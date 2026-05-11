import { createHash, randomBytes, timingSafeEqual } from 'node:crypto';
import type { FastifyReply, FastifyRequest } from 'fastify';
import { HTTP_STATUS } from '../constant';

export const AUTH_TOKEN_ENV = 'CHROME_MCP_AUTH_TOKEN';
export const AUTH_HEADER = 'x-chrome-mcp-auth';
export const AUTH_SCHEME = 'Bearer';
export const AUTH_EXEMPT_PATHS = new Set(['/ping']);

const AUTH_TOKEN_BYTES = 32;
let cachedToken: string | null = null;

function generateAuthToken(): string {
  return randomBytes(AUTH_TOKEN_BYTES).toString('base64url');
}

export function getOrCreateAuthToken(): string {
  const existing = process.env[AUTH_TOKEN_ENV]?.trim();
  if (existing) {
    cachedToken = existing;
    return existing;
  }

  if (!cachedToken) {
    cachedToken = generateAuthToken();
    process.env[AUTH_TOKEN_ENV] = cachedToken;
  }

  return cachedToken;
}

export function resetAuthTokenForTests(): void {
  cachedToken = null;
  delete process.env[AUTH_TOKEN_ENV];
}

function constantTimeEquals(a: string, b: string): boolean {
  const aHash = createHash('sha256').update(a).digest();
  const bHash = createHash('sha256').update(b).digest();
  return timingSafeEqual(aHash, bHash);
}

export function extractAuthToken(request: FastifyRequest): string | null {
  const headerValue = request.headers[AUTH_HEADER];
  if (Array.isArray(headerValue)) {
    return headerValue[0]?.trim() || null;
  }
  if (typeof headerValue === 'string' && headerValue.trim()) {
    return headerValue.trim();
  }

  const query = request.query as { authToken?: unknown } | undefined;
  if (typeof query?.authToken === 'string' && query.authToken.trim()) {
    return query.authToken.trim();
  }

  const authorization = request.headers.authorization;
  if (typeof authorization === 'string' && authorization.trim()) {
    const trimmed = authorization.trim();
    const prefix = `${AUTH_SCHEME} `;
    if (trimmed.toLowerCase().startsWith(prefix.toLowerCase())) {
      return trimmed.slice(prefix.length).trim() || null;
    }
  }

  return null;
}

export function isAuthorizedRequest(request: FastifyRequest): boolean {
  if (request.method === 'OPTIONS') {
    return true;
  }

  if (AUTH_EXEMPT_PATHS.has(request.url.split('?')[0])) {
    return true;
  }

  const origin = request.headers.origin;
  if (
    typeof origin === 'string' &&
    (origin.startsWith('chrome-extension://') || origin.startsWith('moz-extension://'))
  ) {
    return true;
  }

  const expected = getOrCreateAuthToken();
  const provided = extractAuthToken(request);
  return Boolean(provided && constantTimeEquals(provided, expected));
}

export async function requireLocalAuth(
  request: FastifyRequest,
  reply: FastifyReply,
): Promise<void> {
  if (isAuthorizedRequest(request)) {
    return;
  }

  await reply.status(HTTP_STATUS.UNAUTHORIZED).send({ error: 'Unauthorized' });
}

export function buildAuthHeaders(token = getOrCreateAuthToken()): Record<string, string> {
  return {
    [AUTH_HEADER]: token,
    Authorization: `${AUTH_SCHEME} ${token}`,
  };
}
