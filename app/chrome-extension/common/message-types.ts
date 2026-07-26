/**
 * Consolidated message type constants for Chrome extension communication
 * Note: Native message types are imported from the shared package
 */

import type { RealtimeEvent } from 'agent-chrome-mcp-shared';

// Message targets for routing
export enum MessageTarget {
  Offscreen = 'offscreen',
  ContentScript = 'content_script',
  Background = 'background',
}

// Background script message types
export const BACKGROUND_MESSAGE_TYPES = {
  SWITCH_SEMANTIC_MODEL: 'switch_semantic_model',
  GET_MODEL_STATUS: 'get_model_status',
  UPDATE_MODEL_STATUS: 'update_model_status',
  GET_STORAGE_STATS: 'get_storage_stats',
  CLEAR_ALL_DATA: 'clear_all_data',
  GET_SERVER_STATUS: 'get_server_status',
  REFRESH_SERVER_STATUS: 'refresh_server_status',
  SERVER_STATUS_CHANGED: 'server_status_changed',
  INITIALIZE_SEMANTIC_ENGINE: 'initialize_semantic_engine',
  // Record & Replay background control and queries
  RR_START_RECORDING: 'rr_start_recording',
  RR_STOP_RECORDING: 'rr_stop_recording',
  RR_PAUSE_RECORDING: 'rr_pause_recording',
  RR_RESUME_RECORDING: 'rr_resume_recording',
  RR_GET_RECORDING_STATUS: 'rr_get_recording_status',
  RR_LIST_FLOWS: 'rr_list_flows',
  RR_FLOWS_CHANGED: 'rr_flows_changed',
  RR_GET_FLOW: 'rr_get_flow',
  RR_DELETE_FLOW: 'rr_delete_flow',
  RR_PUBLISH_FLOW: 'rr_publish_flow',
  RR_UNPUBLISH_FLOW: 'rr_unpublish_flow',
  RR_RUN_FLOW: 'rr_run_flow',
  RR_SAVE_FLOW: 'rr_save_flow',
  RR_EXPORT_FLOW: 'rr_export_flow',
  RR_EXPORT_ALL: 'rr_export_all',
  RR_IMPORT_FLOW: 'rr_import_flow',
  RR_LIST_RUNS: 'rr_list_runs',
  // Triggers
  RR_LIST_TRIGGERS: 'rr_list_triggers',
  RR_SAVE_TRIGGER: 'rr_save_trigger',
  RR_DELETE_TRIGGER: 'rr_delete_trigger',
  RR_REFRESH_TRIGGERS: 'rr_refresh_triggers',
  // Scheduling
  RR_SCHEDULE_FLOW: 'rr_schedule_flow',
  RR_UNSCHEDULE_FLOW: 'rr_unschedule_flow',
  RR_LIST_SCHEDULES: 'rr_list_schedules',
  // Element marker management
  ELEMENT_MARKER_LIST_ALL: 'element_marker_list_all',
  ELEMENT_MARKER_LIST_FOR_URL: 'element_marker_list_for_url',
  ELEMENT_MARKER_SAVE: 'element_marker_save',
  ELEMENT_MARKER_UPDATE: 'element_marker_update',
  ELEMENT_MARKER_DELETE: 'element_marker_delete',
  ELEMENT_MARKER_VALIDATE: 'element_marker_validate',
  ELEMENT_MARKER_START: 'element_marker_start_from_popup',
  // Element picker (human-in-the-loop element selection)
  ELEMENT_PICKER_UI_EVENT: 'element_picker_ui_event',
  ELEMENT_PICKER_FRAME_EVENT: 'element_picker_frame_event',
  // Web editor (in-page visual editing)
  WEB_EDITOR_TOGGLE: 'web_editor_toggle',
  WEB_EDITOR_APPLY: 'web_editor_apply',
  WEB_EDITOR_STATUS_QUERY: 'web_editor_status_query',
  // Web editor <-> AgentChat integration (Phase 1.1)
  WEB_EDITOR_APPLY_BATCH: 'web_editor_apply_batch',
  WEB_EDITOR_TX_CHANGED: 'web_editor_tx_changed',
  WEB_EDITOR_HIGHLIGHT_ELEMENT: 'web_editor_highlight_element',
  // Web editor <-> AgentChat integration (Phase 2 - Revert)
  WEB_EDITOR_REVERT_ELEMENT: 'web_editor_revert_element',
  // Web editor <-> AgentChat integration - Selection sync
  WEB_EDITOR_SELECTION_CHANGED: 'web_editor_selection_changed',
  // Web editor <-> AgentChat integration - Clear selection (sidepanel -> web-editor)
  WEB_EDITOR_CLEAR_SELECTION: 'web_editor_clear_selection',
  // Web editor <-> AgentChat integration - Cancel execution
  WEB_EDITOR_CANCEL_EXECUTION: 'web_editor_cancel_execution',
  // Web editor props (Phase 7.1.6 early injection)
  WEB_EDITOR_PROPS_REGISTER_EARLY_INJECTION: 'web_editor_props_register_early_injection',
  // Web editor props - open source file in VSCode
  WEB_EDITOR_OPEN_SOURCE: 'web_editor_open_source',
  // Quick Panel <-> AgentChat integration
  QUICK_PANEL_SEND_TO_AI: 'quick_panel_send_to_ai',
  QUICK_PANEL_CANCEL_AI: 'quick_panel_cancel_ai',
  // Quick Panel Search - Tabs bridge
  QUICK_PANEL_TABS_QUERY: 'quick_panel_tabs_query',
  QUICK_PANEL_TAB_ACTIVATE: 'quick_panel_tab_activate',
  QUICK_PANEL_TAB_CLOSE: 'quick_panel_tab_close',
} as const;

