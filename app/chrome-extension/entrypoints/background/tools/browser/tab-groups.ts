import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

/**
 * Tab group create tool parameters interface
 */
interface TabGroupCreateToolParams {
  tabIds?: number[]; // Array of tab IDs to add to the group
  title?: string; // Title for the tab group
  color?: chrome.tabGroups.ColorEnum; // Color for the tab group
  collapsed?: boolean; // Whether the group should be collapsed
}

/**
 * Tab group update tool parameters interface
 */
interface TabGroupUpdateToolParams {
  groupId: number; // ID of the tab group to update
  title?: string; // New title for the tab group
  color?: chrome.tabGroups.ColorEnum; // New color for the tab group
  collapsed?: boolean; // Whether the group should be collapsed
}

/**
 * Tab group delete tool parameters interface
 */
interface TabGroupDeleteToolParams {
  groupId: number; // ID of the tab group to delete
}

/**
 * Tab group list tool parameters interface
 */
interface TabGroupListToolParams {
  windowId?: number; // Filter tab groups by window ID
}

/**
 * Helper function to get tabs in a tab group
 */
async function getTabsInGroup(groupId: number): Promise<chrome.tabs.Tab[]> {
  return await chrome.tabs.query({ groupId });
}

/**
 * Tab group create tool
 * Used to create new tab groups in Chrome browser
 */
class TabGroupCreateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_CREATE;

  /**
   * Execute create tab group operation
   */
  async execute(args: TabGroupCreateToolParams): Promise<ToolResult> {
    const { tabIds = [], title, color, collapsed = false } = args;

    console.log(`TabGroupCreateTool: Creating tab group with options:`, args);

    try {
      // If no tabIds provided, use current active tab
      let groupTabIds = tabIds;
      if (!groupTabIds || groupTabIds.length === 0) {
        const [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (!activeTab || !activeTab.id) {
          return createErrorResponse('No active tab found and no tab IDs provided');
        }
        groupTabIds = [activeTab.id];
      }

      // Create the group with the specified tabs
      const groupId = await chrome.tabs.group({ tabIds: groupTabIds });

      // Update group properties if provided
      const updateProperties: chrome.tabGroups.UpdateProperties = {};
      if (title !== undefined) {
        updateProperties.title = title;
      }
      if (color !== undefined) {
        updateProperties.color = color;
      }
      if (collapsed !== undefined) {
        updateProperties.collapsed = collapsed;
      }

      let updatedGroup: chrome.tabGroups.TabGroup;
      if (Object.keys(updateProperties).length > 0) {
        updatedGroup = await chrome.tabGroups.update(groupId, updateProperties);
      } else {
        updatedGroup = await chrome.tabGroups.get(groupId);
      }

      // Get tabs in the group
      const tabsInGroup = await getTabsInGroup(groupId);
      const tabDetails = tabsInGroup.map((tab) => ({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Tab group created successfully',
                group: {
                  groupId: updatedGroup.id,
                  title: updatedGroup.title,
                  color: updatedGroup.color,
                  collapsed: updatedGroup.collapsed,
                  windowId: updatedGroup.windowId,
                },
                tabs: tabDetails,
              },
              null,
              2,
            ),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error creating tab group:', error);
      return createErrorResponse(
        `Error creating tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Tab group update tool
 * Used to update existing tab groups in Chrome browser
 */
class TabGroupUpdateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_UPDATE;

  /**
   * Execute update tab group operation
   */
  async execute(args: TabGroupUpdateToolParams): Promise<ToolResult> {
    const { groupId, title, color, collapsed } = args;

    console.log(`TabGroupUpdateTool: Updating tab group ${groupId} with options:`, args);

    if (groupId === undefined || groupId === null) {
      return createErrorResponse('Group ID is required');
    }

    try {
      // Build update properties object
      const updateProperties: chrome.tabGroups.UpdateProperties = {};
      if (title !== undefined) {
        updateProperties.title = title;
      }
      if (color !== undefined) {
        updateProperties.color = color;
      }
      if (collapsed !== undefined) {
        updateProperties.collapsed = collapsed;
      }

      if (Object.keys(updateProperties).length === 0) {
        return createErrorResponse(
          'At least one property (title, color, or collapsed) must be provided',
        );
      }

      // Update the group
      const updatedGroup = await chrome.tabGroups.update(groupId, updateProperties);

      // Get tabs in the group
      const tabsInGroup = await getTabsInGroup(groupId);
      const tabDetails = tabsInGroup.map((tab) => ({
        tabId: tab.id,
        url: tab.url,
        title: tab.title,
      }));

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Tab group updated successfully',
                group: {
                  groupId: updatedGroup.id,
                  title: updatedGroup.title,
                  color: updatedGroup.color,
                  collapsed: updatedGroup.collapsed,
                  windowId: updatedGroup.windowId,
                },
                tabs: tabDetails,
              },
              null,
              2,
            ),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error(`Error updating tab group ${groupId}:`, error);
      return createErrorResponse(
        `Error updating tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Tab group delete tool
 * Used to delete tab groups in Chrome browser
 */
class TabGroupDeleteTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_DELETE;

  /**
   * Execute delete tab group operation
   */
  async execute(args: TabGroupDeleteToolParams): Promise<ToolResult> {
    const { groupId } = args;

    console.log(`TabGroupDeleteTool: Deleting tab group ${groupId}`);

    if (groupId === undefined || groupId === null) {
      return createErrorResponse('Group ID is required');
    }

    try {
      // Get group details and tabs before deletion
      const group = await chrome.tabGroups.get(groupId);
      const tabsInGroup = await getTabsInGroup(groupId);
      const tabIds = tabsInGroup.map((tab) => tab.id).filter((id): id is number => id !== undefined);

      // Ungroup the tabs (this effectively deletes the group)
      await chrome.tabs.ungroup(tabIds);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                message: 'Tab group deleted successfully',
                deletedGroup: {
                  groupId: group.id,
                  title: group.title,
                  color: group.color,
                },
                ungroupedTabCount: tabIds.length,
              },
              null,
              2,
            ),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error(`Error deleting tab group ${groupId}:`, error);
      return createErrorResponse(
        `Error deleting tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

/**
 * Tab group list tool
 * Used to list all tab groups in Chrome browser
 */
class TabGroupListTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_LIST;

  /**
   * Execute list tab groups operation
   */
  async execute(args: TabGroupListToolParams): Promise<ToolResult> {
    const { windowId } = args;

    console.log(`TabGroupListTool: Listing tab groups`, windowId ? `for window ${windowId}` : '');

    try {
      // Query groups
      const queryInfo: chrome.tabGroups.QueryInfo = {};
      if (windowId !== undefined) {
        queryInfo.windowId = windowId;
      }

      const groups = await chrome.tabGroups.query(queryInfo);

      // Get tabs for each group
      const groupsWithTabs = await Promise.all(
        groups.map(async (group) => {
          const tabsInGroup = await getTabsInGroup(group.id);
          const tabDetails = tabsInGroup.map((tab) => ({
            tabId: tab.id,
            url: tab.url,
            title: tab.title,
            active: tab.active,
          }));

          return {
            groupId: group.id,
            title: group.title,
            color: group.color,
            collapsed: group.collapsed,
            windowId: group.windowId,
            tabCount: tabsInGroup.length,
            tabs: tabDetails,
          };
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify(
              {
                success: true,
                totalGroups: groups.length,
                groups: groupsWithTabs,
              },
              null,
              2,
            ),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error listing tab groups:', error);
      return createErrorResponse(
        `Error listing tab groups: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupCreateTool = new TabGroupCreateTool();
export const tabGroupUpdateTool = new TabGroupUpdateTool();
export const tabGroupDeleteTool = new TabGroupDeleteTool();
export const tabGroupListTool = new TabGroupListTool();
