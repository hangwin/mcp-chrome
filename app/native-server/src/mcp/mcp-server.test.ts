import { describe, expect, test, jest } from '@jest/globals';

// Mock the native messaging host singleton so importing mcp-server (which
// transitively imports the host via register-tools) doesn't attach to stdin
// or block on extension responses during tests.
jest.mock('../native-messaging-host', () => ({
  __esModule: true,
  default: {
    sendRequestToExtensionAndWait: () => Promise.resolve({ status: 'success', items: [] }),
    sendMessage: () => {},
  },
}));

import { createMcpServer } from './mcp-server';

describe('createMcpServer (multi-session support — regression for hangwin/mcp-chrome#345)', () => {
  test('returns a fresh Server instance per call (not memoized)', () => {
    const a = createMcpServer();
    const b = createMcpServer();
    expect(a).not.toBe(b);
  });

  test('two instances each route requests to their own transport (no shared _transport)', async () => {
    const serverA = createMcpServer();
    const serverB = createMcpServer();

    const makeMockTransport = () => {
      const mock: any = {
        start: jest.fn(async () => {}),
        close: jest.fn(async () => {}),
        send: jest.fn(async () => {}),
        onmessage: undefined as ((msg: unknown) => void) | undefined,
        onclose: undefined as (() => void) | undefined,
        onerror: undefined as ((err: Error) => void) | undefined,
      };
      return mock;
    };

    const transportA = makeMockTransport();
    const transportB = makeMockTransport();

    await serverA.connect(transportA as any);
    await serverB.connect(transportB as any);

    expect(transportA.start).toHaveBeenCalledTimes(1);
    expect(transportB.start).toHaveBeenCalledTimes(1);

    // Simulate an inbound tools/list request on transport A.
    // Under the pre-fix singleton, both servers shared one underlying
    // `_transport` (the last one connected — transportB), so the response
    // would go to transportB.send rather than transportA.send.
    transportA.onmessage?.({
      jsonrpc: '2.0',
      id: 'req-1',
      method: 'tools/list',
      params: {},
    });

    // Let the async handler resolve.
    await new Promise((r) => setTimeout(r, 50));

    expect(transportA.send).toHaveBeenCalled();
    expect(transportB.send).not.toHaveBeenCalled();
  });
});
