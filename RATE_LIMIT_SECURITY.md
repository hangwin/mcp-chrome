# Rate Limiting Security Documentation

## Overview

This document describes the rate limiting security feature implemented to prevent tool abuse in the Chrome MCP Extension (Issue #162).

## Security Threat Model

### Identified Threats

Without rate limiting, a rogue LLM or malicious actor could:

1. **Resource Exhaustion**: Open thousands of tabs, crashing the browser
2. **Data Exfiltration**: Rapidly extract cookies, storage, and browsing data
3. **Network Spam**: Flood network with requests, DoS attacks
4. **User Harassment**: Rapid-fire UI interactions, making browser unusable
5. **Privacy Violations**: Mass screenshot capture, history extraction

### Attack Scenarios

**Scenario 1: Tab Bomb**
```javascript
// Without rate limiting - could open 1000+ tabs instantly
for (let i = 0; i < 1000; i++) {
  await callTool('browser_navigate', { url: 'https://evil.com' });
}
```

**Scenario 2: Cookie Theft**
```javascript
// Rapid cookie extraction before user notices
for (let i = 0; i < 100; i++) {
  await callTool('browser_network_request', {
    url: 'https://target.com',
    extractCookies: true
  });
}
```

## Rate Limiting Solution

### Algorithm: Token Bucket

**Why Token Bucket?**
- Allows short bursts of legitimate activity
- Prevents sustained abuse over time
- Simple to implement and understand
- Industry-standard for API rate limiting

**How It Works:**
1. Each tool has a "bucket" with N tokens
2. Each tool call consumes 1 token
3. Tokens refill at R tokens/second
4. Bucket cannot exceed max capacity
5. Request blocked if no tokens available

### Risk-Based Rate Limits

Tools are classified into three risk categories:

#### HIGH Risk Tools (10 tokens, refill 2/sec)
**Threat**: Can open tabs, make network requests, steal data

Tools:
- `browser_navigate` - Opens new URLs (tab bomb risk)
- `browser_close_tabs` - Closes tabs (DoS risk)
- `browser_window` - Window manipulation
- `browser_network_request` - Direct network access (data exfiltration)
- `browser_network_debugger_start` - Network capture (privacy risk)
- `browser_network_capture_start` - Network monitoring
- `browser_inject_script` - Code injection (XSS risk)
- `browser_web_fetcher` - Fetch web content

**Effective Limits:**
- Burst: 10 requests instantly
- Sustained: 2 requests/second (120/minute)
- Recovery: Full capacity in 5 seconds

#### MEDIUM Risk Tools (20 tokens, refill 5/sec)
**Threat**: Can interact with page but limited damage potential

Tools:
- `browser_click` - Click elements (UI spam risk)
- `browser_fill` - Fill forms (limited data entry)
- `browser_screenshot` - Capture screenshots (privacy concern)
- `browser_keyboard` - Keyboard input (limited typing)
- `browser_get_interactive_elements` - DOM queries

**Effective Limits:**
- Burst: 20 requests instantly
- Sustained: 5 requests/second (300/minute)
- Recovery: Full capacity in 4 seconds

#### LOW Risk Tools (50 tokens, refill 10/sec)
**Threat**: Read-only operations, minimal abuse potential

Tools:
- `browser_history` - Read browsing history
- `browser_bookmark_search` - Search bookmarks
- `browser_console` - Console log reading
- All other read-only tools

**Effective Limits:**
- Burst: 50 requests instantly
- Sustained: 10 requests/second (600/minute)
- Recovery: Full capacity in 5 seconds

## Implementation Details

### Core Components

**File**: `app/chrome-extension/entrypoints/background/rate-limiter.ts`

```typescript
// Token bucket per tool
interface TokenBucket {
  tokens: number;           // Current available tokens
  lastRefill: number;       // Timestamp of last refill
  config: RateLimitConfig;  // Rate limit configuration
  refillTimer?: NodeJS.Timeout; // Auto-refill timer
}

// Rate limiter singleton
class RateLimiter {
  tryConsume(toolName: string): RateLimitResult;
  getRateLimitStatus(toolName: string): RateLimitStatus;
  resetRateLimit(toolName: string): void;
  destroy(): void;
}
```

### Integration Point

**File**: `app/chrome-extension/entrypoints/background/tools/index.ts`

```typescript
export const handleCallTool = async (param: ToolCallParam) => {
  // 1. Validate tool exists
  // 2. Check rate limit <- SECURITY CHECK
  // 3. Execute tool if allowed
  // 4. Log security events
}
```

### Security Logging

All rate limit events are logged with `[SECURITY]` prefix for monitoring:

```typescript
// Successful execution
console.log(`[SECURITY] Tool 'browser_navigate' (HIGH risk) execution allowed. Remaining tokens: 9/10`);

// Rate limit violation
console.warn(`[SECURITY] Rate limit exceeded for HIGH-risk tool 'browser_navigate'. Tokens: 0/10. Retry after: 500ms`);
```

## Monitoring & Administration

### Query Rate Limit Status

```typescript
// Get status for specific tool
const status = await chrome.runtime.sendMessage({
  type: 'GET_RATE_LIMIT_STATUS'
});
// Returns: { toolName, currentTokens, maxTokens, refillRate, riskLevel }

// Get all tool statuses (for dashboard)
const allStatuses = getAllRateLimitStatuses();
```

### Reset Rate Limits (Admin/Testing)

```typescript
// Reset specific tool
await chrome.runtime.sendMessage({
  type: 'RESET_RATE_LIMIT',
  toolName: 'browser_navigate'
});

// Reset all tools
await chrome.runtime.sendMessage({
  type: 'RESET_ALL_RATE_LIMITS'
});
```

## Testing & Validation

### Unit Tests

**File**: `app/chrome-extension/entrypoints/background/rate-limiter.test.ts`

Test Coverage:
- Token consumption and refill
- Bucket capacity limits
- Per-tool isolation
- Different risk levels
- Concurrent request handling
- Status queries and resets
- Error messages
- Resource cleanup

### Integration Tests

**File**: `app/chrome-extension/entrypoints/background/tools/index.test.ts`

Validates:
- Rate limit enforcement in tool handler
- Error message formatting
- Per-tool rate limit isolation
- Security logging

### Manual Testing

**Test Case 1: High-Risk Tool Burst Protection**
```bash
# Should block after 10 rapid calls
for i in {1..15}; do
  callTool('browser_navigate', { url: "https://example.com/$i" })
done
# Expected: First 10 succeed, next 5 blocked
```

**Test Case 2: Token Refill Verification**
```bash
# Exhaust tokens
for i in {1..10}; do callTool('browser_navigate', ...); done
# Wait 5 seconds
sleep 5
# Should have full capacity again (10 tokens)
callTool('browser_navigate', ...) # Should succeed
```

**Test Case 3: Per-Tool Isolation**
```bash
# Exhaust navigate
for i in {1..10}; do callTool('browser_navigate', ...); done
# Screenshot should still work (different bucket)
callTool('browser_screenshot', ...) # Should succeed
```

## Configuration

### Adjusting Rate Limits

**File**: `app/chrome-extension/common/constants.ts`

```typescript
export const LIMITS = {
  RATE_LIMIT: {
    HIGH_RISK: {
      BUCKET_SIZE: 10,      // Increase for higher burst capacity
      REFILL_RATE: 2,       // Increase for faster sustained rate
      REFILL_INTERVAL: 1000 // Decrease for faster refill checks
    },
    // ... MEDIUM_RISK, LOW_RISK
  }
}
```

**Tuning Guidelines:**
- **Increase BUCKET_SIZE**: Allow more burst requests (legitimate bulk operations)
- **Increase REFILL_RATE**: Allow faster sustained usage
- **Decrease REFILL_INTERVAL**: More responsive refilling (higher CPU usage)

### Adding New Tool Classifications

**File**: `app/chrome-extension/entrypoints/background/rate-limiter.ts`

```typescript
// Add to appropriate risk category
const HIGH_RISK_TOOLS = [
  'browser_navigate',
  'your_new_high_risk_tool', // <- Add here
];
```

## Performance Considerations

### Memory Usage

- **Per-tool overhead**: ~200 bytes (bucket + timer)
- **15 active tools**: ~3 KB total
- **Negligible impact** on extension memory

### CPU Usage

- **Refill timers**: 1 setInterval per active tool
- **Timer frequency**: Every 1 second per tool
- **CPU impact**: < 0.1% (minimal)

### Optimization

Token refill uses lazy evaluation:
```typescript
// Refill calculated on-demand, not continuously
refillBucket(bucket) {
  const elapsed = Date.now() - bucket.lastRefill;
  const intervals = Math.floor(elapsed / bucket.config.refillInterval);
  if (intervals > 0) {
    bucket.tokens = Math.min(maxTokens, bucket.tokens + intervals * refillRate);
  }
}
```

## Security Best Practices

### Defense in Depth

Rate limiting is ONE layer of security. Combine with:

1. **Permission Scoping**: Limit tool permissions to minimum required
2. **User Consent**: Require user approval for sensitive operations
3. **Audit Logging**: Log all tool executions for forensics
4. **Anomaly Detection**: Monitor for suspicious patterns
5. **Kill Switch**: Ability to disable tools entirely

### Monitoring Checklist

Monitor logs for:
- [ ] Frequent rate limit violations (indicates potential attack)
- [ ] Unusual tool usage patterns (e.g., mass screenshot capture)
- [ ] High-risk tool bursts near rate limit
- [ ] Multiple tools hitting limits simultaneously
- [ ] Rate limit resets (should be rare in production)

### Incident Response

**If rate limit abuse detected:**

1. **Immediate**: Check security logs for affected tools
2. **Assess**: Determine if attack or legitimate high usage
3. **Mitigate**: Reset rate limits if false positive, or
4. **Block**: Disable affected tools via kill switch
5. **Investigate**: Review full audit logs
6. **Update**: Adjust rate limits if needed

## Future Enhancements

### Potential Improvements

1. **Adaptive Rate Limiting**: Automatically adjust limits based on user behavior
2. **Per-User Limits**: Different limits for different user trust levels
3. **Persistent State**: Save rate limit state across extension restarts
4. **Circuit Breaker**: Temporarily disable tool after repeated violations
5. **Rate Limit Dashboard**: Visual UI for monitoring tool usage
6. **Anomaly Detection**: ML-based detection of suspicious patterns

### Known Limitations

1. **No Cross-Session Persistence**: Rate limits reset on extension restart
2. **No Global Limit**: Individual tools limited, but no total request limit
3. **No IP-Based Limiting**: Cannot rate limit by external factors
4. **Timer Granularity**: 1-second refill intervals (not millisecond precision)

## References

- **Issue**: https://github.com/[repo]/issues/162
- **Token Bucket Algorithm**: https://en.wikipedia.org/wiki/Token_bucket
- **OWASP Rate Limiting**: https://owasp.org/www-community/controls/Rate_Limiting

## Changelog

- **2025-09-30**: Initial implementation (Cycles 1-3)
  - Token bucket rate limiter
  - Risk-based classification
  - Monitoring API
  - Security logging
  - Comprehensive test coverage

---

**Security Contact**: For security concerns, please report via GitHub Security Advisory.
