import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { consoleBuffer, BufferedConsoleMessage, BufferedConsoleException } from './console-buffer';

const DEFAULT_MAX_MESSAGES = 100;

type ConsoleMode = 'snapshot' | 'buffer';

interface ConsoleToolParams {
  url?: string;
  tabId?: number;
  background?: boolean;
  windowId?: number;
  includeExceptions?: boolean;
  maxMessages?: number;
  // 新增参数
  mode?: ConsoleMode;
  buffer?: boolean; // mode="buffer" 的别名
  clear?: boolean; // 读取前清空
  clearAfterRead?: boolean; // 读取后清空（mcp-tools.js 风格）
  pattern?: string;
  onlyErrors?: boolean;
  limit?: number;
}

interface ConsoleMessage {
  timestamp: number;
  level: string;
  text: string;
  args?: any[];
  argsSerialized?: any[];
  source?: string;
  url?: string;
  lineNumber?: number;
  stackTrace?: any;
}

interface ConsoleException {
  timestamp: number;
  text: string;
  url?: string;
  lineNumber?: number;
  columnNumber?: number;
  stackTrace?: any;
}

interface ConsoleResult {
  success: boolean;
  message: string;
  tabId: number;
  tabUrl: string;
  tabTitle: string;
  captureStartTime: number;
  captureEndTime: number;
  totalDurationMs: number;
  messages: ConsoleMessage[];
  exceptions: ConsoleException[];
  messageCount: number;
  exceptionCount: number;
  messageLimitReached: boolean;
  droppedMessageCount: number;
  droppedExceptionCount: number;
}

// 辅助函数

function normalizeLimit(value: unknown, fallback: number): number {
  const n = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : fallback;
  return Math.max(0, n);
}

