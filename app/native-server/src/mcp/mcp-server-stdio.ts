#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import {
  CallToolRequestSchema,
  CallToolResult,
  ListToolsRequestSchema,
  ListResourcesRequestSchema,
  ListPromptsRequestSchema,
} from '@modelcontextprotocol/sdk/types.js';
import { TOOL_SCHEMAS } from 'chrome-mcp-shared';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { StreamableHTTPClientTransport } from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import * as fs from 'fs';
import * as path from 'path';

let stdioMcpServer: Server | null = null;
let mcpClient: Client | null = null;

// Read configuration from stdio-config.json
const loadConfig = () => {
  try {
    const configPath = path.join(__dirname, 'stdio-config.json');
    const configData = fs.readFileSync(configPath, 'utf8');
    return JSON.parse(configData);
  } catch (error) {
    console.error('Failed to load stdio-config.json:', error);
    throw new Error('Configuration file stdio-config.json not found or invalid');
  }
};

export const getStdioMcpServer = () => {
  if (stdioMcpServer) {
    return stdioMcpServer;
  }
  stdioMcpServer = new Server(
    {
      name: 'StdioChromeMcpServer',
      version: '1.0.0',
    },
    {
      capabilities: {
        tools: {},
        resources: {},
        prompts: {},
      },
    },
  );

  setupTools(stdioMcpServer);
  return stdioMcpServer;
};

export const ensureMcpClient = async (forceNew = false) => {
  try {
    if (mcpClient && !forceNew) {
      try {
        const pingResult = await mcpClient.ping();
        if (pingResult) {
          return mcpClient;
        }
      } catch {
        // Ping failed — old client/transport is dead, will rebuild below
        console.error('[chrome-mcp-stdio] Ping failed, rebuilding client');
      }
    }

    // Always close the old client before creating a new one
    if (mcpClient) {
      try { mcpClient.close(); } catch { /* ignore close errors */ }
      mcpClient = null;
    }

    const config = loadConfig();
    mcpClient = new Client({ name: 'Mcp Chrome Proxy', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {});
    await mcpClient.connect(transport);
    return mcpClient;
  } catch (error) {
    if (mcpClient) {
      try { mcpClient.close(); } catch { /* ignore close errors */ }
    }
    mcpClient = null;
    console.error('[chrome-mcp-stdio] Failed to connect to MCP server:', error);
    throw error;
  }
};

export const setupTools = (server: Server) => {
  // List tools handler
  server.setRequestHandler(ListToolsRequestSchema, async () => ({ tools: TOOL_SCHEMAS }));

  // Call tool handler
  server.setRequestHandler(CallToolRequestSchema, async (request) =>
    handleToolCall(request.params.name, request.params.arguments || {}),
  );

  // List resources handler - REQUIRED BY MCP PROTOCOL
  server.setRequestHandler(ListResourcesRequestSchema, async () => ({ resources: [] }));

  // List prompts handler - REQUIRED BY MCP PROTOCOL
  server.setRequestHandler(ListPromptsRequestSchema, async () => ({ prompts: [] }));
};

const isConnectionError = (error: any): boolean => {
  const msg = error?.message || '';
  return (
    msg.includes('EOF') ||
    msg.includes('closed') ||
    msg.includes('ECONNREFUSED') ||
    msg.includes('fetch failed') ||
    msg.includes('client is closing')
  );
};

const handleToolCall = async (name: string, args: any): Promise<CallToolResult> => {
  const DEFAULT_CALL_TIMEOUT_MS = 2 * 60 * 1000;

  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const client = await ensureMcpClient(attempt > 0);
      if (!client) {
        throw new Error('Failed to connect to MCP server');
      }
      const result = await client.callTool({ name, arguments: args }, undefined, {
        timeout: DEFAULT_CALL_TIMEOUT_MS,
      });
      return result as CallToolResult;
    } catch (error: any) {
      if (attempt === 0 && isConnectionError(error)) {
        console.error('[chrome-mcp-stdio] Connection error, retrying with fresh client:', error.message);
        continue;
      }
      return {
        content: [
          {
            type: 'text',
            text: `Error calling tool: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
  }

  // Should never reach here, but satisfy TypeScript
  return {
    content: [{ type: 'text', text: 'Unexpected error: retry loop exhausted' }],
    isError: true,
  };
};

async function main() {
  const transport = new StdioServerTransport();
  await getStdioMcpServer().connect(transport);
}

main().catch((error) => {
  console.error('Fatal error Chrome MCP Server main():', error);
  process.exit(1);
});
