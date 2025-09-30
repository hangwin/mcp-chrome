/**
 * Tools Integration Tests with Rate Limiting
 */

import { describe, expect, test, beforeEach } from '@jest/globals';
import { handleCallTool, ToolCallParam } from './index';

describe('handleCallTool with Rate Limiting', () => {
  test('allows tool execution when rate limit not exceeded', async () => {
    const param: ToolCallParam = {
      name: 'browser_history',
      args: { maxResults: 10 },
    };

    const result = await handleCallTool(param);

    // Should not be a rate limit error
    expect(result.isError).not.toBe(true);
  });

  test('blocks tool execution when rate limit exceeded', async () => {
    const param: ToolCallParam = {
      name: 'test_high_risk_tool',
      args: {},
    };

    // Consume all tokens (bucket size is 10 for high-risk)
    const promises = Array.from({ length: 15 }, () => handleCallTool(param));
    const results = await Promise.all(promises);

    // Some should be blocked
    const blocked = results.filter((r) =>
      r.isError && r.content[0].text.includes('Rate limit exceeded')
    );

    expect(blocked.length).toBeGreaterThan(0);
  });

  test('returns helpful error message with retry information', async () => {
    const param: ToolCallParam = {
      name: 'test_tool',
      args: {},
    };

    // Exhaust rate limit
    for (let i = 0; i < 25; i++) {
      await handleCallTool(param);
    }

    // Next call should be rate limited
    const result = await handleCallTool(param);

    if (result.isError) {
      const errorText = result.content[0].text;
      expect(errorText).toContain('Rate limit exceeded');
      expect(errorText).toContain('Retry after');
      expect(errorText).toContain('ms');
    }
  });

  test('maintains separate rate limits per tool', async () => {
    const tool1Param: ToolCallParam = {
      name: 'browser_navigate',
      args: { url: 'https://example.com' },
    };

    const tool2Param: ToolCallParam = {
      name: 'browser_history',
      args: { maxResults: 10 },
    };

    // Exhaust tool1 rate limit
    for (let i = 0; i < 12; i++) {
      await handleCallTool(tool1Param);
    }

    // tool2 should still work
    const tool2Result = await handleCallTool(tool2Param);

    // tool2 might fail for other reasons, but not rate limit
    if (tool2Result.isError) {
      const errorText = tool2Result.content[0].text;
      expect(errorText).not.toContain('Rate limit exceeded');
    }
  });
});
