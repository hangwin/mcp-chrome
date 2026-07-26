import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import { ERROR_MESSAGES, TIMEOUTS } from '@/common/constants';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import { clickTool, fillTool } from './interaction';
import { keyboardTool } from './keyboard';
import { screenshotTool } from './screenshot';
import { screenshotContextManager, scaleCoordinates } from '@/utils/screenshot-context';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import {
  captureFrameOnAction,
  isAutoCaptureActive,
  type ActionMetadata,
  type ActionType,
} from './gif-recorder';

type MouseButton = 'left' | 'right' | 'middle';

interface Coordinates {
  x: number;
  y: number;
}

interface ZoomRegion {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}

interface Modifiers {
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
  shiftKey?: boolean;
}

interface ComputerParams {
  action:
    | 'left_click'
    | 'right_click'
    | 'double_click'
    | 'triple_click'
    | 'left_click_drag'
    | 'scroll'
    | 'type'
    | 'key'
    | 'hover'
    | 'wait'
    | 'fill'
    | 'fill_form'
    | 'resize_page'
    | 'scroll_to'
    | 'zoom'
    | 'screenshot';
  // click/scroll coordinates in screenshot space (if screenshot context exists) or viewport space
  coordinates?: Coordinates; // for click/scroll; for drag, this is endCoordinates
  startCoordinates?: Coordinates; // for drag start
  // Optional element refs (from chrome_read_page) as alternative to coordinates
  ref?: string; // click target or drag end
  startRef?: string; // drag start
  scrollDirection?: 'up' | 'down' | 'left' | 'right';
  scrollAmount?: number;
  text?: string; // for type/key
  repeat?: number; // for key action (1-100)
  modifiers?: Modifiers; // for click actions
  region?: ZoomRegion; // for zoom action
  duration?: number; // seconds for wait
  // For fill
  selector?: string;
  selectorType?: 'css' | 'xpath'; // Type of selector (default: 'css')
  value?: string;
  frameId?: number; // Target frame for selector/ref resolution
  tabId?: number; // target existing tab id
  windowId?: number;
  background?: boolean; // default true: avoid focusing/activating; set false to foreground
}

// Minimal CDP helper encapsulated here to avoid scattering CDP code
class CDPHelper {
  static async attach(tabId: number): Promise<void> {
    await cdpSessionManager.attach(tabId, 'computer');
  }

  static async detach(tabId: number): Promise<void> {
    await cdpSessionManager.detach(tabId, 'computer');
  }

  static async send(tabId: number, method: string, params?: object): Promise<any> {
    return await cdpSessionManager.sendCommand(tabId, method, params);
  }

  static async dispatchMouseEvent(tabId: number, opts: any) {
    const params: any = {
      type: opts.type,
      x: Math.round(opts.x),
      y: Math.round(opts.y),
      modifiers: opts.modifiers || 0,
    };
    if (
      opts.type === 'mousePressed' ||
      opts.type === 'mouseReleased' ||
      opts.type === 'mouseMoved'
    ) {
      params.button = opts.button || 'none';
      if (opts.type === 'mousePressed' || opts.type === 'mouseReleased') {
        params.clickCount = opts.clickCount || 1;
      }
      // Per CDP: buttons is ignored for mouseWheel
      params.buttons = opts.buttons !== undefined ? opts.buttons : 0;
    }
    if (opts.type === 'mouseWheel') {
      params.deltaX = opts.deltaX || 0;
      params.deltaY = opts.deltaY || 0;
    }
    await this.send(tabId, 'Input.dispatchMouseEvent', params);
  }

  static async insertText(tabId: number, text: string) {
    await this.send(tabId, 'Input.insertText', { text });
  }

  static modifierMask(mods: string[]): number {
    const map: Record<string, number> = {
      alt: 1,
      ctrl: 2,
      control: 2,
      meta: 4,
      cmd: 4,
      command: 4,
      win: 4,
      windows: 4,
      shift: 8,
    };
    let mask = 0;
    for (const m of mods) mask |= map[m] || 0;
    return mask;
  }

  // Enhanced key mapping for common non-character keys
  private static KEY_ALIASES: Record<string, { key: string; code?: string; text?: string }> = {
    enter: { key: 'Enter', code: 'Enter' },
    return: { key: 'Enter', code: 'Enter' },
    backspace: { key: 'Backspace', code: 'Backspace' },
    delete: { key: 'Delete', code: 'Delete' },
    tab: { key: 'Tab', code: 'Tab' },
    escape: { key: 'Escape', code: 'Escape' },
    esc: { key: 'Escape', code: 'Escape' },
    space: { key: ' ', code: 'Space', text: ' ' },
    pageup: { key: 'PageUp', code: 'PageUp' },
    pagedown: { key: 'PageDown', code: 'PageDown' },
    home: { key: 'Home', code: 'Home' },
    end: { key: 'End', code: 'End' },
    arrowup: { key: 'ArrowUp', code: 'ArrowUp' },
    arrowdown: { key: 'ArrowDown', code: 'ArrowDown' },
    arrowleft: { key: 'ArrowLeft', code: 'ArrowLeft' },
    arrowright: { key: 'ArrowRight', code: 'ArrowRight' },
  };

