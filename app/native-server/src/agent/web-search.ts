/** The built-in Parallel server is separate from user-configured MCP servers. */
export const PARALLEL_SEARCH_SERVER = 'parallel-search';
export const PARALLEL_SEARCH_URL = 'https://search.parallel.ai/mcp';
export const SEARCH_USER_AGENT = 'mcp-chrome (https://github.com/hangwin/mcp-chrome)';

export type WebSearchProvider = 'parallel' | 'builtin' | 'disabled';

/**
 * Choose a search default only when creating an unconfigured Claude session.
 * Existing sessions and explicitly supplied options keep their previous behavior.
 */
export function initialSessionOptions<T extends object | undefined>(
  engine: string,
  options: T,
): T | { webSearchProvider: WebSearchProvider } {
  return engine === 'claude' && options === undefined ? { webSearchProvider: 'parallel' } : options;
}

/** Apply a session's explicit search choice without granting tool permissions. */
export function configureWebSearch(
  queryOptions: Record<string, unknown>,
  sessionOptions: Record<string, unknown> | undefined,
): void {
  const provider = sessionOptions?.webSearchProvider;
  if (provider !== 'parallel' && provider !== 'disabled') return;

  const servers = (queryOptions.mcpServers ?? {}) as Record<string, unknown>;
  if (provider === 'parallel') {
    // An explicitly configured server, including its credentials, takes precedence.
    queryOptions.mcpServers = {
      [PARALLEL_SEARCH_SERVER]: {
        type: 'http',
        url: PARALLEL_SEARCH_URL,
        headers: { 'User-Agent': SEARCH_USER_AGENT },
      },
      ...servers,
    };
  } else {
    const { [PARALLEL_SEARCH_SERVER]: _removed, ...rest } = servers;
    if (Object.keys(rest).length > 0) queryOptions.mcpServers = rest;
    else delete queryOptions.mcpServers;
  }

  // Do not silently use Claude's built-in search/fetch after a Parallel failure.
  // Existing allowlists, denylists and permission modes still apply to MCP tools.
  const disallowed = (queryOptions.disallowedTools ?? []) as string[];
  queryOptions.disallowedTools = Array.from(
    new Set([
      ...disallowed,
      'WebSearch',
      'WebFetch',
      ...(provider === 'disabled' ? [`mcp__${PARALLEL_SEARCH_SERVER}__*`] : []),
    ]),
  );
}
