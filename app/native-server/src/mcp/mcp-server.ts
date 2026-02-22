import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

// Factory function – creates a fresh Server instance on every call so that
// multiple transports (e.g. Chrome extension via SSE **and** an external
// MCP client via StreamableHTTP on /mcp) can connect simultaneously without
// hitting the @modelcontextprotocol/sdk single-transport guard:
//   "Already connected to a transport"
//
// Why this is safe: tool handlers registered by setupTools() forward every
// Chrome API call through the shared `nativeMessagingHostInstance` module
// singleton, so each independent Server instance still reaches the Chrome
// extension correctly regardless of how many Server objects are alive.
export const getMcpServer = () => {
  const server = new Server(
    {
      name: 'ChromeMcpServer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
      },
    },
  );
  setupTools(server);
  return server;
};
