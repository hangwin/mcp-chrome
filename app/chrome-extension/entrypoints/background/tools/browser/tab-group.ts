import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

type TabGroupColor =
  | 'grey'
  | 'blue'
  | 'red'
  | 'yellow'
  | 'green'
  | 'pink'
  | 'purple'
  | 'cyan'
  | 'orange';

const TAB_GROUP_COLORS: ReadonlyArray<TabGroupColor> = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
];

const isValidColor = (value: unknown): value is TabGroupColor =>
  typeof value === 'string' && (TAB_GROUP_COLORS as ReadonlyArray<string>).includes(value);

const requireTabGroupsApi = (): void => {
  if (typeof chrome === 'undefined' || !chrome.tabGroups || !chrome.tabs?.group) {
    throw new Error(
      'chrome.tabGroups / chrome.tabs.group APIs are not available. Ensure the extension has the "tabGroups" permission and is running on Chrome 89+.',
    );
  }
};

const serializeGroup = (group: chrome.tabGroups.TabGroup) => ({
  groupId: group.id,
  windowId: group.windowId,
  title: group.title ?? '',
  color: group.color,
  collapsed: group.collapsed,
});

interface TabGroupCreateParams {
  tabIds: number[];
  title?: string;
  color?: TabGroupColor;
  windowId?: number;
}

class TabGroupCreateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_CREATE;

  async execute(args: TabGroupCreateParams): Promise<ToolResult> {
    try {
      requireTabGroupsApi();

      const { tabIds, title, color, windowId } = args || ({} as TabGroupCreateParams);
      if (!Array.isArray(tabIds) || tabIds.length === 0) {
        return createErrorResponse('tabIds must be a non-empty array of numeric tab IDs');
      }
      if (color !== undefined && !isValidColor(color)) {
        return createErrorResponse(
          `Invalid color "${color}". Must be one of: ${TAB_GROUP_COLORS.join(', ')}`,
        );
      }

      const createOptions: chrome.tabs.GroupOptions = { tabIds };
      if (typeof windowId === 'number') {
        createOptions.createProperties = { windowId };
      }

      const groupId = await chrome.tabs.group(createOptions);

      const updateProps: chrome.tabGroups.UpdateProperties = {};
      if (typeof title === 'string') updateProps.title = title;
      if (color !== undefined) updateProps.color = color;
      const updatedGroup =
        Object.keys(updateProps).length > 0
          ? await chrome.tabGroups.update(groupId, updateProps)
          : await chrome.tabGroups.get(groupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Created tab group ${groupId} with ${tabIds.length} tab(s)`,
              ...serializeGroup(updatedGroup),
              tabIds,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in TabGroupCreateTool.execute:', error);
      return createErrorResponse(
        `Error creating tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupCreateTool = new TabGroupCreateTool();

interface TabGroupUpdateParams {
  groupId: number;
  title?: string;
  color?: TabGroupColor;
  collapsed?: boolean;
}

class TabGroupUpdateTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_UPDATE;

  async execute(args: TabGroupUpdateParams): Promise<ToolResult> {
    try {
      requireTabGroupsApi();

      const { groupId, title, color, collapsed } = args || ({} as TabGroupUpdateParams);
      if (typeof groupId !== 'number') {
        return createErrorResponse('groupId is required and must be a number');
      }
      if (color !== undefined && !isValidColor(color)) {
        return createErrorResponse(
          `Invalid color "${color}". Must be one of: ${TAB_GROUP_COLORS.join(', ')}`,
        );
      }

      const updateProps: chrome.tabGroups.UpdateProperties = {};
      if (typeof title === 'string') updateProps.title = title;
      if (color !== undefined) updateProps.color = color;
      if (typeof collapsed === 'boolean') updateProps.collapsed = collapsed;

      if (Object.keys(updateProps).length === 0) {
        return createErrorResponse('At least one of title, color, or collapsed must be provided');
      }

      const updatedGroup = await chrome.tabGroups.update(groupId, updateProps);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Updated tab group ${groupId}`,
              ...serializeGroup(updatedGroup),
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in TabGroupUpdateTool.execute:', error);
      return createErrorResponse(
        `Error updating tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupUpdateTool = new TabGroupUpdateTool();

interface TabGroupAddTabsParams {
  groupId: number;
  tabIds: number[];
}

class TabGroupAddTabsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_ADD_TABS;

  async execute(args: TabGroupAddTabsParams): Promise<ToolResult> {
    try {
      requireTabGroupsApi();

      const { groupId, tabIds } = args || ({} as TabGroupAddTabsParams);
      if (typeof groupId !== 'number') {
        return createErrorResponse('groupId is required and must be a number');
      }
      if (!Array.isArray(tabIds) || tabIds.length === 0) {
        return createErrorResponse('tabIds must be a non-empty array of numeric tab IDs');
      }

      const returnedGroupId = await chrome.tabs.group({ groupId, tabIds });
      const group = await chrome.tabGroups.get(returnedGroupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Added ${tabIds.length} tab(s) to group ${returnedGroupId}`,
              ...serializeGroup(group),
              addedTabIds: tabIds,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in TabGroupAddTabsTool.execute:', error);
      return createErrorResponse(
        `Error adding tabs to group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupAddTabsTool = new TabGroupAddTabsTool();

interface TabGroupCloseParams {
  groupId: number;
}

class TabGroupCloseTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_CLOSE;

  async execute(args: TabGroupCloseParams): Promise<ToolResult> {
    try {
      requireTabGroupsApi();

      const { groupId } = args || ({} as TabGroupCloseParams);
      if (typeof groupId !== 'number') {
        return createErrorResponse('groupId is required and must be a number');
      }

      const tabs = await chrome.tabs.query({ groupId });
      const tabIds = tabs.map((tab) => tab.id).filter((id): id is number => typeof id === 'number');

      if (tabIds.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: false,
                message: `No tabs found in group ${groupId}`,
                groupId,
                closedCount: 0,
              }),
            },
          ],
          isError: false,
        };
      }

      await chrome.tabs.remove(tabIds);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Closed ${tabIds.length} tab(s) in group ${groupId}`,
              groupId,
              closedCount: tabIds.length,
              closedTabIds: tabIds,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in TabGroupCloseTool.execute:', error);
      return createErrorResponse(
        `Error closing tab group: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupCloseTool = new TabGroupCloseTool();

interface TabGroupListParams {
  windowId?: number;
  color?: TabGroupColor;
  title?: string;
  collapsed?: boolean;
}

class TabGroupListTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_LIST;

  async execute(args: TabGroupListParams): Promise<ToolResult> {
    try {
      requireTabGroupsApi();

      const { windowId, color, title, collapsed } = args || ({} as TabGroupListParams);
      if (color !== undefined && !isValidColor(color)) {
        return createErrorResponse(
          `Invalid color "${color}". Must be one of: ${TAB_GROUP_COLORS.join(', ')}`,
        );
      }

      const queryInfo: chrome.tabGroups.QueryInfo = {};
      if (typeof windowId === 'number') queryInfo.windowId = windowId;
      if (color !== undefined) queryInfo.color = color;
      if (typeof title === 'string') queryInfo.title = title;
      if (typeof collapsed === 'boolean') queryInfo.collapsed = collapsed;

      const groups = await chrome.tabGroups.query(queryInfo);

      const enriched = await Promise.all(
        groups.map(async (group) => {
          const tabs = await chrome.tabs.query({ groupId: group.id });
          return {
            ...serializeGroup(group),
            tabIds: tabs.map((tab) => tab.id).filter((id): id is number => typeof id === 'number'),
          };
        }),
      );

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              groupCount: enriched.length,
              groups: enriched,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in TabGroupListTool.execute:', error);
      return createErrorResponse(
        `Error listing tab groups: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const tabGroupListTool = new TabGroupListTool();
