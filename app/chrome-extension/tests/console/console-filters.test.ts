/**
 * @fileoverview chrome_console filter helpers
 * @description Verifies level / regex / since filtering shared by snapshot and buffer modes
 */

import { describe, expect, it } from 'vitest';

import {
  exceptionMatchesFilters,
  isErrorLevel,
  messageMatchesFilters,
  normalizeConsoleLevel,
  parseLevelFilter,
  parseRegexPattern,
  parseSince,
} from '@/entrypoints/background/tools/browser/console-filters';

describe('normalizeConsoleLevel', () => {
  it('lowercases, trims and maps warn to warning', () => {
    expect(normalizeConsoleLevel(' WARN ')).toBe('warning');
    expect(normalizeConsoleLevel('warning')).toBe('warning');
    expect(normalizeConsoleLevel('Error')).toBe('error');
    expect(normalizeConsoleLevel(undefined)).toBe('');
  });

  it('treats error and assert as error levels', () => {
    expect(isErrorLevel('error')).toBe(true);
    expect(isErrorLevel('ASSERT')).toBe(true);
    expect(isErrorLevel('warning')).toBe(false);
  });
});

describe('parseLevelFilter', () => {
  it('returns undefined when no levels are given', () => {
    expect(parseLevelFilter(undefined)).toBeUndefined();
    expect(parseLevelFilter(null)).toBeUndefined();
    expect(parseLevelFilter([])).toBeUndefined();
    expect(parseLevelFilter(['', '  '])).toBeUndefined();
  });

  it('accepts a single string or an array and normalizes values', () => {
    expect(parseLevelFilter('warn')).toEqual(new Set(['warning']));
    expect(parseLevelFilter(['Error', 'warn', 'warning'])).toEqual(new Set(['error', 'warning']));
  });

  it('rejects non-string entries', () => {
    expect(() => parseLevelFilter([1])).toThrow(/Invalid levels/);
    expect(() => parseLevelFilter({ level: 'error' })).toThrow(/Invalid levels/);
  });
});

describe('parseSince', () => {
  it('returns undefined when omitted and passes finite numbers through', () => {
    expect(parseSince(undefined)).toBeUndefined();
    expect(parseSince(null)).toBeUndefined();
    expect(parseSince(0)).toBe(0);
    expect(parseSince(1700000000000)).toBe(1700000000000);
  });

  it('rejects non-numeric or non-finite values', () => {
    expect(() => parseSince('2024-01-01')).toThrow(/Invalid since/);
    expect(() => parseSince(Number.NaN)).toThrow(/Invalid since/);
    expect(() => parseSince(Number.POSITIVE_INFINITY)).toThrow(/Invalid since/);
  });
});

describe('parseRegexPattern', () => {
  it('supports plain and /pattern/flags syntax', () => {
    expect(parseRegexPattern(undefined)).toBeUndefined();
    expect(parseRegexPattern('   ')).toBeUndefined();
    expect(parseRegexPattern('fail(ed)?')?.test('request failed')).toBe(true);
    expect(parseRegexPattern('/TIMEOUT/i')?.test('timeout after 5s')).toBe(true);
  });

  it('throws a descriptive error for invalid patterns', () => {
    expect(() => parseRegexPattern('(')).toThrow(/Invalid regex pattern/);
  });
});

describe('messageMatchesFilters', () => {
  const messages = [
    { timestamp: 100, level: 'log', text: 'app started' },
    { timestamp: 200, level: 'warning', text: 'deprecated API used' },
    { timestamp: 300, level: 'error', text: 'request failed: 500' },
    { timestamp: 400, level: 'info', text: 'request ok' },
    { timestamp: 500, level: 'assert', text: 'assertion failed' },
  ];

  const pick = (options: Parameters<typeof messageMatchesFilters>[1]) =>
    messages.filter((m) => messageMatchesFilters(m, options)).map((m) => m.timestamp);

  it('keeps everything without filters', () => {
    expect(pick({})).toEqual([100, 200, 300, 400, 500]);
  });

  it('filters by levels, including the warn alias', () => {
    expect(pick({ levels: parseLevelFilter(['warn', 'error']) })).toEqual([200, 300]);
    expect(pick({ levels: parseLevelFilter('info') })).toEqual([400]);
  });

  it('treats a missing level as log', () => {
    expect(messageMatchesFilters({ timestamp: 1, text: 'x' }, { levels: new Set(['log']) })).toBe(
      true,
    );
  });

  it('filters by since (inclusive)', () => {
    expect(pick({ since: 300 })).toEqual([300, 400, 500]);
    expect(pick({ since: 501 })).toEqual([]);
  });

  it('combines levels, pattern, since and onlyErrors', () => {
    expect(pick({ pattern: /request/, since: 250 })).toEqual([300, 400]);
    expect(pick({ levels: parseLevelFilter(['error', 'info']), pattern: /request/ })).toEqual([
      300, 400,
    ]);
    expect(pick({ onlyErrors: true })).toEqual([300, 500]);
    expect(pick({ onlyErrors: true, levels: parseLevelFilter(['error', 'warning']) })).toEqual([
      300,
    ]);
  });

  it('is not affected by global regex lastIndex state', () => {
    const pattern = /request/g;
    expect(pick({ pattern })).toEqual([300, 400]);
    expect(pick({ pattern })).toEqual([300, 400]);
  });
});

describe('exceptionMatchesFilters', () => {
  it('applies since and pattern but ignores levels and onlyErrors', () => {
    const exception = { timestamp: 1000, text: 'TypeError: x is undefined' };
    expect(exceptionMatchesFilters(exception, { levels: new Set(['warning']) })).toBe(true);
    expect(exceptionMatchesFilters(exception, { onlyErrors: true })).toBe(true);
    expect(exceptionMatchesFilters(exception, { since: 1000 })).toBe(true);
    expect(exceptionMatchesFilters(exception, { since: 1001 })).toBe(false);
    expect(exceptionMatchesFilters(exception, { pattern: /TypeError/ })).toBe(true);
    expect(exceptionMatchesFilters(exception, { pattern: /RangeError/ })).toBe(false);
  });
});
