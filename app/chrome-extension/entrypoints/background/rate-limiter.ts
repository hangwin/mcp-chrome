/**
 * Rate Limiter
 * Token bucket implementation for rate limiting tool execution
 */

export interface RateLimitConfig {
  bucketSize: number; // Maximum tokens in bucket
  refillRate: number; // Tokens to add per interval
  refillInterval: number; // Interval in milliseconds
}

export interface RateLimitResult {
  allowed: boolean;
  remainingTokens: number;
  bucketSize: number;
  retryAfterMs?: number;
  errorMessage?: string;
}

interface TokenBucket {
  tokens: number;
  lastRefill: number;
  config: RateLimitConfig;
  refillTimer?: NodeJS.Timeout;
}

/**
 * Token Bucket Rate Limiter
 * Prevents tool abuse by limiting execution frequency per tool
 */
export class RateLimiter {
  private buckets: Map<string, TokenBucket> = new Map();
  private configs: Map<string, RateLimitConfig>;
  private defaultConfig: RateLimitConfig;

  constructor(configs?: { [toolName: string]: RateLimitConfig; default?: RateLimitConfig }) {
    // Default config for tools without specific configuration
    this.defaultConfig = configs?.default || {
      bucketSize: 20,
      refillRate: 5,
      refillInterval: 1000,
    };

    // Parse tool-specific configs
    this.configs = new Map();
    if (configs) {
      Object.entries(configs).forEach(([toolName, config]) => {
        if (toolName !== 'default') {
          this.configs.set(toolName, config);
        }
      });
    }
  }

  /**
   * Try to consume a token for tool execution
   * @param toolName Name of the tool to rate limit
   * @returns Result indicating if request is allowed
   */
  tryConsume(toolName: string): RateLimitResult {
    const bucket = this.getOrCreateBucket(toolName);

    // Refill tokens based on elapsed time
    this.refillBucket(bucket);

    // Check if tokens available
    if (bucket.tokens >= 1) {
      bucket.tokens -= 1;
      return {
        allowed: true,
        remainingTokens: Math.floor(bucket.tokens),
        bucketSize: bucket.config.bucketSize,
      };
    }

    // Calculate retry time
    const tokensNeeded = 1;
    const refillTime = (tokensNeeded / bucket.config.refillRate) * bucket.config.refillInterval;
    const timeSinceLastRefill = Date.now() - bucket.lastRefill;
    const timeUntilNextRefill = Math.max(0, bucket.config.refillInterval - timeSinceLastRefill);

    return {
      allowed: false,
      remainingTokens: 0,
      bucketSize: bucket.config.bucketSize,
      retryAfterMs: Math.ceil(timeUntilNextRefill),
      errorMessage: `Rate limit exceeded for tool '${toolName}'. Please retry after ${Math.ceil(timeUntilNextRefill)}ms.`,
    };
  }

  /**
   * Get or create a token bucket for a tool
   */
  private getOrCreateBucket(toolName: string): TokenBucket {
    let bucket = this.buckets.get(toolName);

    if (!bucket) {
      const config = this.configs.get(toolName) || this.defaultConfig;
      bucket = {
        tokens: config.bucketSize,
        lastRefill: Date.now(),
        config,
      };

      // Start refill timer
      bucket.refillTimer = setInterval(() => {
        this.refillBucket(bucket!);
      }, config.refillInterval);

      this.buckets.set(toolName, bucket);
    }

    return bucket;
  }

  /**
   * Refill tokens in bucket based on elapsed time
   */
  private refillBucket(bucket: TokenBucket): void {
    const now = Date.now();
    const elapsed = now - bucket.lastRefill;
    const intervals = Math.floor(elapsed / bucket.config.refillInterval);

    if (intervals > 0) {
      const tokensToAdd = intervals * bucket.config.refillRate;
      bucket.tokens = Math.min(bucket.config.bucketSize, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
    }
  }

  /**
   * Clean up timers (for testing)
   */
  destroy(): void {
    this.buckets.forEach((bucket) => {
      if (bucket.refillTimer) {
        clearInterval(bucket.refillTimer);
      }
    });
    this.buckets.clear();
  }
}

/**
 * Get rate limit configuration for a tool based on risk level
 */
export function getToolRateLimitConfig(toolName: string): RateLimitConfig {
  // High-risk tools: can open tabs, make network requests, steal data
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

  // Medium-risk tools: can interact with page but limited damage
  const MEDIUM_RISK_TOOLS = [
    'browser_click',
    'browser_fill',
    'browser_screenshot',
    'browser_keyboard',
    'browser_get_interactive_elements',
  ];

  // Low-risk tools: read-only operations
  // Everything else falls into this category

  if (HIGH_RISK_TOOLS.includes(toolName)) {
    return {
      bucketSize: 10,
      refillRate: 2,
      refillInterval: 1000,
    };
  }

  if (MEDIUM_RISK_TOOLS.includes(toolName)) {
    return {
      bucketSize: 20,
      refillRate: 5,
      refillInterval: 1000,
    };
  }

  // Low-risk default
  return {
    bucketSize: 50,
    refillRate: 10,
    refillInterval: 1000,
  };
}

/**
 * Global rate limiter instance
 */
let globalRateLimiter: RateLimiter | null = null;

/**
 * Initialize rate limiter with tool-specific configs
 */
export function initRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    // Build config map for all tools
    const configs: { [toolName: string]: RateLimitConfig } = {};

    // Add high-risk tools
    [
      'browser_navigate',
      'browser_close_tabs',
      'browser_window',
      'browser_network_request',
      'browser_network_debugger_start',
      'browser_network_capture_start',
      'browser_inject_script',
      'browser_web_fetcher',
    ].forEach((tool) => {
      configs[tool] = getToolRateLimitConfig(tool);
    });

    // Add medium-risk tools
    [
      'browser_click',
      'browser_fill',
      'browser_screenshot',
      'browser_keyboard',
      'browser_get_interactive_elements',
    ].forEach((tool) => {
      configs[tool] = getToolRateLimitConfig(tool);
    });

    // Set default for low-risk tools
    configs.default = {
      bucketSize: 50,
      refillRate: 10,
      refillInterval: 1000,
    };

    globalRateLimiter = new RateLimiter(configs);
  }

  return globalRateLimiter;
}

/**
 * Get global rate limiter instance
 */
export function getRateLimiter(): RateLimiter {
  if (!globalRateLimiter) {
    return initRateLimiter();
  }
  return globalRateLimiter;
}