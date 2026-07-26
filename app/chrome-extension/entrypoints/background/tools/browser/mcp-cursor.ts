/**
 * MCP built-in page cursor — visible click pointer for live browser automation.
 * Not demo-recorder specific: shows in the real tab during chrome_click / computer actions.
 */

import { BaseBrowserToolExecutor } from '../base-browser';

const CURSOR_SCRIPT = 'inject-scripts/mcp-cursor.js';

class McpCursorInjector extends BaseBrowserToolExecutor {
  name = 'mcp_cursor';

  async execute(): Promise<never> {
    throw new Error('mcp_cursor is an internal helper, not an MCP tool');
  }

  async ensure(tabId: number): Promise<void> {
    await this.injectContentScript(tabId, [CURSOR_SCRIPT]);
  }
}

const injector = new McpCursorInjector();

export async function ensureMcpCursor(tabId: number): Promise<void> {
  await injector.ensure(tabId);
}

/**
 * Show the MCP cursor and click pulse at viewport CSS coordinates.
 * Soft-fails so automation never breaks if injection is blocked.
 */
export async function showMcpCursorClick(
  tabId: number,
  x: number,
  y: number,
  options: { holdMs?: number; hideAfterMs?: number; animateMove?: boolean } = {},
): Promise<void> {
  if (!Number.isFinite(x) || !Number.isFinite(y)) return;
  try {
    await ensureMcpCursor(tabId);
    await chrome.tabs.sendMessage(tabId, {
      action: 'mcp_cursor_click',
      x,
      y,
      options,
    });
  } catch (error) {
    console.warn('[McpCursor] showClick failed:', error);
  }
}

/**
 * Resolve a viewport point from click tool result / args, then show cursor.
 */
export async function showMcpCursorForClickTarget(
  tabId: number,
  coords?: { x: number; y: number } | null,
  rect?: {
    left?: number;
    top?: number;
    width?: number;
    height?: number;
    x?: number;
    y?: number;
  } | null,
): Promise<{ x: number; y: number } | null> {
  let point: { x: number; y: number } | null = null;
  if (coords && Number.isFinite(coords.x) && Number.isFinite(coords.y)) {
    point = { x: coords.x, y: coords.y };
  } else if (rect) {
    const left = rect.left ?? rect.x ?? 0;
    const top = rect.top ?? rect.y ?? 0;
    const width = rect.width ?? 0;
    const height = rect.height ?? 0;
    point = {
      x: Math.round(left + width / 2),
      y: Math.round(top + height / 2),
    };
  }
  if (!point) return null;
  await showMcpCursorClick(tabId, point.x, point.y);
  return point;
}
