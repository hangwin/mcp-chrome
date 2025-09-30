import { createErrorResponse } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import { getRateLimiter, getRateLimitStatus } from '../rate-limiter';
import * as browserTools from './browser';

const tools = { ...browserTools };
const toolsMap = new Map(Object.values(tools).map((tool) => [tool.name, tool]));

/**
 * Tool call parameter interface
 */
export interface ToolCallParam {
  name: string;
  args: any;
}

/**
 * Get risk level for a tool (for better error messages)
 */
function getToolRiskLevel(toolName: string): 'HIGH' | 'MEDIUM' | 'LOW' {
  const HIGH_RISK_TOOLS = [
    'browser_navigate',
    'browser_close_tabs',
    'browser_window',
    'browser_network_request',
    'browser_network_debugger_start',
    'browser_network_capture_start',
    'browser_inject_script',
    'browser_web_fetcher',
  ];

  const MEDIUM_RISK_TOOLS = [
    'browser_click',
    'browser_fill',
    'browser_screenshot',
    'browser_keyboard',
    'browser_get_interactive_elements',
  ];

  if (HIGH_RISK_TOOLS.includes(toolName)) {
    return 'HIGH';
  }
  if (MEDIUM_RISK_TOOLS.includes(toolName)) {
    return 'MEDIUM';
  }
  return 'LOW';
}

/**
 * Handle tool execution with rate limiting and security monitoring
 */
export const handleCallTool = async (param: ToolCallParam) => {
  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  // Validate tool name
  if (!param.name || typeof param.name !== 'string') {
    console.error('Invalid tool name:', param.name);
    return createErrorResponse(`${ERROR_MESSAGES.INVALID_PARAMETERS}: Tool name must be a string`);
  }

  // Check rate limit before executing tool
  const rateLimiter = getRateLimiter();
  const rateLimitResult = rateLimiter.tryConsume(param.name);

  if (!rateLimitResult.allowed) {
    const riskLevel = getToolRiskLevel(param.name);
    const status = getRateLimitStatus(param.name);

    // Log rate limit violation for security monitoring
    console.warn(
      `[SECURITY] Rate limit exceeded for ${riskLevel}-risk tool '${param.name}'. ` +
        `Tokens: ${rateLimitResult.remainingTokens}/${rateLimitResult.bucketSize}. ` +
        `Retry after: ${rateLimitResult.retryAfterMs}ms`,
    );

    // Provide detailed error message
    const errorMessage =
      `${ERROR_MESSAGES.RATE_LIMIT_EXCEEDED}: ` +
      `Tool '${param.name}' (${riskLevel} risk) has exceeded its rate limit. ` +
      `Current tokens: ${rateLimitResult.remainingTokens}/${rateLimitResult.bucketSize}. ` +
      `Refill rate: ${status?.refillRate || 'N/A'} tokens per second. ` +
      `Please retry after ${rateLimitResult.retryAfterMs}ms.`;

    return createErrorResponse(errorMessage);
  }

  // Log successful rate limit check for monitoring
  const riskLevel = getToolRiskLevel(param.name);
  console.log(
    `[SECURITY] Tool '${param.name}' (${riskLevel} risk) execution allowed. ` +
      `Remaining tokens: ${rateLimitResult.remainingTokens}/${rateLimitResult.bucketSize}`,
  );

  try {
    return await tool.execute(param.args);
  } catch (error) {
    console.error(`Tool execution failed for ${param.name}:`, error);
    return createErrorResponse(
      error instanceof Error ? error.message : ERROR_MESSAGES.TOOL_EXECUTION_FAILED,
    );
  }
};