// Offscreen message types
export const OFFSCREEN_MESSAGE_TYPES = {
  SIMILARITY_ENGINE_INIT: 'similarityEngineInit',
  SIMILARITY_ENGINE_COMPUTE: 'similarityEngineCompute',
  SIMILARITY_ENGINE_BATCH_COMPUTE: 'similarityEngineBatchCompute',
  SIMILARITY_ENGINE_STATUS: 'similarityEngineStatus',
  // GIF encoding
  GIF_ADD_FRAME: 'gifAddFrame',
  GIF_FINISH: 'gifFinish',
  GIF_RESET: 'gifReset',
  // WebM demo recording
  DEMO_START: 'demoStart',
  DEMO_ADD_FRAME: 'demoAddFrame',
  DEMO_FINISH: 'demoFinish',
  DEMO_RESET: 'demoReset',
} as const;

// Content script message types
export const CONTENT_MESSAGE_TYPES = {
  WEB_FETCHER_GET_TEXT_CONTENT: 'webFetcherGetTextContent',
  WEB_FETCHER_GET_HTML_CONTENT: 'getHtmlContent',
  NETWORK_CAPTURE_PING: 'network_capture_ping',
  CLICK_HELPER_PING: 'click_helper_ping',
  FILL_HELPER_PING: 'fill_helper_ping',
  KEYBOARD_HELPER_PING: 'keyboard_helper_ping',
  SCREENSHOT_HELPER_PING: 'screenshot_helper_ping',
  INTERACTIVE_ELEMENTS_HELPER_PING: 'interactive_elements_helper_ping',
  ACCESSIBILITY_TREE_HELPER_PING: 'chrome_read_page_ping',
  WAIT_HELPER_PING: 'wait_helper_ping',
  DOM_OBSERVER_PING: 'dom_observer_ping',
} as const;

