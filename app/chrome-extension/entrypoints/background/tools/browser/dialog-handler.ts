import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { TIMEOUTS, ERROR_MESSAGES } from '@/common/constants';

const DEBUGGER_PROTOCOL_VERSION = '1.3';
const DEFAULT_DIALOG_TIMEOUT = 5000;

interface DismissDialogParams {
  accept?: boolean;
  promptText?: string;
  timeout?: number;
}

interface DialogInfo {
  type: string; // 'alert' | 'confirm' | 'prompt' | 'beforeunload'
  message: string;
  defaultPrompt?: string;
}

interface DialogResult {
  success: boolean;
  message: string;
  dialogInfo?: DialogInfo;
  action: string;
  waitTime?: number;
}

/**
 * Tool for dismissing JavaScript dialogs (alert, confirm, prompt, beforeunload)
 *
 * This tool uses Chrome Debugger Protocol to detect and dismiss JavaScript dialogs
 * that may be blocking page automation. It supports:
 * - alert(): Always accepts
 * - confirm(): Can accept (OK) or cancel
 * - prompt(): Can accept with custom text or cancel
 * - beforeunload: Can accept (leave page) or cancel (stay)
 *
 * Usage:
 * - Call this tool when MCP operations timeout due to dialog blocking
 * - The tool will wait up to `timeout` ms for a dialog to appear
 * - If a dialog is already present, it will be dismissed immediately
 */
class DismissDialogTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.DISMISS_DIALOG;

  async execute(args: DismissDialogParams): Promise<ToolResult> {
    const { accept = true, promptText = '', timeout = DEFAULT_DIALOG_TIMEOUT } = args;

    console.log(`[DismissDialogTool] Starting with options:`, {
      accept,
      promptText: promptText ? `"${promptText}"` : '(empty)',
      timeout,
    });

    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
      }

      const tabId = tabs[0].id;
      const tabUrl = tabs[0].url || 'unknown';
      console.log(`[DismissDialogTool] Target tab ${tabId}: ${tabUrl}`);

      // Check if debugger is already attached
      const isDebuggerAvailable = await this.checkDebuggerAvailability(tabId);
      if (!isDebuggerAvailable) {
        return createErrorResponse(
          `Debugger is already attached to tab ${tabId} by another tool (DevTools or extension). Please close DevTools and try again.`,
        );
      }

      // Handle dialog dismissal
      const result = await this.dismissDialog(tabId, { accept, promptText, timeout });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result, null, 2),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('[DismissDialogTool] Error:', error);
      return createErrorResponse(
        `Error dismissing dialog: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Check if debugger can be attached to the tab
   */
  private async checkDebuggerAvailability(tabId: number): Promise<boolean> {
    try {
      const targets = await chrome.debugger.getTargets();
      const existingTarget = targets.find(
        (t) => t.tabId === tabId && t.attached && t.type === 'page',
      );

      // Allow if not attached, or if attached by this extension
      return !existingTarget || existingTarget.extensionId === chrome.runtime.id;
    } catch (error) {
      console.warn('[DismissDialogTool] Could not check debugger targets:', error);
      return true; // Proceed anyway
    }
  }

  /**
   * Dismiss a JavaScript dialog on the specified tab
   *
   * This method:
   * 1. Attaches Chrome Debugger to the tab
   * 2. Enables Page domain to receive dialog events
   * 3. Waits for Page.javascriptDialogOpening event (or timeout)
   * 4. Dismisses dialog using Page.handleJavaScriptDialog
   * 5. Detaches debugger and cleans up
   */
  private async dismissDialog(
    tabId: number,
    options: {
      accept: boolean;
      promptText: string;
      timeout: number;
    },
  ): Promise<DialogResult> {
    const { accept, promptText, timeout } = options;
    const startTime = Date.now();
    let dialogInfo: DialogInfo | undefined;
    let debuggerAttached = false;
    let eventListenerAdded = false;

    return new Promise<DialogResult>(async (resolve, reject) => {
      let timeoutId: NodeJS.Timeout | undefined;
      let eventListener: ((source: chrome.debugger.Debuggee, method: string, params?: any) => void) | undefined;

      // Cleanup function to ensure resources are freed
      const cleanup = async (detachDebugger: boolean = true) => {
        if (timeoutId) {
          clearTimeout(timeoutId);
          timeoutId = undefined;
        }

        if (eventListener && eventListenerAdded) {
          chrome.debugger.onEvent.removeListener(eventListener);
          eventListenerAdded = false;
        }

        if (debuggerAttached && detachDebugger) {
          try {
            await chrome.debugger.detach({ tabId });
            console.log(`[DismissDialogTool] Debugger detached from tab ${tabId}`);
          } catch (error) {
            console.warn(`[DismissDialogTool] Error detaching debugger:`, error);
          }
          debuggerAttached = false;
        }
      };

      // Set timeout for dialog detection
      timeoutId = setTimeout(async () => {
        console.log(`[DismissDialogTool] Timeout after ${timeout}ms waiting for dialog`);
        await cleanup();
        reject(
          new Error(
            `No dialog appeared within ${timeout}ms. The page may not have any active dialogs, or the dialog was already dismissed.`,
          ),
        );
      }, timeout);

      // Define event listener for dialog events
      eventListener = async (source: chrome.debugger.Debuggee, method: string, params?: any) => {
        // Only handle events from our target tab
        if (source.tabId !== tabId) return;

        if (method === 'Page.javascriptDialogOpening' && params) {
          const waitTime = Date.now() - startTime;
          console.log(`[DismissDialogTool] Dialog detected after ${waitTime}ms:`, {
            type: params.type,
            message: params.message?.substring(0, 100),
            defaultPrompt: params.defaultPrompt,
          });

          // Store dialog info
          dialogInfo = {
            type: params.type,
            message: params.message || '',
            defaultPrompt: params.defaultPrompt,
          };

          try {
            // Prepare dialog response
            const dialogResponse: any = {
              accept: accept,
            };

            // Only include promptText for prompt dialogs
            if (params.type === 'prompt') {
              dialogResponse.promptText = promptText;
            }

            // Dismiss the dialog
            await chrome.debugger.sendCommand({ tabId }, 'Page.handleJavaScriptDialog', dialogResponse);

            console.log(`[DismissDialogTool] Dialog dismissed successfully:`, {
              type: params.type,
              action: accept ? 'accepted' : 'cancelled',
              promptText: params.type === 'prompt' ? promptText : 'N/A',
            });

            // Clean up and resolve
            await cleanup();

            resolve({
              success: true,
              message: `Successfully dismissed ${params.type} dialog`,
              dialogInfo: dialogInfo,
              action: accept ? 'accepted' : 'cancelled',
              waitTime: waitTime,
            });
          } catch (error) {
            console.error(`[DismissDialogTool] Error dismissing dialog:`, error);
            await cleanup();
            reject(error);
          }
        } else if (method === 'Page.javascriptDialogClosed' && params) {
          // Dialog was closed (possibly by user or another script)
          console.log(`[DismissDialogTool] Dialog was closed externally`);
        }
      };

      try {
        // Attach debugger
        console.log(`[DismissDialogTool] Attaching debugger to tab ${tabId}...`);
        await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION);
        debuggerAttached = true;
        console.log(`[DismissDialogTool] Debugger attached successfully`);

        // Add event listener BEFORE enabling Page domain
        chrome.debugger.onEvent.addListener(eventListener);
        eventListenerAdded = true;

        // Enable Page domain to receive dialog events
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable');
        console.log(`[DismissDialogTool] Page domain enabled, waiting for dialog events...`);

      } catch (error: any) {
        console.error(`[DismissDialogTool] Error during setup:`, error);
        await cleanup(false); // Don't try to detach if attach failed

        // Provide helpful error messages
        if (error.message?.includes('Cannot attach')) {
          reject(
            new Error(
              `Cannot attach debugger to tab ${tabId}. Please close Chrome DevTools if open, or check if another extension is using the debugger.`,
            ),
          );
        } else if (error.message?.includes('No tab with given id')) {
          reject(new Error(`Tab ${tabId} not found. It may have been closed.`));
        } else {
          reject(error);
        }
      }
    });
  }
}

export const dismissDialogTool = new DismissDialogTool();
