import { describe, expect, test, afterAll, beforeAll, jest } from '@jest/globals';
import supertest from 'supertest';
import type { ServerResponse } from 'node:http';
import type { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import Server from './index';

jest.mock('../agent/engines/codex', () => ({
  CodexEngine: jest.fn(),
}));

jest.mock('../agent/engines/claude', () => ({
  ClaudeEngine: jest.fn(),
}));

jest.mock('../agent/db', () => ({
  closeDb: jest.fn(),
}));

describe('服务器测试', () => {
  // 启动服务器测试实例
  beforeAll(async () => {
    await Server.getInstance().ready();
  });

  // 关闭服务器
  afterAll(async () => {
    await Server.stop();
  });

  test('GET /ping 应返回正确响应', async () => {
    const response = await supertest(Server.getInstance().server)
      .get('/ping')
      .expect(200)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      status: 'ok',
      message: 'pong',
    });
  });

  test('POST /mcp 初始化请求应只发送一次 transport 响应', async () => {
    const response = await supertest(Server.getInstance().server)
      .post('/mcp')
      .set('Accept', 'application/json, text/event-stream')
      .set('Content-Type', 'application/json')
      .send({
        jsonrpc: '2.0',
        id: 1,
        method: 'initialize',
        params: {
          protocolVersion: '2025-03-26',
          capabilities: {},
          clientInfo: {
            name: 'server-test',
            version: '1.0.0',
          },
        },
      })
      .expect(200)
      .expect('Content-Type', /text\/event-stream/);

    expect(response.headers['mcp-session-id']).toEqual(expect.any(String));
    expect(response.text).toContain('"jsonrpc":"2.0"');
    expect(response.text).toContain('"id":1');
  });

  test('GET /mcp 缺少 session id 时应拒绝请求', async () => {
    const response = await supertest(Server.getInstance().server)
      .get('/mcp')
      .set('Accept', 'text/event-stream')
      .expect(400)
      .expect('Content-Type', /json/);

    expect(response.body).toEqual({
      error: 'Invalid or missing MCP session ID for SSE.',
    });
  });

  test('GET /mcp 应由 transport 独占原始响应', async () => {
    const sessionId = 'test-stream-session';
    const handleRequest = jest.fn(async (_request: unknown, response: ServerResponse) => {
      if (response.headersSent) {
        throw new Error('Response headers were sent before the MCP transport handled the request');
      }

      response.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        Connection: 'keep-alive',
      });
      response.end(': ready\n\n');
    });
    const serverWithTransports = Server as unknown as {
      transportsMap: Map<string, StreamableHTTPServerTransport>;
    };
    serverWithTransports.transportsMap.set(sessionId, {
      handleRequest,
    } as unknown as StreamableHTTPServerTransport);

    try {
      const response = await supertest(Server.getInstance().server)
        .get('/mcp')
        .set('Accept', 'text/event-stream')
        .set('mcp-session-id', sessionId)
        .expect(200)
        .expect('Content-Type', /text\/event-stream/);

      expect(response.text).toBe(': ready\n\n');
    } finally {
      serverWithTransports.transportsMap.delete(sessionId);
    }
  });
});