// Tool action message types (for chrome.runtime.sendMessage)
export const TOOL_MESSAGE_TYPES = {
  // Screenshot related
  SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE: 'preparePageForCapture',
  SCREENSHOT_GET_PAGE_DETAILS: 'getPageDetails',
  SCREENSHOT_GET_ELEMENT_DETAILS: 'getElementDetails',
  SCREENSHOT_SCROLL_PAGE: 'scrollPage',
  SCREENSHOT_RESET_PAGE_AFTER_CAPTURE: 'resetPageAfterCapture',

  // Web content fetching
  WEB_FETCHER_GET_HTML_CONTENT: 'getHtmlContent',
  WEB_FETCHER_GET_TEXT_CONTENT: 'getTextContent',

  // User interactions
  CLICK_ELEMENT: 'clickElement',
  FILL_ELEMENT: 'fillElement',
  SIMULATE_KEYBOARD: 'simulateKeyboard',

  // Interactive elements
  GET_INTERACTIVE_ELEMENTS: 'getInteractiveElements',

  // Accessibility tree
  GENERATE_ACCESSIBILITY_TREE: 'generateAccessibilityTree',
  RESOLVE_REF: 'resolveRef',
  ENSURE_REF_FOR_SELECTOR: 'ensureRefForSelector',
  VERIFY_FINGERPRINT: 'verifyFingerprint',
  DISPATCH_HOVER_FOR_REF: 'dispatchHoverForRef',

  // Network requests
  NETWORK_SEND_REQUEST: 'sendPureNetworkRequest',

  // Wait helper
  WAIT_FOR_TEXT: 'waitForText',

  // Semantic similarity engine
  SIMILARITY_ENGINE_INIT: 'similarityEngineInit',
  SIMILARITY_ENGINE_COMPUTE_BATCH: 'similarityEngineComputeBatch',
  // Record & Replay content script bridge
  RR_RECORDER_CONTROL: 'rr_recorder_control',
  RR_RECORDER_EVENT: 'rr_recorder_event',
  // Record & Replay timeline feed (background -> content overlay)
  RR_TIMELINE_UPDATE: 'rr_timeline_update',
  // Quick Panel AI streaming events (background -> content script)
  QUICK_PANEL_AI_EVENT: 'quick_panel_ai_event',
  // DOM observer trigger bridge
  SET_DOM_TRIGGERS: 'set_dom_triggers',
  DOM_TRIGGER_FIRED: 'dom_trigger_fired',
  // Record & Replay overlay: variable collection
  COLLECT_VARIABLES: 'collectVariables',
  // Element marker overlay control (content-side)
  ELEMENT_MARKER_START: 'element_marker_start',
  // Element picker (tool-driven, background <-> content scripts)
  ELEMENT_PICKER_START: 'elementPickerStart',
  ELEMENT_PICKER_STOP: 'elementPickerStop',
  ELEMENT_PICKER_SET_ACTIVE_REQUEST: 'elementPickerSetActiveRequest',
  ELEMENT_PICKER_UI_PING: 'elementPickerUiPing',
  ELEMENT_PICKER_UI_SHOW: 'elementPickerUiShow',
  ELEMENT_PICKER_UI_UPDATE: 'elementPickerUiUpdate',
  ELEMENT_PICKER_UI_HIDE: 'elementPickerUiHide',
} as const;

// Type unions for type safety
export type BackgroundMessageType =
  (typeof BACKGROUND_MESSAGE_TYPES)[keyof typeof BACKGROUND_MESSAGE_TYPES];
export type OffscreenMessageType =
  (typeof OFFSCREEN_MESSAGE_TYPES)[keyof typeof OFFSCREEN_MESSAGE_TYPES];
export type ContentMessageType = (typeof CONTENT_MESSAGE_TYPES)[keyof typeof CONTENT_MESSAGE_TYPES];
export type ToolMessageType = (typeof TOOL_MESSAGE_TYPES)[keyof typeof TOOL_MESSAGE_TYPES];

// Legacy enum for backward compatibility (will be deprecated)
export enum SendMessageType {
  // Screenshot related message types
  ScreenshotPreparePageForCapture = 'preparePageForCapture',
  ScreenshotGetPageDetails = 'getPageDetails',
  ScreenshotGetElementDetails = 'getElementDetails',
  ScreenshotScrollPage = 'scrollPage',
  ScreenshotResetPageAfterCapture = 'resetPageAfterCapture',

  // Web content fetching related message types
  WebFetcherGetHtmlContent = 'getHtmlContent',
  WebFetcherGetTextContent = 'getTextContent',

  // Click related message types
  ClickElement = 'clickElement',

  // Input filling related message types
  FillElement = 'fillElement',

  // Interactive elements related message types
  GetInteractiveElements = 'getInteractiveElements',

  // Network request capture related message types
  NetworkSendRequest = 'sendPureNetworkRequest',

  // Keyboard event related message types
  SimulateKeyboard = 'simulateKeyboard',

  // Semantic similarity engine related message types
  SimilarityEngineInit = 'similarityEngineInit',
  SimilarityEngineComputeBatch = 'similarityEngineComputeBatch',
}

// ============================================================
// Quick Panel <-> AgentChat Message Contracts
// ============================================================

