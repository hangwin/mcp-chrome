import { createErrorResponse } from '@/common/tool-handler';
import { ERROR_MESSAGES } from '@/common/constants';
import { getRateLimiter } from '../rate-limiter';
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
 * Handle tool execution with rate limiting
 */
export const handleCallTool = async (param: ToolCallParam) => {
  const tool = toolsMap.get(param.name);
  if (!tool) {
    return createErrorResponse(`Tool ${param.name} not found`);
  }

  // Check rate limit before executing tool
  const rateLimiter = getRateLimiter();
  const rateLimitResult = rateLimiter.tryConsume(param.name);

  if (!rateLimitResult.allowed) {
    console.warn(
      `Rate limit exceeded for tool ${param.name}. Retry after ${rateLimitResult.retryAfterMs}ms`,
    );
    return createErrorResponse(
      `${ERROR_MESSAGES.RATE_LIMIT_EXCEEDED}: ${rateLimitResult.errorMessage}. Remaining tokens: ${rateLimitResult.remainingTokens}/${rateLimitResult.bucketSize}. Retry after ${rateLimitResult.retryAfterMs}ms`,
    );
  }

  // Log rate limit info for monitoring
  console.log(
    `Tool ${param.name} execution allowed. Remaining tokens: ${rateLimitResult.remainingTokens}/${rateLimitResult.bucketSize}`,
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
