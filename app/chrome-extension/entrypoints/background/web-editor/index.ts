import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import {
  WEB_EDITOR_V2_ACTIONS,
  WEB_EDITOR_V1_ACTIONS,
  type ElementChangeSummary,
  type WebEditorApplyBatchPayload,
  type WebEditorTxChangedPayload,
  type WebEditorHighlightElementPayload,
  type WebEditorRevertElementPayload,
  type WebEditorCancelExecutionPayload,
  type WebEditorCancelExecutionResponse,
} from '@/common/web-editor-types';
import { openAgentChatSidepanel } from '../utils/sidepanel';

const CONTEXT_MENU_ID = 'web_editor_toggle';
const COMMAND_KEY = 'toggle_web_editor';
const DEFAULT_NATIVE_SERVER_PORT = 12306;

/** Storage key prefix for TX change session data (per-tab isolation) */
const WEB_EDITOR_TX_CHANGED_SESSION_KEY_PREFIX = 'web-editor-v2-tx-changed-';
const WEB_EDITOR_SELECTION_SESSION_KEY_PREFIX = 'web-editor-v2-selection-';

/** Storage key prefix for excluded element keys (per-tab isolation, managed by sidepanel) */
const WEB_EDITOR_EXCLUDED_KEYS_SESSION_KEY_PREFIX = 'web-editor-v2-excluded-keys-';

/** Storage key for AgentChat selected session ID */
const STORAGE_KEY_SELECTED_SESSION = 'agent-selected-session-id';

// In-memory execution status cache (per requestId)
interface ExecutionStatusEntry {
  status: string;
  message?: string;
  updatedAt: number;
  result?: { success: boolean; summary?: string; error?: string };
}
const executionStatusCache = new Map<string, ExecutionStatusEntry>();
const STATUS_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

function cleanupExpiredStatuses(): void {
  const now = Date.now();
  for (const [key, entry] of executionStatusCache) {
    if (now - entry.updatedAt > STATUS_CACHE_TTL) {
      executionStatusCache.delete(key);
    }
  }
}

function setExecutionStatus(
  requestId: string,
  status: string,
  message?: string,
  result?: ExecutionStatusEntry['result'],
): void {
  executionStatusCache.set(requestId, {
    status,
    message,
    updatedAt: Date.now(),
    result,
  });
  // Periodic cleanup
  if (executionStatusCache.size > 100) {
    cleanupExpiredStatuses();
  }
}

function getExecutionStatus(requestId: string): ExecutionStatusEntry | undefined {
  return executionStatusCache.get(requestId);
}

// SSE connections for status updates (per sessionId)
const sseConnections = new Map<string, { abort: AbortController; lastRequestId: string }>();

/**
 * Start SSE subscription for a session to receive status updates
 */
async function subscribeToSessionStatus(
  sessionId: string,
  requestId: string,
  port: number,
): Promise<void> {
  // Close existing connection for this session if any
  const existing = sseConnections.get(sessionId);
  if (existing) {
    existing.abort.abort();
    sseConnections.delete(sessionId);
  }

  const abortController = new AbortController();
  sseConnections.set(sessionId, { abort: abortController, lastRequestId: requestId });

  // Set initial status
  setExecutionStatus(requestId, 'starting', 'Connecting to Agent...');

  const sseUrl = `http://127.0.0.1:${port}/agent/chat/${encodeURIComponent(sessionId)}/stream`;

  try {
    const response = await fetch(sseUrl, {
      method: 'GET',
      headers: { Accept: 'text/event-stream' },
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      setExecutionStatus(requestId, 'running', 'Agent processing...');
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    setExecutionStatus(requestId, 'running', 'Agent processing...');

    // Read SSE stream

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split('\n');
      buffer = lines.pop() ?? '';

      for (const line of lines) {
        if (line.startsWith('data:')) {
          try {
            const data = JSON.parse(line.slice(5).trim());
            handleSseEvent(requestId, data);
          } catch {
            // Ignore parse errors
          }
        }
      }
    }
  } catch (err) {
    if (err instanceof Error && err.name === 'AbortError') {
      // Intentionally aborted, not an error
      return;
    }
    // Connection error - mark as unknown but not failed (Agent may still be running)
    const cached = getExecutionStatus(requestId);
    if (cached && !['completed', 'failed', 'cancelled'].includes(cached.status)) {
      setExecutionStatus(requestId, 'running', 'Agent processing (connection lost)...');
    }
  } finally {
    sseConnections.delete(sessionId);
  }
}

/**
 * Handle SSE event from Agent stream
 */
function handleSseEvent(requestId: string, event: unknown): void {
  if (!event || typeof event !== 'object') return;
  const e = event as Record<string, unknown>;
  const type = e.type;
  const data = e.data as Record<string, unknown> | undefined;

  // Check if this event is for our request
  const eventRequestId = data?.requestId as string | undefined;
  if (eventRequestId && eventRequestId !== requestId) return;

  if (type === 'status' && data) {
    const status = data.status as string;
    const message = data.message as string | undefined;

    // Map Agent status to our status
    // - 'ready' -> 'running' (ready is a running sub-state)
    // - 'error' -> 'failed' (normalize server 'error' to UI 'failed')
    let mappedStatus = status;
    if (status === 'ready') mappedStatus = 'running';
    if (status === 'error') mappedStatus = 'failed';

    setExecutionStatus(requestId, mappedStatus, message);
  } else if (type === 'message' && data) {
    // Update status to show we're receiving messages
    const cached = getExecutionStatus(requestId);
    if (cached && cached.status === 'starting') {
      setExecutionStatus(requestId, 'running', 'Agent is working...');
    }

    // Check for completion indicators in message content
    const role = data.role as string | undefined;
    const isFinal = data.isFinal as boolean | undefined;
    if (role === 'assistant' && isFinal) {
      const content = data.content as string | undefined;
      setExecutionStatus(requestId, 'completed', 'Completed', {
        success: true,
        summary: content?.slice(0, 200),
      });
    }
  } else if (type === 'error') {
    const errorMsg = (e.error as string) || 'Unknown error';
    setExecutionStatus(requestId, 'failed', errorMsg, {
      success: false,
      error: errorMsg,
    });
  }
}

/**
 * Web Editor version configuration
 * - v1: Legacy inject-scripts/web-editor.js (IIFE, ~850 lines)
 * - v2: New TypeScript-based web-editor-v2.js (WXT unlisted script)
 *
 * Set USE_WEB_EDITOR_V2 to true to enable v2.
 * This flag allows gradual rollout and easy rollback.
 */
const USE_WEB_EDITOR_V2 = true;

/** Script path for v1 (legacy) */
const V1_SCRIPT_PATH = 'inject-scripts/web-editor.js';

/** Script path for v2 (WXT unlisted script output) */
const V2_SCRIPT_PATH = 'web-editor-v2.js';

/** Script path for Phase 7 props agent (MAIN world) */
const PROPS_AGENT_SCRIPT_PATH = 'inject-scripts/props-agent.js';

type WebEditorInstructionType = 'update_text' | 'update_style';

interface WebEditorFingerprint {
  tag: string;
  id?: string;
  classes: string[];
  text?: string;
}

/** Debug source from React/Vue fiber (file, line, component name) */
interface DebugSource {
  file: string;
  line?: number;
  column?: number;
  componentName?: string;
}

/** Style operation details (before/after diff) */
interface StyleOperation {
  type: 'update_style';
  before: Record<string, string>;
  after: Record<string, string>;
  removed: string[];
}

interface WebEditorApplyPayload {
  pageUrl: string;
  targetFile?: string;
  fingerprint: WebEditorFingerprint;
  techStackHint?: string[];
  instruction: {
    type: WebEditorInstructionType;
    description: string;
    text?: string;
    style?: Record<string, string>;
  };

  // V2 extended fields (best-effort, optional)
  selectorCandidates?: string[];
  debugSource?: DebugSource;
  operation?: StyleOperation;
}

function normalizeString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function normalizeStringArray(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.map((item) => normalizeString(item)).filter(Boolean);
}

function normalizeStyleMap(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeString(k).trim();
    const val = normalizeString(v).trim();
    if (!key || !val) continue;
    out[key] = val;
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeStyleMapAllowEmpty(value: unknown): Record<string, string> | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
    const key = normalizeString(k).trim();
    if (!key) continue;
    // Allow empty values (represents removed styles)
    out[key] = normalizeString(v).trim();
  }
  return Object.keys(out).length ? out : undefined;
}

