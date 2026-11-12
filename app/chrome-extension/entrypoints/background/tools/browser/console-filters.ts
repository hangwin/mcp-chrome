/**
 * Shared filtering helpers for the chrome_console tool (snapshot and buffer modes).
 *
 * Kept free of chrome.* APIs so the filtering rules can be unit tested in isolation.
 */

export interface ConsoleFilterOptions {
  /** Regex applied to message / exception text */
  pattern?: RegExp;
  /** Only keep error-level messages (error/assert) */
  onlyErrors?: boolean;
  /** Only keep messages whose (normalized) level is in this set */
  levels?: ReadonlySet<string>;
  /** Only keep entries with timestamp >= since (epoch milliseconds) */
  since?: number;
}

export interface ConsoleFilterableMessage {
  timestamp: number;
  level?: string;
  text?: string;
}

export interface ConsoleFilterableException {
  timestamp: number;
  text?: string;
}

/**
 * Normalize a console level so that CDP `Runtime.consoleAPICalled` types
 * (e.g. "warning"), `Log.entryAdded` levels and the user-facing names
 * (e.g. "warn") can be compared directly.
 */
export function normalizeConsoleLevel(level?: string): string {
  const normalized = (level || '').trim().toLowerCase();
  if (normalized === 'warn') return 'warning';
  return normalized;
}

export function isErrorLevel(level?: string): boolean {
  const normalized = normalizeConsoleLevel(level);
  return normalized === 'error' || normalized === 'assert';
}

export function matchesPattern(pattern: RegExp, text: string): boolean {
  pattern.lastIndex = 0;
  return pattern.test(text);
}

/**
 * Parse a regex filter. Supports both plain patterns and /pattern/flags syntax.
 * Returns undefined for empty input and throws a descriptive error for invalid patterns.
 */
export function parseRegexPattern(pattern?: string): RegExp | undefined {
  if (typeof pattern !== 'string') return undefined;
  const trimmed = pattern.trim();
  if (!trimmed) return undefined;
  // 支持 /pattern/flags 语法
  const match = trimmed.match(/^\/(.+)\/([gimsuy]*)$/);
  try {
    return match ? new RegExp(match[1], match[2]) : new RegExp(trimmed);
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e);
    throw new Error(`Invalid regex pattern: ${msg}`);
  }
}

/**
 * Parse the `levels` parameter. Accepts a single level string or an array of level strings.
 * Returns undefined when no level filter should be applied.
 */
export function parseLevelFilter(levels?: unknown): Set<string> | undefined {
  if (levels === undefined || levels === null) return undefined;
  const list = Array.isArray(levels) ? levels : [levels];
  const result = new Set<string>();
  for (const level of list) {
    if (typeof level !== 'string') {
      throw new Error('Invalid levels: expected a string or an array of strings.');
    }
    const normalized = normalizeConsoleLevel(level);
    if (normalized) result.add(normalized);
  }
  return result.size > 0 ? result : undefined;
}

/**
 * Parse the `since` parameter (epoch milliseconds, e.g. a previous call's captureEndTime).
 * Returns undefined when no time filter should be applied.
 */
export function parseSince(since?: unknown): number | undefined {
  if (since === undefined || since === null) return undefined;
  if (typeof since !== 'number' || !Number.isFinite(since)) {
    throw new Error('Invalid since: expected a timestamp in milliseconds since the Unix epoch.');
  }
  return since;
}

export function messageMatchesFilters(
  message: ConsoleFilterableMessage,
  options: ConsoleFilterOptions,
): boolean {
  const { pattern, onlyErrors = false, levels, since } = options;
  if (typeof since === 'number' && message.timestamp < since) return false;
  if (onlyErrors && !isErrorLevel(message.level)) return false;
  if (levels && !levels.has(normalizeConsoleLevel(message.level || 'log'))) return false;
  if (pattern && !matchesPattern(pattern, message.text || '')) return false;
  return true;
}

/**
 * Exceptions have no console level, so `levels` / `onlyErrors` do not apply to them;
 * use `includeExceptions` to drop them entirely.
 */
export function exceptionMatchesFilters(
  exception: ConsoleFilterableException,
  options: ConsoleFilterOptions,
): boolean {
  const { pattern, since } = options;
  if (typeof since === 'number' && exception.timestamp < since) return false;
  if (pattern && !matchesPattern(pattern, exception.text || '')) return false;
  return true;
}
