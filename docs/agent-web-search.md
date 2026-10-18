# AgentChat web search

New Claude AgentChat sessions use [Parallel Search MCP](https://docs.parallel.ai/integrations/mcp/search-mcp)
for web search and page fetching. No Parallel account or API key is needed.
Search uses Fast mode. Your Claude model setup is unchanged.

Open **Session Settings → Web search** to select:

- **Parallel**: use `web_search` to find sources and `web_fetch` to read URLs.
  Search queries and requested URLs are sent to Parallel when these tools run.
- **Claude / configured tools**: use the engine's existing tools and MCP settings.
- **Disable built-in web search**: disable Claude's `WebSearch`/`WebFetch` and the
  built-in Parallel server. Other configured MCP tools and browser navigation
  remain available.

For example, ask AgentChat to find current browser accessibility guidance, read
the relevant pages, and cite the source URLs.

Existing sessions retain their previous search behavior. Creating a session with
an explicit `optionsConfig` also preserves that configuration; set
`optionsConfig.webSearchProvider` to `"parallel"`, `"builtin"`, or `"disabled"`
to choose explicitly. A custom `optionsConfig.mcpServers["parallel-search"]`
entry takes precedence over the built-in endpoint and headers.

Tool restrictions and permission modes still apply. Selecting Parallel does not
allow its tools automatically. Claude's built-in search and fetch tools are
disabled for that choice, so errors do not silently switch providers. Service
limits and network errors are returned through the normal tool-result path;
retry the request or change the setting explicitly. Cancellation and MCP request
timeouts are handled by the Claude Agent SDK.

This setting applies to Claude AgentChat sessions. It does not change the Chrome
MCP browser tools or Codex's web-search configuration.
