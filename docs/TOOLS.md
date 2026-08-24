# Chrome MCP Server API Reference 📚

Complete reference for all available tools and their parameters.

## 📋 Table of Contents

- [Browser Management](#browser-management)
- [Screenshots & Visual](#screenshots--visual)
- [Network Monitoring](#network-monitoring)
- [Content Analysis](#content-analysis)
- [Interaction](#interaction)
- [Data Management](#data-management)
- [Response Format](#response-format)

## 📊 Browser Management

### `get_windows_and_tabs`

List all currently open browser windows and tabs.

**Parameters**: None

**Response**:

```json
{
  "windowCount": 2,
  "tabCount": 5,
  "windows": [
    {
      "windowId": 123,
      "tabs": [
        {
          "tabId": 456,
          "url": "https://example.com",
          "title": "Example Page",
          "active": true,
          "groupId": 789,
          "groupTitle": "Work",
          "groupColor": "blue"
        }
      ]
    }
  ]
}
```

Tabs that belong to a tab group include `groupId`, `groupTitle` and `groupColor`; ungrouped tabs omit these fields.

### `chrome_navigate`

Navigate to a URL with optional viewport control.

**Parameters**:

- `url` (string, optional): URL to navigate to (omit when `refresh=true`)
- `newWindow` (boolean, optional): Create new window (default: false)
- `tabId` (number, optional): Target an existing tab by ID (navigate/refresh that tab)
- `background` (boolean, optional): Do not activate the tab or focus the window (default: false)
- `width` (number, optional): Viewport width in pixels (default: 1280)
- `height` (number, optional): Viewport height in pixels (default: 720)

**Example**:

```json
{
  "url": "https://example.com",
  "newWindow": true,
  "width": 1920,
  "height": 1080
}
```

### `chrome_close_tabs`

Close specific tabs or windows.

**Parameters**:

- `tabIds` (array, optional): Array of tab IDs to close
- `windowIds` (array, optional): Array of window IDs to close

**Example**:

```json
{
  "tabIds": [123, 456],
  "windowIds": [789]
}
```

### `chrome_switch_tab`

Switch to a specific browser tab.

**Parameters**:

- `tabId` (number, required): The ID of the tab to switch to.
- `windowId` (number, optional): The ID of the window where the tab is located.

**Example**:

```json
{
  "tabId": 456,
  "windowId": 123
}
```

### `chrome_list_tab_groups`

List tab groups, optionally including their member tabs.

**Parameters**:

- `windowId` (number, optional): Only list groups in this window
- `title` (string, optional): Only list groups with exactly this title
- `color` (string, optional): Filter by color (`grey`, `blue`, `red`, `yellow`, `green`, `pink`, `purple`, `cyan`, `orange`)
- `collapsed` (boolean, optional): Filter by collapsed state
- `includeTabs` (boolean, optional): Include each group's member tabs in the result (default: true)

**Example**:

```json
{
  "windowId": 123,
  "includeTabs": true
}
```

### `chrome_create_tab_group`

Create a tab group from existing tabs, or create a new group seeded with a blank tab.

**Parameters**:

- `tabIds` (array, optional): Existing tab IDs to put into the new group (must be in the same window)
- `windowId` (number, optional): Window for the new group. Required when `tabIds` is omitted; a blank seed tab is created as the first member of the group
- `title` (string, optional): Title of the new group
- `color` (string, optional): Color of the new group
- `collapsed` (boolean, optional): Whether the group starts collapsed

**Example**:

```json
{
  "tabIds": [456, 789],
  "title": "Research",
  "color": "green"
}
```

### `chrome_update_tab_group`

Rename a tab group, change its color, or collapse/expand it.

**Parameters**:

- `groupId` (number, required): The ID of the tab group to update
- `title` (string, optional): New title
- `color` (string, optional): New color
- `collapsed` (boolean, optional): Collapse/expand the group

**Example**:

```json
{
  "groupId": 789,
  "title": "Deep Work",
  "color": "purple"
}
```

### `chrome_delete_tab_group`

Delete a tab group. By default the tabs are ungrouped but stay open; set `closeTabs` to true to close all tabs in the group instead.

**Parameters**:

- `groupId` (number, required): The ID of the tab group to delete
- `closeTabs` (boolean, optional): Close all tabs in the group instead of ungrouping them (default: false)

**Example**:

```json
{
  "groupId": 789,
  "closeTabs": false
}
```

### `chrome_move_tab_group`

Move a whole tab group: reorder it within its window or move it to another window.

**Parameters**:

- `groupId` (number, required): The ID of the tab group to move
- `index` (number, optional): Tab index to move the group to within the target window (`-1` for the end)
- `windowId` (number, optional): Move the group to this window

**Example**:

```json
{
  "groupId": 789,
  "windowId": 123,
  "index": -1
}
```

### `chrome_tabs_group_membership`

Add tabs to an existing tab group, or remove (ungroup) tabs from their groups.

**Parameters**:

- `action` (string, required): `"add"` puts the tabs into the given group; `"remove"` ungroups the tabs
- `tabIds` (array, required): Tab IDs. For `"add"`, all tabs must already be in the same window as the target group
- `groupId` (number, optional/required): Target group ID. Required when `action` is `"add"`

**Example**:

```json
{
  "action": "add",
  "tabIds": [101, 102],
  "groupId": 789
}
```

### `chrome_go_back_or_forward`

Navigate browser history.

**Parameters**:

- `direction` (string, required): "back" or "forward"
- `tabId` (number, optional): Specific tab ID (default: active tab)

**Example**:

```json
{
  "direction": "back",
  "tabId": 123
}
```

## 📸 Screenshots & Visual

### `chrome_screenshot`

Take advanced screenshots with various options.

**Parameters**:

- `name` (string, optional): Screenshot filename
- `selector` (string, optional): CSS selector for element screenshot
- `tabId` (number, optional): Target tab to capture (default: active tab)
- `background` (boolean, optional): Attempt capture without bringing tab/window to foreground (viewport-only uses CDP)
- `width` (number, optional): Width in pixels (default: 800)
- `height` (number, optional): Height in pixels (default: 600)
- `storeBase64` (boolean, optional): Return base64 data (default: false)
- `fullPage` (boolean, optional): Capture full page (default: true)

**Example**:

```json
{
  "selector": ".main-content",
  "fullPage": true,
  "storeBase64": true,
  "width": 1920,
  "height": 1080
}
```

**Response**:

```json
{
  "success": true,
  "base64": "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAA...",
  "dimensions": {
    "width": 1920,
    "height": 1080
  }
}
```

## 🌐 Network Monitoring

### `chrome_network_capture_start`

Start capturing network requests using webRequest API.

**Parameters**:

- `url` (string, optional): URL to navigate to and capture
- `maxCaptureTime` (number, optional): Maximum capture time in ms (default: 30000)
- `inactivityTimeout` (number, optional): Stop after inactivity in ms (default: 3000)
- `includeStatic` (boolean, optional): Include static resources (default: false)

**Example**:

```json
{
  "url": "https://api.example.com",
  "maxCaptureTime": 60000,
  "includeStatic": false
}
```

### `chrome_network_capture_stop`

Stop network capture and return collected data.

**Parameters**: None

**Response**:

```json
{
  "success": true,
  "capturedRequests": [
    {
      "url": "https://api.example.com/data",
      "method": "GET",
      "status": 200,
      "requestHeaders": {...},
      "responseHeaders": {...},
      "responseTime": 150
    }
  ],
  "summary": {
    "totalRequests": 15,
    "captureTime": 5000
  }
}
```

### `chrome_network_debugger_start`

Start capturing with Chrome Debugger API (includes response bodies).

**Parameters**:

- `url` (string, optional): URL to navigate to and capture

### `chrome_network_debugger_stop`

Stop debugger capture and return data with response bodies.

### `chrome_network_request`

Send custom HTTP requests.

**Parameters**:

- `url` (string, required): Request URL
- `method` (string, optional): HTTP method (default: "GET")
- `headers` (object, optional): Request headers
- `body` (string, optional): Request body

**Example**:

```json
{
  "url": "https://api.example.com/data",
  "method": "POST",
  "headers": {
    "Content-Type": "application/json"
  },
  "body": "{\"key\": \"value\"}"
}
```

## 🔍 Content Analysis

### `chrome_read_page`

Build an accessibility-like tree of the current page (visible viewport by default) with stable `ref_*` identifiers and viewport info. Useful for semantic element discovery or agent planning.

Parameters:

- `filter` (string, optional): `interactive` to only include interactive elements; default includes structural and labeled nodes.
- `tabId` (number, optional): Target an existing tab by ID (default: active tab).

Example:

```json
{
  "filter": "interactive"
}
```

Response contains `pageContent` (text tree), `viewport`, and a `refMapCount` summary. Use `chrome_get_interactive_elements` or your own logic to act on returned refs.

### `search_tabs_content`

AI-powered semantic search across browser tabs.

**Parameters**:

- `query` (string, required): Search query

**Example**:

```json
{
  "query": "machine learning tutorials"
}
```

**Response**:

```json
{
  "success": true,
  "totalTabsSearched": 10,
  "matchedTabsCount": 3,
  "vectorSearchEnabled": true,
  "indexStats": {
    "totalDocuments": 150,
    "totalTabs": 10,
    "semanticEngineReady": true
  },
  "matchedTabs": [
    {
      "tabId": 123,
      "url": "https://example.com/ml-tutorial",
      "title": "Machine Learning Tutorial",
      "semanticScore": 0.85,
      "matchedSnippets": ["Introduction to machine learning..."],
      "chunkSource": "content"
    }
  ]
}
```

### `chrome_get_web_content`

Extract HTML or text content from web pages.

**Parameters**:

- `format` (string, optional): "html" or "text" (default: "text")
- `selector` (string, optional): CSS selector for specific elements
- `tabId` (number, optional): Specific tab ID (default: active tab)
- `background` (boolean, optional): Do not activate tab/focus window while fetching (default: false)

**Example**:

```json
{
  "format": "text",
  "selector": ".article-content"
}
```

### `chrome_get_interactive_elements` (deprecated)

Replaced by `chrome_read_page` as the primary discovery tool. The `read_page` implementation will automatically fallback to the interactive-elements logic when the accessibility tree is unavailable or too sparse. This tool is no longer listed via ListTools and is kept only for backward compatibility.

## 🎯 Interaction

### `chrome_computer`

Unified advanced interaction tool that prioritizes high-level DOM actions with CDP fallback. Supports hover, click, drag, scroll, typing, key chords, fill, wait and screenshot. If a recent screenshot was taken via `chrome_screenshot`, coordinates are auto-scaled from screenshot space to viewport space.

Parameters:

- `action` (string, required): `left_click` | `right_click` | `double_click` | `triple_click` | `left_click_drag` | `scroll` | `type` | `key` | `fill` | `hover` | `wait` | `screenshot`
- `tabId` (number, optional): Target an existing tab by ID (default: active tab)
- `background` (boolean, optional): Avoid focusing/activating tab/window for certain operations (best-effort)
- `ref` (string, optional): element ref from `chrome_read_page` (preferred). Used for click/scroll/type/key and as drag end when provided
- `coordinates` (object, optional): `{ "x": 100, "y": 200 }` for click/scroll or drag end
- `startRef` (string, optional): element ref for drag start
- `startCoordinates` (object, optional): for `left_click_drag` when no `startRef`
- `scrollDirection` (string, optional): `up` | `down` | `left` | `right`
- `scrollAmount` (number, optional): ticks 1–10 (default 3)
- `text` (string, optional): for `type` (raw text) or `key` (space-separated chords/keys like `"cmd+a Enter"`)
- `duration` (number, optional): seconds for `wait` (max 30)
- `selector` (string, optional): for `fill` when no `ref`
- `value` (string, optional): for `fill` value

Examples:

```json
{ "action": "left_click", "coordinates": { "x": 420, "y": 260 } }
```

```json
{ "action": "key", "text": "cmd+a Backspace" }
```

````json
{ "action": "fill", "ref": "ref_7", "value": "user@example.com" }

```json
{ "action": "hover", "ref": "ref_12", "duration": 0.6 }
````

````

```json
{ "action": "left_click_drag", "startRef": "ref_10", "ref": "ref_15" }
````

### `chrome_click_element`

Click elements using a ref, selector, or coordinates.

**Parameters**:

- `ref` (string, optional): Element ref from `chrome_read_page` (preferred when available)
- `selector` (string, optional): CSS selector for target element
- `coordinates` (object, optional): `{ "x": 120, "y": 240 }` viewport coordinates

At least one of `ref`, `selector`, or `coordinates` must be provided.

**Example**:

```json
{
  "ref": "ref_42"
}
```

### `chrome_fill_or_select`

Fill form fields or select options.

**Parameters**:

- `ref` (string, optional): Element ref from `chrome_read_page`
- `selector` (string, optional): CSS selector for target element
- `value` (string, required): Value to fill or select

Provide `ref` or `selector` to identify the element.

**Example**:

```json
{
  "ref": "ref_7",
  "value": "user@example.com"
}
```

### `chrome_keyboard`

Simulate keyboard input and shortcuts.

**Parameters**:

- `keys` (string, required): Key combination (e.g., "Ctrl+C", "Enter")
- `selector` (string, optional): Target element selector
- `delay` (number, optional): Delay between keystrokes in ms (default: 0)

**Example**:

```json
{
  "keys": "Ctrl+A",
  "selector": "#text-input",
  "delay": 100
}
```

## 📚 Data Management

### `chrome_history`

Search browser history with filters.

**Parameters**:

- `text` (string, optional): Search text in URL/title
- `startTime` (string, optional): Start date (ISO format)
- `endTime` (string, optional): End date (ISO format)
- `maxResults` (number, optional): Maximum results (default: 100)
- `excludeCurrentTabs` (boolean, optional): Exclude current tabs (default: true)

**Example**:

```json
{
  "text": "github",
  "startTime": "2024-01-01",
  "maxResults": 50
}
```

### `chrome_bookmark_search`

Search bookmarks by keywords.

**Parameters**:

- `query` (string, optional): Search keywords
- `maxResults` (number, optional): Maximum results (default: 100)
- `folderPath` (string, optional): Search within specific folder

**Example**:

```json
{
  "query": "documentation",
  "maxResults": 20,
  "folderPath": "Work/Resources"
}
```

### `chrome_bookmark_add`

Add new bookmarks with folder support.

**Parameters**:

- `url` (string, optional): URL to bookmark (default: current tab)
- `title` (string, optional): Bookmark title (default: page title)
- `parentId` (string, optional): Parent folder ID or path
- `createFolder` (boolean, optional): Create folder if not exists (default: false)

**Example**:

```json
{
  "url": "https://example.com",
  "title": "Example Site",
  "parentId": "Work/Resources",
  "createFolder": true
}
```

### `chrome_bookmark_delete`

Delete bookmarks by ID or URL.

**Parameters**:

- `bookmarkId` (string, optional): Bookmark ID to delete
- `url` (string, optional): URL to find and delete

**Example**:

```json
{
  "url": "https://example.com"
}
```

## 📋 Response Format

All tools return responses in the following format:

```json
{
  "content": [
    {
      "type": "text",
      "text": "JSON string containing the actual response data"
    }
  ],
  "isError": false
}
```

For errors:

```json
{
  "content": [
    {
      "type": "text",
      "text": "Error message describing what went wrong"
    }
  ],
  "isError": true
}
```

## 🔧 Usage Examples

### Complete Workflow Example

```javascript
// 1. Navigate to a page
await callTool('chrome_navigate', {
  url: 'https://example.com',
});

// 2. Take a screenshot
const screenshot = await callTool('chrome_screenshot', {
  fullPage: true,
  storeBase64: true,
});

// 3. Start network monitoring
await callTool('chrome_network_capture_start', {
  maxCaptureTime: 30000,
});

// 4. Interact with the page
await callTool('chrome_click_element', {
  selector: '#load-data-button',
});

// 5. Search content semantically
const searchResults = await callTool('search_tabs_content', {
  query: 'user data analysis',
});

// 6. Stop network capture
const networkData = await callTool('chrome_network_capture_stop');

// 7. Save bookmark
await callTool('chrome_bookmark_add', {
  title: 'Data Analysis Page',
  parentId: 'Work/Analytics',
});
```

This API provides comprehensive browser automation capabilities with AI-enhanced content analysis and semantic search features.
