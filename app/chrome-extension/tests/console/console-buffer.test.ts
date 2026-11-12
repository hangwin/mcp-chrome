/**
 * @fileoverview ConsoleBuffer read filters
 * @description Verifies levels / since / pattern / limit handling when reading the per-tab buffer
 */

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    attach: vi.fn().mockResolvedValue(undefined),
    detach: vi.fn().mockResolvedValue(undefined),
    sendCommand: vi.fn().mockResolvedValue({}),
  },
}));

import { consoleBuffer } from '@/entrypoints/background/tools/browser/console-buffer';

const TAB_ID = 42;

type DebuggerEventHandler = (
  source: chrome.debugger.Debuggee,
  method: string,
  params?: unknown,
) => void;

function emit(method: string, params: unknown): void {
  const handler = (consoleBuffer as unknown as { handleDebuggerEvent: DebuggerEventHandler })
    .handleDebuggerEvent;
  handler.call(consoleBuffer, { tabId: TAB_ID }, method, params);
}

function consoleApiCall(type: string, text: string, timestamp: number): void {
  emit('Runtime.consoleAPICalled', {
    type,
    timestamp,
    args: [{ type: 'string', value: text }],
  });
}

describe('consoleBuffer.read filters', () => {
  beforeEach(async () => {
    vi.mocked(chrome.tabs.get).mockResolvedValue({
      id: TAB_ID,
      url: 'https://example.com/',
      title: 'Example',
    } as chrome.tabs.Tab);
    await consoleBuffer.ensureStarted(TAB_ID);
    consoleBuffer.clear(TAB_ID, 'test');

    consoleApiCall('log', 'boot', 1000);
    consoleApiCall('warning', 'slow request', 2000);
    consoleApiCall('error', 'request failed', 3000);
    emit('Log.entryAdded', {
      entry: { level: 'error', text: 'GET /api 500', timestamp: 4000, source: 'network' },
    });
    consoleApiCall('info', 'request retried', 5000);
    emit('Runtime.exceptionThrown', {
      timestamp: 2500,
      exceptionDetails: { text: 'Uncaught TypeError: early' },
    });
    emit('Runtime.exceptionThrown', {
      timestamp: 4500,
      exceptionDetails: { text: 'Uncaught TypeError: late' },
    });
  });

  it('returns everything without filters', () => {
    const read = consoleBuffer.read(TAB_ID);
    expect(read?.messages.map((m) => m.text)).toEqual([
      'boot',
      'slow request',
      'request failed',
      'GET /api 500',
      'request retried',
    ]);
    expect(read?.exceptions.map((e) => e.timestamp)).toEqual([2500, 4500]);
  });

  it('filters messages by level', () => {
    const read = consoleBuffer.read(TAB_ID, { levels: new Set(['warning', 'error']) });
    expect(read?.messages.map((m) => m.text)).toEqual([
      'slow request',
      'request failed',
      'GET /api 500',
    ]);
    expect(read?.messageCount).toBe(3);
    expect(read?.totalBufferedMessages).toBe(5);
    // Exceptions are not level-filtered
    expect(read?.exceptionCount).toBe(2);
  });

  it('filters messages and exceptions by since', () => {
    const read = consoleBuffer.read(TAB_ID, { since: 3000 });
    expect(read?.messages.map((m) => m.timestamp)).toEqual([3000, 4000, 5000]);
    expect(read?.exceptions.map((e) => e.text)).toEqual(['Uncaught TypeError: late']);
  });

  it('applies filters before the limit and keeps the newest matches', () => {
    const read = consoleBuffer.read(TAB_ID, {
      levels: new Set(['error', 'info']),
      pattern: /request|api/i,
      limit: 2,
    });
    expect(read?.messages.map((m) => m.text)).toEqual(['GET /api 500', 'request retried']);
    expect(read?.messageLimitReached).toBe(true);
  });

  it('drops exceptions when includeExceptions is false', () => {
    const read = consoleBuffer.read(TAB_ID, { since: 0, includeExceptions: false });
    expect(read?.exceptions).toEqual([]);
    expect(read?.messageCount).toBe(5);
  });
});