/**
 * Context information that can be attached to a Quick Panel AI request.
 * Allows passing page-specific data to enhance the AI's understanding.
 */
export interface QuickPanelAIContext {
  /** Current page URL */
  pageUrl?: string;
  /** User's text selection on the page */
  selectedText?: string;
  /**
   * Optional element metadata from the page.
   * Kept as unknown to avoid tight coupling with specific element types.
   */
  elementInfo?: unknown;
}

/**
 * Payload for sending a message to AI via Quick Panel.
 */
export interface QuickPanelSendToAIPayload {
  /** The user's instruction/question for the AI */
  instruction: string;
  /** Optional contextual information from the page */
  context?: QuickPanelAIContext;
}

/**
 * Response from QUICK_PANEL_SEND_TO_AI message handler.
 */
export type QuickPanelSendToAIResponse =
  | { success: true; requestId: string; sessionId: string }
  | { success: false; error: string };

/**
 * Message structure for sending to AI.
 */
export interface QuickPanelSendToAIMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_SEND_TO_AI;
  payload: QuickPanelSendToAIPayload;
}

/**
 * Payload for cancelling an active AI request.
 */
export interface QuickPanelCancelAIPayload {
  /** The request ID to cancel */
  requestId: string;
  /**
   * Optional session ID for fallback when background state is missing.
   * This can happen after MV3 Service Worker restarts.
   */
  sessionId?: string;
}

/**
 * Response from QUICK_PANEL_CANCEL_AI message handler.
 */
export type QuickPanelCancelAIResponse = { success: true } | { success: false; error: string };

/**
 * Message structure for cancelling AI request.
 */
export interface QuickPanelCancelAIMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_CANCEL_AI;
  payload: QuickPanelCancelAIPayload;
}

/**
 * Message pushed from background to content script with AI streaming events.
 * Uses the same RealtimeEvent type as AgentChat for consistency.
 */
export interface QuickPanelAIEventMessage {
  action: typeof TOOL_MESSAGE_TYPES.QUICK_PANEL_AI_EVENT;
  requestId: string;
  sessionId: string;
  event: RealtimeEvent;
}

// ============================================================
// Quick Panel Search - Tabs Bridge Contracts
// ============================================================

/**
 * Payload for querying open tabs.
 */
export interface QuickPanelTabsQueryPayload {
  /**
   * When true (default), query tabs across all windows.
   * When false, restrict results to the sender's window.
   */
  includeAllWindows?: boolean;
}

/**
 * Summary of a single tab returned from the background.
 */
export interface QuickPanelTabSummary {
  tabId: number;
  windowId: number;
  title: string;
  url: string;
  favIconUrl?: string;
  active: boolean;
  pinned: boolean;
  audible: boolean;
  muted: boolean;
  index: number;
  lastAccessed?: number;
}

/**
 * Response from QUICK_PANEL_TABS_QUERY message handler.
 */
export type QuickPanelTabsQueryResponse =
  | {
      success: true;
      tabs: QuickPanelTabSummary[];
      currentTabId: number | null;
      currentWindowId: number | null;
    }
  | { success: false; error: string };

/**
 * Message structure for querying tabs.
 */
export interface QuickPanelTabsQueryMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_TABS_QUERY;
  payload?: QuickPanelTabsQueryPayload;
}

/**
 * Payload for activating a tab.
 */
export interface QuickPanelActivateTabPayload {
  tabId: number;
  windowId?: number;
}

/**
 * Response from QUICK_PANEL_TAB_ACTIVATE message handler.
 */
export type QuickPanelActivateTabResponse = { success: true } | { success: false; error: string };

/**
 * Message structure for activating a tab.
 */
export interface QuickPanelActivateTabMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_TAB_ACTIVATE;
  payload: QuickPanelActivateTabPayload;
}

/**
 * Payload for closing a tab.
 */
export interface QuickPanelCloseTabPayload {
  tabId: number;
}

/**
 * Response from QUICK_PANEL_TAB_CLOSE message handler.
 */
export type QuickPanelCloseTabResponse = { success: true } | { success: false; error: string };

/**
 * Message structure for closing a tab.
 */
export interface QuickPanelCloseTabMessage {
  type: typeof BACKGROUND_MESSAGE_TYPES.QUICK_PANEL_TAB_CLOSE;
  payload: QuickPanelCloseTabPayload;
}
