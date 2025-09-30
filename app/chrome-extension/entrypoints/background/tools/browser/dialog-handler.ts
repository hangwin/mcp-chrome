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

/**
 * Tool for dismissing JavaScript dialogs (alert, confirm, prompt)
 */
class DismissDialogTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.DISMISS_DIALOG;

  async execute(args: DismissDialogParams): Promise<ToolResult> {
    const { accept = true, promptText = '', timeout = DEFAULT_DIALOG_TIMEOUT } = args;

    console.log(`Starting dialog dismissal with options:`, args);

    try {
      // Get current active tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]?.id) {
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
      }

      const tabId = tabs[0].id;

      // Check if debugger is already attached
      const targets = await chrome.debugger.getTargets();
      const existingTarget = targets.find(
        (t) => t.tabId === tabId && t.attached && t.type === 'page',
      );

      if (existingTarget && existingTarget.extensionId !== chrome.runtime.id) {
        return createErrorResponse(
          `Debugger is already attached to tab ${tabId} by another tool (e.g., DevTools).`,
        );
      }

      // Handle dialog dismissal
      const result = await this.dismissDialog(tabId, { accept, promptText, timeout });

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(result),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in dialog dismissal:', error);
      return createErrorResponse(
        `Error dismissing dialog: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  /**
   * Dismiss a JavaScript dialog on the specified tab
   */
  private async dismissDialog(
    tabId: number,
    options: {
      accept: boolean;
      promptText: string;
      timeout: number;
    },
  ): Promise<{
    success: boolean;
    message: string;
    dialogInfo?: DialogInfo;
    action: string;
  }> {
    const { accept, promptText, timeout } = options;
    let dialogInfo: DialogInfo | undefined;
    let debuggerAttached = false;

    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        // Clean up
        if (debuggerAttached) {
          chrome.debugger.onEvent.removeListener(eventListener);
          chrome.debugger.detach({ tabId }).catch(() => {});
        }
        reject(new Error(`Timeout waiting for dialog to appear (${timeout}ms)`));
      }, timeout);

      const eventListener = async (
        source: chrome.debugger.Debuggee,
        method: string,
        params?: any,
      ) => {
        if (source.tabId !== tabId) return;

        if (method === 'Page.javascriptDialogOpening' && params) {
          console.log('Dialog detected:', params);

          // Store dialog info
          dialogInfo = {
            type: params.type,
            message: params.message,
            defaultPrompt: params.defaultPrompt,
          };

          try {
            // Dismiss the dialog
            await chrome.debugger.sendCommand({ tabId }, 'Page.handleJavaScriptDialog', {
              accept: accept,
              promptText: params.type === 'prompt' ? promptText : undefined,
            });

            console.log(
              `Dialog dismissed: type=${params.type}, accept=${accept}, promptText=${promptText}`,
            );

            // Clean up
            clearTimeout(timeoutId);
            chrome.debugger.onEvent.removeListener(eventListener);
            await chrome.debugger.detach({ tabId });
            debuggerAttached = false;

            resolve({
              success: true,
              message: `Successfully dismissed ${params.type} dialog`,
              dialogInfo: dialogInfo,
              action: accept ? 'accepted' : 'cancelled',
            });
          } catch (error) {
            clearTimeout(timeoutId);
            chrome.debugger.onEvent.removeListener(eventListener);
            await chrome.debugger.detach({ tabId }).catch(() => {});
            debuggerAttached = false;
            reject(error);
          }
        }
      };

      try {
        // Attach debugger
        await chrome.debugger.attach({ tabId }, DEBUGGER_PROTOCOL_VERSION);
        debuggerAttached = true;

        // Add event listener
        chrome.debugger.onEvent.addListener(eventListener);

        // Enable Page domain to receive dialog events
        await chrome.debugger.sendCommand({ tabId }, 'Page.enable');

        console.log(`Waiting for dialog to appear on tab ${tabId}...`);
      } catch (error) {
        clearTimeout(timeoutId);
        if (debuggerAttached) {
          chrome.debugger.onEvent.removeListener(eventListener);
          await chrome.debugger.detach({ tabId }).catch(() => {});
        }
        reject(error);
      }
    });
  }
}

export const dismissDialogTool = new DismissDialogTool();
