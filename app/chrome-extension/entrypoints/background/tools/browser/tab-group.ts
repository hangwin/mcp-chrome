import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import {
  addTabsToMcpGroup,
  createTabInMcpGroup,
  ensureMcpTabGroup,
  listMcpGroupTabs,
  MCP_TAB_GROUP_TITLE,
} from '@/utils/mcp-tab-group';

interface TabsContextParams {
  /** Create a labeled MCP tab group (new background window + blank tab) when none exists */
  createIfEmpty?: boolean;
  /** Bring the MCP window to the foreground when creating (default: false) */
  background?: boolean;
}

interface TabsCreateParams {
  url?: string;
  background?: boolean;
}

interface TabsAdoptParams {
  tabIds: number[];
}

function jsonResult(payload: unknown): ToolResult {
  return {
    content: [{ type: 'text', text: JSON.stringify(payload) }],
    isError: false,
  };
}

/**
 * Claude-style tabs_context_mcp: inspect / create the MCP pin group.
 */
class TabsContextTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TABS_CONTEXT;

  async execute(args: TabsContextParams = {}): Promise<ToolResult> {
    try {
      const stayBackground = this.stayInBackground(args.background);
      const context = await ensureMcpTabGroup({
        createIfEmpty: args.createIfEmpty === true,
        focusWindow: !stayBackground,
      });

      return jsonResult({
        success: true,
        message: context.groupId
          ? context.created
            ? `Created MCP tab group "${MCP_TAB_GROUP_TITLE}"`
            : `Found MCP tab group "${MCP_TAB_GROUP_TITLE}"`
          : `No MCP tab group yet. Pass createIfEmpty:true to create one, or use chrome_tabs_adopt / chrome_tabs_create.`,
        groupId: context.groupId,
        windowId: context.windowId,
        title: context.title,
        color: context.color,
        created: context.created,
        tabs: context.tabs,
        tabCount: context.tabs.length,
      });
    } catch (error) {
      return createErrorResponse(
        `tabs_context failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Claude-style tabs_create_mcp: open a new tab inside the MCP pin group.
 */
class TabsCreateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TABS_CREATE;

  async execute(args: TabsCreateParams = {}): Promise<ToolResult> {
    try {
      const stayBackground = this.stayInBackground(args.background);
      const { groupId, tab } = await createTabInMcpGroup({
        url: args.url,
        active: !stayBackground,
      });

      if (!stayBackground && typeof tab.windowId === 'number') {
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      return jsonResult({
        success: true,
        message: `Created tab in MCP group "${MCP_TAB_GROUP_TITLE}"`,
        groupId,
        tabId: tab.tabId,
        windowId: tab.windowId,
        url: tab.url,
        title: tab.title,
      });
    } catch (error) {
      return createErrorResponse(
        `tabs_create failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Move existing tabs into the MCP pin group (manual "drag into Claude group" equivalent).
 */
class TabsAdoptTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TABS_ADOPT;

  async execute(args: TabsAdoptParams): Promise<ToolResult> {
    try {
      const tabIds = Array.isArray(args?.tabIds) ? args.tabIds : [];
      if (!tabIds.length) {
        return createErrorResponse('tabIds is required (non-empty array of tab IDs)');
      }

      // Validate tabs exist first for clearer errors
      for (const id of tabIds) {
        try {
          await chrome.tabs.get(id);
        } catch {
          return createErrorResponse(`Tab not found: ${id}`);
        }
      }

      const groupId = await addTabsToMcpGroup(tabIds);
      const tabs = await listMcpGroupTabs(groupId);

      return jsonResult({
        success: true,
        message: `Adopted ${tabIds.length} tab(s) into MCP group "${MCP_TAB_GROUP_TITLE}"`,
        groupId,
        adoptedTabIds: tabIds,
        tabs,
        tabCount: tabs.length,
      });
    } catch (error) {
      return createErrorResponse(
        `tabs_adopt failed: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabsContextTool = new TabsContextTool();
export const tabsCreateTool = new TabsCreateTool();
export const tabsAdoptTool = new TabsAdoptTool();
