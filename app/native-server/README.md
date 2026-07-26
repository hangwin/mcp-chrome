# Chrome MCP

**📖 Documentation**: [English](https://github.com/rudy2steiner/chrome-mcp/blob/master/app/native-server/README.md) | [中文](https://github.com/rudy2steiner/chrome-mcp/blob/master/app/native-server/README_zh.md)

Use your own Chrome browser as an MCP server for work automation agents and MCP-compatible clients.

Chrome MCP lets an agent inspect and operate the Chrome browser you already use, including your existing login sessions, tabs, cookies, and extensions. It is useful for research, data entry, operations workflows, QA checks, content workflows, and coding tasks.

## Install

Most users should let their agent configure this package with the `npx` MCP config. If a client cannot keep a long-running MCP stdio server alive through `npx`, use the direct Node.js fallback.

### Prerequisites

- Chrome/Chromium browser
- An MCP-capable agent or MCP client
- Node.js `20+`
- npm and npx available in your terminal; npx is bundled with npm in normal Node.js installs

### 1. Install The Chrome Extension

1. Download the latest `chrome-mcp-extension.zip` from:
   https://github.com/rudy2steiner/chrome-mcp/releases/latest
2. Unzip it.
3. Open Chrome and go to `chrome://extensions/`.
4. Enable Developer mode.
5. Click Load unpacked.
6. Select the unzipped folder that contains `manifest.json`.

### 2. Ask Your Agent To Connect It

Copy this prompt into your agent:

```text
Connect Chrome MCP to this agent.

Requirements:
- Use the simple npx config first.
- If this agent cannot start MCP stdio through npx, falls back to the direct Node.js config below.

Primary MCP server config:

{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}

If prerequisites, extension loading, or fallback setup are missing, follow the manual install guide first:
https://github.com/rudy2steiner/chrome-mcp#-quick-start

Fallback if npx hangs or the agent cannot list MCP tools after the manual guide:
1. Run npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
2. Resolve node path with: node -p "process.execPath"
3. Resolve global npm root with: npm root -g
4. Configure command as the absolute node path and args as:
   <global npm root>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js
5. Add env CHROME_MCP_SKIP_AUTO_REGISTER=1.

After updating the MCP config, tell me where you saved it and which config style you used. Remind me to restart the agent, confirm the Chrome extension is loaded from https://github.com/rudy2steiner/chrome-mcp/releases/latest if needed, and click Connect in the extension popup.
```

### 3. Restart And Connect

Restart your agent. Then open the Chrome MCP extension popup and click Connect.

After that, your agent should be able to list and call Chrome tools.

## Manual MCP Config

If you prefer to edit the MCP config yourself, add this to your agent MCP settings:

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "npx",
      "args": ["-y", "--registry=https://registry.npmjs.org", "agent-chrome-mcp@latest", "stdio"]
    }
  }
}
```

Then restart your agent and click Connect in the Chrome extension popup.

The explicit npm registry flag avoids failures on machines configured to use a private or mirrored npm registry that has not synced this package yet.

## Quick Test

Check that `npx` can run the bridge:

```bash
npx -y --registry=https://registry.npmjs.org agent-chrome-mcp@latest --version
```

For a real MCP stdio test, add the config above to your agent and restart it.

## Direct Node.js Fallback

If `npx` hangs or your agent cannot list MCP tools, install the package globally and point the agent directly at the stdio server file:

```bash
npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
node -p "process.execPath"
npm root -g
```

```json
{
  "mcpServers": {
    "chrome-mcp": {
      "command": "<absolute node path>",
      "args": ["<npm root -g>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js"],
      "env": {
        "CHROME_MCP_SKIP_AUTO_REGISTER": "1"
      }
    }
  }
}
```

## Streamable HTTP Connection

Use Streamable HTTP only when your MCP client supports HTTP MCP servers directly. For most local agents, stdio is still the recommended setup.

Before adding the HTTP config:

1. Load the Chrome MCP extension in Chrome.
2. Open the extension popup.
3. Click Connect.
4. Confirm the popup shows the local bridge running on port `12307`.

Then add this MCP server to your client:

```json
{
  "mcpServers": {
    "chrome-mcp-http": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

Some clients use the kebab-case type name instead:

```json
{
  "mcpServers": {
    "chrome-mcp-http": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

If your client reports an invalid server type, switch between `streamableHttp` and `streamable-http`.

Troubleshooting:

- `Invalid or missing MCP session ID for SSE` usually means the URL was opened directly in a browser tab. Add it as an MCP server in your agent instead.
- Connection refused means the extension has not started the local bridge yet. Open the extension popup and click Connect.
- If port `12307` was changed in the popup, use the port shown there.

## Troubleshooting

### npm says package not found

Your npm registry may be set to a private mirror. Use the explicit registry config:

```bash
npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
```

Or change your npm registry:

```bash
npm config set registry https://registry.npmjs.org
```

### Extension cannot connect

Run:

```bash
agent-chrome-mcp doctor
```

To attempt automatic fixes:

```bash
agent-chrome-mcp doctor --fix
```

## What This Package Does

This package is the local MCP bridge that your agent starts. The Chrome extension connects to the local bridge, and the bridge exposes Chrome tools to your agent over MCP stdio.

Normal users only need:

1. Chrome extension
2. Agent-installed MCP bridge
3. Click Connect

## License

MIT

## Acknowledgements

Special thanks to the original [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) project and its author, **hangye**, whose work laid the foundation for Chrome MCP.
