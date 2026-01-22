import { BACKGROUND_MESSAGE_TYPES } from '@/common/message-types';
import type {
  UpsertMarkerRequest,
  ElementMarker,
  MarkerValidationRequest,
  MarkerValidationAction,
} from '@/common/element-marker-types';
import {
  deleteMarker,
  listAllMarkers,
  listMarkersForUrl,
  saveMarker,
  updateMarker,
} from './element-marker-storage';
import { computerTool } from '@/entrypoints/background/tools/browser/computer';
import { clickTool } from '@/entrypoints/background/tools/browser/interaction';
import { keyboardTool } from '@/entrypoints/background/tools/browser/keyboard';

const CONTEXT_MENU_ID = 'element_marker_mark';

/**
 * Extract error message from MCP tool result
 */
function extractToolError(result: any): string | undefined {
  if (!result) return undefined;

  // Check for error in result content array
  if (Array.isArray(result.content)) {
    for (const item of result.content) {
      if (item?.text) {
        try {
          const parsed = JSON.parse(item.text);
          if (parsed?.error) return parsed.error;
          if (parsed?.message) return parsed.message;
        } catch {
          // Not JSON, use as-is
          return item.text;
        }
      }
    }
  }

  // Fallback to direct error field
  return result.error || (result.isError ? 'unknown tool error' : undefined);
}

async function ensureContextMenu() {
  try {
    // Guard: contextMenus permission may be missing
    if (!(chrome as any).contextMenus?.create) return;
    // Remove and re-create our single menu to avoid duplication
    try {
      await chrome.contextMenus.remove(CONTEXT_MENU_ID);
    } catch {}
    await chrome.contextMenus.create({
      id: CONTEXT_MENU_ID,
      title: chrome.i18n.getMessage('contextMenuMarkElement'),
      contexts: ['all'],
    });
  } catch (e) {
    console.warn('ElementMarker: ensureContextMenu failed:', e);
  }
}

/**
 * Check if element-marker.js is already injected in the tab
 * Uses a short timeout to avoid hanging on unresponsive tabs
 */
async function isMarkerInjected(tabId: number): Promise<boolean> {
  try {
    const response = await Promise.race([
      chrome.tabs.sendMessage(tabId, { action: 'element_marker_ping' }),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 300)),
    ]);
    return response?.status === 'pong';
  } catch {
    return false;
  }
}

/**
 * Inject element-marker.js into the tab if not already injected
 */
async function injectMarkerHelper(tabId: number) {
  // Check if already injected via ping
  const alreadyInjected = await isMarkerInjected(tabId);

  if (!alreadyInjected) {
    try {
      await chrome.scripting.executeScript({
        target: { tabId, allFrames: true },
        files: ['inject-scripts/element-marker.js'],
        world: 'ISOLATED',
      } as any);
    } catch (e) {
      // Script injection may fail on some pages (e.g., chrome:// URLs)
      console.warn('ElementMarker: script injection failed:', e);
    }
  }

  try {
    await chrome.tabs.sendMessage(tabId, { action: 'element_marker_start' } as any);
  } catch (e) {
    console.warn('ElementMarker: start overlay failed:', e);
  }
}

