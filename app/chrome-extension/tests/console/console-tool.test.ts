/**
 * @fileoverview chrome_console tool (snapshot mode) filters
 * @description Verifies that levels / since filters are applied in snapshot mode, before the
 * maxMessages limit, and that invalid filter params are rejected up front.
 */

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue({}),
  },
}));

import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { consoleTool } from '@/entrypoints/background/tools/browser/console';

const TAB_ID = 7;

type DebuggerEventHandler = (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: unknown,
) => void;

const consoleApiCall = (type: string, text: string, timestamp: number) => ({
  method: 'Runtime.consoleAPICalled',
  params: { type, timestamp, args: [{ type: 'string', value: text }] },
});

const replayedEvents = [
  consoleApiCall('log', 'noise 1', 1000),
  consoleApiCall('log', 'noise 2', 1100),
  consoleApiCall('warning', 'old warning', 1200),
  consoleApiCall('log', 'noise 3', 2000),
  consoleApiCall('error', 'new error', 2100),
  consoleApiCall('warning', 'new warning', 2200),
  {
    method: 'Runtime.exceptionThrown',
    params: { timestamp: 1500, exceptionDetails: { text: 'old exception' } },
  },
  {
    method: 'Runtime.exceptionThrown',
    params: { timestamp: 2300, exceptionDetails: { text: 'new exception' } },
  },
];

// Tool arguments come from MCP clients as untyped JSON
const execute = (args: Record<string, unknown>) =>
  consoleTool.execute(args as Parameters<typeof consoleTool.execute>[0]);

async function runSnapshot(args: Record<string, unknown>) {
  const promise = execute({ tabId: TAB_ID, ...args });
  await vi.advanceTimersByTimeAsync(2500);
  const result = await promise;
  return {
    result,
    payload: result.isError ? null : JSON.parse((result.content[0] as { text: string }).text),
  };
}

describe('chrome_console snapshot filters', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: TAB_ID,
      url: 'https://example.com/',
      title: 'Example',
    } as chrome.tabs.Tab);

    let listener: DebuggerEventHandler | undefined;
    vi.mocked(chrome.debugger.onEvent.addListener).mockImplementation((fn) => {
      listener = fn as DebuggerEventHandler;
    });
    vi.mocked(cdpSessionManager.sendCommand).mockImplementation(async (_tabId, method) => {
      // Runtime.enable replays the existing console messages, like Chrome does
      if (method === 'Runtime.enable') {
        for (const event of replayedEvents)
          listener?.({ tabId: TAB_ID }, event.method, event.params);
      }
      return {};
    });
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it('filters by levels before applying the message limit', async () => {
    const { payload } = await runSnapshot({ levels: ['warn', 'error'], maxMessages: 2 });
    expect(payload.messages.map((m: { text: string }) => m.text)).toEqual([
      'old warning',
      'new error',
    ]);
    expect(payload.messageLimitReached).toBe(true);
    expect(payload.exceptionCount).toBe(2);
  });

  it('only returns messages and exceptions at or after since', async () => {
    const { payload } = await runSnapshot({ since: 2000 });
    expect(payload.messages.map((m: { text: string }) => m.text)).toEqual([
      'noise 3',
      'new error',
      'new warning',
    ]);
    expect(payload.exceptions.map((e: { text: string }) => e.text)).toEqual(['new exception']);
    expect(payload.exceptions[0].timestamp).toBe(2300);
  });

  it('rejects invalid filter params before touching the tab', async () => {
    const levelsResult = await execute({ tabId: TAB_ID, levels: [1] });
    expect(levelsResult.isError).toBe(true);
    expect((levelsResult.content[0] as { text: string }).text).toMatch(/Invalid levels/);

    const sinceResult = await execute({ tabId: TAB_ID, since: 'yesterday' });
    expect(sinceResult.isError).toBe(true);
    expect((sinceResult.content[0] as { text: string }).text).toMatch(/Invalid since/);
    expect(chrome.tabs.get).not.toHaveBeenCalled();
  });
});