function normalizeDebugSource(value: unknown): DebugSource | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  const file = normalizeString(obj.file).trim();
  if (!file) return undefined;

  const source: DebugSource = { file };
  const line = Number(obj.line);
  if (Number.isFinite(line) && line > 0) source.line = line;
  const column = Number(obj.column);
  if (Number.isFinite(column) && column >= 0) source.column = column;
  const componentName = normalizeString(obj.componentName).trim();
  if (componentName) source.componentName = componentName;

  return source;
}

function normalizeOperation(value: unknown): StyleOperation | undefined {
  if (!value || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  if (obj.type !== 'update_style') return undefined;

  const before = normalizeStyleMapAllowEmpty(obj.before);
  const after = normalizeStyleMapAllowEmpty(obj.after);
  const removed = normalizeStringArray(obj.removed);

  if (!before && !after && removed.length === 0) return undefined;

  return {
    type: 'update_style',
    before: before ?? {},
    after: after ?? {},
    removed,
  };
}

function normalizeApplyPayload(raw: unknown): WebEditorApplyPayload {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const pageUrl = normalizeString(obj.pageUrl).trim();
  const targetFile = normalizeString(obj.targetFile).trim() || undefined;
  const techStackHint = normalizeStringArray(obj.techStackHint);

  const fingerprintRaw = (
    obj.fingerprint && typeof obj.fingerprint === 'object' ? obj.fingerprint : {}
  ) as Record<string, unknown>;
  const fingerprint: WebEditorFingerprint = {
    tag: normalizeString(fingerprintRaw.tag).trim() || 'unknown',
    id: normalizeString(fingerprintRaw.id).trim() || undefined,
    classes: normalizeStringArray(fingerprintRaw.classes),
    text: normalizeString(fingerprintRaw.text).trim() || undefined,
  };

  const instructionRaw = (
    obj.instruction && typeof obj.instruction === 'object' ? obj.instruction : {}
  ) as Record<string, unknown>;
  const type = normalizeString(instructionRaw.type).trim() as WebEditorInstructionType;
  if (type !== 'update_text' && type !== 'update_style') {
    throw new Error('Invalid instruction.type');
  }

  const instruction = {
    type,
    description: normalizeString(instructionRaw.description).trim() || '',
    text: normalizeString(instructionRaw.text).trim() || undefined,
    style: normalizeStyleMap(instructionRaw.style),
  };

  if (!pageUrl) {
    throw new Error('pageUrl is required');
  }
  if (!instruction.description) {
    throw new Error('instruction.description is required');
  }

  // V2 extended fields (optional)
  const selectorCandidates = normalizeStringArray(obj.selectorCandidates);
  const debugSource = normalizeDebugSource(obj.debugSource);
  const operation = normalizeOperation(obj.operation);

  return {
    pageUrl,
    targetFile,
    fingerprint,
    techStackHint: techStackHint.length ? techStackHint : undefined,
    instruction,
    selectorCandidates: selectorCandidates.length ? selectorCandidates : undefined,
    debugSource,
    operation,
  };
}

/**
 * Normalize and validate batch apply payload.
 * Runtime validation for WebEditorApplyBatchPayload.
 */
function normalizeApplyBatchPayload(raw: unknown): WebEditorApplyBatchPayload {
  const obj = (raw && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;

  const tabIdRaw = Number(obj.tabId);
  const tabId = Number.isFinite(tabIdRaw) && tabIdRaw > 0 ? tabIdRaw : 0;

  const elements = Array.isArray(obj.elements) ? (obj.elements as ElementChangeSummary[]) : [];

  const excludedKeys = Array.isArray(obj.excludedKeys)
    ? obj.excludedKeys.map((k) => normalizeString(k).trim()).filter((k): k is string => Boolean(k))
    : [];

  const pageUrl = normalizeString(obj.pageUrl).trim() || undefined;

  return { tabId, elements, excludedKeys, pageUrl };
}

/**
 * Build a batch prompt for multiple element changes.
 * Designed for AgentChat integration to apply multiple visual edits at once.
 */
function buildAgentPromptBatch(elements: readonly ElementChangeSummary[], pageUrl: string): string {
  const lines: string[] = [];

  // Header
  lines.push('You are a senior frontend engineer working in a local codebase.');
  lines.push(
    'Goal: persist a batch of visual edits from the browser into the source code with minimal changes.',
  );
  lines.push('');

  // Page context
  lines.push(`Page URL: ${pageUrl}`);
  lines.push('');

  lines.push('## Batch Changes');
  lines.push(`Total elements: ${elements.length}`);
  lines.push('');
  lines.push(
    'For each element, prefer "source" (file/line/component) when available; otherwise use selectors/fingerprint to locate it.',
  );
  lines.push('');

  // Element details
  elements.forEach((element, index) => {
    const title = element.fullLabel || element.label || element.elementKey;
    lines.push(`### ${index + 1}. ${title}`);
    lines.push(`- elementKey: ${element.elementKey}`);
    lines.push(`- change type: ${element.type}`);

    // Debug source (high-confidence location)
    const ds = element.debugSource ?? element.locator?.debugSource;
    if (ds?.file) {
      const loc = ds.line ? `${ds.file}:${ds.line}${ds.column ? `:${ds.column}` : ''}` : ds.file;
      lines.push(`- source: ${loc}${ds.componentName ? ` (${ds.componentName})` : ''}`);
    }

    // Locator hints for fallback
    if (element.locator?.selectors?.length) {
      lines.push('- selectors:');
      for (const sel of element.locator.selectors.slice(0, 5)) {
        lines.push(`  - ${sel}`);
      }
    }
    if (element.locator?.fingerprint) {
      lines.push(`- fingerprint: ${element.locator.fingerprint}`);
    }
    if (Array.isArray(element.locator?.path) && element.locator.path.length > 0) {
      lines.push(`- path: ${JSON.stringify(element.locator.path)}`);
    }
    if (element.locator?.shadowHostChain?.length) {
      lines.push(`- shadowHostChain: ${JSON.stringify(element.locator.shadowHostChain)}`);
    }
    lines.push('');

    // Net effect details
    const net = element.netEffect;
    lines.push('#### Net Effect (apply these final values)');

    if (net.textChange) {
      lines.push('##### Text');
      lines.push(`- before: ${JSON.stringify(net.textChange.before)}`);
      lines.push(`- after: ${JSON.stringify(net.textChange.after)}`);
      lines.push('');
    }

    if (net.classChanges) {
      lines.push('##### Classes');
      lines.push(`- before: ${net.classChanges.before.join(' ')}`);
      lines.push(`- after: ${net.classChanges.after.join(' ')}`);
      lines.push('');
    }

    if (net.styleChanges) {
      lines.push('##### Styles (before → after)');
      const before = net.styleChanges.before ?? {};
      const after = net.styleChanges.after ?? {};
      const allKeys = new Set([...Object.keys(before), ...Object.keys(after)]);
      for (const key of Array.from(allKeys).sort()) {
        const beforeVal = before[key] ?? '(unset)';
        const afterRaw = Object.prototype.hasOwnProperty.call(after, key) ? after[key] : '(unset)';
        const afterVal = afterRaw === '' ? '(removed)' : afterRaw;
        if (beforeVal !== afterVal) {
          lines.push(`- ${key}: "${beforeVal}" → "${afterVal}"`);
        }
      }
      lines.push('');
    }

    // Fallback message if no specific changes
    if (!net.textChange && !net.classChanges && !net.styleChanges) {
      lines.push(
        '- No net effect details available; use locator hints to inspect the element in code.',
      );
      lines.push('');
    }
  });

  // Instructions
  lines.push('## How to Apply');
  lines.push('1. Use "source" when available to go directly to the component file.');
  lines.push('2. Otherwise, use selectors/fingerprint/path to locate the element in the codebase.');
  lines.push('3. Apply the net effect with minimal changes and correct styling conventions.');
  lines.push('4. Avoid generated/bundled outputs; update source files only.');
  lines.push('');

  // Output format
  lines.push('## Constraints');
  lines.push('- Make the smallest safe edit possible for each element');
  lines.push(
    '- If Tailwind/CSS Modules/styled-components are used, update the correct styling source',
  );
  lines.push('- Do not change unrelated behavior or formatting');
  lines.push('');

  lines.push(
    '## Output\nApply all the changes in the repo, then reply with a short summary of what file(s) you modified and the exact changes made.',
  );

  return lines.join('\n');
}

function buildAgentPrompt(payload: WebEditorApplyPayload): string {
  const lines: string[] = [];

  // Header
  lines.push('You are a senior frontend engineer working in a local codebase.');
  lines.push(
    'Goal: persist a visual edit from the browser into the source code with minimal changes.',
  );
  lines.push('');

  // Page context
  lines.push(`Page URL: ${payload.pageUrl}`);
  lines.push('');

  // == Source Location (high-confidence if debugSource available) ==
  const ds = payload.debugSource;
  if (ds?.file) {
    lines.push('## Source Location (from React/Vue debug info)');
    const loc = ds.line ? `${ds.file}:${ds.line}${ds.column ? `:${ds.column}` : ''}` : ds.file;
    lines.push(`- file: ${loc}`);
    if (ds.componentName) lines.push(`- component: ${ds.componentName}`);
    lines.push('');
    lines.push('This is high-confidence source location extracted from framework debug info.');
    lines.push('Start your search here. Only fall back to fingerprint if this file is invalid.');
    lines.push('');
  } else if (payload.targetFile) {
    lines.push(`## Target File (best-effort): ${payload.targetFile}`);
    lines.push(
      'If this path is invalid or points to node_modules, fall back to fingerprint search.',
    );
    lines.push('');
  }

  // == Element Fingerprint ==
  lines.push('## Element Fingerprint');
  lines.push(`- tag: ${payload.fingerprint.tag}`);
  if (payload.fingerprint.id) lines.push(`- id: ${payload.fingerprint.id}`);
  if (payload.fingerprint.classes?.length) {
    lines.push(`- classes: ${payload.fingerprint.classes.join(' ')}`);
  }
  if (payload.fingerprint.text) lines.push(`- text: ${payload.fingerprint.text}`);
  lines.push('');

  // == CSS Selectors (for precise matching) ==
  if (payload.selectorCandidates?.length) {
    lines.push('## CSS Selectors (ordered by specificity)');
    for (const sel of payload.selectorCandidates.slice(0, 5)) {
      lines.push(`- ${sel}`);
    }
    lines.push('');
    lines.push('Use these selectors to grep the codebase if file location is unavailable.');
    lines.push('');
  }

  // == Tech Stack ==
  if (payload.techStackHint?.length) {
    lines.push(`## Tech Stack: ${payload.techStackHint.join(', ')}`);
    lines.push('');
  }

  // == Requested Change ==
  lines.push('## Requested Change');
  lines.push(`- type: ${payload.instruction.type}`);
  lines.push(`- description: ${payload.instruction.description}`);

  if (payload.instruction.type === 'update_text' && payload.instruction.text !== undefined) {
    lines.push(`- new text: ${JSON.stringify(payload.instruction.text)}`);
  }

  // For style updates, show detailed before/after diff if available
  if (payload.instruction.type === 'update_style') {
    const op = payload.operation;
    if (op && (Object.keys(op.before).length > 0 || Object.keys(op.after).length > 0)) {
      lines.push('');
      lines.push('### Style Changes (before → after)');
      const allKeys = new Set([...Object.keys(op.before), ...Object.keys(op.after)]);
      for (const key of allKeys) {
        const before = op.before[key] ?? '(unset)';
        const after = op.after[key] ?? '(removed)';
        if (before !== after) {
          lines.push(`  ${key}: "${before}" → "${after}"`);
        }
      }
      if (op.removed.length > 0) {
        lines.push(`  [Removed]: ${op.removed.join(', ')}`);
      }
    } else if (payload.instruction.style) {
      lines.push(`- style map: ${JSON.stringify(payload.instruction.style, null, 2)}`);
    }
  }
  lines.push('');

  // == Instructions ==
  lines.push('## How to Apply');
  if (ds?.file) {
    lines.push(`1. Open ${ds.file}${ds.line ? ` around line ${ds.line}` : ''}`);
    if (ds.componentName) {
      lines.push(`2. Locate the "${ds.componentName}" component definition`);
    }
    lines.push(
      `3. Find the element matching tag="${payload.fingerprint.tag}"${payload.fingerprint.classes?.length ? ` with classes including "${payload.fingerprint.classes[0]}"` : ''}`,
    );
    lines.push('4. Apply the requested style/text change');
  } else if (payload.targetFile) {
    lines.push(`1. Open ${payload.targetFile}`);
    lines.push('2. Search for the element by matching fingerprint (tag, classes, text)');
    lines.push('3. If not found, use repo-wide search with selectors or class names');
    lines.push('4. Apply the requested change');
  } else {
    lines.push('1. Use repo-wide search (rg) with class names or text from fingerprint');
    if (payload.selectorCandidates?.length) {
      lines.push(`2. Try searching for: "${payload.selectorCandidates[0]}"`);
    }
    lines.push('3. Locate the component/template containing this element');
    lines.push('4. Apply the requested change');
  }
  lines.push('');

  // == Constraints ==
  lines.push('## Constraints');
  lines.push('- Make the smallest safe edit possible');
  if (payload.techStackHint?.includes('Tailwind')) {
    lines.push('- Tailwind detected: prefer updating className over inline styles');
  }
  if (payload.techStackHint?.includes('React') || payload.techStackHint?.includes('Vue')) {
    lines.push('- Update the component source, not generated/bundled code');
  }
  lines.push('- If CSS Modules or styled-components are used, update the correct styling source');
  lines.push('- Do not change unrelated behavior or formatting');
  lines.push('');

  // == Output ==
  lines.push(
    '## Output\nApply the change in the repo, then reply with a short summary of what file(s) you modified and the exact change made.',
  );

  return lines.join('\n');
}

async function ensureContextMenu(): Promise<void> {
  try {
    if (!(chrome as any).contextMenus?.create) return;
    try {
      await chrome.contextMenus.remove(CONTEXT_MENU_ID);
    } catch {}
    await chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: chrome.i18n.getMessage('contextMenuToggleWebEditor'),
      contexts: ['all'],
    });
  } catch (error) {
    console.warn('[WebEditor] Failed to ensure context menu:', error);
  }
}

