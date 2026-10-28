import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

export let mcpServer: Server | null = null;

/**
 * Create a dedicated MCP Server instance.
 *
 * The MCP SDK's `Protocol` can only be bound to a single transport:
 * calling `connect()` twice throws "Already connected to a transport".
 * Therefore every HTTP/SSE session needs its own Server instance.
 */
export const createMcpServer = (): Server => {
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

// Kept for backwards compatibility (stdio entry point and other consumers).
export const getMcpServer = () => {
  if (mcpServer) {
    return mcpServer;
  }
  mcpServer = createMcpServer();
  return mcpServer;
};
