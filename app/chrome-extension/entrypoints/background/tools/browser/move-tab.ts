import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface MoveTabToolParams {
  tabId: number;
  windowId?: number;
  index?: number;
  newWindow?: boolean;
  focused?: boolean;
}

/**
 * Move an existing tab to another window (or detach into a new window) without
 * reloading the page. Tab state — scroll position, navigation history, form
 * input, etc. — is preserved because the underlying renderer is reattached
 * rather than recreated.
 */
class MoveTabTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.MOVE_TAB;

  async execute(args: MoveTabToolParams): Promise<ToolResult> {
    const { tabId, windowId, index, newWindow = false, focused = true } = args;

    if (typeof tabId !== 'number') {
      return createErrorResponse('tabId is required');
    }
    if (newWindow && windowId !== undefined) {
      return createErrorResponse('Cannot specify both newWindow and windowId');
    }
    if (!newWindow && windowId === undefined) {
      return createErrorResponse('Either windowId or newWindow=true must be provided');
    }

    console.log(
      `Attempting to move tab ${tabId} to ${newWindow ? 'a new window' : `window ${windowId}`}` +
        (typeof index === 'number' ? ` at index ${index}` : ''),
    );

    try {
      let targetWindowId: number;
      let movedTab: chrome.tabs.Tab;

      if (newWindow) {
        // Detach into a brand-new window. chrome.windows.create({ tabId })
        // reattaches the existing tab; it does not reload.
        const win = await chrome.windows.create({ tabId, focused });
        if (!win || typeof win.id !== 'number') {
          return createErrorResponse('Failed to create new window');
        }
        targetWindowId = win.id;
        movedTab = await chrome.tabs.get(tabId);
      } else {
        const result = await chrome.tabs.move(tabId, {
          windowId: windowId as number,
          index: typeof index === 'number' ? index : -1,
        });
        movedTab = Array.isArray(result) ? result[0] : result;
        targetWindowId = windowId as number;
        if (focused) {
          await chrome.windows.update(targetWindowId, { focused: true });
        }
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: newWindow
                ? `Successfully moved tab ${tabId} to a new window`
                : `Successfully moved tab ${tabId} to window ${targetWindowId}`,
              tabId: movedTab.id,
              windowId: movedTab.windowId,
              index: movedTab.index,
              url: movedTab.url,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      if (chrome.runtime.lastError) {
        console.error(`Chrome API Error: ${chrome.runtime.lastError.message}`, error);
        return createErrorResponse(`Chrome API Error: ${chrome.runtime.lastError.message}`);
      }
      console.error('Error in MoveTabTool.execute:', error);
      return createErrorResponse(
        `Error moving tab: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const moveTabTool = new MoveTabTool();
