import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { exceptionMatchesFilters, messageMatchesFilters } from './console-filters';

/**
 * ConsoleBuffer - 持久化的控制台日志缓冲管理器
 *
 * 为每个 tab 维护一个滚动缓冲区，持续收集控制台事件。
 * 当 tab 导航到新域名时会自动清空缓冲，避免不同站点日志混淆。
 */

const DEFAULT_MAX_BUFFER_MESSAGES = 2000;
const DEFAULT_MAX_BUFFER_EXCEPTIONS = 500;

export interface BufferedConsoleMessage {
  timestamp: number;
  level: string;
  text: string;
  args?: unknown[];
  source?: string;
  url?: string;
  lineNumber?: number;
  stackTrace?: unknown;
}

export interface BufferedConsoleException {
  timestamp: number;
  text: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: unknown;
}

interface TabConsoleBufferState {
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  hostname: string;
  captureStartTime: number;
  messages: BufferedConsoleMessage[];
  exceptions: BufferedConsoleException[];
  droppedMessageCount: number;
  droppedExceptionCount: number;
}

export interface ConsoleBufferReadOptions {
  pattern?: RegExp;
  onlyErrors?: boolean;
  /** Only return messages whose normalized level is in this set */
  levels?: ReadonlySet<string>;
  /** Only return messages/exceptions with timestamp >= since (epoch ms) */
  since?: number;
  limit?: number;
  includeExceptions?: boolean;
}

export interface ConsoleBufferReadResult {
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  captureStartTime: number;
  captureEndTime: number;
  totalDurationMs: number;
  messages: BufferedConsoleMessage[];
  exceptions: BufferedConsoleException[];
  totalBufferedMessages: number;
  totalBufferedExceptions: number;
  messageCount: number;
  exceptionCount: number;
  messageLimitReached: boolean;
  droppedMessageCount: number;
  droppedExceptionCount: number;
}

function extractHostname(url?: string): string {
  if (!url) return '';
  try {
    return new URL(url).hostname;
  } catch {
    return '';
  }
}

function formatConsoleArgs(args: unknown[]): string {
  if (!args || args.length === 0) return '';

  return args
    .map((arg: unknown) => {
      const a = arg as Record<string, unknown>;
      if (a.type === 'string') return (a.value as string) || '';
      if (a.type === 'number') return String(a.value ?? '');
      if (a.type === 'boolean') return String(a.value ?? '');
      if (a.type === 'object') return (a.description as string) || '[Object]';
      if (a.type === 'undefined') return 'undefined';
      if (a.type === 'function') return (a.description as string) || '[Function]';
      return (a.description as string) || (a.value as string) || String(arg);
    })
    .join(' ');
}

/**
 * 从 CDP RemoteObject 提取安全的预览数据，丢弃 objectId 避免内存泄漏
 */
function extractArgPreview(arg: unknown): unknown {
  const a = arg as Record<string, unknown>;
  if (!a || typeof a !== 'object') return arg;

  // 只保留安全的字段，丢弃 objectId
  const preview: Record<string, unknown> = {
    type: a.type,
  };

  if ('value' in a) preview.value = a.value;
  if ('unserializableValue' in a) preview.unserializableValue = a.unserializableValue;
  if ('description' in a) preview.description = a.description;
  if ('subtype' in a) preview.subtype = a.subtype;
  if ('className' in a) preview.className = a.className;

  return preview;
}

function safeTimestamp(value: unknown): number {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return Date.now();
}

function safeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function safeNumber(value: unknown): number | undefined {
  return typeof value === 'number' ? value : undefined;
}

class ConsoleBuffer {
  private buffers = new Map<number, TabConsoleBufferState>();
  private starting = new Map<number, Promise<void>>();
  private static instance: ConsoleBuffer | null = null;

  constructor() {
    if (ConsoleBuffer.instance) {
      return ConsoleBuffer.instance;
    }
    ConsoleBuffer.instance = this;

    chrome.debugger.onEvent.addListener(this.handleDebuggerEvent.bind(this));
    chrome.debugger.onDetach.addListener(this.handleDebuggerDetach.bind(this));
    chrome.tabs.onRemoved.addListener(this.handleTabRemoved.bind(this));
    chrome.tabs.onUpdated.addListener(this.handleTabUpdated.bind(this));
  }

  /**
   * 检查指定 tab 是否正在进行 buffer 模式的捕获
   */
  isCapturing(tabId: number): boolean {
    return this.buffers.has(tabId);
  }