/**
 * Get the appropriate action constants based on version
 */
function getActions() {
  return USE_WEB_EDITOR_V2 ? WEB_EDITOR_V2_ACTIONS : WEB_EDITOR_V1_ACTIONS;
}

/**
 * Ensure the web editor script is injected into the tab
 * Supports both v1 (legacy) and v2 (new) versions
 *
 * V1 and V2 use different action names to avoid conflicts:
 * - V1: web_editor_ping, web_editor_toggle, etc.
 * - V2: web_editor_ping_v2, web_editor_toggle_v2, etc.
 */
async function ensureEditorInjected(tabId: number): Promise<void> {
  const scriptPath = USE_WEB_EDITOR_V2 ? V2_SCRIPT_PATH : V1_SCRIPT_PATH;
  const logPrefix = USE_WEB_EDITOR_V2 ? '[WebEditorV2]' : '[WebEditor]';
  const actions = getActions();

  // Try to ping existing instance using version-specific action
  try {
    const pong: { status?: string; version?: number } = await chrome.tabs.sendMessage(
      tabId,
      { action: actions.PING },
      { frameId: 0 },
    );

    if (pong?.status === 'pong') {
      // Already injected with correct version
      return;
    }
  } catch {
    // No existing instance, fallthrough to inject
  }

  // Inject the script
  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [scriptPath],
      world: 'ISOLATED',
    });
    console.log(`${logPrefix} Script injected successfully`);
  } catch (error) {
    console.warn(`${logPrefix} Failed to inject editor script:`, error);
  }
}

