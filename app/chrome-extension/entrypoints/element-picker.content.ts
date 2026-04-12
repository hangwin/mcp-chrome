/**
 * Element Picker Content Script
 *
 * Renders the Element Picker Panel UI (Quick Panel style) and forwards UI events
 * to background while a chrome_request_element_selection session is active.
 *
 * This script only runs in the top frame and handles:
 * - Displaying the element picker panel UI
 * - Forwarding user actions (cancel, confirm, etc.) to background
 * - Receiving state updates from background
 */

import {
  createElementPickerController,
  type ElementPickerController,
  type ElementPickerUiState,
} from '@/shared/element-picker';
import { BACKGROUND_MESSAGE_TYPES, TOOL_MESSAGE_TYPES } from '@/common/message-types';
import type { PickedElement } from 'chrome-mcp-shared';

// ============================================================
// Message Types
// ============================================================

interface UiShowMessage {
  action: typeof TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_SHOW;
  sessionId: string;
  requests: Array<{ id: string; name: string; description?: string }>;
  activeRequestId: string | null;
  deadlineTs: number;
}

interface UiUpdateMessage {
  action: typeof TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_UPDATE;
  sessionId: string;
  activeRequestId: string | null;
  selections: Record<string, PickedElement | null>;
  deadlineTs: number;
  errorMessage: string | null;
}

interface UiHideMessage {
  action: typeof TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_HIDE;
  sessionId: string;
}

interface UiPingMessage {
  action: typeof TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_PING;
}

type PickerMessage = UiPingMessage | UiShowMessage | UiUpdateMessage | UiHideMessage;

// ============================================================
// Content Script Definition
// ============================================================

export default defineContentScript({
  matches: ['<all_urls>'],
  runAt: 'document_idle',

  main() {
    // Only mount UI in the top frame
    if (window.top !== window) return;

    let controller: ElementPickerController | null = null;
    let currentSessionId: string | null = null;

    /**
     * Ensure the controller is created and configured.
     */
    function ensureController(): ElementPickerController {
      if (controller) return controller;

      controller = createElementPickerController({
        onCancel: () => {
          if (!currentSessionId) return;
          void chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.ELEMENT_PICKER_UI_EVENT,
            sessionId: currentSessionId,
            event: 'cancel',
          });
        },
        onConfirm: () => {
          if (!currentSessionId) return;
          void chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.ELEMENT_PICKER_UI_EVENT,
            sessionId: currentSessionId,
            event: 'confirm',
          });
        },
        onSetActiveRequest: (requestId: string) => {
          if (!currentSessionId) return;
          void chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.ELEMENT_PICKER_UI_EVENT,
            sessionId: currentSessionId,
            event: 'set_active_request',
            requestId,
          });
        },
        onClearSelection: (requestId: string) => {
          if (!currentSessionId) return;
          void chrome.runtime.sendMessage({
            type: BACKGROUND_MESSAGE_TYPES.ELEMENT_PICKER_UI_EVENT,
            sessionId: currentSessionId,
            event: 'clear_selection',
            requestId,
          });
        },
      });

      return controller;
    }

    /**
     * Handle incoming messages from background.
     */
    function handleMessage(
      message: unknown,
      _sender: chrome.runtime.MessageSender,
      sendResponse: (response?: unknown) => void,
    ): boolean | void {
      const msg = message as PickerMessage | undefined;
      if (!msg?.action) return false;

      // Respond to ping (used by background to check if UI script is ready)
      if (msg.action === TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_PING) {
        sendResponse({ success: true });
        return true;
      }

      // Show the picker panel
      if (msg.action === TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_SHOW) {
        const showMsg = msg as UiShowMessage;
        currentSessionId = typeof showMsg.sessionId === 'string' ? showMsg.sessionId : null;

        if (!currentSessionId) {
          sendResponse({ success: false, error: 'Missing sessionId' });
          return true;
        }

        const ctrl = ensureController();
        const initialState: ElementPickerUiState = {
          sessionId: currentSessionId,
          requests: Array.isArray(showMsg.requests) ? showMsg.requests : [],
          activeRequestId: showMsg.activeRequestId ?? null,
          selections: {},
          deadlineTs: typeof showMsg.deadlineTs === 'number' ? showMsg.deadlineTs : Date.now(),
          errorMessage: null,
        };
        ctrl.show(initialState);
        sendResponse({ success: true });
        return true;
      }

      // Update the picker panel state
      if (msg.action === TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_UPDATE) {
        const updateMsg = msg as UiUpdateMessage;

        if (!currentSessionId || updateMsg.sessionId !== currentSessionId) {
          sendResponse({ success: false, error: 'Session mismatch' });
          return true;
        }

        controller?.update({
          sessionId: currentSessionId,
          activeRequestId: updateMsg.activeRequestId ?? null,
          selections: updateMsg.selections || {},
          deadlineTs: updateMsg.deadlineTs,
          errorMessage: updateMsg.errorMessage ?? null,
        });
        sendResponse({ success: true });
        return true;
      }

      // Hide the picker panel
      if (msg.action === TOOL_MESSAGE_TYPES.ELEMENT_PICKER_UI_HIDE) {
        const hideMsg = msg as UiHideMessage;

        // Best-effort hide even if session mismatches
        if (currentSessionId && hideMsg.sessionId !== currentSessionId) {
          // Log but don't fail
          console.warn('[ElementPicker] Session mismatch on hide, hiding anyway');
        }

        controller?.hide();
        currentSessionId = null;
        sendResponse({ success: true });
        return true;
      }

      return false;
    }

    // Register message listener
    chrome.runtime.onMessage.addListener(handleMessage);

    // Cleanup on page unload (using pagehide for Chrome 120+ permissions policy compatibility)
    window.addEventListener('pagehide', () => {
      chrome.runtime.onMessage.removeListener(handleMessage);
      controller?.dispose();
      controller = null;
      currentSessionId = null;
    });
  },
});
