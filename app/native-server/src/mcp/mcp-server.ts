import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { setupTools } from './register-tools';

/**
 * Create a new MCP Server instance with tools registered.
 *
 * Must be called per MCP session, not memoized. The
 * @modelcontextprotocol/sdk `Server.connect(transport)` call assigns
 * `this._transport = transport`, so a singleton shared across sessions
 * orphans earlier transports when a new client initializes. See #345.
 */
export const createMcpServer = () => {
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
