# Chrome MCP Release Install

**📖 Documentation**: [English](README.md) | [中文](README_zh.md)

## Download

Download the latest `agent-chrome-mcp-extension.zip` from:

https://github.com/rudy2steiner/agent-chrome-mcp/releases/latest

## Install

### Prerequisites

- Chrome/Chromium browser
- An MCP-capable agent or MCP client
- Node.js `20+`
- npm and npx available in your terminal; npx is bundled with npm in normal Node.js installs

1. Unzip `agent-chrome-mcp-extension.zip`.
2. Open Chrome and go to `chrome://extensions/`.
3. Enable Developer mode.
4. Click Load unpacked.
5. Select the unzipped folder that contains `manifest.json`.
6. Open the Chrome MCP extension popup and click Copy Configuration.

## Ask Your Agent To Connect It

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
https://github.com/rudy2steiner/agent-chrome-mcp#-quick-start

Fallback if npx hangs or the agent cannot list MCP tools after the manual guide:
1. Run npm install -g --registry=https://registry.npmjs.org agent-chrome-mcp@latest
2. Resolve node path with: node -p "process.execPath"
3. Resolve global npm root with: npm root -g
4. Configure command as the absolute node path and args as:
   <global npm root>/agent-chrome-mcp/dist/mcp/mcp-server-stdio.js
5. Add env CHROME_MCP_SKIP_AUTO_REGISTER=1.

After updating the MCP config, tell me where you saved it and which config style you used. Remind me to restart the agent, confirm the Chrome extension is loaded from https://github.com/rudy2steiner/agent-chrome-mcp/releases/latest if needed, and click Connect in the extension popup.
```

Then restart the agent and click Connect in the extension popup.

## Manual MCP Config

If you prefer to edit the config yourself, add this to your agent MCP settings:

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

## Advanced: Direct Node.js Fallback

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

## Advanced: Streamable HTTP

Use Streamable HTTP only when your MCP client supports HTTP MCP servers directly. Prefer stdio unless your client specifically needs HTTP.

Before adding the HTTP config:

1. Load the extension in Chrome.
2. Open the extension popup.
3. Click Connect.
4. Confirm the popup shows the local bridge running on port `12307`.

Then add this MCP server to your client:

```json
{
  "mcpServers": {
    "agent-chrome-mcp-http": {
      "type": "streamableHttp",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

If your client expects kebab-case, use:

```json
{
  "mcpServers": {
    "agent-chrome-mcp-http": {
      "type": "streamable-http",
      "url": "http://127.0.0.1:12307/mcp"
    }
  }
}
```

Do not open `http://127.0.0.1:12307/mcp` directly in a browser tab; that can show `Invalid or missing MCP session ID for SSE`. Add it as an MCP server in your agent.

## Acknowledgements

Special thanks to the original [hangwin/mcp-chrome](https://github.com/hangwin/mcp-chrome) project and its author, **hangye**, whose work laid the foundation for Chrome MCP.
