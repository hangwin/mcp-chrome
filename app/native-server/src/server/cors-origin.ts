/**
 * CORS origin validation for the native server's HTTP API.
 *
 * Split out of server/index.ts so it can be unit tested without pulling in
 * that file's much heavier dependency graph (MCP transports, agent engines,
 * db, ...).
 */

/**
 * Checks a request's `Origin` header against SERVER_CONFIG.CORS_ORIGIN.
 *
 * String entries in the allowlist (e.g. `'http://127.0.0.1'`) used to be
 * matched with `origin.startsWith(pattern)`, which is a substring match, not
 * an origin match: `http://127.0.0.1.evil.com` (a domain an attacker fully
 * controls, registered under their own zone) satisfies
 * `startsWith('http://127.0.0.1')` even though it shares no host with
 * 127.0.0.1. Verified live: with `credentials: true` also set on the CORS
 * plugin, that origin got `access-control-allow-origin` reflected back and
 * `access-control-allow-credentials: true`, so any site hosted at such a
 * domain could drive this server's full MCP surface (browser automation -
 * navigation, script execution, cookies, screenshots) from any tab, with no
 * user interaction beyond visiting the page.
 *
 * String entries are now compared as an origin (scheme + hostname, matching
 * any port, since the existing entries never specify one) via the WHATWG URL
 * parser instead of a raw string prefix, closing that off. RegExp entries
 * (used for `chrome-extension://`/`moz-extension://`) are unaffected.
 */
export function isOriginAllowed(origin: string, patterns: readonly (string | RegExp)[]): boolean {
  let parsedOrigin: URL;
  try {
    parsedOrigin = new URL(origin);
  } catch {
    return false;
  }

  return patterns.some((pattern) => {
    if (pattern instanceof RegExp) {
      return pattern.test(origin);
    }
    let parsedPattern: URL;
    try {
      parsedPattern = new URL(pattern);
    } catch {
      return false;
    }
    return (
      parsedOrigin.protocol === parsedPattern.protocol &&
      parsedOrigin.hostname === parsedPattern.hostname
    );
  });
}