/**
 * Inject props agent into MAIN world for Phase 7 Props editing
 * Only inject for v2 editor
 */
async function ensurePropsAgentInjected(tabId: number): Promise<void> {
  if (!USE_WEB_EDITOR_V2) return;

  try {
    await chrome.scripting.executeScript({
      target: { tabId },
      files: [PROPS_AGENT_SCRIPT_PATH],
      world: 'MAIN',
    });
  } catch (error) {
    // Best-effort: some pages (chrome://, extensions, PDF) block injection
    console.warn('[WebEditorV2] Failed to inject props agent:', error);
  }
}

/**
 * Send cleanup event to props agent
 */
async function sendPropsAgentCleanup(tabId: number): Promise<void> {
  if (!USE_WEB_EDITOR_V2) return;

  try {
    // Dispatch cleanup event in ISOLATED world
    // CustomEvent crosses worlds and is observed by MAIN agent
    await chrome.scripting.executeScript({
      target: { tabId },
      func: () => {
        try {
          window.dispatchEvent(new CustomEvent('web-editor-props:cleanup'));
        } catch {
          // ignore
        }
      },
      world: 'ISOLATED',
    });
  } catch (error) {
    // Best-effort cleanup; ignore failures if tab is gone or injection blocked
    console.warn('[WebEditorV2] Failed to send props agent cleanup:', error);
  }
}

