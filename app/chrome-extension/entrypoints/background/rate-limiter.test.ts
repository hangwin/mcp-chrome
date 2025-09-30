/**
 * Rate Limiter Tests
 * Tests for token bucket rate limiting implementation
 */

import { describe, expect, test, beforeEach, jest } from '@jest/globals';
import { RateLimiter, RateLimitConfig } from './rate-limiter';

describe('RateLimiter', () => {
  let rateLimiter: RateLimiter;

  beforeEach(() => {
    rateLimiter = new RateLimiter();
  });

  test('allows request when tokens available', () => {
    const result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(true);
    expect(result.remainingTokens).toBeLessThan(result.bucketSize);
  });

  test('consumes token on successful request', () => {
    const first = rateLimiter.tryConsume('test-tool');
    const second = rateLimiter.tryConsume('test-tool');

    expect(second.remainingTokens).toBe(first.remainingTokens - 1);
  });

  test('blocks request when tokens depleted', () => {
    const config: RateLimitConfig = {
      bucketSize: 2,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Consume all tokens
    rateLimiter.tryConsume('test-tool');
    rateLimiter.tryConsume('test-tool');

    // Should be blocked
    const result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
  });

  test('refills tokens over time', async () => {
    const config: RateLimitConfig = {
      bucketSize: 2,
      refillRate: 2,
      refillInterval: 100, // 100ms for faster test
    };
    rateLimiter = new RateLimiter({ default: config });

    // Consume all tokens
    rateLimiter.tryConsume('test-tool');
    rateLimiter.tryConsume('test-tool');

    // Wait for refill
    await new Promise((resolve) => setTimeout(resolve, 150));

    // Should have tokens again
    const result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(true);
  });

  test('does not exceed bucket capacity', async () => {
    const config: RateLimitConfig = {
      bucketSize: 5,
      refillRate: 10,
      refillInterval: 100,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Wait for excessive refill attempts
    await new Promise((resolve) => setTimeout(resolve, 500));

    const result = rateLimiter.tryConsume('test-tool');
    expect(result.remainingTokens).toBeLessThanOrEqual(config.bucketSize);
  });

  test('maintains separate buckets per tool', () => {
    const config: RateLimitConfig = {
      bucketSize: 2,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Deplete tool1
    rateLimiter.tryConsume('tool1');
    rateLimiter.tryConsume('tool1');

    // tool2 should still have tokens
    const result = rateLimiter.tryConsume('tool2');
    expect(result.allowed).toBe(true);
  });

  test('applies different limits for different risk levels', () => {
    const highRiskConfig: RateLimitConfig = {
      bucketSize: 5,
      refillRate: 1,
      refillInterval: 1000,
    };
    const lowRiskConfig: RateLimitConfig = {
      bucketSize: 20,
      refillRate: 5,
      refillInterval: 1000,
    };

    rateLimiter = new RateLimiter({
      default: lowRiskConfig,
      'high-risk-tool': highRiskConfig,
    });

    const highRisk = rateLimiter.tryConsume('high-risk-tool');
    const lowRisk = rateLimiter.tryConsume('low-risk-tool');

    expect(highRisk.bucketSize).toBe(5);
    expect(lowRisk.bucketSize).toBe(20);
  });

  test('provides accurate retry timing', () => {
    const config: RateLimitConfig = {
      bucketSize: 1,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Consume token
    rateLimiter.tryConsume('test-tool');

    // Try again immediately
    const result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(false);
    expect(result.retryAfterMs).toBeGreaterThan(0);
    expect(result.retryAfterMs).toBeLessThanOrEqual(1000);
  });

  test('handles concurrent requests safely', () => {
    const config: RateLimitConfig = {
      bucketSize: 10,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Simulate concurrent requests
    const results = Array.from({ length: 15 }, () =>
      rateLimiter.tryConsume('test-tool'),
    );

    const allowed = results.filter((r) => r.allowed).length;
    const blocked = results.filter((r) => !r.allowed).length;

    expect(allowed).toBe(10); // Only bucket size should be allowed
    expect(blocked).toBe(5);
  });

  test('includes descriptive error messages', () => {
    const config: RateLimitConfig = {
      bucketSize: 1,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Consume token
    rateLimiter.tryConsume('test-tool');

    // Try again
    const result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(false);
    expect(result.errorMessage).toBeDefined();
    expect(result.errorMessage).toContain('Rate limit exceeded');
  });

  test('getRateLimitStatus returns correct status', () => {
    const config: RateLimitConfig = {
      bucketSize: 10,
      refillRate: 2,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Consume some tokens
    rateLimiter.tryConsume('test-tool');
    rateLimiter.tryConsume('test-tool');

    const status = rateLimiter.getRateLimitStatus('test-tool');

    expect(status).not.toBeNull();
    expect(status?.toolName).toBe('test-tool');
    expect(status?.currentTokens).toBe(8);
    expect(status?.maxTokens).toBe(10);
    expect(status?.riskLevel).toBeDefined();
  });

  test('getAllRateLimitStatuses returns all active tools', () => {
    rateLimiter.tryConsume('tool1');
    rateLimiter.tryConsume('tool2');
    rateLimiter.tryConsume('tool3');

    const statuses = rateLimiter.getAllRateLimitStatuses();

    expect(statuses.length).toBe(3);
    expect(statuses.map((s) => s.toolName)).toContain('tool1');
    expect(statuses.map((s) => s.toolName)).toContain('tool2');
    expect(statuses.map((s) => s.toolName)).toContain('tool3');
  });

  test('resetRateLimit restores tokens', () => {
    const config: RateLimitConfig = {
      bucketSize: 5,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Exhaust tokens
    for (let i = 0; i < 5; i++) {
      rateLimiter.tryConsume('test-tool');
    }

    // Verify depleted
    let result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(false);

    // Reset
    rateLimiter.resetRateLimit('test-tool');

    // Should work again
    result = rateLimiter.tryConsume('test-tool');
    expect(result.allowed).toBe(true);
  });

  test('resetAllRateLimits restores all tools', () => {
    const config: RateLimitConfig = {
      bucketSize: 2,
      refillRate: 1,
      refillInterval: 1000,
    };
    rateLimiter = new RateLimiter({ default: config });

    // Exhaust multiple tools
    rateLimiter.tryConsume('tool1');
    rateLimiter.tryConsume('tool1');
    rateLimiter.tryConsume('tool2');
    rateLimiter.tryConsume('tool2');

    // Reset all
    rateLimiter.resetAllRateLimits();

    // All should work
    expect(rateLimiter.tryConsume('tool1').allowed).toBe(true);
    expect(rateLimiter.tryConsume('tool2').allowed).toBe(true);
  });
});