  /**
   * 确保指定 tab 的 buffer 捕获已启动
   */
  async ensureStarted(tabId: number): Promise<void> {
    if (this.buffers.has(tabId)) return;

    const existing = this.starting.get(tabId);
    if (existing) return existing;

    const promise = this.startCapture(tabId).finally(() => {
      this.starting.delete(tabId);
    });
    this.starting.set(tabId, promise);
    return promise;
  }

  /**
   * 清空指定 tab 的缓冲区
   */
  clear(
    tabId: number,
    reason: string = 'manual',
  ): { clearedMessages: number; clearedExceptions: number } | null {
    const state = this.buffers.get(tabId);
    if (!state) return null;

    const clearedMessages = state.messages.length;
    const clearedExceptions = state.exceptions.length;

    state.messages.length = 0;
    state.exceptions.length = 0;
    state.droppedMessageCount = 0;
    state.droppedExceptionCount = 0;
    state.captureStartTime = Date.now();

    console.log(
      `ConsoleBuffer: Cleared buffer for tab ${tabId} (reason=${reason}). ` +
        `${clearedMessages} messages, ${clearedExceptions} exceptions.`,
    );

    return { clearedMessages, clearedExceptions };
  }

  /**
   * 读取指定 tab 的缓冲区内容
   */
  read(tabId: number, options: ConsoleBufferReadOptions = {}): ConsoleBufferReadResult | null {
    const state = this.buffers.get(tabId);
    if (!state) return null;

    const { pattern, onlyErrors = false, levels, since, limit, includeExceptions = true } = options;
    const filters = { pattern, onlyErrors, levels, since };

    const totalBufferedMessages = state.messages.length;
    const totalBufferedExceptions = state.exceptions.length;

    // 过滤消息
    let messages = state.messages.filter((m) => messageMatchesFilters(m, filters));

    // 按时间排序
    messages = [...messages].sort((a, b) => a.timestamp - b.timestamp);

    // 应用 limit
    let messageLimitReached = false;
    const normalizedLimit =
      typeof limit === 'number' && Number.isFinite(limit) ? Math.max(0, Math.floor(limit)) : null;
    if (normalizedLimit !== null && messages.length > normalizedLimit) {
      messageLimitReached = true;
      // 保留最新的消息
      messages = messages.slice(messages.length - normalizedLimit);
    }

    // 过滤异常
    let exceptions: BufferedConsoleException[] = [];
    if (includeExceptions) {
      exceptions = state.exceptions.filter((e) => exceptionMatchesFilters(e, filters));
      exceptions = [...exceptions].sort((a, b) => a.timestamp - b.timestamp);
    }

    const now = Date.now();

    return {
      tabId,
      tabUrl: state.tabUrl,
      tabTitle: state.tabTitle,
      captureStartTime: state.captureStartTime,
      captureEndTime: now,
      totalDurationMs: now - state.captureStartTime,
      messages,
      exceptions,
      totalBufferedMessages,
      totalBufferedExceptions,
      messageCount: messages.length,
      exceptionCount: exceptions.length,
      messageLimitReached,
      droppedMessageCount: state.droppedMessageCount,
      droppedExceptionCount: state.droppedExceptionCount,
    };
  }

  private async startCapture(tabId: number): Promise<void> {
    const tab = await chrome.tabs.get(tabId);
    const url = tab.url || '';
    const title = tab.title || '';
    const hostname = extractHostname(url);

    const state: TabConsoleBufferState = {
      tabId,
      tabUrl: url,
      tabTitle: title,
      hostname,
      captureStartTime: Date.now(),
      messages: [],
      exceptions: [],
      droppedMessageCount: 0,
      droppedExceptionCount: 0,
    };

    this.buffers.set(tabId, state);

    try {
      await cdpSessionManager.attach(tabId, 'console-buffer');
      await cdpSessionManager.sendCommand(tabId, 'Runtime.enable');
      await cdpSessionManager.sendCommand(tabId, 'Log.enable');
    } catch (error) {
      this.buffers.delete(tabId);
      await cdpSessionManager.detach(tabId, 'console-buffer').catch(() => {});
      throw error;
    }
  }

  private handleTabRemoved(tabId: number): void {
    if (!this.buffers.has(tabId)) return;
    void this.stopCapture(tabId, 'tab_closed');
  }