function parseRegexPattern(pattern?: string): RegExp | undefined {
  if (typeof pattern !== 'string') return undefined;
  const trimmed = pattern.trim();
  if (!trimmed) return undefined;
  // 支持 /pattern/flags 语法
  const match = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    return match ? new RegExp(match[1], match[2]) : new RegExp(trimmed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid regex pattern: ${msg}`);
  }
}

function matchesPattern(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

function isErrorLevel(level?: string): boolean {
  const normalized = (level || '').toLowerCase();
  return normalized === 'error' || normalized === 'assert';
}

function applyResultFilters(
  result: ConsoleResult,
  options: { pattern?: RegExp; onlyErrors?: boolean; includeExceptions: boolean },
): ConsoleResult {
  const { pattern, onlyErrors = false, includeExceptions } = options;

  let messages = result.messages;
  if (onlyErrors) {
    messages = messages.filter((m) => isErrorLevel(m.level));
  }
  if (pattern) {
    messages = messages.filter((m) => matchesPattern(pattern, m.text || ''));
  }

  let exceptions = includeExceptions ? result.exceptions : [];
  if (includeExceptions && pattern) {
    exceptions = exceptions.filter((e) => matchesPattern(pattern, e.text || ''));
  }

  return {
    ...result,
    messages,
    exceptions,
    messageCount: messages.length,
    exceptionCount: exceptions.length,
  };
}

function isDebuggerConflictError(error: unknown): boolean {
  const msg = (error instanceof Error ? error.message : String(error)).toLowerCase();
  return msg.includes('debugger is already attached') || msg.includes('another client');
}

function formatDebuggerConflictMessage(tabId: number, originalMessage: string): string {
  return (
    `Failed to attach Chrome Debugger to tab ${tabId}: another debugger client is already attached ` +
    `(likely DevTools or another extension). Close DevTools for this tab or disable the conflicting extension, ` +
    `then retry. Original error: ${originalMessage}`
  );
}

/**
 * Tool for capturing console output from browser tabs
 */
class ConsoleTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.CONSOLE;

  async execute(args: ConsoleToolParams): Promise<ToolResult> {
    const {
      url,
      tabId,
      windowId,
      background,
      includeExceptions = true,
      maxMessages = DEFAULT_MAX_MESSAGES,
      mode = 'snapshot',
      buffer,
      clear = false,
      clearAfterRead = false,
      pattern,
      onlyErrors = false,
      limit,
    } = args;
    const stayBackground = this.stayInBackground(background);

    let targetTab: chrome.tabs.Tab;
    let targetTabId: number | undefined;

    // 解析正则表达式
    let compiledPattern: RegExp | undefined;
    try {
      compiledPattern = parseRegexPattern(pattern);
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      return createErrorResponse(msg);
    }

    try {
      if (typeof tabId === 'number') {
        // Use explicit tab
        const t = await chrome.tabs.get(tabId);
        if (!t?.id) return createErrorResponse('Failed to identify target tab.');
        targetTab = t;
      } else if (url) {
        // Navigate to the specified URL
        targetTab = await this.navigateToUrl(url, stayBackground, windowId);
      } else {
        // Use current active tab
        const [activeTab] =
          typeof windowId === 'number'
            ? await chrome.tabs.query({ active: true, windowId })
            : await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab?.id) {
          return createErrorResponse('No active tab found and no URL provided.');
        }
        targetTab = activeTab;
      }

      if (!targetTab?.id) {
        return createErrorResponse('Failed to identify target tab.');
      }

      targetTabId = targetTab.id;

      // 确定模式：buffer 参数是 mode="buffer" 的别名
      const resolvedMode: ConsoleMode =
        mode === 'buffer' || buffer === true ? 'buffer' : 'snapshot';

      // 计算有效的消息限制
      const normalizedMaxMessages = normalizeLimit(maxMessages, DEFAULT_MAX_MESSAGES);
      const effectiveLimit =
        typeof limit === 'number'
          ? normalizeLimit(limit, normalizedMaxMessages)
          : normalizedMaxMessages;

      // Buffer 模式
      if (resolvedMode === 'buffer') {
        try {
          await consoleBuffer.ensureStarted(targetTabId);
        } catch (error: unknown) {
          const msg = error instanceof Error ? error.message : String(error);
          if (isDebuggerConflictError(error)) {
            return createErrorResponse(formatDebuggerConflictMessage(targetTabId, msg));
          }
          throw error;
        }

        // 处理读取前清空请求
        let clearedBefore: { clearedMessages: number; clearedExceptions: number } | null = null;
        if (clear === true) {
          clearedBefore = consoleBuffer.clear(targetTabId, 'manual');
        }

        // 读取缓冲区
        const read = consoleBuffer.read(targetTabId, {
          pattern: compiledPattern,
          onlyErrors,
          limit: effectiveLimit,
          includeExceptions,
        });

        if (!read) {
          return createErrorResponse('Console buffer is not available for this tab.');
        }

        // 处理读取后清空请求（mcp-tools.js 风格，避免重复读取）
        let clearedAfter: { clearedMessages: number; clearedExceptions: number } | null = null;
        if (clearAfterRead === true) {
          clearedAfter = consoleBuffer.clear(targetTabId, 'manual');
        }

        // 构建清空摘要
        let clearedSummary = '';
        if (clearedBefore) {
          clearedSummary += ` Cleared ${clearedBefore.clearedMessages} messages and ${clearedBefore.clearedExceptions} exceptions before reading.`;
        }
        if (clearedAfter) {
          clearedSummary += ` Cleared ${clearedAfter.clearedMessages} messages and ${clearedAfter.clearedExceptions} exceptions after reading.`;
        }

        const result: ConsoleResult = {
          success: true,
          message:
            `Console buffer read for tab ${targetTabId}.` +
            clearedSummary +
            ` Returned ${read.messageCount} messages and ${read.exceptionCount} exceptions.`,
          tabId: targetTabId,
          tabUrl: read.tabUrl || '',
          tabTitle: read.tabTitle || '',
          captureStartTime: read.captureStartTime,
          captureEndTime: read.captureEndTime,
          totalDurationMs: read.totalDurationMs,
          messages: read.messages as ConsoleMessage[],
          exceptions: read.exceptions as ConsoleException[],
          messageCount: read.messageCount,
          exceptionCount: read.exceptionCount,
          messageLimitReached: read.messageLimitReached,
          droppedMessageCount: read.droppedMessageCount,
          droppedExceptionCount: read.droppedExceptionCount,
        };

        return {
          content: [{ type: 'text', text: JSON.stringify(result) }],
          isError: false,
        };
      }

      // Snapshot 模式（一次性捕获）
      const result = await this.captureConsoleMessages(targetTabId, {
        includeExceptions,
        maxMessages: effectiveLimit,
      });

      // 应用过滤器
      const filtered = applyResultFilters(result, {
        pattern: compiledPattern,
        onlyErrors,
        includeExceptions,
      });

      return {
        content: [{ type: 'text', text: JSON.stringify(filtered) }],
        isError: false,
      };
    } catch (error: unknown) {
      console.error('ConsoleTool: Critical error during execute:', error);
      const msg = error instanceof Error ? error.message : String(error);
      if (typeof targetTabId === 'number' && isDebuggerConflictError(error)) {
        return createErrorResponse(formatDebuggerConflictMessage(targetTabId, msg));
      }
      return createErrorResponse(`Error in ConsoleTool: ${msg}`);
    }
  }

  private async navigateToUrl(
    url: string,
    stayBackground = true,
    windowId?: number,
  ): Promise<chrome.tabs.Tab> {
    // Check if URL is already open
    const existingTabs = await chrome.tabs.query({ url });

    if (existingTabs.length > 0 && existingTabs[0]?.id) {
      const tab = existingTabs[0];
      if (!stayBackground) {
        // Activate the existing tab
        await chrome.tabs.update(tab.id!, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }
      return tab;
    } else {
      // Create new tab with the URL
      const createInfo: chrome.tabs.CreateProperties = { url, active: !stayBackground };
      if (typeof windowId === 'number') createInfo.windowId = windowId;
      const newTab = await chrome.tabs.create(createInfo);
      // Wait for tab to be ready
      await this.waitForTabReady(newTab.id!);
      return newTab;
    }
  }

  private async waitForTabReady(tabId: number): Promise<void> {
    return new Promise((resolve) => {
      const checkTab = async () => {
        try {
          const tab = await chrome.tabs.get(tabId);
          if (tab.status === 'complete') {
            resolve();
          } else {
            setTimeout(checkTab, 100);
          }
        } catch (error) {
          // Tab might be closed, resolve anyway
          resolve();
        }
      };
      checkTab();
    });
  }

  private formatConsoleArgs(args: any[]): string {
    if (!args || args.length === 0) return '';

    return args
      .map((arg) => {
        if (arg.type === 'string') {
          return arg.value || '';
        } else if (arg.type === 'number') {
          return String(arg.value || '');
        } else if (arg.type === 'boolean') {
          return String(arg.value || '');
        } else if (arg.type === 'object') {
          return arg.description || '[Object]';
        } else if (arg.type === 'undefined') {
          return 'undefined';
        } else if (arg.type === 'function') {
          return arg.description || '[Function]';
        } else {
          return arg.description || arg.value || String(arg);
        }
      })
      .join(' ');
  }

  private async captureConsoleMessages(
    tabId: number,
    options: {
      includeExceptions: boolean;
      maxMessages: number;
    },
  ): Promise<ConsoleResult> {
    const { includeExceptions, maxMessages } = options;
    const startTime = Date.now();
    const messages: ConsoleMessage[] = [];
    const exceptions: ConsoleException[] = [];
    let limitReached = false;

    try {
      // Get tab information
      const tab = await chrome.tabs.get(tabId);

      // Attach via shared manager
      await cdpSessionManager.attach(tabId, 'console');

      // Set up event listener to collect messages
      const collectedMessages: any[] = [];
      const collectedExceptions: any[] = [];

      const eventListener = (source: chrome.debugger.Debuggee, method: string, params?: any) => {
        if (source.tabId !== tabId) return;

        if (method === 'Log.entryAdded' && params?.entry) {
          collectedMessages.push(params.entry);
        } else if (method === 'Runtime.consoleAPICalled' && params) {
          // Convert Runtime.consoleAPICalled to Log.entryAdded format
          const logEntry = {
            timestamp: params.timestamp,
            level: params.type || 'log',
            text: this.formatConsoleArgs(params.args || []),
            source: 'console-api',
            url: params.stackTrace?.callFrames?.[0]?.url,
            lineNumber: params.stackTrace?.callFrames?.[0]?.lineNumber,
            stackTrace: params.stackTrace,
            args: params.args,
          };
          collectedMessages.push(logEntry);
        } else if (
          method === 'Runtime.exceptionThrown' &&
          includeExceptions &&
          params?.exceptionDetails
        ) {
          collectedExceptions.push(params.exceptionDetails);
        }
      };

      chrome.debugger.onEvent.addListener(eventListener);

      try {
        // Enable Runtime domain first to capture console API calls and exceptions
        await cdpSessionManager.sendCommand(tabId, 'Runtime.enable');

        // Also enable Log domain to capture other log entries
        await cdpSessionManager.sendCommand(tabId, 'Log.enable');

        // Wait for all messages to be flushed
        await new Promise((resolve) => setTimeout(resolve, 2000));

        // Process collected messages
        // Helper to deeply serialize console arguments when possible
        const serializeArg = async (arg: any): Promise<any> => {
          try {
            if (!arg) return arg;
            if (Object.prototype.hasOwnProperty.call(arg, 'unserializableValue')) {
              return arg.unserializableValue;
            }
            if (Object.prototype.hasOwnProperty.call(arg, 'value')) {
              return arg.value;
            }
            if (arg.objectId) {
              const resp = await cdpSessionManager.sendCommand(tabId, 'Runtime.callFunctionOn', {
                objectId: arg.objectId,
                functionDeclaration:
                  'function(maxDepth, maxProps){\n' +
                  '  const seen=new WeakSet();\n' +
                  '  function S(v,d){\n' +
                  '    try{\n' +
                  '      if(d<0) return "[MaxDepth]";\n' +
                  '      if(v===null) return null;\n' +
                  '      const t=typeof v;\n' +
                  '      if(t!=="object"){\n' +
                  '        if(t==="bigint") return v.toString()+"n";\n' +
                  '        return v;\n' +
                  '      }\n' +
                  '      if(seen.has(v)) return "[Circular]";\n' +
                  '      seen.add(v);\n' +
                  '      if(Array.isArray(v)){\n' +
                  '        const out=[];\n' +
                  '        for(let i=0;i<v.length;i++){\n' +
                  '          if(i>=maxProps){ out.push("[...truncated]"); break; }\n' +
                  '          out.push(S(v[i], d-1));\n' +
                  '        }\n' +
                  '        return out;\n' +
                  '      }\n' +
                  '      if(v instanceof Date) return {__type:"Date", value:v.toISOString()};\n' +
                  '      if(v instanceof RegExp) return {__type:"RegExp", value:String(v)};\n' +
                  '      if(v instanceof Map){\n' +
                  '        const out={__type:"Map", entries:[]}; let c=0;\n' +
                  '        for(const [k,val] of v.entries()){\n' +
                  '          if(c++>=maxProps){ out.entries.push(["[...truncated]","[...truncated]"]); break; }\n' +
                  '          out.entries.push([S(k,d-1), S(val,d-1)]);\n' +
                  '        }\n' +
                  '        return out;\n' +
                  '      }\n' +
                  '      if(v instanceof Set){\n' +
                  '        const out={__type:"Set", values:[]}; let c=0;\n' +
                  '        for(const val of v.values()){\n' +
                  '          if(c++>=maxProps){ out.values.push("[...truncated]"); break; }\n' +
                  '          out.values.push(S(val,d-1));\n' +
                  '        }\n' +
                  '        return out;\n' +
                  '      }\n' +
                  '      const out={}; let c=0;\n' +
                  '      for(const key in v){\n' +
                  '        if(c++>=maxProps){ out.__truncated__=true; break; }\n' +
                  '        try{ out[key]=S(v[key], d-1); }catch(e){ out[key]="[Thrown]"; }\n' +
                  '      }\n' +
                  '      return out;\n' +
                  '    }catch(e){ return "[Unserializable]" }\n' +
                  '  }\n' +
                  '  return S(this, maxDepth);\n' +
                  '}',
                arguments: [{ value: 3 }, { value: 100 }],
                silent: true,
                returnByValue: true,
              });
              return resp?.result?.value ?? '[Unavailable]';
            }
            return '[Unknown]';
          } catch (e) {
            return '[SerializeError]';
          }
        };

        for (const entry of collectedMessages) {
          if (messages.length >= maxMessages) {
            limitReached = true;
            break;
          }

          const message: ConsoleMessage = {
            timestamp: entry.timestamp,
            level: entry.level || 'log',
            text: entry.text || '',
            source: entry.source,
            url: entry.url,
            lineNumber: entry.lineNumber,
          };

          if (entry.stackTrace) {
            message.stackTrace = entry.stackTrace;
          }

          if (entry.args && Array.isArray(entry.args)) {
            message.args = entry.args;
            // Attempt deep serialization for better fidelity
            const serialized: any[] = [];
            for (const a of entry.args) {
              serialized.push(await serializeArg(a));
            }
            message.argsSerialized = serialized;
          }

          messages.push(message);
        }

        // Process collected exceptions
        for (const exceptionDetails of collectedExceptions) {
          const exception: ConsoleException = {
            timestamp: Date.now(),
            text:
              exceptionDetails.text ||
              exceptionDetails.exception?.description ||
              'Unknown exception',
            url: exceptionDetails.url,
            lineNumber: exceptionDetails.lineNumber,
            columnNumber: exceptionDetails.columnNumber,
          };

          if (exceptionDetails.stackTrace) {
            exception.stackTrace = exceptionDetails.stackTrace;
          }

          exceptions.push(exception);
        }
      } finally {
        // Clean up
        chrome.debugger.onEvent.removeListener(eventListener);

        // 如果 buffer 模式正在使用这个 tab，不要关闭 Runtime/Log 域
        const keepDomainsEnabled = consoleBuffer.isCapturing(tabId);
        if (!keepDomainsEnabled) {
          try {
            await cdpSessionManager.sendCommand(tabId, 'Runtime.disable');
          } catch (e) {
            console.warn(`ConsoleTool: Error disabling Runtime for tab ${tabId}:`, e);
          }

          try {
            await cdpSessionManager.sendCommand(tabId, 'Log.disable');
          } catch (e) {
            console.warn(`ConsoleTool: Error disabling Log for tab ${tabId}:`, e);
          }
        }

        try {
          await cdpSessionManager.detach(tabId, 'console');
        } catch (e) {
          console.warn(`ConsoleTool: Error detaching debugger for tab ${tabId}:`, e);
        }
      }

      const endTime = Date.now();

      // Sort messages by timestamp
      messages.sort((a, b) => a.timestamp - b.timestamp);
      exceptions.sort((a, b) => a.timestamp - b.timestamp);

      return {
        success: true,
        message: `Console capture completed for tab ${tabId}. ${messages.length} messages, ${exceptions.length} exceptions captured.`,
        tabId,
        tabUrl: tab.url || '',
        tabTitle: tab.title || '',
        captureStartTime: startTime,
        captureEndTime: endTime,
        totalDurationMs: endTime - startTime,
        messages,
        exceptions,
        messageCount: messages.length,
        exceptionCount: exceptions.length,
        messageLimitReached: limitReached,
        droppedMessageCount: 0,
        droppedExceptionCount: 0,
      };
    } catch (error: any) {
      console.error(`ConsoleTool: Error capturing console messages for tab ${tabId}:`, error);
      throw error;
    }
  }
}

export const consoleTool = new ConsoleTool();
