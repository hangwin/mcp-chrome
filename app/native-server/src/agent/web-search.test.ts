import {
  configureWebSearch,
  initialSessionOptions,
  PARALLEL_SEARCH_SERVER,
  PARALLEL_SEARCH_URL,
  SEARCH_USER_AGENT,
} from './web-search';

describe('Claude web search selection', () => {
  it('defaults only new unconfigured Claude sessions to Parallel', () => {
    expect(initialSessionOptions('claude', undefined)).toEqual({ webSearchProvider: 'parallel' });
    expect(initialSessionOptions('codex', undefined)).toBeUndefined();
    const saved = { tools: ['Read'], mcpServers: {}, env: { SEARCH_API_KEY: 'configured' } };
    expect(initialSessionOptions('claude', saved)).toBe(saved);
    expect(initialSessionOptions('claude', {})).toEqual({});
  });

  it('preserves legacy sessions, explicit builtin selection and unknown choices', () => {
    for (const session of [
      undefined,
      {},
      { webSearchProvider: 'builtin' },
      { webSearchProvider: 'typo' },
    ]) {
      const options = { mcpServers: { custom: { type: 'stdio' } }, tools: ['WebSearch'] };
      const original = JSON.parse(JSON.stringify(options));
      configureWebSearch(options, session);
      expect(options).toEqual(original);
    }
  });

  it('registers anonymous HTTP search while preserving permissions and custom servers', () => {
    const custom = {
      type: 'http',
      url: 'https://example.org/mcp',
      headers: { Authorization: 'saved' },
    };
    const options: Record<string, unknown> = {
      mcpServers: { custom },
      permissionMode: 'plan',
      allowedTools: ['Read'],
      disallowedTools: ['Bash', 'mcp__parallel-search__web_fetch'],
      env: { ANTHROPIC_API_KEY: 'model-only' },
      tools: ['Read'],
    };
    configureWebSearch(options, initialSessionOptions('claude', undefined));
    expect(options.mcpServers).toEqual({
      custom,
      [PARALLEL_SEARCH_SERVER]: {
        type: 'http',
        url: PARALLEL_SEARCH_URL,
        headers: { 'User-Agent': SEARCH_USER_AGENT },
      },
    });
    expect(options.permissionMode).toBe('plan');
    expect(options.allowedTools).toEqual(['Read']);
    expect(options.tools).toEqual(['Read']);
    expect(options.env).toEqual({ ANTHROPIC_API_KEY: 'model-only' });
    expect(options.disallowedTools).toEqual([
      'Bash',
      'mcp__parallel-search__web_fetch',
      'WebSearch',
      'WebFetch',
    ]);
  });

  it('keeps explicit endpoint/header overrides and never mutates saved configuration', () => {
    const custom = {
      type: 'http',
      url: 'https://example.org/private',
      headers: { Authorization: 'key' },
    };
    const servers = Object.freeze({ [PARALLEL_SEARCH_SERVER]: custom });
    const denied = Object.freeze(['WebSearch']);
    const options: Record<string, unknown> = { mcpServers: servers, disallowedTools: denied };
    configureWebSearch(options, { webSearchProvider: 'parallel' });
    expect((options.mcpServers as Record<string, unknown>)[PARALLEL_SEARCH_SERVER]).toBe(custom);
    expect(denied).toEqual(['WebSearch']);
    expect(options.disallowedTools).toEqual(['WebSearch', 'WebFetch']);
  });

  it('disables only owned search tools and retains other MCP servers', () => {
    const custom = { type: 'http', url: 'https://example.org/mcp' };
    const options: Record<string, unknown> = {
      mcpServers: { custom, [PARALLEL_SEARCH_SERVER]: { url: PARALLEL_SEARCH_URL } },
      disallowedTools: ['Bash'],
    };
    configureWebSearch(options, { webSearchProvider: 'disabled' });
    expect(options.mcpServers).toEqual({ custom });
    expect(options.disallowedTools).toEqual([
      'Bash',
      'WebSearch',
      'WebFetch',
      'mcp__parallel-search__*',
    ]);
    const empty: Record<string, unknown> = {};
    configureWebSearch(empty, { webSearchProvider: 'disabled' });
    expect(empty).not.toHaveProperty('mcpServers');
  });
});
