import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

export let mcpServer: Server | null = null;

export const getMcpServer = () => {
  if (mcpServer) {
    return mcpServer;
  }
  mcpServer = new Server(
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

  setupTools(mcpServer);
  return mcpServer;
};

/**
 * Create a fresh MCP server instance with its own tool registration.
 *
 * The Streamable HTTP / SSE endpoints must use a separate server (Protocol)
 * instance per connection: the SDK's Server can only be bound to one transport
 * at a time, so sharing a single cached instance limits the endpoint to one
 * client and lets an unclean disconnect leave a "zombie" transport that blocks
 * all subsequent connections ("Already connected to a transport"). Each new
 * instance still drives the same browser through the shared native messaging
 * host.
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
