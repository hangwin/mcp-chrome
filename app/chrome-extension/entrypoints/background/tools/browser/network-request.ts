import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

const DEFAULT_NETWORK_REQUEST_TIMEOUT = 30000; // For sending a single request via content script
const NEW_TAB_LOAD_DELAY_MS = 3000; // Mirrors inject-script / web-fetcher — gives a newly created tab time to hydrate before we run fetch in it.

interface NetworkRequestToolParams {
  url: string; // Request URL (required)
  method?: string; // Defaults to GET
  headers?: Record<string, string>; // User-provided headers
  body?: any; // User-provided body
  timeout?: number; // Timeout for the network request itself
  // Optional multipart/form-data descriptor. When provided, overrides body and lets the helper build FormData.
  // Shape: { fields?: Record<string, string|number|boolean>, files?: Array<{ name: string, fileUrl?: string, filePath?: string, base64Data?: string, filename?: string, contentType?: string }> }
  // Or a compact array: [ [name, fileSpec, filename?], ... ] where fileSpec can be 'url:...', 'file:/abs/path', 'base64:...'
  formData?: any;
  // ─── Tab targeting (added 2026-05) ──────────────────────────────────────
  // Without these the tool fires from the currently active tab, which
  // breaks credentialed cross-origin fetches (the active tab's origin
  // owns the cookies the fetch sees). Pass one of these to make the
  // request fire from a tab at the origin you actually want.
  tabId?: number; // Direct tab id (most precise).
  tabUrl?: string; // Find a tab whose URL matches, or open a new one. Named
  //                 tabUrl rather than url because url is already the
  //                 request URL.
  windowId?: number; // When picking active tab, restrict to this window.
  background?: boolean; // When true (default for this tool — see comment
  //                       in execute), do NOT activate the target tab.
  //                       This diverges from inject-script (which defaults
  //                       to false) because a network call should never
  //                       yank the user out of whatever tab they're
  //                       reading.
}

/**
 * NetworkRequestTool - Sends network requests based on provided parameters.
 *
 * By default the request fires from the currently active tab. To target a
 * specific origin's tab (e.g. for credentialed cross-origin fetches where
 * the request URL's domain must match the tab's origin), pass `tabId`,
 * `tabUrl`, or `windowId`.
 */
class NetworkRequestTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.NETWORK_REQUEST;

  async execute(args: NetworkRequestToolParams): Promise<ToolResult> {
    const {
      url,
      method = 'GET',
      headers = {},
      body,
      timeout = DEFAULT_NETWORK_REQUEST_TIMEOUT,
      tabId,
      tabUrl,
      windowId,
      // Tools that pick a non-active tab should not steal focus on each
      // call. The active-tab fallback (no targeting args) preserves
      // existing behavior — `background` is only consulted when we
      // actually picked a non-active tab.
      background = true,
    } = args;

    console.log(`NetworkRequestTool: Executing with options:`, args);

    if (!url) {
      return createErrorResponse('URL parameter is required.');
    }

    try {
      const targetTabId = await resolveTargetTab({ tabId, tabUrl, windowId, background });
      if (typeof targetTabId !== 'number') {
        return createErrorResponse(targetTabId.error);
      }

      // Ensure content script is available in the target tab
      await this.injectContentScript(targetTabId, ['inject-scripts/network-helper.js']);

      console.log(
        `NetworkRequestTool: Sending to content script (tab ${targetTabId}): URL=${url}, Method=${method}, Headers=${Object.keys(headers).join(',')}, BodyType=${typeof body}`,
      );

      const resultFromContentScript = await this.sendMessageToTab(targetTabId, {
        action: TOOL_MESSAGE_TYPES.NETWORK_SEND_REQUEST,
        url: url,
        method: method,
        headers: headers,
        body: body,
        formData: args.formData || null,
        timeout: timeout,
      });

      console.log(`NetworkRequestTool: Response from content script:`, resultFromContentScript);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(resultFromContentScript),
          },
        ],
        isError: !resultFromContentScript?.success,
      };
    } catch (error: any) {
      console.error('NetworkRequestTool: Error sending network request:', error);
      return createErrorResponse(
        `Error sending network request: ${error.message || String(error)}`,
      );
    }
  }
}

/**
 * Pick a tab to run the network request in, mirroring the tab-resolution
 * pattern used by inject-script and web-fetcher:
 *
 *   1. If `tabId` is supplied, use it directly.
 *   2. Else if `tabUrl` is supplied, find a matching tab; create one if none.
 *   3. Else fall back to the active tab (optionally restricted to a window).
 *
 * Returns a tab id on success, or `{ error: string }` on a known failure.
 * Throws on unexpected chrome.* errors (caller wraps in createErrorResponse).
 */
async function resolveTargetTab(opts: {
  tabId?: number;
  tabUrl?: string;
  windowId?: number;
  background: boolean;
}): Promise<number | { error: string }> {
  const { tabId, tabUrl, windowId, background } = opts;

  if (typeof tabId === 'number') {
    // Validate the tab still exists; chrome.tabs.get throws if not.
    try {
      const tab = await chrome.tabs.get(tabId);
      return tab.id ?? { error: `Tab ${tabId} has no ID` };
    } catch {
      return { error: `Tab ${tabId} does not exist` };
    }
  }

  if (typeof tabUrl === 'string' && tabUrl.length > 0) {
    // Normalize trailing slashes for the match.
    const target = tabUrl.endsWith('/') ? tabUrl.slice(0, -1) : tabUrl;
    const allTabs = await chrome.tabs.query({});
    const match = allTabs.find((t) => {
      const u = t.url?.endsWith('/') ? t.url.slice(0, -1) : t.url;
      return u === target;
    });
    if (match?.id) {
      console.log(`NetworkRequestTool: matched existing tab ${match.id} for url ${tabUrl}`);
      return match.id;
    }
    // No match — open a new tab. Use `active: !background` so callers
    // who opt out of background get focus.
    console.log(`NetworkRequestTool: no tab found for url ${tabUrl}, creating one`);
    const created = await chrome.tabs.create({
      url: tabUrl,
      active: background === true ? false : true,
      windowId,
    });
    // Give the page time to hydrate before we inject the network-helper.
    await new Promise((resolve) => setTimeout(resolve, NEW_TAB_LOAD_DELAY_MS));
    return created.id ?? { error: 'Failed to create tab' };
  }

  // Active-tab fallback. Preserves the pre-2026-05 behavior — no focus
  // change, no tab creation — for callers that don't pass any targeting
  // args.
  const tabs =
    typeof windowId === 'number'
      ? await chrome.tabs.query({ active: true, windowId })
      : await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tabs[0]?.id) {
    return { error: 'No active tab found or tab has no ID.' };
  }
  return tabs[0].id;
}

export const networkRequestTool = new NetworkRequestTool();
