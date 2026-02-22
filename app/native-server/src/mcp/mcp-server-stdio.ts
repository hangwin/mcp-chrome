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
let sessionId: string | undefined = undefined;

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

export const ensureMcpClient = async () => {
  try {
    if (mcpClient) {
      const pingResult = await mcpClient.ping();
      if (pingResult) {
        return mcpClient;
      }
    }

    const config = loadConfig();
    mcpClient = new Client({ name: 'Mcp Chrome Proxy', version: '1.0.0' }, { capabilities: {} });
    const transport = new StreamableHTTPClientTransport(new URL(config.url), {});
    await mcpClient.connect(transport);
    // Save session ID for cleanup on exit
    sessionId = transport.sessionId;
    return mcpClient;
  } catch (error) {
    mcpClient?.close();
    mcpClient = null;
    sessionId = undefined;
    console.error('Failed to connect to MCP server:', error);
  }
};

// Cleanup function to close session on exit
const cleanup = async () => {
  console.error('[stdio-mcp] Closing session...');
  if (sessionId) {
    try {
      const config = loadConfig();
      await fetch(config.url, {
        method: 'DELETE',
        headers: { 'Mcp-Session-Id': sessionId! },
      });
      console.error('[stdio-mcp] Session terminated');
    } catch (e: any) {
      console.error('[stdio-mcp] Failed to terminate session:', e.message);
    }
    sessionId = undefined;
  }
  mcpClient?.close();
  stdioMcpServer?.close();
  process.exit(0);
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

const handleToolCall = async (name: string, args: any): Promise<CallToolResult> => {
  try {
    const client = await ensureMcpClient();
    if (!client) {
      throw new Error('Failed to connect to MCP server');
    }
    // Use a sane default of 2 minutes; the previous value mistakenly used 2*6*1000 (12s)
    const DEFAULT_CALL_TIMEOUT_MS = 2 * 60 * 1000;
    const result = await client.callTool({ name, arguments: args }, undefined, {
      timeout: DEFAULT_CALL_TIMEOUT_MS,
    });
    return result as CallToolResult;
  } catch (error: any) {
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
};

async function main() {
  const transport = new StdioServerTransport();
  await getStdioMcpServer().connect(transport);

  // Setup stdin handlers to cleanup session on exit
  process.stdin.on('end', cleanup);
  process.stdin.on('close', cleanup);

  // Watchdog for parent PID (backup mechanism)
  const parentPid = process.ppid;
  const parentCheck = setInterval(() => {
    try {
      process.kill(parentPid, 0);
    } catch {
      clearInterval(parentCheck);
      cleanup();
    }
  }, 10000);
  parentCheck.unref();
}

main().catch((error) => {
  console.error('Fatal error Chrome MCP Server main():', error);
  process.exit(1);
});