// =============================================================================
// Phase 7.1.6: Early Injection for Props Agent
// =============================================================================

/**
 * Content script ID prefix for early injection (document_start).
 * Registered scripts persist across sessions and survive browser restarts.
 */
const PROPS_AGENT_EARLY_INJECTION_ID_PREFIX = 'mcp_we_props_early';

/**
 * Result of early injection registration
 */
interface EarlyInjectionResult {
  id: string;
  host: string;
  matches: string[];
  alreadyRegistered: boolean;
}

/**
 * Sanitize a string for use in content script ID
 * Only allows alphanumeric, underscore, and hyphen
 */
function sanitizeContentScriptId(input: string): string {
  const cleaned = String(input ?? '')
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return cleaned.slice(0, 80) || 'site';
}

/**
 * Build match patterns from tab URL for early injection.
 * Returns patterns for the specific host only (not all URLs).
 */
function buildEarlyInjectionPatterns(tabUrl: string): { host: string; matches: string[] } {
  let url: URL;
  try {
    url = new URL(tabUrl);
  } catch {
    throw new Error('Invalid tab URL');
  }

  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Early injection only supports http/https pages (got ${url.protocol})`);
  }

  const host = url.hostname.trim();
  if (!host) {
    throw new Error('Unable to derive host from tab URL');
  }

  // Match all paths on this host for both http and https
  return { host, matches: [`*://${host}/*`] };
}

/**
 * Register props agent for early injection (document_start, MAIN world).
 * This allows capturing React DevTools hook before React initializes.
 *
 * The registration is per-host and persists across sessions.
 */
async function registerPropsAgentEarlyInjection(tabUrl: string): Promise<EarlyInjectionResult> {
  const { host, matches } = buildEarlyInjectionPatterns(tabUrl);
  const id = `${PROPS_AGENT_EARLY_INJECTION_ID_PREFIX}_${sanitizeContentScriptId(host)}`;

  // Check if already registered (idempotent)
  let alreadyRegistered = false;
  try {
    const existing = await chrome.scripting.getRegisteredContentScripts({ ids: [id] });
    alreadyRegistered = existing.some((s) => s.id === id);
  } catch {
    // API might not support getRegisteredContentScripts in all contexts
    alreadyRegistered = false;
  }

  if (!alreadyRegistered) {
    await chrome.scripting.registerContentScripts([
      {
        id,
        js: [PROPS_AGENT_SCRIPT_PATH],
        matches,
        runAt: 'document_start',
        world: 'MAIN',
        allFrames: false,
        persistAcrossSessions: true,
      },
    ]);
    console.log(`[WebEditorV2] Registered early injection for ${host}`);
  }

  return { id, host, matches, alreadyRegistered };
}

async function toggleEditorInTab(tabId: number): Promise<{ active?: boolean }> {
  await ensureEditorInjected(tabId);
  const logPrefix = USE_WEB_EDITOR_V2 ? '[WebEditorV2]' : '[WebEditor]';
  const actions = getActions();

  try {
    const resp: { active?: boolean } = await chrome.tabs.sendMessage(
      tabId,
      { action: actions.TOGGLE },
      { frameId: 0 },
    );
    const active = typeof resp?.active === 'boolean' ? resp.active : undefined;

    // Phase 7: Inject props agent on start; cleanup on stop
    if (active === true) {
      await ensurePropsAgentInjected(tabId);
    } else if (active === false) {
      await sendPropsAgentCleanup(tabId);
    }

    return { active };
  } catch (error) {
    console.warn(`${logPrefix} Failed to toggle editor in tab:`, error);
    return {};
  }
}

async function getActiveTabId(): Promise<number | null> {
  try {
    const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
    const tabId = tabs?.[0]?.id;
    return typeof tabId === 'number' ? tabId : null;
  } catch {
    return null;
  }
}