  private handleTabUpdated(
    tabId: number,
    changeInfo: chrome.tabs.TabChangeInfo,
    tab: chrome.tabs.Tab,
  ): void {
    const state = this.buffers.get(tabId);
    if (!state) return;

    const nextUrl = changeInfo.url ?? tab.url;
    const nextTitle = tab.title;

    if (typeof nextUrl === 'string') {
      const nextHost = extractHostname(nextUrl);
      // 域名变化时清空缓冲
      if (nextHost !== state.hostname) {
        this.clear(tabId, 'domain_changed');
        state.hostname = nextHost;
      }
      state.tabUrl = nextUrl;
    }

    if (typeof nextTitle === 'string') {
      state.tabTitle = nextTitle;
    }
  }

  private handleDebuggerDetach(source: chrome.debugger.Debuggee, reason: string): void {
    if (typeof source.tabId !== 'number') return;
    if (!this.buffers.has(source.tabId)) return;

    console.log(
      `ConsoleBuffer: Debugger detached from tab ${source.tabId} (reason=${reason}), cleaning up.`,
    );

    this.buffers.delete(source.tabId);
    this.starting.delete(source.tabId);
    cdpSessionManager.detach(source.tabId, 'console-buffer').catch(() => {});
  }

  private handleDebuggerEvent(
    source: chrome.debugger.Debuggee,
    method: string,
    params?: unknown,
  ): void {
    const tabId = source.tabId;
    if (typeof tabId !== 'number') return;

    const state = this.buffers.get(tabId);
    if (!state) return;

    const p = params as Record<string, unknown>;

    if (method === 'Log.entryAdded' && p?.entry) {
      const entry = p.entry as Record<string, unknown>;
      state.messages.push({
        timestamp: safeTimestamp(entry.timestamp),
        level: safeString(entry.level) || 'log',
        text: safeString(entry.text),
        source: safeString(entry.source),
        url: safeString(entry.url),
        lineNumber: safeNumber(entry.lineNumber),
        stackTrace: entry.stackTrace,
      });
      this.trimMessages(state);
      return;
    }

    if (method === 'Runtime.consoleAPICalled' && p) {
      const stackTrace = p.stackTrace as Record<string, unknown[]> | undefined;
      const callFrame = stackTrace?.callFrames?.[0] as Record<string, unknown> | undefined;
      const rawArgs = (p.args as unknown[]) || [];

      state.messages.push({
        timestamp: safeTimestamp(p.timestamp),
        level: safeString(p.type) || 'log',
        text: formatConsoleArgs(rawArgs),
        source: 'console-api',
        url: safeString(callFrame?.url),
        lineNumber: safeNumber(callFrame?.lineNumber),
        stackTrace: stackTrace,
        // 只存储安全的预览数据，避免内存泄漏
        args: rawArgs.map(extractArgPreview),
      });
      this.trimMessages(state);
      return;
    }

    if (method === 'Runtime.exceptionThrown' && p?.exceptionDetails) {
      const exceptionDetails = p.exceptionDetails as Record<string, unknown>;
      const exception = exceptionDetails.exception as Record<string, unknown> | undefined;
      state.exceptions.push({
        timestamp: safeTimestamp(p.timestamp),
        text:
          safeString(exceptionDetails.text) ||
          safeString(exception?.description) ||
          'Unknown exception',
        url: safeString(exceptionDetails.url),
        lineNumber: safeNumber(exceptionDetails.lineNumber),
        columnNumber: safeNumber(exceptionDetails.columnNumber),
        stackTrace: exceptionDetails.stackTrace,
      });
      this.trimExceptions(state);
    }
  }

  private trimMessages(state: TabConsoleBufferState): void {
    const overflow = state.messages.length - DEFAULT_MAX_BUFFER_MESSAGES;
    if (overflow <= 0) return;
    state.messages.splice(0, overflow);
    state.droppedMessageCount += overflow;
  }

  private trimExceptions(state: TabConsoleBufferState): void {
    const overflow = state.exceptions.length - DEFAULT_MAX_BUFFER_EXCEPTIONS;
    if (overflow <= 0) return;
    state.exceptions.splice(0, overflow);
    state.droppedExceptionCount += overflow;
  }

  private async stopCapture(tabId: number, reason: string): Promise<void> {
    if (!this.buffers.has(tabId)) return;

    this.buffers.delete(tabId);
    this.starting.delete(tabId);

    try {
      await cdpSessionManager.sendCommand(tabId, 'Runtime.disable');
    } catch {
      // best effort
    }
    try {
      await cdpSessionManager.sendCommand(tabId, 'Log.disable');
    } catch {
      // best effort
    }
    await cdpSessionManager.detach(tabId, 'console-buffer').catch(() => {});
    console.log(`ConsoleBuffer: Stopped buffer for tab ${tabId} (reason=${reason}).`);
  }
}

export const consoleBuffer = new ConsoleBuffer();