  private static resolveKeyDef(token: string): { key: string; code?: string; text?: string } {
    const t = (token || '').toLowerCase();
    if (this.KEY_ALIASES[t]) return this.KEY_ALIASES[t];
    if (/^f([1-9]|1[0-2])$/.test(t)) {
      return { key: t.toUpperCase(), code: t.toUpperCase() };
    }
    if (t.length === 1) {
      const upper = t.toUpperCase();
      return { key: upper, code: `Key${upper}`, text: t };
    }
    return { key: token };
  }

  static async dispatchSimpleKey(tabId: number, token: string) {
    const def = this.resolveKeyDef(token);
    if (def.text && def.text.length === 1) {
      await this.insertText(tabId, def.text);
      return;
    }
    await this.send(tabId, 'Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: def.key,
      code: def.code,
    });
    await this.send(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: def.key,
      code: def.code,
    });
  }

  static async dispatchKeyChord(tabId: number, chord: string) {
    const parts = chord.split('+');
    const modifiers: string[] = [];
    let keyToken = '';
    for (const pRaw of parts) {
      const p = pRaw.trim().toLowerCase();
      if (
        ['ctrl', 'control', 'alt', 'shift', 'cmd', 'meta', 'command', 'win', 'windows'].includes(p)
      )
        modifiers.push(p);
      else keyToken = pRaw.trim();
    }
    const mask = this.modifierMask(modifiers);
    const def = this.resolveKeyDef(keyToken);
    await this.send(tabId, 'Input.dispatchKeyEvent', {
      type: 'rawKeyDown',
      key: def.key,
      code: def.code,
      text: def.text,
      modifiers: mask,
    });
    await this.send(tabId, 'Input.dispatchKeyEvent', {
      type: 'keyUp',
      key: def.key,
      code: def.code,
      modifiers: mask,
    });
  }
}

class ComputerTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.COMPUTER;

  async execute(args: ComputerParams): Promise<ToolResult> {
    const params = args || ({} as ComputerParams);
    if (!params.action) return createErrorResponse('Action parameter is required');

    try {
      const explicit = await this.tryGetTab(args.tabId);
      const tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));
      if (!tab.id)
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND + ': Active tab has no ID');

      // Execute the action and capture frame on success
      const result = await this.executeAction(params, tab);

      // Trigger auto-capture on successful actions (except screenshot which is read-only)
      if (!result.isError && params.action !== 'screenshot' && params.action !== 'wait') {
        const actionType = this.mapActionToCapture(params.action);
        if (actionType) {
          // Convert to viewport-space coordinates for GIF overlays
          // params.coordinates may be screenshot-space when screenshot context exists
          const ctx = screenshotContextManager.getContext(tab.id);
          const toViewport = (c?: Coordinates): { x: number; y: number } | undefined => {
            if (!c) return undefined;
            if (!ctx) return { x: c.x, y: c.y };
            const scaled = scaleCoordinates(c.x, c.y, ctx);
            return { x: scaled.x, y: scaled.y };
          };

          const endCoords = toViewport(params.coordinates);
          const startCoords = toViewport(params.startCoordinates);

          await this.triggerAutoCapture(tab.id, actionType, {
            coordinateSpace: 'viewport',
            coordinates: endCoords,
            startCoordinates: startCoords,
            endCoordinates: actionType === 'drag' ? endCoords : undefined,
            text: params.text,
            ref: params.ref,
          });
        }
      }

      return result;
    } catch (error) {
      console.error('Error in computer tool:', error);
      return createErrorResponse(
        `Failed to execute action: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private mapActionToCapture(action: string): ActionType | null {
    const mapping: Record<string, ActionType> = {
      left_click: 'click',
      right_click: 'right_click',
      double_click: 'double_click',
      triple_click: 'triple_click',
      left_click_drag: 'drag',
      scroll: 'scroll',
      type: 'type',
      key: 'key',
      hover: 'hover',
      fill: 'fill',
      fill_form: 'fill',
      resize_page: 'other',
      scroll_to: 'scroll',
      zoom: 'other',
    };
    return mapping[action] || null;
  }

  private async executeAction(params: ComputerParams, tab: chrome.tabs.Tab): Promise<ToolResult> {
    if (!tab.id) {
      return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND + ': Active tab has no ID');
    }

    // Helper to project coordinates using screenshot context when available
    const project = (c?: Coordinates): Coordinates | undefined => {
      if (!c) return undefined;
      const ctx = screenshotContextManager.getContext(tab.id!);
      if (!ctx) return c;
      const scaled = scaleCoordinates(c.x, c.y, ctx);
      return { x: scaled.x, y: scaled.y };
    };

    switch (params.action) {
      case 'resize_page': {
        const width = Number((params as any).coordinates?.x || (params as any).text);
        const height = Number((params as any).coordinates?.y || (params as any).value);
        const w = Number((params as any).width ?? width);
        const h = Number((params as any).height ?? height);
        if (!Number.isFinite(w) || !Number.isFinite(h) || w <= 0 || h <= 0) {
          return createErrorResponse('Provide width and height for resize_page (positive numbers)');
        }
        try {
          // Prefer precise CDP emulation
          await CDPHelper.attach(tab.id);
          try {
            await CDPHelper.send(tab.id, 'Emulation.setDeviceMetricsOverride', {
              width: Math.round(w),
              height: Math.round(h),
              deviceScaleFactor: 0,
              mobile: false,
              screenWidth: Math.round(w),
              screenHeight: Math.round(h),
            });
          } finally {
            await CDPHelper.detach(tab.id);
          }
        } catch (e) {
          // Fallback: window resize
          if (tab.windowId !== undefined) {
            await chrome.windows.update(tab.windowId, {
              width: Math.round(w),
              height: Math.round(h),
            });
          } else {
            return createErrorResponse(
              `Failed to resize via CDP and cannot determine windowId: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        }
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ success: true, action: 'resize_page', width: w, height: h }),
            },
          ],
          isError: false,
        };
      }
      case 'hover': {
        // Resolve target point from ref | selector | coordinates
        let coord: Coordinates | undefined = undefined;
        let resolvedBy: 'ref' | 'selector' | 'coordinates' | undefined;

        try {
          if (params.ref) {
            await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
            // Scroll element into view first to ensure it's visible
            try {
              await this.sendMessageToTab(tab.id, { action: 'focusByRef', ref: params.ref });
            } catch {
              // Best effort - continue even if scroll fails
            }
            // Re-resolve coordinates after scroll
            const resolved = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
              ref: params.ref,
            });
            if (resolved && resolved.success) {
              coord = project({ x: resolved.center.x, y: resolved.center.y });
              resolvedBy = 'ref';
            }
          } else if (params.selector) {
            await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
            const selectorType = params.selectorType || 'css';
            const ensured = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.ENSURE_REF_FOR_SELECTOR,
              selector: params.selector,
              isXPath: selectorType === 'xpath',
            });
            if (ensured && ensured.success) {
              // Scroll element into view first to ensure it's visible
              const resolvedRef = typeof ensured.ref === 'string' ? ensured.ref : undefined;
              if (resolvedRef) {
                try {
                  await this.sendMessageToTab(tab.id, { action: 'focusByRef', ref: resolvedRef });
                } catch {
                  // Best effort - continue even if scroll fails
                }
                // Re-resolve coordinates after scroll
                const reResolved = await this.sendMessageToTab(tab.id, {
                  action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
                  ref: resolvedRef,
                });
                if (reResolved && reResolved.success) {
                  coord = project({ x: reResolved.center.x, y: reResolved.center.y });
                } else {
                  coord = project({ x: ensured.center.x, y: ensured.center.y });
                }
              } else {
                coord = project({ x: ensured.center.x, y: ensured.center.y });
              }
              resolvedBy = 'selector';
            }
          } else if (params.coordinates) {
            coord = project(params.coordinates);
            resolvedBy = 'coordinates';
          }
        } catch (e) {
          // fall through to error handling below
        }

        if (!coord)
          return createErrorResponse(
            'Provide ref or selector or coordinates for hover, or failed to resolve target',
          );
        {
          const stale = ((): any => {
            if (!params.coordinates) return null;
            const getHostname = (url: string): string => {
              try {
                return new URL(url).hostname;
              } catch {
                return '';
              }
            };
            const currentHostname = getHostname(tab.url || '');
            const ctx = screenshotContextManager.getContext(tab.id!);
            const contextHostname = (ctx as any)?.hostname as string | undefined;
            if (contextHostname && contextHostname !== currentHostname) {
              return createErrorResponse(
                `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during hover. Capture a new screenshot or use ref/selector.`,
              );
            }
            return null;
          })();
          if (stale) return stale;
        }

        try {
          await CDPHelper.attach(tab.id);
          try {
            // Move pointer to target. We can dispatch a single mouseMoved; browsers will generate mouseover/mouseenter as needed.
            await CDPHelper.dispatchMouseEvent(tab.id, {
              type: 'mouseMoved',
              x: coord.x,
              y: coord.y,
              button: 'none',
              buttons: 0,
            });
          } finally {
            await CDPHelper.detach(tab.id);
          }

          // Optional hold to allow UI (menus/tooltips) to appear
          const holdMs = Math.max(
            0,
            Math.min(params.duration ? params.duration * 1000 : 400, 5000),
          );
          if (holdMs > 0) await new Promise((r) => setTimeout(r, holdMs));

          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'hover',
                  coordinates: coord,
                  resolvedBy,
                  transport: 'cdp',
                }),
              },
            ],
            isError: false,
          };
        } catch (error) {
          console.warn('[ComputerTool] CDP hover failed, attempting DOM fallback', error);
          return await this.domHoverFallback(tab.id, coord, resolvedBy, params.ref);
        }
      }
      case 'left_click':
      case 'right_click': {
        // Calculate CDP modifier mask for click events
        const modifiersMask = CDPHelper.modifierMask(
          [
            params.modifiers?.altKey ? 'alt' : undefined,
            params.modifiers?.ctrlKey ? 'ctrl' : undefined,
            params.modifiers?.metaKey ? 'meta' : undefined,
            params.modifiers?.shiftKey ? 'shift' : undefined,
          ].filter((v): v is string => typeof v === 'string'),
        );

        if (params.ref) {
          // Prefer DOM click via ref
          const domResult = await clickTool.execute({
            ref: params.ref,
            waitForNavigation: false,
            timeout: TIMEOUTS.DEFAULT_WAIT * 5,
            button: params.action === 'right_click' ? 'right' : 'left',
            modifiers: params.modifiers,
          });
          return domResult;
        }
        if (params.selector) {
          // Support selector-based click
          const domResult = await clickTool.execute({
            selector: params.selector,
            selectorType: params.selectorType,
            frameId: params.frameId,
            waitForNavigation: false,
            timeout: TIMEOUTS.DEFAULT_WAIT * 5,
            button: params.action === 'right_click' ? 'right' : 'left',
            modifiers: params.modifiers,
          });
          return domResult;
        }
        if (!params.coordinates)
          return createErrorResponse('Provide ref, selector, or coordinates for click action');
        {
          const stale = ((): any => {
            const getHostname = (url: string): string => {
              try {
                return new URL(url).hostname;
              } catch {
                return '';
              }
            };
            const currentHostname = getHostname(tab.url || '');
            const ctx = screenshotContextManager.getContext(tab.id!);
            const contextHostname = (ctx as any)?.hostname as string | undefined;
            if (contextHostname && contextHostname !== currentHostname) {
              return createErrorResponse(
                `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during ${params.action}. Capture a new screenshot or use ref/selector.`,
              );
            }
            return null;
          })();
          if (stale) return stale;
        }
        const coord = project(params.coordinates)!;
        // Prefer DOM path via existing click tool
        const domResult = await clickTool.execute({
          coordinates: coord,
          waitForNavigation: false,
          timeout: TIMEOUTS.DEFAULT_WAIT * 5,
          button: params.action === 'right_click' ? 'right' : 'left',
          modifiers: params.modifiers,
        });
        if (!domResult.isError) {
          return domResult; // Standardized response from click tool
        }
        // Fallback to CDP if DOM failed
        try {
          await CDPHelper.attach(tab.id);
          const button: MouseButton = params.action === 'right_click' ? 'right' : 'left';
          const clickCount = 1;
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseMoved',
            x: coord.x,
            y: coord.y,
            button: 'none',
            buttons: 0,
            modifiers: modifiersMask,
          });
          for (let i = 1; i <= clickCount; i++) {
            await CDPHelper.dispatchMouseEvent(tab.id, {
              type: 'mousePressed',
              x: coord.x,
              y: coord.y,
              button,
              buttons: button === 'left' ? 1 : 2,
              clickCount: i,
              modifiers: modifiersMask,
            });
            await CDPHelper.dispatchMouseEvent(tab.id, {
              type: 'mouseReleased',
              x: coord.x,
              y: coord.y,
              button,
              buttons: 0,
              clickCount: i,
              modifiers: modifiersMask,
            });
          }
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: params.action,
                  coordinates: coord,
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          return createErrorResponse(
            `CDP click failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      case 'double_click':
      case 'triple_click': {
        // Calculate CDP modifier mask for click events
        const modifiersMask = CDPHelper.modifierMask(
          [
            params.modifiers?.altKey ? 'alt' : undefined,
            params.modifiers?.ctrlKey ? 'ctrl' : undefined,
            params.modifiers?.metaKey ? 'meta' : undefined,
            params.modifiers?.shiftKey ? 'shift' : undefined,
          ].filter((v): v is string => typeof v === 'string'),
        );

        if (!params.coordinates && !params.ref && !params.selector)
          return createErrorResponse(
            'Provide ref, selector, or coordinates for double/triple click',
          );
        let coord = params.coordinates ? project(params.coordinates)! : (undefined as any);
        // If ref is provided, resolve center via accessibility helper
        if (params.ref) {
          try {
            await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
            const resolved = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
              ref: params.ref,
            });
            if (resolved && resolved.success) {
              coord = project({ x: resolved.center.x, y: resolved.center.y })!;
            }
          } catch (e) {
            // ignore and use provided coordinates
          }
        } else if (params.selector) {
          // Support selector-based click
          try {
            await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
            const selectorType = params.selectorType || 'css';
            const ensured = await this.sendMessageToTab(
              tab.id,
              {
                action: TOOL_MESSAGE_TYPES.ENSURE_REF_FOR_SELECTOR,
                selector: params.selector,
                isXPath: selectorType === 'xpath',
              },
              params.frameId,
            );
            if (ensured && ensured.success) {
              coord = project({ x: ensured.center.x, y: ensured.center.y })!;
            }
          } catch (e) {
            // ignore
          }
        }
        if (!coord) return createErrorResponse('Failed to resolve coordinates from ref/selector');
        {
          const stale = ((): any => {
            if (!params.coordinates) return null;
            const getHostname = (url: string): string => {
              try {
                return new URL(url).hostname;
              } catch {
                return '';
              }
            };
            const currentHostname = getHostname(tab.url || '');
            const ctx = screenshotContextManager.getContext(tab.id!);
            const contextHostname = (ctx as any)?.hostname as string | undefined;
            if (contextHostname && contextHostname !== currentHostname) {
              return createErrorResponse(
                `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during ${params.action}. Capture a new screenshot or use ref/selector.`,
              );
            }
            return null;
          })();
          if (stale) return stale;
        }
        try {
          await CDPHelper.attach(tab.id);
          const button: MouseButton = 'left';
          const clickCount = params.action === 'double_click' ? 2 : 3;
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseMoved',
            x: coord.x,
            y: coord.y,
            button: 'none',
            buttons: 0,
            modifiers: modifiersMask,
          });
          for (let i = 1; i <= clickCount; i++) {
            await CDPHelper.dispatchMouseEvent(tab.id, {
              type: 'mousePressed',
              x: coord.x,
              y: coord.y,
              button,
              buttons: 1,
              clickCount: i,
              modifiers: modifiersMask,
            });
            await CDPHelper.dispatchMouseEvent(tab.id, {
              type: 'mouseReleased',
              x: coord.x,
              y: coord.y,
              button,
              buttons: 0,
              clickCount: i,
              modifiers: modifiersMask,
            });
          }
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: params.action,
                  coordinates: coord,
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          return createErrorResponse(
            `CDP ${params.action} failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      case 'left_click_drag': {
        if (!params.startCoordinates && !params.startRef)
          return createErrorResponse('Provide startRef or startCoordinates for drag');
        if (!params.coordinates && !params.ref)
          return createErrorResponse('Provide ref or end coordinates for drag');
        let start = params.startCoordinates
          ? project(params.startCoordinates)!
          : (undefined as any);
        let end = params.coordinates ? project(params.coordinates)! : (undefined as any);
        {
          const stale = ((): any => {
            if (!params.startCoordinates && !params.coordinates) return null;
            const getHostname = (url: string): string => {
              try {
                return new URL(url).hostname;
              } catch {
                return '';
              }
            };
            const currentHostname = getHostname(tab.url || '');
            const ctx = screenshotContextManager.getContext(tab.id!);
            const contextHostname = (ctx as any)?.hostname as string | undefined;
            if (contextHostname && contextHostname !== currentHostname) {
              return createErrorResponse(
                `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during left_click_drag. Capture a new screenshot or use ref/selector.`,
              );
            }
            return null;
          })();
          if (stale) return stale;
        }
        if (params.startRef || params.ref) {
          await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
        }
        if (params.startRef) {
          try {
            const resolved = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
              ref: params.startRef,
            });
            if (resolved && resolved.success)
              start = project({ x: resolved.center.x, y: resolved.center.y })!;
          } catch {
            // ignore
          }
        }
        if (params.ref) {
          try {
            const resolved = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
              ref: params.ref,
            });
            if (resolved && resolved.success)
              end = project({ x: resolved.center.x, y: resolved.center.y })!;
          } catch {
            // ignore
          }
        }
        if (!start || !end) return createErrorResponse('Failed to resolve drag coordinates');
        try {
          await CDPHelper.attach(tab.id);
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseMoved',
            x: start.x,
            y: start.y,
            button: 'none',
            buttons: 0,
          });
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mousePressed',
            x: start.x,
            y: start.y,
            button: 'left',
            buttons: 1,
            clickCount: 1,
          });
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseMoved',
            x: end.x,
            y: end.y,
            button: 'left',
            buttons: 1,
          });
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseReleased',
            x: end.x,
            y: end.y,
            button: 'left',
            buttons: 0,
            clickCount: 1,
          });
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, action: 'left_click_drag', start, end }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          return createErrorResponse(`Drag failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      case 'scroll': {
        if (!params.coordinates && !params.ref)
          return createErrorResponse('Provide ref or coordinates for scroll');
        let coord = params.coordinates ? project(params.coordinates)! : (undefined as any);
        if (params.ref) {
          try {
            await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
            const resolved = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
              ref: params.ref,
            });
            if (resolved && resolved.success)
              coord = project({ x: resolved.center.x, y: resolved.center.y })!;
          } catch {
            // ignore
          }
        }
        if (!coord) return createErrorResponse('Failed to resolve scroll coordinates');
        {
          const stale = ((): any => {
            if (!params.coordinates) return null;
            const getHostname = (url: string): string => {
              try {
                return new URL(url).hostname;
              } catch {
                return '';
              }
            };
            const currentHostname = getHostname(tab.url || '');
            const ctx = screenshotContextManager.getContext(tab.id!);
            const contextHostname = (ctx as any)?.hostname as string | undefined;
            if (contextHostname && contextHostname !== currentHostname) {
              return createErrorResponse(
                `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during scroll. Capture a new screenshot or use ref/selector.`,
              );
            }
            return null;
          })();
          if (stale) return stale;
        }
        const direction = params.scrollDirection || 'down';
        const amount = Math.max(1, Math.min(params.scrollAmount || 3, 10));
        // Convert to deltas (~100px per tick)
        const unit = 100;
        let deltaX = 0,
          deltaY = 0;
        if (direction === 'up') deltaY = -amount * unit;
        if (direction === 'down') deltaY = amount * unit;
        if (direction === 'left') deltaX = -amount * unit;
        if (direction === 'right') deltaX = amount * unit;
        try {
          await CDPHelper.attach(tab.id);
          await CDPHelper.dispatchMouseEvent(tab.id, {
            type: 'mouseWheel',
            x: coord.x,
            y: coord.y,
            deltaX,
            deltaY,
          });
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'scroll',
                  coordinates: coord,
                  deltaX,
                  deltaY,
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          return createErrorResponse(
            `Scroll failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      case 'type': {
        if (!params.text) return createErrorResponse('Text parameter is required for type action');
        try {
          // Optional focus via ref before typing
          if (params.ref) {
            await clickTool.execute({
              ref: params.ref,
              waitForNavigation: false,
              timeout: TIMEOUTS.DEFAULT_WAIT * 5,
            });
          }
          await CDPHelper.attach(tab.id);
          // Use CDP insertText to avoid complex KeyboardEvent emulation for long text
          await CDPHelper.insertText(tab.id, params.text);
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'type',
                  length: params.text.length,
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          // Fallback to DOM-based keyboard tool
          const res = await keyboardTool.execute({
            keys: params.text.split('').join(','),
            delay: 0,
            selector: undefined,
          });
          return res;
        }
      }
      case 'fill': {
        if (!params.ref && !params.selector) {
          return createErrorResponse('Provide ref or selector and a value for fill');
        }
        // Reuse existing fill tool to leverage robust DOM event behavior
        const res = await fillTool.execute({
          selector: params.selector as any,
          selectorType: params.selectorType as any,
          ref: params.ref as any,
          value: params.value as any,
        } as any);
        return res;
      }
      case 'fill_form': {
        const elements = (params as any).elements as Array<{
          ref: string;
          value: string | number | boolean;
        }>;
        if (!Array.isArray(elements) || elements.length === 0) {
          return createErrorResponse('elements must be a non-empty array for fill_form');
        }
        const results: Array<{ ref: string; ok: boolean; error?: string }> = [];
        for (const item of elements) {
          if (!item || !item.ref) {
            results.push({ ref: String(item?.ref || ''), ok: false, error: 'missing ref' });
            continue;
          }
          try {
            const r = await fillTool.execute({
              ref: item.ref as any,
              value: item.value as any,
            } as any);
            const ok = !r.isError;
            results.push({ ref: item.ref, ok, error: ok ? undefined : 'failed' });
          } catch (e) {
            results.push({
              ref: item.ref,
              ok: false,
              error: String(e instanceof Error ? e.message : e),
            });
          }
        }
        const successCount = results.filter((r) => r.ok).length;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                action: 'fill_form',
                filled: successCount,
                total: results.length,
                results,
              }),
            },
          ],
          isError: false,
        };
      }
      case 'key': {
        if (!params.text)
          return createErrorResponse(
            'text is required for key action (e.g., "Backspace Backspace Enter" or "cmd+a")',
          );
        const tokens = params.text.trim().split(/\s+/).filter(Boolean);
        const repeat = params.repeat ?? 1;
        if (!Number.isInteger(repeat) || repeat < 1 || repeat > 100) {
          return createErrorResponse('repeat must be an integer between 1 and 100 for key action');
        }
        try {
          // Optional focus via ref before key events
          if (params.ref) {
            await clickTool.execute({
              ref: params.ref,
              waitForNavigation: false,
              timeout: TIMEOUTS.DEFAULT_WAIT * 5,
            });
          }
          await CDPHelper.attach(tab.id);
          for (let i = 0; i < repeat; i++) {
            for (const t of tokens) {
              if (t.includes('+')) await CDPHelper.dispatchKeyChord(tab.id, t);
              else await CDPHelper.dispatchSimpleKey(tab.id, t);
            }
          }
          await CDPHelper.detach(tab.id);
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, action: 'key', keys: tokens, repeat }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          // Fallback to DOM keyboard simulation (comma-separated combinations)
          const keysStr = tokens.join(',');
          const repeatedKeys =
            repeat === 1 ? keysStr : Array.from({ length: repeat }, () => keysStr).join(',');
          const res = await keyboardTool.execute({ keys: repeatedKeys });
          return res;
        }
      }
      case 'wait': {
        const hasTextCondition =
          typeof (params as any).text === 'string' && (params as any).text.trim().length > 0;
        if (hasTextCondition) {
          try {
            // Conditional wait for text appearance/disappearance using content script
            await this.injectContentScript(
              tab.id,
              ['inject-scripts/wait-helper.js'],
              false,
              'ISOLATED',
              true,
            );
            const appear = (params as any).appear !== false; // default to true
            const timeoutMs = Math.max(
              0,
              Math.min(((params as any).timeout as number) || 10000, 120000),
            );
            const resp = await this.sendMessageToTab(tab.id, {
              action: TOOL_MESSAGE_TYPES.WAIT_FOR_TEXT,
              text: (params as any).text,
              appear,
              timeout: timeoutMs,
            });
            if (!resp || resp.success !== true) {
              return createErrorResponse(
                resp && resp.reason === 'timeout'
                  ? `wait_for timed out after ${timeoutMs}ms for text: ${(params as any).text}`
                  : `wait_for failed: ${resp && resp.error ? resp.error : 'unknown error'}`,
              );
            }
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify({
                    success: true,
                    action: 'wait_for',
                    appear,
                    text: (params as any).text,
                    matched: resp.matched || null,
                    tookMs: resp.tookMs,
                  }),
                },
              ],
              isError: false,
            };
          } catch (e) {
            return createErrorResponse(
              `wait_for failed: ${e instanceof Error ? e.message : String(e)}`,
            );
          }
        } else {
          const seconds = Math.max(0, Math.min((params as any).duration || 0, 30));
          if (!seconds)
            return createErrorResponse('Duration parameter is required and must be > 0');
          await new Promise((r) => setTimeout(r, seconds * 1000));
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({ success: true, action: 'wait', duration: seconds }),
              },
            ],
            isError: false,
          };
        }
      }
      case 'scroll_to': {
        if (!params.ref) {
          return createErrorResponse('ref is required for scroll_to action');
        }
        try {
          await this.injectContentScript(tab.id, ['inject-scripts/accessibility-tree-helper.js']);
          const resp = await this.sendMessageToTab(tab.id, {
            action: 'focusByRef',
            ref: params.ref,
          });
          if (!resp || resp.success !== true) {
            return createErrorResponse(resp?.error || 'scroll_to failed: element not found');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'scroll_to',
                  ref: params.ref,
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          return createErrorResponse(
            `scroll_to failed: ${e instanceof Error ? e.message : String(e)}`,
          );
        }
      }
      case 'zoom': {
        const region = params.region;
        if (!region) {
          return createErrorResponse('region is required for zoom action');
        }
        const x0 = Number(region.x0);
        const y0 = Number(region.y0);
        const x1 = Number(region.x1);
        const y1 = Number(region.y1);
        if (![x0, y0, x1, y1].every(Number.isFinite)) {
          return createErrorResponse('region must contain finite numbers (x0, y0, x1, y1)');
        }
        if (x0 < 0 || y0 < 0 || x1 <= x0 || y1 <= y0) {
          return createErrorResponse('Invalid region: require x0>=0, y0>=0 and x1>x0, y1>y0');
        }

        // Project coordinates from screenshot space to viewport space
        const p0 = project({ x: x0, y: y0 })!;
        const p1 = project({ x: x1, y: y1 })!;
        const rx0 = Math.min(p0.x, p1.x);
        const ry0 = Math.min(p0.y, p1.y);
        const rx1 = Math.max(p0.x, p1.x);
        const ry1 = Math.max(p0.y, p1.y);
        const w = rx1 - rx0;
        const h = ry1 - ry0;
        if (w <= 0 || h <= 0) {
          return createErrorResponse('Invalid region after projection');
        }

        // Security check: verify domain hasn't changed since last screenshot
        {
          const getHostname = (url: string): string => {
            try {
              return new URL(url).hostname;
            } catch {
              return '';
            }
          };
          const ctx = screenshotContextManager.getContext(tab.id!);
          const contextHostname = (ctx as any)?.hostname as string | undefined;
          const currentHostname = getHostname(tab.url || '');
          if (contextHostname && contextHostname !== currentHostname) {
            return createErrorResponse(
              `Security check failed: Domain changed since last screenshot (from ${contextHostname} to ${currentHostname}) during zoom. Capture a new screenshot first.`,
            );
          }
        }

        try {
          await CDPHelper.attach(tab.id);
          const metrics: any = await CDPHelper.send(tab.id, 'Page.getLayoutMetrics', {});
          const viewport = metrics?.layoutViewport ||
            metrics?.visualViewport || {
              clientWidth: 800,
              clientHeight: 600,
              pageX: 0,
              pageY: 0,
            };
          const vw = Math.round(Number(viewport.clientWidth || 800));
          const vh = Math.round(Number(viewport.clientHeight || 600));
          if (rx1 > vw || ry1 > vh) {
            await CDPHelper.detach(tab.id);
            return createErrorResponse(
              `Region exceeds viewport boundaries (${vw}x${vh}). Choose a region within the visible viewport.`,
            );
          }
          const pageX = Number(viewport.pageX || 0);
          const pageY = Number(viewport.pageY || 0);

          const shot: any = await CDPHelper.send(tab.id, 'Page.captureScreenshot', {
            format: 'png',
            captureBeyondViewport: false,
            fromSurface: true,
            clip: {
              x: pageX + rx0,
              y: pageY + ry0,
              width: w,
              height: h,
              scale: 1,
            },
          });
          await CDPHelper.detach(tab.id);

          const base64Data = String(shot?.data || '');
          if (!base64Data) {
            return createErrorResponse('Failed to capture zoom screenshot via CDP');
          }
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'zoom',
                  mimeType: 'image/png',
                  base64Data,
                  region: { x0: rx0, y0: ry0, x1: rx1, y1: ry1 },
                }),
              },
            ],
            isError: false,
          };
        } catch (e) {
          await CDPHelper.detach(tab.id);
          return createErrorResponse(`zoom failed: ${e instanceof Error ? e.message : String(e)}`);
        }
      }
      case 'screenshot': {
        // Reuse existing screenshot tool; it already supports base64 save option
        const result = await screenshotTool.execute({
          name: 'computer',
          storeBase64: true,
          fullPage: false,
        });
        return result;
      }
      default:
        return createErrorResponse(`Unsupported action: ${params.action}`);
    }
  }

  /**
   * DOM-based hover fallback when CDP is unavailable
   * Tries ref-based approach first (works with iframes), falls back to coordinates
   */
  private async domHoverFallback(
    tabId: number,
    coord?: Coordinates,
    resolvedBy?: 'ref' | 'selector' | 'coordinates',
    ref?: string,
  ): Promise<ToolResult> {
    // Try ref-based approach first (handles iframes correctly)
    if (ref) {
      try {
        const resp = await this.sendMessageToTab(tabId, {
          action: TOOL_MESSAGE_TYPES.DISPATCH_HOVER_FOR_REF,
          ref,
        });
        if (resp?.success) {
          return {
            content: [
              {
                type: 'text',
                text: JSON.stringify({
                  success: true,
                  action: 'hover',
                  resolvedBy: 'ref',
                  transport: 'dom-ref',
                  target: resp.target,
                }),
              },
            ],
            isError: false,
          };
        }
      } catch (error) {
        console.warn('[ComputerTool] DOM ref hover failed, falling back to coordinates', error);
      }
    }

    // Fallback to coordinate-based approach
    if (!coord) {
      return createErrorResponse('Hover fallback requires coordinates or ref');
    }

    try {
      const [injection] = await chrome.scripting.executeScript({
        target: { tabId },
        world: 'MAIN',
        func: (point) => {
          const target = document.elementFromPoint(point.x, point.y);
          if (!target) {
            return { success: false, error: 'No element found at coordinates' };
          }

          // Dispatch hover-related events
          for (const type of ['mousemove', 'mouseover', 'mouseenter']) {
            target.dispatchEvent(
              new MouseEvent(type, {
                bubbles: true,
                cancelable: true,
                clientX: point.x,
                clientY: point.y,
                view: window,
              }),
            );
          }

          return {
            success: true,
            target: {
              tagName: target.tagName,
              id: target.id,
              className: target.className,
              text: target.textContent?.trim()?.slice(0, 100) || '',
            },
          };
        },
        args: [coord],
      });

      const payload = injection?.result;
      if (!payload?.success) {
        return createErrorResponse(payload?.error || 'DOM hover fallback failed');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              action: 'hover',
              coordinates: coord,
              resolvedBy,
              transport: 'dom',
              target: payload.target,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `DOM hover fallback failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Trigger GIF auto-capture after a successful action.
   * This is a no-op if auto-capture is not active.
   */
  private async triggerAutoCapture(
    tabId: number,
    actionType: ActionType,
    metadata?: Partial<ActionMetadata>,
  ): Promise<void> {
    if (!isAutoCaptureActive(tabId)) {
      return;
    }

    try {
      await captureFrameOnAction(tabId, {
        type: actionType,
        ...metadata,
      });
    } catch (error) {
      // Log but don't fail the main action
      console.warn('[ComputerTool] Auto-capture failed:', error);
    }
  }
}

export const computerTool = new ComputerTool();