export function initWebEditorListeners(): void {
  ensureContextMenu().catch(() => {});

  // Clean up session storage when tab is closed to avoid stale data
  chrome.tabs.onRemoved.addListener((tabId) => {
    try {
      const keys = [
        `${WEB_EDITOR_TX_CHANGED_SESSION_KEY_PREFIX}${tabId}`,
        `${WEB_EDITOR_SELECTION_SESSION_KEY_PREFIX}${tabId}`,
        `${WEB_EDITOR_EXCLUDED_KEYS_SESSION_KEY_PREFIX}${tabId}`,
      ];
      chrome.storage.session.remove(keys).catch(() => {});
    } catch {}
  });

  if ((chrome as any).contextMenus?.onClicked?.addListener) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      try {
        if (info.menuItemId !== CONTEXT_MENU_ID) return;
        const tabId = tab?.id;
        if (typeof tabId !== 'number') return;
        await toggleEditorInTab(tabId);
      } catch {}
    });
  }

  chrome.commands.onCommand.addListener(async (command) => {
    try {
      if (command !== COMMAND_KEY) return;
      const tabId = await getActiveTabId();
      if (typeof tabId !== 'number') return;
      await toggleEditorInTab(tabId);
    } catch {}
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      // Phase 7.1.6: Handle early injection registration request
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_PROPS_REGISTER_EARLY_INJECTION) {
        (async () => {
          const senderTab = (_sender as chrome.runtime.MessageSender)?.tab;
          const senderTabId = senderTab?.id;
          const senderTabUrl = senderTab?.url;

          if (typeof senderTabId !== 'number' || typeof senderTabUrl !== 'string') {
            return sendResponse({
              success: false,
              error: 'Sender tab information is required',
            });
          }

          try {
            const result = await registerPropsAgentEarlyInjection(senderTabUrl);

            // Respond first, then reload (to avoid message port closing during navigation)
            sendResponse({ success: true, ...result });

            // Small delay to ensure response is sent before navigation
            await new Promise((resolve) => setTimeout(resolve, 50));

            // Reload the tab so early injection takes effect
            try {
              await chrome.tabs.reload(senderTabId);
            } catch {
              // Best-effort: some tabs may block reload
            }
          } catch (err) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
        return true; // Async response
      }

      // =====================================================================
      // WEB_EDITOR_OPEN_SOURCE: Open component source file in VSCode
      // =====================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_OPEN_SOURCE) {
        (async () => {
          try {
            const payload = message.payload as { debugSource?: unknown } | undefined;
            const debugSource = payload?.debugSource;

            if (!debugSource || typeof debugSource !== 'object') {
              return sendResponse({ success: false, error: 'debugSource is required' });
            }

            const rec = debugSource as Record<string, unknown>;
            const file = typeof rec.file === 'string' ? rec.file.trim() : '';
            if (!file) {
              return sendResponse({ success: false, error: 'debugSource.file is required' });
            }

            // Read server port and selected project
            const stored = await chrome.storage.local.get([
              'nativeServerPort',
              'agent-selected-project-id',
            ]);
            const portRaw = stored.nativeServerPort;
            const port = Number.isFinite(Number(portRaw))
              ? Number(portRaw)
              : DEFAULT_NATIVE_SERVER_PORT;
            const projectId = stored['agent-selected-project-id'];

            if (!projectId || typeof projectId !== 'string') {
              return sendResponse({
                success: false,
                error: 'No project selected. Please select a project in AgentChat first.',
              });
            }

            // Prepare line/column
            const lineRaw = Number(rec.line);
            const columnRaw = Number(rec.column);
            const line = Number.isFinite(lineRaw) && lineRaw > 0 ? lineRaw : undefined;
            const column = Number.isFinite(columnRaw) && columnRaw > 0 ? columnRaw : undefined;

            // Call native-server to open file (server will validate project and path)
            const openResp = await fetch(
              `http://127.0.0.1:${port}/agent/projects/${encodeURIComponent(projectId)}/open-file`,
              {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                  filePath: file,
                  line,
                  column,
                }),
              },
            );

            // Try to parse JSON response for detailed error
            let result: { success: boolean; error?: string };
            try {
              result = await openResp.json();
            } catch {
              const text = await openResp.text().catch(() => '');
              result = {
                success: false,
                error: text || `HTTP ${openResp.status}`,
              };
            }

            sendResponse(result);
          } catch (err) {
            sendResponse({
              success: false,
              error: err instanceof Error ? err.message : String(err),
            });
          }
        })();
        return true; // Async response
      }

      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TOGGLE) {
        getActiveTabId()
          .then(async (tabId) => {
            if (typeof tabId !== 'number') return sendResponse({ success: false });
            const result = await toggleEditorInTab(tabId);
            sendResponse({ success: true, ...result });
          })
          .catch(() => sendResponse({ success: false }));
        return true;
      }

      // =======================================================================
      // Phase 1.5: Handle TX_CHANGED broadcast from web-editor
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TX_CHANGED) {
        (async () => {
          const senderTabId = (_sender as chrome.runtime.MessageSender)?.tab?.id;
          if (typeof senderTabId !== 'number') {
            sendResponse({ success: false, error: 'Sender tabId is required' });
            return;
          }

          const rawPayload = message.payload as WebEditorTxChangedPayload | undefined;
          if (!rawPayload || typeof rawPayload !== 'object') {
            sendResponse({ success: false, error: 'Invalid payload' });
            return;
          }

          // Hydrate payload with tabId from sender
          const payload: WebEditorTxChangedPayload = { ...rawPayload, tabId: senderTabId };
          const storageKey = `${WEB_EDITOR_TX_CHANGED_SESSION_KEY_PREFIX}${senderTabId}`;

          // Persist to session storage for cold-start recovery
          // Remove keys on clear to avoid stale data (rollback still has edits, so keep it)
          if (payload.action === 'clear') {
            // Clear TX state and excluded keys together
            const excludedKey = `${WEB_EDITOR_EXCLUDED_KEYS_SESSION_KEY_PREFIX}${senderTabId}`;
            await chrome.storage.session.remove([storageKey, excludedKey]);
          } else {
            await chrome.storage.session.set({ [storageKey]: payload });
          }

          // Broadcast to sidepanel (best-effort, ignore errors if sidepanel is closed)
          chrome.runtime
            .sendMessage({
              type: BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_TX_CHANGED,
              payload,
            })
            .catch(() => {
              // Ignore errors - sidepanel may be closed
            });

          sendResponse({ success: true });
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      // =======================================================================
      // Selection sync: Handle SELECTION_CHANGED broadcast from web-editor
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_SELECTION_CHANGED) {
        (async () => {
          const senderTabId = (_sender as chrome.runtime.MessageSender)?.tab?.id;
          if (typeof senderTabId !== 'number') {
            sendResponse({ success: false, error: 'Sender tabId is required' });
            return;
          }

          const rawPayload = message.payload as
            | import('@/common/web-editor-types').WebEditorSelectionChangedPayload
            | undefined;
          if (!rawPayload || typeof rawPayload !== 'object') {
            sendResponse({ success: false, error: 'Invalid payload' });
            return;
          }

          // Hydrate payload with tabId from sender
          const payload = { ...rawPayload, tabId: senderTabId };
          const storageKey = `${WEB_EDITOR_SELECTION_SESSION_KEY_PREFIX}${senderTabId}`;

          // Persist to session storage for cold-start recovery
          // Remove key on deselection to avoid stale data
          if (payload.selected === null) {
            await chrome.storage.session.remove(storageKey);
          } else {
            await chrome.storage.session.set({ [storageKey]: payload });
          }

          // Broadcast to sidepanel (best-effort, ignore errors if sidepanel is closed)
          chrome.runtime
            .sendMessage({
              type: BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_SELECTION_CHANGED,
              payload,
            })
            .catch(() => {
              // Ignore errors - sidepanel may be closed
            });

          sendResponse({ success: true });
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      // =======================================================================
      // Clear selection: Handle CLEAR_SELECTION from sidepanel (after send)
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_CLEAR_SELECTION) {
        (async () => {
          const payload = message.payload as { tabId?: number } | undefined;
          const targetTabId = payload?.tabId;

          if (typeof targetTabId !== 'number' || targetTabId <= 0) {
            sendResponse({ success: false, error: 'Invalid tabId' });
            return;
          }

          // Forward to content script (web-editor-v2)
          try {
            await chrome.tabs.sendMessage(targetTabId, {
              action: WEB_EDITOR_V2_ACTIONS.CLEAR_SELECTION,
            });
            sendResponse({ success: true });
          } catch (error) {
            // Tab may be closed or web-editor not active - this is expected
            sendResponse({
              success: false,
              error: error instanceof Error ? error.message : 'Failed to send to tab',
            });
          }
        })().catch((error) => {
          // Catch any unhandled errors in the async IIFE
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      // =======================================================================
      // Phase 1.5: Handle APPLY_BATCH from web-editor toolbar
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_APPLY_BATCH) {
        const payload = normalizeApplyBatchPayload(message.payload);
        (async () => {
          const senderTabId = (_sender as chrome.runtime.MessageSender)?.tab?.id;
          const senderWindowId = (_sender as chrome.runtime.MessageSender)?.tab?.windowId;

          // Read storage for server port and selected session
          const stored = await chrome.storage.local.get([
            'nativeServerPort',
            STORAGE_KEY_SELECTED_SESSION,
          ]);

          const portRaw = stored?.nativeServerPort;
          const port = Number.isFinite(Number(portRaw))
            ? Number(portRaw)
            : DEFAULT_NATIVE_SERVER_PORT;

          const sessionId = normalizeString(stored?.[STORAGE_KEY_SELECTED_SESSION]).trim();

          // Best-effort: open AgentChat sidepanel so user can see the session
          // Pass sessionId for deep linking directly to chat view
          if (typeof senderTabId === 'number') {
            openAgentChatSidepanel(senderTabId, senderWindowId, sessionId || undefined).catch(
              () => {},
            );
          }

          if (!sessionId) {
            // No session selected - sidepanel is already being opened (best-effort)
            // User needs to select or create a session manually
            sendResponse({
              success: false,
              error:
                'No Agent session selected. Please select or create a session in AgentChat, then try Apply again.',
            });
            return;
          }

          // Hydrate payload with tabId
          const hydratedPayload: WebEditorApplyBatchPayload =
            typeof senderTabId === 'number' ? { ...payload, tabId: senderTabId } : payload;

          // Read excluded keys from session storage (per-tab, managed by sidepanel)
          let sessionExcludedKeys: string[] = [];
          if (typeof senderTabId === 'number') {
            const excludedSessionKey = `${WEB_EDITOR_EXCLUDED_KEYS_SESSION_KEY_PREFIX}${senderTabId}`;
            try {
              if (chrome.storage?.session?.get) {
                const stored = (await chrome.storage.session.get(excludedSessionKey)) as Record<
                  string,
                  unknown
                >;
                const raw = stored?.[excludedSessionKey];
                sessionExcludedKeys = Array.isArray(raw)
                  ? raw.map((k) => normalizeString(k).trim()).filter(Boolean)
                  : [];
              }
            } catch {
              // Best-effort: ignore session storage failures
            }
          }

          // Filter out excluded elements (union: payload excludedKeys + session excludedKeys)
          const excluded = new Set([...hydratedPayload.excludedKeys, ...sessionExcludedKeys]);
          const elements = hydratedPayload.elements.filter((e) => !excluded.has(e.elementKey));
          if (elements.length === 0) {
            sendResponse({ success: false, error: 'No elements selected to apply.' });
            return;
          }

          // Build page URL from payload or sender tab
          const pageUrl =
            normalizeString(hydratedPayload.pageUrl).trim() ||
            normalizeString((_sender as chrome.runtime.MessageSender)?.tab?.url).trim() ||
            'unknown';

          // Build batch prompt and send to agent
          const instruction = buildAgentPromptBatch(elements, pageUrl);
          const url = `http://127.0.0.1:${port}/agent/chat/${encodeURIComponent(sessionId)}/act`;

          // Extract element labels for compact display
          const elementLabels = elements.slice(0, 5).map((e) => e.label);

          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instruction,
              // Pass dbSessionId so backend loads session-level configuration (engine, model, options)
              dbSessionId: sessionId,
              // Display text for UI (compact representation)
              displayText: `Apply ${elements.length} change${elements.length === 1 ? '' : 's'}`,
              // Client metadata for special message rendering
              clientMeta: {
                kind: 'web_editor_apply_batch',
                pageUrl,
                elementCount: elements.length,
                elementLabels,
              },
            }),
          });

          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            sendResponse({
              success: false,
              error: text || `HTTP ${resp.status}`,
            });
            return;
          }

          const json: any = await resp.json().catch(() => ({}));
          const requestId = json?.requestId as string | undefined;

          if (requestId) {
            // Start SSE subscription for status updates (fire and forget)
            subscribeToSessionStatus(sessionId, requestId, port).catch(() => {});
          }

          sendResponse({ success: true, requestId, sessionId });
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      // =======================================================================
      // Phase 1.8: Handle HIGHLIGHT_ELEMENT from sidepanel chips hover
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_HIGHLIGHT_ELEMENT) {
        const payload = message.payload as WebEditorHighlightElementPayload | undefined;
        (async () => {
          // Validate payload
          const tabId = payload?.tabId;
          if (typeof tabId !== 'number' || !Number.isFinite(tabId) || tabId <= 0) {
            sendResponse({ success: false, error: 'Invalid tabId' });
            return;
          }

          const mode = payload?.mode;
          if (mode !== 'hover' && mode !== 'clear') {
            sendResponse({ success: false, error: 'Invalid mode' });
            return;
          }

          // Clear mode: forward directly without locator/selector validation
          // This prevents overlay residue when sidepanel unmounts
          if (mode === 'clear') {
            try {
              const response = await chrome.tabs.sendMessage(tabId, {
                action: WEB_EDITOR_V2_ACTIONS.HIGHLIGHT_ELEMENT,
                mode: 'clear',
              });
              sendResponse({ success: true, response });
            } catch (error) {
              sendResponse({
                success: false,
                error: String(error instanceof Error ? error.message : error),
              });
            }
            return;
          }

          // Hover mode: validate and forward locator
          const locator = payload?.locator;
          if (!locator || typeof locator !== 'object') {
            sendResponse({ success: false, error: 'Invalid locator' });
            return;
          }

          // Extract best selector for fallback highlighting
          const selectors = Array.isArray(locator.selectors) ? locator.selectors : [];
          const primarySelector = selectors.find(
            (s): s is string => typeof s === 'string' && s.trim().length > 0,
          );

          if (!primarySelector) {
            sendResponse({ success: false, error: 'No valid selector in locator' });
            return;
          }

          // Forward to web-editor content script
          try {
            const response = await chrome.tabs.sendMessage(tabId, {
              action: WEB_EDITOR_V2_ACTIONS.HIGHLIGHT_ELEMENT,
              locator, // Full locator for Shadow DOM/iframe support
              selector: primarySelector, // Backward compatibility fallback
              mode,
              elementKey: payload.elementKey,
            });

            sendResponse({ success: true, response });
          } catch (error) {
            // Content script might not be available
            sendResponse({
              success: false,
              error: String(error instanceof Error ? error.message : error),
            });
          }
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      // =======================================================================
      // Phase 2: Handle REVERT_ELEMENT from sidepanel chips
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_REVERT_ELEMENT) {
        const payload = message.payload as WebEditorRevertElementPayload | undefined;
        (async () => {
          // Validate payload
          const tabId = payload?.tabId;
          if (typeof tabId !== 'number' || !Number.isFinite(tabId) || tabId <= 0) {
            sendResponse({ success: false, error: 'Invalid tabId' });
            return;
          }

          const elementKey = payload?.elementKey;
          if (typeof elementKey !== 'string' || !elementKey.trim()) {
            sendResponse({ success: false, error: 'Invalid elementKey' });
            return;
          }

          // Forward to web-editor content script (frameId: 0 for main frame only)
          try {
            const response = await chrome.tabs.sendMessage(
              tabId,
              {
                action: WEB_EDITOR_V2_ACTIONS.REVERT_ELEMENT,
                elementKey,
              },
              { frameId: 0 },
            );

            sendResponse({ success: true, ...response });
          } catch (error) {
            // Content script might not be available
            sendResponse({
              success: false,
              error: String(error instanceof Error ? error.message : error),
            });
          }
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }

      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_APPLY) {
        const payload = normalizeApplyPayload(message.payload);
        (async () => {
          const senderTabId = (_sender as any)?.tab?.id;
          const sessionId =
            typeof senderTabId === 'number' ? `web-editor-${senderTabId}` : 'web-editor';

          const stored = await chrome.storage.local.get([
            'nativeServerPort',
            'agent-selected-project-id',
          ]);
          const portRaw = stored?.nativeServerPort;
          const port = Number.isFinite(Number(portRaw))
            ? Number(portRaw)
            : DEFAULT_NATIVE_SERVER_PORT;

          const projectId = normalizeString(stored?.['agent-selected-project-id']).trim() || '';

          if (!projectId) {
            return sendResponse({
              success: false,
              error:
                'No Agent project selected. Open Side Panel → 智能助手 and select/create a project first.',
            });
          }

          const instruction = buildAgentPrompt(payload);
          const url = `http://127.0.0.1:${port}/agent/chat/${encodeURIComponent(sessionId)}/act`;

          const resp = await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              instruction,
              projectId,
            }),
          });

          if (!resp.ok) {
            const text = await resp.text().catch(() => '');
            return sendResponse({
              success: false,
              error: text || `HTTP ${resp.status}`,
            });
          }

          const json: any = await resp.json().catch(() => ({}));
          const requestId = json?.requestId as string | undefined;

          if (requestId) {
            // Start SSE subscription for status updates (fire and forget)
            subscribeToSessionStatus(sessionId, requestId, port).catch(() => {});
          }

          return sendResponse({ success: true, requestId, sessionId });
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          });
        });
        return true;
      }
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_STATUS_QUERY) {
        const { requestId } = message;
        if (!requestId || typeof requestId !== 'string') {
          sendResponse({ success: false, error: 'requestId is required' });
          return false;
        }

        const entry = getExecutionStatus(requestId);
        if (!entry) {
          // No status yet - likely still pending or not tracked
          sendResponse({ success: true, status: 'pending', message: 'Waiting for status...' });
        } else {
          sendResponse({
            success: true,
            status: entry.status,
            message: entry.message,
            result: entry.result,
          });
        }
        return false; // Synchronous response
      }

      // =======================================================================
      // Cancel Execution: Handle WEB_EDITOR_CANCEL_EXECUTION from toolbar/sidepanel
      // =======================================================================
      if (message?.type === BACKGROUND_MESSAGE_TYPES.WEB_EDITOR_CANCEL_EXECUTION) {
        const payload = message.payload as WebEditorCancelExecutionPayload | undefined;
        (async () => {
          // Validate payload
          const sessionId = payload?.sessionId?.trim();
          const requestId = payload?.requestId?.trim();

          if (!sessionId) {
            sendResponse({
              success: false,
              error: 'sessionId is required',
            } as WebEditorCancelExecutionResponse);
            return;
          }
          if (!requestId) {
            sendResponse({
              success: false,
              error: 'requestId is required',
            } as WebEditorCancelExecutionResponse);
            return;
          }

          // Get server port
          const stored = await chrome.storage.local.get(['nativeServerPort']);
          const port = stored.nativeServerPort || DEFAULT_NATIVE_SERVER_PORT;

          try {
            // Call cancel API
            const cancelUrl = `http://127.0.0.1:${port}/agent/chat/${encodeURIComponent(sessionId)}/cancel/${encodeURIComponent(requestId)}`;
            const response = await fetch(cancelUrl, { method: 'DELETE' });

            if (!response.ok) {
              const errorText = await response.text().catch(() => `HTTP ${response.status}`);
              sendResponse({
                success: false,
                error: errorText,
              } as WebEditorCancelExecutionResponse);
              return;
            }

            // Update local execution status cache
            setExecutionStatus(requestId, 'cancelled', 'Execution cancelled by user');

            // Abort SSE connection for this session
            const sseConnection = sseConnections.get(sessionId);
            if (sseConnection && sseConnection.lastRequestId === requestId) {
              sseConnection.abort.abort();
              sseConnections.delete(sessionId);
            }

            sendResponse({ success: true } as WebEditorCancelExecutionResponse);
          } catch (error) {
            sendResponse({
              success: false,
              error: String(error instanceof Error ? error.message : error),
            } as WebEditorCancelExecutionResponse);
          }
        })().catch((error) => {
          sendResponse({
            success: false,
            error: String(error instanceof Error ? error.message : error),
          } as WebEditorCancelExecutionResponse);
        });
        return true; // Will respond asynchronously
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: String(error instanceof Error ? error.message : error),
      });
    }
    return false;
  });
}
