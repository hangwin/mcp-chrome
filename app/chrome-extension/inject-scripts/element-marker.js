/* eslint-disable */
(function () {
  if (window.__ELEMENT_MARKER_INSTALLED__) return;
  window.__ELEMENT_MARKER_INSTALLED__ = true;

  const IS_MAIN = window === window.top;

  // ============================================================================
  // Utility Functions
  // ============================================================================

  function sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  // ============================================================================
  // Constants & Configuration
  // ============================================================================

  const CONFIG = {
    DEFAULTS: {
      PREFS: {
        preferId: true,
        preferStableAttr: true,
        preferClass: true,
      },
      SELECTOR_TYPE: 'css',
      LIST_MODE: false,
    },
    Z_INDEX: {
      OVERLAY: 2147483646,
      HIGHLIGHTER: 2147483645,
      RECTS: 2147483644,
    },
    COLORS: {
      PRIMARY: '#2563eb',
      SUCCESS: '#10b981',
      WARNING: '#f59e0b',
      DANGER: '#ef4444',
      HOVER: '#10b981',
      VERIFY: '#3b82f6',
    },
  };

  // ============================================================================
  // Panel Host Module - Shadow DOM Management
  // ============================================================================

  const PanelHost = (() => {
    let hostElement = null;
    let shadowRoot = null;

    const PANEL_STYLES = `
      * {
        box-sizing: border-box;
        margin: 0;
        padding: 0;
      }

      .em-panel {
        width: 400px;
        background: #ffffff;
        border-radius: 12px;
        box-shadow: 0 10px 40px rgba(0, 0, 0, 0.15);
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        padding: 20px;
        transition: opacity 150ms ease;
      }


      /* Header */
      .em-header {
        display: flex;
        align-items: center;
        justify-content: space-between;
        margin-bottom: 20px;
        user-select: none;
      }

      .em-title {
        font-size: 20px;
        font-weight: 500;
        color: #262626;
      }

      .em-header-actions {
        display: flex;
        gap: 4px;
        align-items: center;
      }

      .em-icon-btn {
        width: 32px;
        height: 32px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        color: #a3a3a3;
        cursor: pointer;
        transition: color 150ms ease;
        padding: 0;
      }

      .em-icon-btn:hover {
        color: #525252;
      }

      .em-icon-btn svg {
        width: 20px;
        height: 20px;
        stroke-width: 2;
      }

      /* Controls Row */
      .em-controls {
        display: flex;
        gap: 8px;
        margin-bottom: 12px;
      }

      .em-select-wrapper {
        flex: 1;
        position: relative;
      }

      .em-select {
        width: 100%;
        height: 44px;
        padding: 0 40px 0 16px;
        background: #f5f5f5;
        color: #262626;
        font-size: 15px;
        border: none;
        border-radius: 10px;
        appearance: none;
        cursor: pointer;
        outline: none;
        font-family: inherit;
        font-weight: 400;
      }

      .em-select-wrapper::after {
        content: '';
        position: absolute;
        right: 16px;
        top: 50%;
        transform: translateY(-50%);
        width: 0;
        height: 0;
        border-left: 5px solid transparent;
        border-right: 5px solid transparent;
        border-top: 6px solid #737373;
        pointer-events: none;
      }

      .em-square-btn {
        width: 44px;
        height: 44px;
        display: flex;
        align-items: center;
        justify-content: center;
        background: #f5f5f5;
        border: none;
        border-radius: 10px;
        cursor: pointer;
        transition: background 150ms ease;
        padding: 0;
      }

      .em-square-btn:hover {
        background: #e5e5e5;
      }

      .em-square-btn.active {
        background: #2563eb;
      }

      .em-square-btn.active svg {
        color: #ffffff;
      }

      .em-square-btn svg {
        width: 18px;
        height: 18px;
        color: #525252;
        stroke-width: 2;
      }

      /* Selector Display */
      .em-selector-display {
        display: flex;
        align-items: center;
        gap: 10px;
        height: 44px;
        padding: 0 12px 0 16px;
        background: #f5f5f5;
        border-radius: 10px;
        margin-bottom: 16px;
      }

      .em-selector-display svg {
        width: 18px;
        height: 18px;
        color: #a3a3a3;
        flex-shrink: 0;
        stroke-width: 2;
      }

      .em-selector-text {
        flex: 1;
        font-size: 14px;
        color: #525252;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
        user-select: text;
      }

      .em-selector-nav {
        display: flex;
        gap: 2px;
      }

      .em-nav-btn {
        width: 28px;
        height: 28px;
        display: flex;
        align-items: center;
        justify-content: center;
        border: none;
        background: transparent;
        cursor: pointer;
        transition: background 150ms ease;
        border-radius: 6px;
        padding: 0;
      }

      .em-nav-btn:hover {
        background: #e5e5e5;
      }

      .em-nav-btn svg {
        width: 16px;
        height: 16px;
        color: #525252;
        stroke-width: 2;
      }

      /* Tabs */
      .em-tabs {
        display: inline-flex;
        gap: 2px;
        padding: 2px;
        background: #f5f5f5;
        border-radius: 8px;
        margin-bottom: 16px;
      }

      .em-tab {
        padding: 6px 16px;
        font-size: 12px;
        font-weight: 500;
        color: #737373;
        background: transparent;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .em-tab:hover {
        color: #404040;
      }

      .em-tab.active {
        color: #262626;
        background: #ffffff;
        box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
      }

      /* Content */
      .em-content {
        margin-bottom: 0;
      }

      #__em_tab_settings {
        max-height: min(60vh, 480px);
        overflow-y: auto;
        scrollbar-width: none; /* Firefox */
        -ms-overflow-style: none; /* IE and Edge */
      }

      #__em_tab_settings::-webkit-scrollbar {
        display: none; /* Chrome, Safari, Opera */
      }

      .em-section-title {
        font-size: 13px;
        color: #737373;
        margin-bottom: 16px;
        font-weight: 400;
      }

      .em-attributes {
        display: flex;
        flex-direction: column;
        gap: 12px;
      }

      .em-attribute {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .em-attribute-label {
        font-size: 12px;
        color: #a3a3a3;
        font-weight: 400;
      }

      .em-attribute-value {
        display: flex;
        align-items: center;
        gap: 10px;
        min-height: 44px;
        padding: 0 12px 0 16px;
        background: #f5f5f5;
        border-radius: 10px;
      }

      .em-attribute-value.editable {
        padding: 0 16px;
      }

      .em-attribute-value svg {
        width: 18px;
        height: 18px;
        stroke-width: 2;
        cursor: pointer;
        transition: color 150ms ease;
        flex-shrink: 0;
      }

      .em-attribute-value svg.copy-icon {
        color: #a3a3a3;
      }

      .em-attribute-value svg.copy-icon:hover {
        color: #525252;
      }

      .em-attribute-value svg.copy-icon.disabled {
        color: #d4d4d4;
        cursor: default;
      }

      .em-attribute-text {
        flex: 1;
        font-size: 14px;
        color: #404040;
        user-select: text;
      }

      .em-attribute-text.empty {
        color: #a3a3a3;
      }

      .em-input {
        flex: 1;
        border: none;
        background: transparent;
        font-size: 14px;
        color: #404040;
        font-family: inherit;
        outline: none;
        padding: 0;
        height: 44px;
      }

      .em-input::placeholder {
        color: #a3a3a3;
      }

      /* Settings Panel */
      .em-settings {
        display: flex;
        flex-direction: column;
        gap: 16px;
      }

      .em-settings-group {
        display: flex;
        flex-direction: column;
        gap: 8px;
      }

      .em-settings-label {
        font-size: 12px;
        font-weight: 500;
        color: #737373;
      }

      .em-checkbox-group {
        display: flex;
        flex-direction: column;
        gap: 10px;
      }

      .em-checkbox-label {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #404040;
        cursor: pointer;
      }

      .em-checkbox-label input[type="checkbox"] {
        width: 18px;
        height: 18px;
        cursor: pointer;
        margin: 0;
      }

      /* Action Buttons */
      .em-actions {
        display: flex;
        gap: 8px;
        margin-top: 20px;
      }

      .em-btn {
        flex: 1;
        height: 40px;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 600;
        cursor: pointer;
        transition: all 150ms ease;
      }

      .em-btn-primary {
        background: #2563eb;
        color: #ffffff;
      }

      .em-btn-primary:hover {
        background: #1d4ed8;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
      }

      .em-btn-success {
        background: #10b981;
        color: #ffffff;
      }

      .em-btn-success:hover {
        background: #059669;
        transform: translateY(-1px);
        box-shadow: 0 4px 12px rgba(16, 185, 129, 0.3);
      }

      .em-btn-ghost {
        background: #f5f5f5;
        color: #404040;
      }

      .em-btn-ghost:hover {
        background: #e5e5e5;
      }

      /* Footer */
      .em-footer {
        font-size: 12px;
        color: #a3a3a3;
        text-align: center;
        margin-top: 16px;
      }

      .em-footer kbd {
        display: inline-block;
        padding: 2px 6px;
        background: #f5f5f5;
        border-radius: 4px;
        font-family: monospace;
        font-size: 11px;
        color: #737373;
      }

      /* Status */
      .em-status {
        font-size: 13px;
        padding: 10px 12px;
        border-radius: 8px;
        margin-bottom: 12px;
        display: flex;
        align-items: center;
        gap: 6px;
      }

      .em-status.idle {
        display: none;
      }

      .em-status.running {
        background: rgba(37, 99, 235, 0.1);
        color: #2563eb;
      }

      .em-status.success {
        background: rgba(16, 185, 129, 0.1);
        color: #10b981;
      }

      .em-status.failure {
        background: rgba(239, 68, 68, 0.1);
        color: #ef4444;
      }

      /* Grid Layout */
      .em-grid {
        display: grid;
        grid-template-columns: repeat(2, 1fr);
        gap: 12px;
      }

      .em-field {
        display: flex;
        flex-direction: column;
        gap: 6px;
      }

      .em-field-label {
        font-size: 12px;
        color: #a3a3a3;
      }

      .em-field-input {
        height: 40px;
        padding: 0 12px;
        background: #f5f5f5;
        border: none;
        border-radius: 8px;
        font-size: 14px;
        color: #404040;
        font-family: inherit;
        outline: none;
      }

      .em-field-input:focus {
        background: #e5e5e5;
      }

      /* Details/Accordion */
      .em-details {
        margin-top: 12px;
        padding-top: 12px;
        border-top: 1px solid #f5f5f5;
      }

      .em-details summary {
        cursor: pointer;
        font-size: 13px;
        font-weight: 600;
        color: #737373;
        padding: 8px 0;
        user-select: none;
        list-style: none;
      }

      .em-details summary::-webkit-details-marker {
        display: none;
      }

      .em-details summary:hover {
        color: #404040;
      }

      .em-details[open] summary {
        margin-bottom: 12px;
      }

      /* Dragging state */
      body[data-em-dragging] {
        user-select: none !important;
        cursor: grabbing !important;
      }

      body[data-em-dragging] * {
        cursor: grabbing !important;
      }

      /* SVG Icons */
      svg {
        fill: none;
        stroke: currentColor;
      }

      .em-drag-handle {
        cursor: grab;
      }

      .em-drag-handle:active {
        cursor: grabbing;
      }
    `;

    const PANEL_TEMPLATE = `
      <div class="em-panel" id="em_panel_root">
        <!-- Header -->
        <div class="em-header em-drag-handle" id="__em_drag_handle" title="Drag to move">
          <h2 class="em-title">Element Marker</h2>
          <div class="em-header-actions">
            <button class="em-icon-btn" id="__em_close" title="Close">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Controls -->
        <div class="em-controls">
          <div class="em-select-wrapper">
            <select class="em-select" id="__em_selector_type">
              <option value="css">CSS Selector</option>
              <option value="xpath">XPath</option>
            </select>
          </div>
          <button class="em-square-btn" id="__em_toggle_list" title="List mode - Batch mark similar elements (CSS only)">
            <svg viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M4 6h16M4 12h16M4 18h16"/>
            </svg>
          </button>
          <button class="em-square-btn" id="__em_toggle_tab" title="Toggle Execute tab">
            <svg viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/>
              <path stroke-linecap="round" stroke-linejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/>
            </svg>
          </button>
        </div>

        <!-- Selector Display -->
        <div class="em-selector-display">
          <svg viewBox="0 0 24 24" id="__em_copy_selector" title="Copy selector">
            <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
          </svg>
          <span class="em-selector-text" id="__em_selector_text">Click an element to select</span>
          <div class="em-selector-nav">
            <button class="em-nav-btn" id="__em_nav_up" title="Select parent">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M5 15l7-7 7 7"/>
              </svg>
            </button>
            <button class="em-nav-btn" id="__em_nav_down" title="Select child">
              <svg viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7"/>
              </svg>
            </button>
          </div>
        </div>

        <!-- Tabs -->
        <div class="em-tabs">
          <button class="em-tab active" data-tab="attributes">Attributes</button>
          <button class="em-tab" data-tab="execute">Execute</button>
        </div>

        <!-- Status -->
        <div class="em-status idle" id="__em_status"></div>

        <!-- Content: Attributes Tab -->
        <div class="em-content" id="__em_tab_attributes">
          <h3 class="em-section-title">#1 Element</h3>
          
          <div class="em-attributes">
            <div class="em-attribute">
              <div class="em-attribute-label">name</div>
              <div class="em-attribute-value editable">
                <input class="em-input" id="__em_name" placeholder="Element name" />
              </div>
            </div>

            <div class="em-attribute">
              <div class="em-attribute-label">selector</div>
              <div class="em-attribute-value">
                <svg class="copy-icon" viewBox="0 0 24 24" id="__em_copy" title="Copy">
                  <path stroke-linecap="round" stroke-linejoin="round" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"/>
                </svg>
                <span class="em-attribute-text" id="__em_selector">-</span>
              </div>
            </div>
          </div>

          <h3 class="em-section-title">Selector Preferences</h3>
          <div class="em-settings">
            <div class="em-checkbox-group">
              <label class="em-checkbox-label">
                <input type="checkbox" id="__em_pref_id" checked />
                <span>Prefer ID</span>
              </label>
              <label class="em-checkbox-label">
                <input type="checkbox" id="__em_pref_attr" checked />
                <span>Prefer stable attributes</span>
              </label>
              <label class="em-checkbox-label">
                <input type="checkbox" id="__em_pref_class" checked />
                <span>Prefer class names</span>
              </label>
            </div>
          </div>

          <div class="em-actions">
            <button class="em-btn em-btn-primary" id="__em_verify">Verify (Highlight Only)</button>
          </div>

          <div class="em-actions">
            <button class="em-btn em-btn-success" id="__em_save">Save</button>
            <button class="em-btn em-btn-ghost" id="__em_cancel">Cancel</button>
          </div>
        </div>

        <!-- Content: Execute Tab -->
        <div class="em-content" id="__em_tab_execute" style="display: none;">
          <div class="em-settings">
            <div class="em-settings-group">
              <div class="em-settings-label">Action</div>
              <div class="em-select-wrapper">
                <select class="em-select" id="__em_action">
                  <option value="hover">Hover</option>
                  <option value="left_click">Left click</option>
                  <option value="double_click">Double click</option>
                  <option value="right_click">Right click</option>
                  <option value="scroll">Scroll</option>
                  <option value="type_text">Type text</option>
                  <option value="press_keys">Press keys</option>
                </select>
              </div>
            </div>

            <!-- Action-specific inputs (dynamically shown/hidden) -->
            <div class="em-settings-group" id="__em_action_text_group" style="display: none;">
              <div class="em-settings-label">Text</div>
              <input class="em-field-input" id="__em_action_text" placeholder="Text to type" />
            </div>

            <div class="em-settings-group" id="__em_action_keys_group" style="display: none;">
              <div class="em-settings-label">Keys</div>
              <input class="em-field-input" id="__em_action_keys" placeholder="Keys to press (e.g., Enter, Ctrl+C)" />
            </div>

            <div class="em-settings-group" id="__em_scroll_options" style="display: none;">
              <div class="em-settings-label">Scroll Direction</div>
              <div class="em-select-wrapper">
                <select class="em-select" id="__em_scroll_direction">
                  <option value="down">Down</option>
                  <option value="up">Up</option>
                  <option value="left">Left</option>
                  <option value="right">Right</option>
                </select>
              </div>
              <div class="em-field" style="margin-top: 8px;">
                <div class="em-field-label">Amount (1-10, ~100px each)</div>
                <input class="em-field-input" id="__em_scroll_distance" type="number" min="1" max="10" step="1" value="3" />
              </div>
            </div>

            <!-- Click-specific options -->
            <div id="__em_click_options" style="display: none;">
              <div class="em-grid">
                <div class="em-field">
                  <div class="em-field-label">Button</div>
                  <select class="em-select" id="__em_btn">
                    <option value="left">Left</option>
                    <option value="middle">Middle</option>
                    <option value="right">Right</option>
                  </select>
                </div>
                <div class="em-field">
                  <div class="em-field-label">Timeout (ms)</div>
                  <input class="em-field-input" id="__em_nav_timeout" type="number" value="3000" />
                </div>
              </div>

              <div class="em-checkbox-group" style="margin-top: 12px;">
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_wait_nav" />
                  <span>Wait for navigation</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_alt" />
                  <span>Alt key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_ctrl" />
                  <span>Ctrl key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_meta" />
                  <span>Meta key</span>
                </label>
                <label class="em-checkbox-label">
                  <input type="checkbox" id="__em_mod_shift" />
                  <span>Shift key</span>
                </label>
              </div>
            </div>

            <div class="em-actions" style="margin-top: 16px;">
              <button class="em-btn em-btn-primary" id="__em_execute">Execute</button>
            </div>

            <!-- Execution History -->
            <div id="__em_execution_history" style="margin-top: 16px; display: none;">
              <div class="em-settings-label">Recent Executions</div>
              <div id="__em_history_list" style="font-size: 12px; color: #737373; margin-top: 8px;"></div>
            </div>
          </div>
        </div>

        <!-- Footer -->
        <div class="em-footer">
          Click or press <kbd>Space</kbd> to select an element
        </div>
      </div>
    `;

    function mount() {
      if (hostElement) return { host: hostElement, shadow: shadowRoot };

      hostElement = document.createElement('div');
      hostElement.id = '__element_marker_overlay';
      Object.assign(hostElement.style, {
        position: 'fixed',
        top: '24px',
        right: '24px',
        zIndex: String(CONFIG.Z_INDEX.OVERLAY),
        pointerEvents: 'none',
      });

      shadowRoot = hostElement.attachShadow({ mode: 'open' });
      shadowRoot.innerHTML = `<style>${PANEL_STYLES}</style>${PANEL_TEMPLATE}`;

      hostElement.querySelector = (...args) => shadowRoot.querySelector(...args);
      hostElement.querySelectorAll = (...args) => shadowRoot.querySelectorAll(...args);

      const panel = shadowRoot.querySelector('.em-panel');
      if (panel) {
        panel.style.pointerEvents = 'auto';
      }

      document.documentElement.appendChild(hostElement);
      return { host: hostElement, shadow: shadowRoot };
    }

    function unmount() {
      if (hostElement?.parentNode) {
        hostElement.parentNode.removeChild(hostElement);
      }
      hostElement = null;
      shadowRoot = null;
    }

    function getHost() {
      return hostElement;
    }

    function getShadow() {
      return shadowRoot;
    }

    return {
      mount,
      unmount,
      getHost,
      getShadow,
    };
  })();

  // ============================================================================
  // State Store Module - Centralized State Management
  // ============================================================================

  const StateStore = (() => {
    const state = {
      selectorType: CONFIG.DEFAULTS.SELECTOR_TYPE,
      listMode: CONFIG.DEFAULTS.LIST_MODE,
      prefs: { ...CONFIG.DEFAULTS.PREFS },
      activeTab: 'attributes',
      validation: {
        status: 'idle',
        message: '',
      },
      validationHistory: [], // Last 5 validation results
    };

    const listeners = new Set();

    function init() {
      return state;
    }

    function get(key) {
      return key ? state[key] : state;
    }

    function set(partial) {
      const changed = {};

      Object.keys(partial).forEach((key) => {
        if (JSON.stringify(state[key]) !== JSON.stringify(partial[key])) {
          changed[key] = true;
          state[key] = partial[key];
        }
      });

      if (Object.keys(changed).length === 0) return;

      if (changed.validation) {
        updateValidationUI();
      }
      if (changed.activeTab) {
        updateTabUI();
      }
      if (changed.listMode) {
        updateListModeUI();
      }
      if (changed.validationHistory) {
        updateValidationHistoryUI();
      }

      notifyListeners();
    }

    function subscribe(callback) {
      listeners.add(callback);
      return () => listeners.delete(callback);
    }

    function notifyListeners() {
      listeners.forEach((cb) => {
        try {
          cb(state);
        } catch (err) {
          console.error('[StateStore] Listener error:', err);
        }
      });
    }

    function updateValidationUI() {
      const statusEl = PanelHost.getShadow()?.getElementById('__em_status');
      if (!statusEl) return;

      const { status, message } = state.validation;
      statusEl.className = `em-status ${status}`;
      statusEl.textContent = message;
    }

    function updateListModeUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const btn = shadow.getElementById('__em_toggle_list');
      if (!btn) return;

      if (state.listMode) {
        btn.classList.add('active');
      } else {
        btn.classList.remove('active');
      }
    }

    function updateTabUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const tabs = shadow.querySelectorAll('.em-tab');
      tabs.forEach((tab) => {
        if (tab.dataset.tab === state.activeTab) {
          tab.classList.add('active');
        } else {
          tab.classList.remove('active');
        }
      });

      const attrContent = shadow.getElementById('__em_tab_attributes');
      const executeContent = shadow.getElementById('__em_tab_execute');

      if (attrContent)
        attrContent.style.display = state.activeTab === 'attributes' ? 'block' : 'none';
      if (executeContent)
        executeContent.style.display = state.activeTab === 'execute' ? 'block' : 'none';

      // Sync interaction mode when tab changes
      syncInteractionMode();
    }

    function updateValidationHistoryUI() {
      const shadow = PanelHost.getShadow();
      if (!shadow) return;

      const historyContainer = shadow.getElementById('__em_execution_history');
      const historyList = shadow.getElementById('__em_history_list');
      if (!historyContainer || !historyList) return;

      if (state.validationHistory.length === 0) {
        historyContainer.style.display = 'none';
        return;
      }

      historyContainer.style.display = 'block';
      historyList.innerHTML = state.validationHistory
        .slice(-5)
        .reverse()
        .map((entry) => {
          const icon = entry.success ? '✓' : '✗';
          const color = entry.success ? '#10b981' : '#ef4444';
          const timestamp = new Date(entry.timestamp).toLocaleTimeString();
          return `<div style="padding: 6px 0; border-bottom: 1px solid #f5f5f5;">
            <span style="color: ${color}; font-weight: 600;">${icon}</span>
            <span style="margin-left: 6px;">${entry.action}</span>
            <span style="float: right; color: #a3a3a3; font-size: 11px;">${timestamp}</span>
          </div>`;
        })
        .join('');
    }

    return {
      init,
      get,
      set,
      subscribe,
    };
  })();

  // ============================================================================
  // Drag Controller Module
  // ============================================================================

  const DragController = (() => {
    let dragging = false;
    let startPos = { x: 0, y: 0 };
    let startOffset = { top: 0, right: 0 };

    function init(handleElement) {
      if (!handleElement) return;
      handleElement.addEventListener('mousedown', onDragStart);
    }

    function onDragStart(event) {
      event.preventDefault();
      dragging = true;

      const host = PanelHost.getHost();
      if (!host) return;

      startPos = { x: event.clientX, y: event.clientY };
      startOffset = {
        top: parseInt(host.style.top) || 0,
        right: parseInt(host.style.right) || 0,
      };

      document.addEventListener('mousemove', onDragMove, { capture: true, passive: false });
      document.addEventListener('mouseup', onDragEnd, { capture: true, passive: false });
      document.body.setAttribute('data-em-dragging', 'true');
    }

    function onDragMove(event) {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();

      const host = PanelHost.getHost();
      if (!host) return;

      const deltaX = event.clientX - startPos.x;
      const deltaY = event.clientY - startPos.y;

      const newTop = Math.max(8, startOffset.top + deltaY);
      const newRight = Math.max(8, startOffset.right - deltaX);

      host.style.top = `${newTop}px`;
      host.style.right = `${newRight}px`;
    }

    function onDragEnd(event) {
      if (!dragging) return;
      event.preventDefault();
      event.stopPropagation();

      dragging = false;
      document.removeEventListener('mousemove', onDragMove, { capture: true });
      document.removeEventListener('mouseup', onDragEnd, { capture: true });
      document.body.removeAttribute('data-em-dragging');
    }

    function destroy() {
      if (dragging) {
        onDragEnd(new MouseEvent('mouseup'));
      }
    }

    return { init, destroy };
  })();

  // [继续下一部分...]
  // ============================================================================
  // Selector Engine - Heuristic Selector Generation
  // ============================================================================

  function generateSelector(el) {
    if (!(el instanceof Element)) return '';

    const prefs = StateStore.get('prefs');

    if (prefs.preferId && el.id) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (isDeepSelectorUnique(idSel, el)) return idSel;
    }

    if (prefs.preferStableAttr) {
      const attrNames = [
        'data-testid',
        'data-testId',
        'data-test',
        'data-qa',
        'data-cy',
        'name',
        'title',
        'alt',
        'aria-label',
      ];
      const tag = el.tagName.toLowerCase();

      for (const attr of attrNames) {
        const v = el.getAttribute(attr);
        if (!v) continue;
        const attrSel = `[${attr}="${CSS.escape(v)}"]`;
        const testSel = /^(input|textarea|select)$/i.test(tag) ? `${tag}${attrSel}` : attrSel;
        if (isDeepSelectorUnique(testSel, el)) return testSel;
      }
    }

    if (prefs.preferClass) {
      try {
        const classes = Array.from(el.classList || []).filter(
          (c) => c && /^[a-zA-Z0-9_-]+$/.test(c),
        );
        const tag = el.tagName.toLowerCase();

        for (const cls of classes) {
          const sel = `.${CSS.escape(cls)}`;
          if (isDeepSelectorUnique(sel, el)) return sel;
        }

        for (const cls of classes) {
          const sel = `${tag}.${CSS.escape(cls)}`;
          if (isDeepSelectorUnique(sel, el)) return sel;
        }

        for (let i = 0; i < Math.min(classes.length, 3); i++) {
          for (let j = i + 1; j < Math.min(classes.length, 3); j++) {
            const sel = `.${CSS.escape(classes[i])}.${CSS.escape(classes[j])}`;
            if (isDeepSelectorUnique(sel, el)) return sel;
          }
        }
      } catch {}
    }

    if (prefs.preferStableAttr) {
      try {
        let cur = el;
        const anchorAttrs = [
          'id',
          'data-testid',
          'data-testId',
          'data-test',
          'data-qa',
          'data-cy',
          'name',
        ];

        // Detect shadow DOM boundary
        const root = el.getRootNode();
        const isShadowElement = root instanceof ShadowRoot;
        const boundary = isShadowElement ? root.host : document.body;

        while (cur && cur !== boundary) {
          if (cur.id) {
            const anchor = `#${CSS.escape(cur.id)}`;
            if (isDeepSelectorUnique(anchor, cur)) {
              const rel = buildPathFromAncestor(cur, el);
              const composed = rel ? `${anchor} ${rel}` : anchor;
              if (isDeepSelectorUnique(composed, el)) return composed;
            }
          }

          for (const attr of anchorAttrs) {
            const val = cur.getAttribute(attr);
            if (!val) continue;
            const aSel = `[${attr}="${CSS.escape(val)}"]`;
            if (isDeepSelectorUnique(aSel, cur)) {
              const rel = buildPathFromAncestor(cur, el);
              const composed = rel ? `${aSel} ${rel}` : aSel;
              if (isDeepSelectorUnique(composed, el)) return composed;
            }
          }
          cur = cur.parentElement;
        }
      } catch {}
    }

    return buildFullPath(el);
  }

  function buildPathFromAncestor(ancestor, target) {
    const segs = [];
    let cur = target;

    // Detect if we're inside shadow DOM
    const root = target.getRootNode();
    const isShadowElement = root instanceof ShadowRoot;
    const boundary = isShadowElement ? root.host : document.body;

    while (cur && cur !== ancestor && cur !== boundary) {
      let seg = cur.tagName.toLowerCase();
      const parent = cur.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === cur.tagName);
        if (siblings.length > 1) {
          seg += `:nth-of-type(${siblings.indexOf(cur) + 1})`;
        }
      }

      segs.unshift(seg);
      cur = parent;

      // Stop if we've reached the shadow root host
      if (isShadowElement && cur === boundary) {
        break;
      }
    }

    return segs.join(' > ');
  }

  function buildFullPath(el) {
    let path = '';
    let current = el;

    // Detect if the element is inside a shadow DOM
    const root = el.getRootNode();
    const isShadowElement = root instanceof ShadowRoot;

    // Determine the boundary where we should stop traversing
    const boundary = isShadowElement ? root.host : document.body;

    while (current && current.nodeType === Node.ELEMENT_NODE && current !== boundary) {
      let sel = current.tagName.toLowerCase();
      const parent = current.parentElement;

      if (parent) {
        const siblings = Array.from(parent.children).filter((c) => c.tagName === current.tagName);
        if (siblings.length > 1) {
          sel += `:nth-of-type(${siblings.indexOf(current) + 1})`;
        }
      }

      path = path ? `${sel} > ${path}` : sel;
      current = parent;

      // Stop if we've reached the shadow root host
      if (isShadowElement && current === boundary) {
        break;
      }
    }

    // For shadow DOM elements, don't prepend "body >"
    // The selector should be relative within the shadow tree
    if (isShadowElement) {
      return path || el.tagName.toLowerCase();
    }

    // For light DOM elements, keep the original behavior
    return path ? `body > ${path}` : 'body';
  }

  function generateXPath(el) {
    if (!(el instanceof Element)) return '';
    if (el.id) return `//*[@id="${el.id}"]`;

    const segs = [];
    let cur = el;

    while (cur && cur.nodeType === 1 && cur !== document.documentElement) {
      const tag = cur.tagName.toLowerCase();

      if (cur.id) {
        segs.unshift(`//*[@id="${cur.id}"]`);
        break;
      }

      let i = 1;
      let sib = cur;
      while ((sib = sib.previousElementSibling)) {
        if (sib.tagName.toLowerCase() === tag) i++;
      }

      segs.unshift(`${tag}[${i}]`);
      cur = cur.parentElement;
    }

    return segs[0]?.startsWith('//*') ? segs.join('/') : '//' + segs.join('/');
  }

  function generateListSelector(target) {
    const list = computeElementList(target);
    const selected = list?.[0] || target;
    const parent = selected.parentElement;

    if (!parent) return generateSelector(target);

    const parentSel = generateSelector(parent);
    const childRel = generateSelectorWithinRoot(selected, parent);

    return parentSel && childRel ? `${parentSel} ${childRel}` : generateSelector(target);
  }

  function generateSelectorWithinRoot(el, root) {
    if (!(el instanceof Element)) return '';

    const tag = el.tagName.toLowerCase();

    // Use isDeepSelectorUnique for ID to support shadow DOM elements
    if (el.id) {
      const idSel = `#${CSS.escape(el.id)}`;
      if (isDeepSelectorUnique(idSel, el)) return idSel;
    }

    const attrNames = [
      'data-testid',
      'data-testId',
      'data-test',
      'data-qa',
      'data-cy',
      'name',
      'title',
      'alt',
      'aria-label',
    ];

    // Use isDeepSelectorUnique for attributes to support shadow DOM elements
    for (const attr of attrNames) {
      const v = el.getAttribute(attr);
      if (!v) continue;
      const aSel = `[${attr}="${CSS.escape(v)}"]`;
      const testSel = /^(input|textarea|select)$/i.test(tag) ? `${tag}${aSel}` : aSel;
      if (isDeepSelectorUnique(testSel, el)) return testSel;
    }

    try {
      const classes = Array.from(el.classList || []).filter((c) => c && /^[a-zA-Z0-9_-]+$/.test(c));

      // Use isDeepSelectorUnique for classes to support shadow DOM elements
      for (const cls of classes) {
        const sel = `.${CSS.escape(cls)}`;
        if (isDeepSelectorUnique(sel, el)) return sel;
      }

      for (const cls of classes) {
        const sel = `${tag}.${CSS.escape(cls)}`;
        if (isDeepSelectorUnique(sel, el)) return sel;
      }
    } catch {}

    return buildPathFromAncestor(root, el);
  }

  function getAccessibleName(el) {
    try {
      const labelledby = el.getAttribute('aria-labelledby');
      if (labelledby) {
        const labelEl = document.getElementById(labelledby);
        if (labelEl) return (labelEl.textContent || '').trim();
      }

      const ariaLabel = el.getAttribute('aria-label');
      if (ariaLabel) return ariaLabel.trim();

      if (el.id) {
        const label = document.querySelector(`label[for="${el.id}"]`);
        if (label) return (label.textContent || '').trim();
      }

      const parentLabel = el.closest('label');
      if (parentLabel) return (parentLabel.textContent || '').trim();

      return (
        el.getAttribute('placeholder') ||
        el.getAttribute('value') ||
        el.textContent ||
        ''
      ).trim();
    } catch {
      return '';
    }
  }

  // ============================================================================
  // List Mode Utilities
  // ============================================================================

  function getAllSiblings(el, selector) {
    const siblings = [el];
    const validate = (element) => {
      const isSameTag = el.tagName === element.tagName;
      let ok = isSameTag;
      if (selector) {
        try {
          ok = ok && !!element.querySelector(selector);
        } catch {}
      }
      return ok;
    };

    let next = el;
    let prev = el;
    let elementIndex = 1;

    while ((prev = prev?.previousElementSibling)) {
      if (validate(prev)) {
        elementIndex += 1;
        siblings.unshift(prev);
      }
    }

    while ((next = next?.nextElementSibling)) {
      if (validate(next)) siblings.push(next);
    }

    return { elements: siblings, index: elementIndex };
  }

  function getElementList(el, maxDepth = 50, paths = []) {
    if (maxDepth === 0 || !el || el.tagName === 'BODY') return null;

    let selector = el.tagName.toLowerCase();
    const { elements, index } = getAllSiblings(el, paths.join(' > '));
    let siblings = elements;

    if (index !== 1) selector += `:nth-of-type(${index})`;
    paths.unshift(selector);

    if (siblings.length === 1) {
      siblings = getElementList(el.parentElement, maxDepth - 1, paths);
    }

    return siblings;
  }

  function computeElementList(target) {
    try {
      return getElementList(target) || [target];
    } catch {
      return [target];
    }
  }

  // ============================================================================
  // Deep Query (Shadow DOM Support)
  // ============================================================================

  function* walkAllNodesDeep(root) {
    const stack = [root];
    let count = 0;
    const MAX = 10000;

    while (stack.length) {
      const node = stack.pop();
      if (!node || ++count > MAX) continue;

      // Skip overlay elements to prevent panel self-highlighting
      if (isOverlayElement(node)) {
        continue;
      }

      yield node;

      try {
        if (node.children) {
          const children = Array.from(node.children);
          for (let i = children.length - 1; i >= 0; i--) {
            stack.push(children[i]);
          }
        }

        if (node.shadowRoot?.children) {
          const srChildren = Array.from(node.shadowRoot.children);
          for (let i = srChildren.length - 1; i >= 0; i--) {
            stack.push(srChildren[i]);
          }
        }
      } catch {}
    }
  }

  function queryAllDeep(selector) {
    const results = [];
    for (const node of walkAllNodesDeep(document)) {
      if (!(node instanceof Element)) continue;
      try {
        if (node.matches(selector)) results.push(node);
      } catch {}
    }
    return results;
  }

  /**
   * Check if a selector uniquely identifies the target element across the entire DOM tree,
   * including shadow DOM boundaries.
   *
   * This function uses queryAllDeep to traverse both light DOM and shadow DOM,
   * ensuring that selectors work correctly for elements inside shadow roots.
   *
   * @param {string} selector - The CSS selector to test
   * @param {Element} target - The target element that should be uniquely identified
   * @returns {boolean} True if the selector matches exactly one element and it's the target
   */
  function isDeepSelectorUnique(selector, target) {
    if (!selector || !(target instanceof Element)) return false;
    try {
      const matches = queryAllDeep(selector);
      return matches.length === 1 && matches[0] === target;
    } catch (error) {
      return false;
    }
  }

  function evaluateXPathAll(xpath) {
    try {
      const arr = [];
      const res = document.evaluate(
        xpath,
        document,
        null,
        XPathResult.ORDERED_NODE_SNAPSHOT_TYPE,
        null,
      );

      for (let i = 0; i < res.snapshotLength; i++) {
        const n = res.snapshotItem(i);
        // Filter out overlay elements to prevent panel self-highlighting
        if (n?.nodeType === 1 && !isOverlayElement(n)) {
          arr.push(n);
        }
      }
      return arr;
    } catch {
      return [];
    }
  }

  // ============================================================================
  // Highlighter & Rects Management
  // ============================================================================

  const STATE = {
    active: false,
    hoverEl: null,
    selectedEl: null,
    box: null,
    highlighter: null,
    listenersAttached: false,
    rectsHost: null,
    hoveredList: [],
    verifyRectsActive: false, // Track if verify rects are showing
    // Performance optimization: rAF throttling for hover
    hoverRafId: null,
    lastHoverTarget: null,
    // DOM pooling for rect elements
    rectPool: [],
    rectPoolUsed: 0,
  };

  function ensureHighlighter() {
    if (STATE.highlighter) return STATE.highlighter;

    const hl = document.createElement('div');
    hl.id = '__element_marker_highlight';
    Object.assign(hl.style, {
      position: 'fixed',
      zIndex: String(CONFIG.Z_INDEX.HIGHLIGHTER),
      pointerEvents: 'none',
      border: `2px solid ${CONFIG.COLORS.HOVER}`,
      borderRadius: '4px',
      boxShadow: `0 0 0 2px ${CONFIG.COLORS.HOVER}33`,
      transition: 'all 100ms ease-out',
    });

    document.documentElement.appendChild(hl);
    STATE.highlighter = hl;
    return hl;
  }

  function ensureRectsHost() {
    if (STATE.rectsHost) return STATE.rectsHost;

    const host = document.createElement('div');
    host.id = '__element_marker_rects';
    Object.assign(host.style, {
      position: 'fixed',
      zIndex: String(CONFIG.Z_INDEX.RECTS),
      pointerEvents: 'none',
      inset: '0',
    });

    document.documentElement.appendChild(host);
    STATE.rectsHost = host;
    return host;
  }

  function moveHighlighterTo(el) {
    const hl = ensureHighlighter();
    const r = el.getBoundingClientRect();
    hl.style.left = `${r.left}px`;
    hl.style.top = `${r.top}px`;
    hl.style.width = `${r.width}px`;
    hl.style.height = `${r.height}px`;
    hl.style.display = 'block';
  }

  function clearHighlighter() {
    if (STATE.highlighter) STATE.highlighter.style.display = 'none';
    // Only clear hover rects, not verify rects
    if (!STATE.verifyRectsActive) {
      clearRects();
    }
  }

  function clearRects() {
    // Hide all pooled rect boxes instead of destroying them
    const used = STATE.rectPoolUsed || 0;
    for (let i = 0; i < used; i++) {
      const box = STATE.rectPool[i];
      if (box) box.style.display = 'none';
    }
    STATE.rectPoolUsed = 0;
    STATE.verifyRectsActive = false;
    // Invalidate lastHoverTarget so next hover will redraw even on same element
    STATE.lastHoverTarget = null;
  }

  /**
   * Get or create a rect box from the pool
   * @param {HTMLElement} host - The container element
   * @param {number} index - The pool index
   * @returns {HTMLDivElement} The rect box element
   */
  function getOrCreateRectBox(host, index) {
    let box = STATE.rectPool[index];
    if (!box) {
      box = document.createElement('div');
      Object.assign(box.style, {
        position: 'fixed',
        pointerEvents: 'none',
        borderRadius: '4px',
        transition: 'all 100ms ease-out',
        display: 'none',
      });
      STATE.rectPool[index] = box;
    }
    // Ensure the box is attached to the host
    if (!box.isConnected) {
      host.appendChild(box);
    }
    return box;
  }

  // Maximum rect pool size to prevent memory bloat
  const MAX_RECT_POOL_SIZE = 100;

  /**
   * Draw rect boxes with pooling optimization
   * @param {Array<{x: number, y: number, width: number, height: number}>} rects - Rect data
   * @param {Object} options - Drawing options
   * @param {boolean} options.isVerify - Whether this is a verify highlight (affects verifyRectsActive)
   */
  function drawRectBoxes(
    rects,
    { color = CONFIG.COLORS.HOVER, dashed = true, offsetX = 0, offsetY = 0, isVerify = false } = {},
  ) {
    const host = ensureRectsHost();
    const prevUsed = STATE.rectPoolUsed || 0;
    // Limit rect count to prevent memory bloat
    const count = Math.min(Array.isArray(rects) ? rects.length : 0, MAX_RECT_POOL_SIZE);

    // Update or show rect boxes
    for (let i = 0; i < count; i++) {
      const r = rects[i];
      if (!r) continue;

      const x = Number.isFinite(r.left) ? r.left : Number.isFinite(r.x) ? r.x : 0;
      const y = Number.isFinite(r.top) ? r.top : Number.isFinite(r.y) ? r.y : 0;
      const w = Number.isFinite(r.width) ? r.width : 0;
      const h = Number.isFinite(r.height) ? r.height : 0;

      const box = getOrCreateRectBox(host, i);
      Object.assign(box.style, {
        left: `${offsetX + x}px`,
        top: `${offsetY + y}px`,
        width: `${w}px`,
        height: `${h}px`,
        border: `2px ${dashed ? 'dashed' : 'solid'} ${color}`,
        boxShadow: `0 0 0 2px ${color}22`,
        display: 'block',
      });
    }

    // Hide excess boxes from previous render
    for (let i = count; i < prevUsed; i++) {
      const box = STATE.rectPool[i];
      if (box) box.style.display = 'none';
    }

    STATE.rectPoolUsed = count;
    // Reset verifyRectsActive for hover operations (so clearHighlighter works correctly)
    // Only set to true when isVerify is explicitly true
    STATE.verifyRectsActive = isVerify;
  }

  function drawRects(elements, color = CONFIG.COLORS.HOVER, dashed = true, isVerify = false) {
    const rects = elements.map((el) => {
      const r = el.getBoundingClientRect();
      return { x: r.left, y: r.top, width: r.width, height: r.height };
    });
    drawRectBoxes(rects, { color, dashed, isVerify });
  }

  // ============================================================================
  // Interaction Logic
  // ============================================================================

  function isInsidePanel(target) {
    const shadow = PanelHost.getShadow();
    return !!shadow && target instanceof Node && shadow.contains(target);
  }

  /**
   * Check if a node belongs to the element marker overlay (panel host or its shadow DOM)
   * This is used to filter out overlay elements from query results to prevent self-highlighting
   *
   * @param {Node} node - The node to check
   * @returns {boolean} True if the node is part of the overlay
   */
  function isOverlayElement(node) {
    if (!(node instanceof Node)) return false;

    const host = PanelHost.getHost();
    if (!host) return false;

    // Check if node is the panel host itself
    if (node === host) return true;

    // Check if node is within the shadow DOM of the panel host
    const root = typeof node.getRootNode === 'function' ? node.getRootNode() : null;
    return root instanceof ShadowRoot && root.host === host;
  }

  /**
   * Filter out overlay elements from an array of elements
   * This ensures that panel components are never included in highlight/verification results
   *
   * @param {Array} elements - Array of elements to filter
   * @returns {Array} Filtered array without overlay elements
   */
  function filterOverlayElements(elements) {
    if (!Array.isArray(elements)) return [];
    return elements.filter((node) => !isOverlayElement(node));
  }

  /**
   * Get the effective event target for page element selection, considering shadow DOM boundaries.
   *
   * This function resolves the real target element from a pointer event by walking the
   * composed path (if available) to find the innermost page element, skipping overlay elements.
   *
   * Background:
   * - When events bubble up from inside shadow DOM, they get "retargeted" at shadow boundaries
   * - By the time a window-level listener receives the event, ev.target points to the shadow host
   * - composedPath() exposes the original event path before retargeting
   * - This allows us to select elements inside shadow DOM (e.g., <td-header> internals)
   *
   * IMPORTANT: This function should only be called AFTER verifying the event is not from
   * overlay UI (panel buttons, etc). Otherwise it will filter out overlay elements and break
   * panel interactions.
   *
   * @param {Event} ev - The pointer event (mousemove, click, etc.)
   * @returns {Element|null} The innermost non-overlay page element, or null if none found
   */
  function getDeepPageTarget(ev) {
    if (!ev) return null;

    // Try to walk the composed path to find the innermost non-overlay element
    try {
      const path = typeof ev.composedPath === 'function' ? ev.composedPath() : null;
      if (Array.isArray(path) && path.length > 0) {
        // Walk from innermost to outermost, find the first real page element
        for (const node of path) {
          if (node instanceof Element && !isOverlayElement(node)) {
            return node;
          }
        }
      }
    } catch (error) {
      // composedPath() may throw in some edge cases (e.g., detached nodes)
      // Fall through to use ev.target
    }

    // Fallback: use ev.target if composedPath is unavailable or all nodes were filtered
    const fallback = ev.target instanceof Element ? ev.target : null;
    // If fallback is overlay, return null (caller should handle this case)
    if (fallback && !isOverlayElement(fallback)) {
      return fallback;
    }
    return null;
  }

  // Store pending hover event for rAF processing
  let pendingHoverEvent = null;

  /**
   * Process mouse move event - the actual hover update logic
   * Separated from onMouseMove for rAF throttling
   */
  function processMouseMove(ev) {
    if (!STATE.active) return;

    const rawTarget = ev?.target;
    if (!(rawTarget instanceof Element)) {
      STATE.hoverEl = null;
      STATE.lastHoverTarget = null;
      clearHighlighter();
      return;
    }

    const host = PanelHost.getHost();
    if ((host && rawTarget === host) || isInsidePanel(rawTarget)) {
      STATE.hoverEl = null;
      STATE.lastHoverTarget = null;
      clearHighlighter();
      return;
    }

    const target = getDeepPageTarget(ev) || rawTarget;
    STATE.hoverEl = target;

    // Get current listMode
    let listMode = false;
    try {
      listMode = !!StateStore.get('listMode');
    } catch {}

    // Skip update if target and mode haven't changed
    const last = STATE.lastHoverTarget;
    if (last && last.element === target && last.listMode === listMode) {
      return;
    }
    STATE.lastHoverTarget = { element: target, listMode };

    if (!IS_MAIN) {
      try {
        const list = listMode ? computeElementList(target) || [target] : [target];
        const rects = list.map((el) => {
          const r = el.getBoundingClientRect();
          return { x: r.left, y: r.top, width: r.width, height: r.height };
        });

        // Performance: Don't generate selector on hover (defer to click)
        window.top.postMessage({ type: 'em_hover', rects }, '*');
      } catch {}
      return;
    }

    if (listMode) {
      STATE.hoveredList = computeElementList(target) || [target];
      drawRects(STATE.hoveredList);
    } else {
      moveHighlighterTo(target);
    }
  }

  /**
   * Mouse move handler with rAF throttling
   * Ensures hover updates are batched to animation frame rate
   */
  function onMouseMove(ev) {
    if (!STATE.active) return;

    // Store the latest event
    pendingHoverEvent = ev;

    // Skip if already scheduled
    if (STATE.hoverRafId != null) return;

    // Schedule processing on next animation frame
    STATE.hoverRafId = requestAnimationFrame(() => {
      STATE.hoverRafId = null;
      const latest = pendingHoverEvent;
      pendingHoverEvent = null;
      if (!latest) return;
      processMouseMove(latest);
    });
  }

  // ============================================================================
  // Event Listeners Management
  // ============================================================================

  function attachPointerListeners() {
    if (STATE.listenersAttached) return;
    window.addEventListener('mousemove', onMouseMove, true);
    window.addEventListener('click', onClick, true);
    STATE.listenersAttached = true;
  }

  function detachPointerListeners() {
    if (!STATE.listenersAttached) return;
    window.removeEventListener('mousemove', onMouseMove, true);
    window.removeEventListener('click', onClick, true);
    STATE.listenersAttached = false;
  }

  function attachKeyboardListener() {
    window.addEventListener('keydown', onKeyDown, true);
  }

  function detachKeyboardListener() {
    window.removeEventListener('keydown', onKeyDown, true);
  }

  function syncInteractionMode() {
    if (!STATE.active) return;
    const activeTab = StateStore.get('activeTab');
    if (activeTab === 'execute') {
      // In execute mode, detach pointer listeners to allow real interactions
      // but keep keyboard listener for Esc key
      detachPointerListeners();
      // Only clear the hover highlighter, not the verification rects
      if (STATE.highlighter) STATE.highlighter.style.display = 'none';
    } else {
      // In attributes mode, attach all listeners for element selection
      attachPointerListeners();
    }
  }

  // ============================================================================
  // Event Handlers
  // ============================================================================

  function onClick(ev) {
    if (!STATE.active) return;

    // First, use the raw ev.target to check for overlay UI
    // This ensures panel buttons and other UI elements remain interactive
    const rawTarget = ev.target;
    const host = PanelHost.getHost();

    // Check if raw target is the panel host itself or inside the shadow DOM
    // IMPORTANT: Return early WITHOUT preventDefault to allow overlay button clicks
    if ((host && rawTarget === host) || isInsidePanel(rawTarget)) {
      return;
    }

    // Now we know it's a page element, prevent default and get deep target
    ev.preventDefault();
    ev.stopPropagation();

    if (!(rawTarget instanceof Element)) return;

    // Get the deep target (considering shadow DOM) after confirming it's not overlay
    const target = getDeepPageTarget(ev) || rawTarget;

    if (!IS_MAIN) {
      try {
        const selectorType = StateStore.get('selectorType');
        const listMode = StateStore.get('listMode');

        const sel =
          selectorType === 'xpath'
            ? generateXPath(target)
            : listMode
              ? generateListSelector(target)
              : generateSelector(target);

        window.top.postMessage({ type: 'em_click', innerSel: sel }, '*');
      } catch {}
      return;
    }

    setSelection(target);
  }

  function onKeyDown(e) {
    if (!STATE.active) return;

    // Check if the focused element is inside the panel - if so, don't handle selection keys
    if (isInsidePanel(e.target)) {
      // Key event is from panel, don't interfere
      if (e.key !== 'Escape') return; // Still allow Escape to close
    }

    // In execute mode, only handle Escape to close - don't intercept other keys
    // This allows real page interactions (typing, scrolling, etc.)
    const activeTab = StateStore.get('activeTab');
    if (activeTab === 'execute') {
      if (e.key === 'Escape') {
        e.preventDefault();
        stop();
      }
      return; // Don't intercept Space/Arrow keys in execute mode
    }

    if (e.key === 'Escape') {
      e.preventDefault();
      stop();
    } else if (e.key === ' ' || e.code === 'Space') {
      e.preventDefault();
      const t = STATE.hoverEl || STATE.selectedEl;
      if (t) setSelection(t);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.parentElement) setSelection(base.parentElement);
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.firstElementChild) setSelection(base.firstElementChild);
    }
  }

  function setSelection(el) {
    if (!(el instanceof Element)) return;

    STATE.selectedEl = el;

    const selectorType = StateStore.get('selectorType');
    const listMode = StateStore.get('listMode');

    const sel =
      selectorType === 'xpath'
        ? generateXPath(el)
        : listMode
          ? generateListSelector(el)
          : generateSelector(el);

    const name = getAccessibleName(el) || el.tagName.toLowerCase();

    const selectorText = STATE.box?.querySelector('#__em_selector');
    const inputName = STATE.box?.querySelector('#__em_name');
    const selectorDisplay = STATE.box?.querySelector('#__em_selector_text');

    if (selectorText) selectorText.textContent = sel;
    if (selectorDisplay) selectorDisplay.textContent = sel;
    if (inputName && !inputName.value) inputName.value = name;

    moveHighlighterTo(el);
  }

  // ============================================================================
  // Validation Logic
  // ============================================================================

  /**
   * Verify selector by highlighting only (non-destructive)
   */
  async function verifyHighlightOnly() {
    try {
      const selector = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!selector) return;

      StateStore.set({
        validation: { status: 'running', message: 'Verifying selector...' },
      });

      const selectorType = StateStore.get('selectorType');
      const listMode = StateStore.get('listMode');
      const effectiveType = listMode ? 'css' : selectorType;

      // Query for matches
      const matches =
        effectiveType === 'xpath' ? evaluateXPathAll(selector) : queryAllDeep(selector);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!filteredMatches || filteredMatches.length === 0) {
        StateStore.set({
          validation: { status: 'failure', message: 'No elements found' },
        });
        return;
      }

      // Scroll first match into view
      const primaryMatch = filteredMatches[0];
      if (primaryMatch) {
        primaryMatch.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'smooth',
        });
      }

      await sleep(200);

      // Highlight matches with isVerify=true to prevent clearing on hover
      drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false, true);

      StateStore.set({
        validation: {
          status: 'success',
          message: `Found ${filteredMatches.length} element${filteredMatches.length > 1 ? 's' : ''}`,
        },
      });

      // Auto-clear highlight after 2 seconds
      setTimeout(() => {
        clearRects();
        StateStore.set({
          validation: { status: 'idle', message: '' },
        });
      }, 2000);
    } catch (error) {
      console.error('[verifyHighlightOnly] error:', error);
      StateStore.set({
        validation: { status: 'failure', message: error.message || 'Verification failed' },
      });
    }
  }

  /**
   * Execute action on selector (destructive)
   */
  async function verifySelectorNow() {
    try {
      const selector = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!selector) return;

      StateStore.set({
        validation: { status: 'running', message: 'Executing action...' },
      });

      const selectorType = StateStore.get('selectorType');
      const listMode = StateStore.get('listMode');

      const effectiveType = listMode ? 'css' : selectorType;

      const matches =
        effectiveType === 'xpath' ? evaluateXPathAll(selector) : queryAllDeep(selector);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!filteredMatches || filteredMatches.length === 0) {
        StateStore.set({
          validation: { status: 'failure', message: 'No elements found' },
        });
        return;
      }

      drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false);

      const action = STATE.box?.querySelector('#__em_action')?.value || 'hover';

      const payload = {
        type: 'element_marker_validate',
        selector,
        selectorType: effectiveType,
        action,
        listMode,
      };

      // Action-specific parameters with validation
      if (action === 'type_text') {
        const actionText = String(
          STATE.box?.querySelector('#__em_action_text')?.value || '',
        ).trim();
        if (!actionText) {
          StateStore.set({
            validation: { status: 'failure', message: 'Text is required for type_text' },
          });
          return;
        }
        payload.text = actionText;
      }

      if (action === 'press_keys') {
        const actionKeys = String(
          STATE.box?.querySelector('#__em_action_keys')?.value || '',
        ).trim();
        if (!actionKeys) {
          StateStore.set({
            validation: { status: 'failure', message: 'Keys are required for press_keys' },
          });
          return;
        }
        payload.keys = actionKeys;
      }

      if (action === 'scroll') {
        const direction = STATE.box?.querySelector('#__em_scroll_direction')?.value || 'down';
        const rawAmount = Number(STATE.box?.querySelector('#__em_scroll_distance')?.value);
        // Clamp to 1-10 range (backend expects ticks, not pixels)
        const amount = Math.max(
          1,
          Math.min(Math.round(Number.isFinite(rawAmount) ? rawAmount : 3), 10),
        );
        payload.scrollDirection = direction;
        payload.scrollAmount = amount;
      }

      if (['left_click', 'double_click', 'right_click'].includes(action)) {
        payload.modifiers = {
          altKey: !!STATE.box?.querySelector('#__em_mod_alt')?.checked,
          ctrlKey: !!STATE.box?.querySelector('#__em_mod_ctrl')?.checked,
          metaKey: !!STATE.box?.querySelector('#__em_mod_meta')?.checked,
          shiftKey: !!STATE.box?.querySelector('#__em_mod_shift')?.checked,
        };
        payload.button = STATE.box?.querySelector('#__em_btn')?.value || 'left';
        payload.waitForNavigation = !!STATE.box?.querySelector('#__em_wait_nav')?.checked;
        payload.timeoutMs = Number(STATE.box?.querySelector('#__em_nav_timeout')?.value) || 3000;
      }

      const res = await chrome.runtime.sendMessage(payload);

      const success = !!res?.tool?.ok;
      const newEntry = {
        action,
        success,
        timestamp: Date.now(),
        matchCount: filteredMatches.length,
      };
      const history = [...(StateStore.get('validationHistory') || []), newEntry].slice(-5);

      if (res?.tool?.ok) {
        StateStore.set({
          validation: {
            status: 'success',
            message: `✓ Verified (matched ${filteredMatches.length} elements)`,
          },
          validationHistory: history,
        });
      } else {
        StateStore.set({
          validation: {
            status: 'failure',
            message: res?.tool?.error || 'Verification failed',
          },
          validationHistory: history,
        });
      }
    } catch (err) {
      const newEntry = {
        action: STATE.box?.querySelector('#__em_action')?.value || 'hover',
        success: false,
        timestamp: Date.now(),
        matchCount: 0,
      };
      const history = [...(StateStore.get('validationHistory') || []), newEntry].slice(-5);

      StateStore.set({
        validation: {
          status: 'failure',
          message: `Error: ${err.message}`,
        },
        validationHistory: history,
      });
    }
  }

  /**
   * Highlight selector from external request (popup/background)
   * Supports composite iframe selectors: "frameSelector |> innerSelector"
   */
  async function highlightSelectorExternal({ selector, selectorType = 'css', listMode = false }) {
    const normalized = String(selector || '').trim();
    if (!normalized) {
      return { success: false, error: 'selector is required' };
    }

    try {
      // Handle composite iframe selector
      if (normalized.includes('|>')) {
        const parts = normalized
          .split('|>')
          .map((s) => s.trim())
          .filter(Boolean);

        if (parts.length >= 2) {
          const frameSel = parts[0];
          const innerSel = parts.slice(1).join(' |> ');

          // Find frame element
          let frameEl = null;
          try {
            frameEl = querySelectorDeepFirst(frameSel) || document.querySelector(frameSel);
          } catch {}

          if (
            !frameEl ||
            !(frameEl instanceof HTMLIFrameElement || frameEl instanceof HTMLFrameElement)
          ) {
            return { success: false, error: `Frame element not found: ${frameSel}` };
          }

          const cw = frameEl.contentWindow;
          if (!cw) {
            return { success: false, error: 'Unable to access frame contentWindow' };
          }

          // Forward highlight request to iframe
          return new Promise((resolve) => {
            const reqId = `em_highlight_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
            const listener = (ev) => {
              try {
                const data = ev?.data;
                if (!data || data.type !== 'em-highlight-result' || data.reqId !== reqId) return;
                window.removeEventListener('message', listener, true);
                resolve(data.result);
              } catch {}
            };

            window.addEventListener('message', listener, true);
            setTimeout(() => {
              window.removeEventListener('message', listener, true);
              resolve({ success: false, error: 'Frame highlight timeout' });
            }, 3000);

            cw.postMessage(
              {
                type: 'em-highlight-request',
                reqId,
                selector: innerSel,
                selectorType,
                listMode,
              },
              '*',
            );
          });
        }
      }

      // Handle normal selector (non-iframe)
      const effectiveType = listMode ? 'css' : selectorType;
      const matches =
        effectiveType === 'xpath' ? evaluateXPathAll(normalized) : queryAllDeep(normalized);

      // Additional defense: filter out any overlay elements that might have slipped through
      const filteredMatches = filterOverlayElements(matches);

      if (!filteredMatches || filteredMatches.length === 0) {
        return { success: false, error: 'No elements found for selector' };
      }

      // Scroll first match into view
      const primaryMatch = filteredMatches[0];
      if (primaryMatch) {
        primaryMatch.scrollIntoView({
          block: 'center',
          inline: 'center',
          behavior: 'smooth',
        });
      }

      await sleep(150);

      // Draw highlight rectangles
      drawRects(filteredMatches, CONFIG.COLORS.VERIFY, false);

      // Auto-clear after 2 seconds
      setTimeout(() => {
        clearRects();
      }, 2000);

      return { success: true, count: filteredMatches.length };
    } catch (error) {
      return { success: false, error: error.message || String(error) };
    }
  }

  function copySelectorNow() {
    try {
      const sel = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();
      if (!sel) return;
      navigator.clipboard?.writeText(sel).catch(() => {});

      StateStore.set({
        validation: { status: 'success', message: '✓ Copied to clipboard' },
      });

      setTimeout(() => {
        StateStore.set({ validation: { status: 'idle', message: '' } });
      }, 2000);
    } catch {}
  }

  async function save() {
    try {
      const name = STATE.box?.querySelector('#__em_name')?.value?.trim();
      const selector = STATE.box?.querySelector('#__em_selector')?.textContent?.trim();

      if (!selector) return;

      const url = location.href;
      let selectorType = StateStore.get('selectorType');
      const listMode = StateStore.get('listMode');

      if (listMode && selectorType === 'xpath') {
        selectorType = 'css';
      }

      await chrome.runtime.sendMessage({
        type: 'element_marker_save',
        marker: {
          url,
          name: name || selector,
          selector,
          selectorType,
          listMode,
        },
      });
    } catch {}

    stop();
  }

  // ============================================================================
  // Lifecycle Management
  // ============================================================================

  function start() {
    if (STATE.active) return;
    STATE.active = true;

    if (IS_MAIN) {
      const { host } = PanelHost.mount();
      STATE.box = host;
      StateStore.init();
      bindControls();
    }

    ensureHighlighter();
    ensureRectsHost();

    attachPointerListeners();
    attachKeyboardListener();
    syncInteractionMode();
  }

  function stop() {
    STATE.active = false;

    detachPointerListeners();
    detachKeyboardListener();

    // Cancel pending rAF
    if (STATE.hoverRafId != null) {
      cancelAnimationFrame(STATE.hoverRafId);
      STATE.hoverRafId = null;
    }
    pendingHoverEvent = null;

    try {
      STATE.highlighter?.remove();
      STATE.rectsHost?.remove();
      PanelHost.unmount();
      DragController.destroy();
    } catch {}

    STATE.highlighter = null;
    STATE.rectsHost = null;
    STATE.box = null;
    STATE.hoveredList = [];
    STATE.hoverEl = null;
    STATE.selectedEl = null;
    STATE.lastHoverTarget = null;
    STATE.verifyRectsActive = false;

    // Clear rect pool to release DOM references
    STATE.rectPool.length = 0;
    STATE.rectPoolUsed = 0;
  }

  // ============================================================================
  // Controls Binding
  // ============================================================================

  function bindControls() {
    const host = STATE.box;
    if (!host) return;

    // Close/Cancel
    host.querySelector('#__em_close')?.addEventListener('click', stop);
    host.querySelector('#__em_cancel')?.addEventListener('click', stop);

    // Save
    host.querySelector('#__em_save')?.addEventListener('click', save);

    // Verify (highlight only) & Execute (real action)
    host.querySelector('#__em_verify')?.addEventListener('click', verifyHighlightOnly);
    host.querySelector('#__em_execute')?.addEventListener('click', verifySelectorNow);

    // Copy
    host.querySelector('#__em_copy')?.addEventListener('click', copySelectorNow);
    host.querySelector('#__em_copy_selector')?.addEventListener('click', copySelectorNow);

    // Action change handler - show/hide action-specific options
    host.querySelector('#__em_action')?.addEventListener('change', (e) => {
      updateActionSpecificUI(e.target.value);
    });

    // Selector type
    host.querySelector('#__em_selector_type')?.addEventListener('change', (e) => {
      const newType = e.target.value;
      const listMode = StateStore.get('listMode');

      // If switching to XPath while in list mode, disable list mode
      if (newType === 'xpath' && listMode) {
        StateStore.set({ selectorType: newType, listMode: false });
      } else {
        StateStore.set({ selectorType: newType });
      }

      // Regenerate selector for the currently selected element
      if (STATE.selectedEl) {
        setSelection(STATE.selectedEl);
      }
      // Note: If no selectedEl (e.g., iframe selections or manual input),
      // preserve existing selector text instead of clearing it
    });

    // List mode toggle
    host.querySelector('#__em_toggle_list')?.addEventListener('click', (e) => {
      const listMode = StateStore.get('listMode');
      const newListMode = !listMode;

      // If enabling list mode, force CSS selector type
      if (newListMode) {
        StateStore.set({ listMode: true, selectorType: 'css' });
        const selectorTypeSelect = host.querySelector('#__em_selector_type');
        if (selectorTypeSelect) selectorTypeSelect.value = 'css';
      } else {
        StateStore.set({ listMode: false });
      }

      // Update button active state
      const btn = e.currentTarget;
      if (btn) {
        if (newListMode) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      }

      // Regenerate selector for the currently selected element
      if (STATE.selectedEl) {
        setSelection(STATE.selectedEl);
      }

      clearHighlighter();
    });

    // Tab toggle (switch between Attributes and Execute)
    host.querySelector('#__em_toggle_tab')?.addEventListener('click', () => {
      const currentTab = StateStore.get('activeTab');
      StateStore.set({ activeTab: currentTab === 'attributes' ? 'execute' : 'attributes' });
    });

    // Tab switching
    const tabs = host.querySelectorAll('.em-tab');
    tabs.forEach((tab) => {
      tab.addEventListener('click', () => {
        StateStore.set({ activeTab: tab.dataset.tab });
      });
    });

    // Navigation buttons
    host.querySelector('#__em_nav_up')?.addEventListener('click', () => {
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.parentElement) setSelection(base.parentElement);
    });

    host.querySelector('#__em_nav_down')?.addEventListener('click', () => {
      const base = STATE.selectedEl || STATE.hoverEl;
      if (base?.firstElementChild) setSelection(base.firstElementChild);
    });

    // Preferences
    host.querySelector('#__em_pref_id')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferId: !!e.target.checked };
      StateStore.set({ prefs });
    });
    host.querySelector('#__em_pref_attr')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferStableAttr: !!e.target.checked };
      StateStore.set({ prefs });
    });
    host.querySelector('#__em_pref_class')?.addEventListener('change', (e) => {
      const prefs = { ...StateStore.get('prefs'), preferClass: !!e.target.checked };
      StateStore.set({ prefs });
    });

    // Drag - use entire header as drag handle
    const dragHandle = host.querySelector('#__em_drag_handle');
    if (dragHandle) {
      DragController.init(dragHandle);
    }

    syncUIWithState();
  }

  function updateActionSpecificUI(action) {
    const host = STATE.box;
    if (!host) return;

    // Hide all action-specific groups
    const textGroup = host.querySelector('#__em_action_text_group');
    const keysGroup = host.querySelector('#__em_action_keys_group');
    const scrollOptions = host.querySelector('#__em_scroll_options');
    const clickOptions = host.querySelector('#__em_click_options');

    if (textGroup) textGroup.style.display = 'none';
    if (keysGroup) keysGroup.style.display = 'none';
    if (scrollOptions) scrollOptions.style.display = 'none';
    if (clickOptions) clickOptions.style.display = 'none';

    // Show relevant options based on action
    if (action === 'type_text') {
      if (textGroup) textGroup.style.display = 'block';
    } else if (action === 'press_keys') {
      if (keysGroup) keysGroup.style.display = 'block';
    } else if (action === 'scroll') {
      if (scrollOptions) scrollOptions.style.display = 'block';
    } else if (['left_click', 'double_click', 'right_click'].includes(action)) {
      if (clickOptions) clickOptions.style.display = 'block';

      // For right_click, button selector is not relevant (always 'right')
      // Hide the button field for right_click
      const buttonField = host.querySelector('#__em_btn')?.closest('.em-field');
      if (buttonField) {
        buttonField.style.display = action === 'right_click' ? 'none' : 'block';
      }
    }
    // hover: no extra options needed
  }

  function syncUIWithState() {
    const host = STATE.box;
    if (!host) return;

    const state = StateStore.get();

    const typeSelect = host.querySelector('#__em_selector_type');
    if (typeSelect) typeSelect.value = state.selectorType;

    // Initialize list mode button state
    const listModeBtn = host.querySelector('#__em_toggle_list');
    if (listModeBtn) {
      if (state.listMode) {
        listModeBtn.classList.add('active');
      } else {
        listModeBtn.classList.remove('active');
      }
    }

    const prefId = host.querySelector('#__em_pref_id');
    const prefAttr = host.querySelector('#__em_pref_attr');
    const prefClass = host.querySelector('#__em_pref_class');
    if (prefId) prefId.checked = state.prefs.preferId;
    if (prefAttr) prefAttr.checked = state.prefs.preferStableAttr;
    if (prefClass) prefClass.checked = state.prefs.preferClass;

    // Initialize action-specific UI
    const actionSelect = host.querySelector('#__em_action');
    if (actionSelect) {
      updateActionSpecificUI(actionSelect.value);
    }
  }

  // ============================================================================
  // Cross-Frame Bridge
  // ============================================================================

  // Register window message listener in all frames (not just main)
  // to support cross-frame highlighting from popup validation
  window.addEventListener(
    'message',
    (ev) => {
      try {
        const data = ev?.data;
        if (!data) return;

        // Handle iframe highlight request (works even when overlay is inactive)
        if (data.type === 'em-highlight-request') {
          highlightSelectorExternal({
            selector: data.selector,
            selectorType: data.selectorType || 'css',
            listMode: !!data.listMode,
          })
            .then((result) => {
              window.parent.postMessage(
                {
                  type: 'em-highlight-result',
                  reqId: data.reqId,
                  result,
                },
                '*',
              );
            })
            .catch((error) => {
              window.parent.postMessage(
                {
                  type: 'em-highlight-result',
                  reqId: data.reqId,
                  result: { success: false, error: error?.message || String(error) },
                },
                '*',
              );
            });
          return;
        }

        // Following messages only relevant when overlay is active
        if (!STATE.active) return;

        // Only main frame handles these overlay-related messages
        if (!IS_MAIN) return;

        const iframes = Array.from(document.querySelectorAll('iframe'));
        const host = iframes.find((f) => {
          try {
            return f.contentWindow === ev.source;
          } catch {
            return false;
          }
        });

        if (!host) return;

        const base = host.getBoundingClientRect();

        if (data.type === 'em_hover' && Array.isArray(data.rects)) {
          // Use pooled rect boxes for better performance
          drawRectBoxes(data.rects, {
            offsetX: base.left,
            offsetY: base.top,
            color: CONFIG.COLORS.HOVER,
            dashed: true,
          });
        } else if (data.type === 'em_click' && data.innerSel) {
          const frameSel = generateSelector(host);
          const composite = frameSel ? `${frameSel} |> ${data.innerSel}` : data.innerSel;
          const selectorText = STATE.box?.querySelector('#__em_selector');
          const selectorDisplay = STATE.box?.querySelector('#__em_selector_text');
          if (selectorText) selectorText.textContent = composite;
          if (selectorDisplay) selectorDisplay.textContent = composite;
        }
      } catch {}
    },
    true,
  );

  // ============================================================================
  // Message Handlers
  // ============================================================================

  chrome.runtime.onMessage.addListener((request, _sender, sendResponse) => {
    if (request?.action === 'element_marker_start') {
      start();
      sendResponse({ ok: true });
      return true;
    } else if (request?.action === 'element_marker_ping') {
      sendResponse({ status: 'pong' });
      return false;
    } else if (request?.action === 'element_marker_highlight') {
      highlightSelectorExternal({
        selector: request.selector,
        selectorType: request.selectorType,
        listMode: !!request.listMode,
      })
        .then((result) => sendResponse(result))
        .catch((error) => sendResponse({ success: false, error: error?.message || String(error) }));
      return true;
    }
    return false;
  });
})();
