import { describe, expect, test, beforeEach } from '@jest/globals';
import type { FastifyRequest } from 'fastify';
import {
  buildAuthHeaders,
  extractAuthToken,
  getOrCreateAuthToken,
  isAuthorizedRequest,
  resetAuthTokenForTests,
} from './auth';

function mockRequest(input: {
  method?: string;
  url?: string;
  headers?: Record<string, string | string[] | undefined>;
}): FastifyRequest {
  return {
    method: input.method ?? 'GET',
    url: input.url ?? '/agent/engines',
    headers: input.headers ?? {},
  } as FastifyRequest;
}

describe('local server authentication', () => {
  beforeEach(() => {
    resetAuthTokenForTests();
  });

  test('generates a stable process-local auth token', () => {
    const first = getOrCreateAuthToken();
    const second = getOrCreateAuthToken();

    expect(first).toBe(second);
    expect(first.length).toBeGreaterThanOrEqual(32);
  });

  test('extracts auth token from dedicated, query, or bearer credentials', () => {
    expect(extractAuthToken(mockRequest({ headers: buildAuthHeaders('secret-token') }))).toBe(
      'secret-token',
    );

    expect(extractAuthToken(mockRequest({ url: '/mcp?authToken=query-secret' }))).toBe(null);

    expect(
      extractAuthToken(
        mockRequest({
          url: '/mcp?authToken=query-secret',
          headers: {},
        }),
      ),
    ).toBe(null);

    expect(
      extractAuthToken(
        {
          ...mockRequest({ url: '/mcp?authToken=query-secret' }),
          query: { authToken: 'query-secret' },
        } as FastifyRequest,
      ),
    ).toBe('query-secret');

    expect(
      extractAuthToken(mockRequest({ headers: { authorization: 'Bearer bearer-secret' } })),
    ).toBe('bearer-secret');
  });

  test('keeps health checks and extension origins public but rejects untrusted routes without token', () => {
    expect(isAuthorizedRequest(mockRequest({ url: '/ping' }))).toBe(true);
    expect(
      isAuthorizedRequest(
        mockRequest({
          url: '/agent/engines',
          headers: { origin: 'chrome-extension://example-extension' },
        }),
      ),
    ).toBe(true);
    expect(isAuthorizedRequest(mockRequest({ url: '/agent/engines' }))).toBe(false);
  });

  test('accepts protected routes with the generated auth token', () => {
    const token = getOrCreateAuthToken();

    expect(
      isAuthorizedRequest(
        mockRequest({
          url: '/agent/engines',
          headers: buildAuthHeaders(token),
        }),
      ),
    ).toBe(true);
  });
});