export function initElementMarkerListeners() {
  // Ensure context menu on startup
  ensureContextMenu().catch(() => {});

  // Respond to RR triggers refresh by re-ensuring our menu a bit later
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    try {
      switch (message?.type) {
        // Handle element marker start from popup
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_START: {
          const tabId = message.tabId;
          if (typeof tabId !== 'number') {
            sendResponse({ success: false, error: 'invalid tabId' });
            return true;
          }
          injectMarkerHelper(tabId)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_ALL: {
          listAllMarkers()
            .then((markers) => sendResponse({ success: true, markers }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_LIST_FOR_URL: {
          const url = String(message.url || '');
          listMarkersForUrl(url)
            .then((markers) => sendResponse({ success: true, markers }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_SAVE: {
          const req = message.marker as UpsertMarkerRequest;
          saveMarker(req)
            .then((marker) => sendResponse({ success: true, marker }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_UPDATE: {
          const marker = message.marker as ElementMarker;
          updateMarker(marker)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_DELETE: {
          const id = String(message.id || '');
          if (!id) {
            sendResponse({ success: false, error: 'invalid id' });
            return true;
          }
          deleteMarker(id)
            .then(() => sendResponse({ success: true }))
            .catch((e) => sendResponse({ success: false, error: e?.message || String(e) }));
          return true;
        }
        case BACKGROUND_MESSAGE_TYPES.ELEMENT_MARKER_VALIDATE: {
          // Validate via MCP tool chain
          (async () => {
            const req = message as {
              selector: string;
              selectorType?: 'css' | 'xpath';
              action: MarkerValidationAction;
              listMode?: boolean;
              text?: string;
              keys?: string;
              button?: 'left' | 'right' | 'middle';
              bubbles?: boolean;
              cancelable?: boolean;
              modifiers?: any;
              coordinates?: { x: number; y: number };
              offsetX?: number;
              offsetY?: number;
              relativeTo?: 'element' | 'viewport';
            };
            // enrich typing with optional nav + scroll params
            (req as any).waitForNavigation = (message as any).waitForNavigation;
            (req as any).timeoutMs = (message as any).timeoutMs;
            (req as any).scrollDirection = (message as any).scrollDirection;
            (req as any).scrollAmount = (message as any).scrollAmount;
            const selector = String(req.selector || '').trim();
            const selectorType = (req.selectorType || 'css') as 'css' | 'xpath';
            const action = req.action as MarkerValidationAction;
            if (!selector) return sendResponse({ success: false, error: 'selector is required' });
            const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
            const tab = tabs[0];
            if (!tab?.id) return sendResponse({ success: false, error: 'active tab not found' });

            // 1) Ensure helper
            try {
              await chrome.scripting.executeScript({
                target: { tabId: tab.id, allFrames: true },
                files: ['inject-scripts/accessibility-tree-helper.js'],
                world: 'ISOLATED',
              } as any);
            } catch {}

            // 2) Resolve selector -> ref/center via helper (same as tools)
            let ensured: any;
            try {
              ensured = await chrome.tabs.sendMessage(tab.id, {
                action: 'ensureRefForSelector',
                selector,
                isXPath: selectorType === 'xpath',
                allowMultiple: !!req.listMode,
              } as any);
            } catch (e) {
              return sendResponse({
                success: false,
                error: String(e instanceof Error ? e.message : e),
              });
            }
            if (!ensured || !ensured.success || !ensured.ref) {
              return sendResponse({
                success: false,
                error: ensured?.error || 'failed to resolve selector',
              });
            }

            const base = {
              success: true,
              resolved: true,
              ref: ensured.ref,
              center: ensured.center,
            } as any;

            // Compute optional coordinates from offsets
            let coords: { x: number; y: number } | undefined = undefined;
            if (
              req.coordinates &&
              typeof req.coordinates.x === 'number' &&
              typeof req.coordinates.y === 'number'
            ) {
              coords = { x: Math.round(req.coordinates.x), y: Math.round(req.coordinates.y) };
            } else if (
              req.relativeTo === 'element' &&
              ensured.center &&
              (typeof req.offsetX === 'number' || typeof req.offsetY === 'number')
            ) {
              const dx = Number.isFinite(req.offsetX as any) ? (req.offsetX as number) : 0;
              const dy = Number.isFinite(req.offsetY as any) ? (req.offsetY as number) : 0;
              coords = { x: ensured.center.x + dx, y: ensured.center.y + dy };
            }

            // 3) Dispatch to appropriate tool for end-to-end validation
            try {
              switch (action) {
                case 'hover': {
                  const r = await computerTool.execute(
                    coords
                      ? { action: 'hover', coordinates: coords }
                      : ({ action: 'hover', ref: ensured.ref } as any),
                  );
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'computer.hover', ok: !r.isError, error };
                  break;
                }
                case 'left_click': {
                  const r = await clickTool.execute({
                    ...(coords ? { coordinates: coords } : { ref: ensured.ref }),
                    waitForNavigation: !!req.waitForNavigation,
                    timeout: Number.isFinite(req.timeoutMs as any)
                      ? (req.timeoutMs as number)
                      : 3000,
                    button: (req.button || 'left') as any,
                    modifiers: req.modifiers || {},
                  } as any);
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'interaction.click', ok: !r.isError, error };
                  break;
                }
                case 'double_click': {
                  const r = await clickTool.execute({
                    ...(coords ? { coordinates: coords } : { ref: ensured.ref }),
                    double: true,
                    waitForNavigation: !!req.waitForNavigation,
                    timeout: Number.isFinite(req.timeoutMs as any)
                      ? (req.timeoutMs as number)
                      : 3000,
                    button: (req.button || 'left') as any,
                    modifiers: req.modifiers || {},
                  } as any);
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'interaction.click(double)', ok: !r.isError, error };
                  break;
                }
                case 'right_click': {
                  const r = await clickTool.execute({
                    ...(coords ? { coordinates: coords } : { ref: ensured.ref }),
                    waitForNavigation: !!req.waitForNavigation,
                    timeout: Number.isFinite(req.timeoutMs as any)
                      ? (req.timeoutMs as number)
                      : 3000,
                    button: 'right',
                    modifiers: req.modifiers || {},
                  } as any);
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'interaction.click(right)', ok: !r.isError, error };
                  break;
                }
                case 'scroll': {
                  const direction = (req as any).scrollDirection || 'down';
                  const amount = Number.isFinite((req as any).scrollAmount)
                    ? Number((req as any).scrollAmount)
                    : 300;
                  const payload = coords
                    ? {
                        action: 'scroll',
                        scrollDirection: direction,
                        scrollAmount: amount,
                        coordinates: coords,
                      }
                    : ({
                        action: 'scroll',
                        scrollDirection: direction,
                        scrollAmount: amount,
                        ref: ensured.ref,
                      } as any);
                  const r = await computerTool.execute(payload as any);
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'computer.scroll', ok: !r.isError, error };
                  break;
                }
                case 'type_text': {
                  const text = String(req.text || '');
                  const r = await computerTool.execute({ action: 'type', ref: ensured.ref, text });
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'computer.type', ok: !r.isError, error };
                  break;
                }
                case 'press_keys': {
                  const keys = String(req.keys || '');
                  // Focus first by ref to ensure key target
                  try {
                    await clickTool.execute({
                      ref: ensured.ref,
                      waitForNavigation: false,
                      timeout: 2000,
                    });
                  } catch {}
                  const r = await keyboardTool.execute({ keys, delay: 0 } as any);
                  const error = r.isError ? extractToolError(r) : undefined;
                  base.tool = { name: 'keyboard.simulate', ok: !r.isError, error };
                  break;
                }
                default: {
                  base.tool = { name: 'noop', ok: true };
                }
              }
            } catch (e) {
              console.warn('[ElementMarker] Validation failed before tool execution', e);
              base.tool = {
                name: 'unknown',
                ok: false,
                error: String(e instanceof Error ? e.message : e),
              };
            }

            // Log tool failures for debugging
            if (base.tool && base.tool.ok === false) {
              console.warn('[ElementMarker] Tool validation failure', {
                action,
                toolName: base.tool.name,
                error: base.tool.error,
                selector,
                selectorType,
              });
            }

            return sendResponse(base);
          })();
          return true;
        }
        // When RR refresh (or similar) happens, re-add our menu
        case BACKGROUND_MESSAGE_TYPES.RR_REFRESH_TRIGGERS:
        case BACKGROUND_MESSAGE_TYPES.RR_SAVE_TRIGGER:
        case BACKGROUND_MESSAGE_TYPES.RR_DELETE_TRIGGER: {
          setTimeout(() => ensureContextMenu().catch(() => {}), 300);
          break;
        }
      }
    } catch (e) {
      sendResponse({ success: false, error: (e as any)?.message || String(e) });
    }
    return false;
  });

  // Context menu click routing
  if ((chrome as any).contextMenus?.onClicked?.addListener) {
    chrome.contextMenus.onClicked.addListener(async (info, tab) => {
      try {
        if (info.menuItemId === CONTEXT_MENU_ID && tab?.id) {
          await injectMarkerHelper(tab.id);
        }
      } catch (e) {
        console.warn('ElementMarker: context menu click failed:', e);
      }
    });
  }
}
