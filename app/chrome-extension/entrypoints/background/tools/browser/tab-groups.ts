import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

const GROUP_COLORS = [
  'grey',
  'blue',
  'red',
  'yellow',
  'green',
  'pink',
  'purple',
  'cyan',
  'orange',
] as const;

type GroupColor = (typeof GROUP_COLORS)[number];

const isColor = (value: unknown): value is GroupColor =>
  typeof value === 'string' && (GROUP_COLORS as readonly string[]).includes(value);

interface TabGroupSummary {
  groupId: number;
  windowId: number;
  title: string;
  color: string;
  collapsed: boolean;
}

function serializeGroup(group: chrome.tabGroups.TabGroup): TabGroupSummary {
  return {
    groupId: group.id,
    windowId: group.windowId,
    title: group.title || '',
    color: group.color,
    collapsed: group.collapsed,
  };
}

async function getGroupOrError(groupId: number): Promise<chrome.tabGroups.TabGroup> {
  try {
    return await chrome.tabGroups.get(groupId);
  } catch {
    throw new Error(`Tab group with ID ${groupId} not found`);
  }
}

function toErrorResponse(context: string, error: unknown): ToolResult {
  if (chrome.runtime.lastError) {
    console.error(`Chrome API Error: ${chrome.runtime.lastError.message}`, error);
    return createErrorResponse(`Chrome API Error: ${chrome.runtime.lastError.message}`);
  }
  console.error(`Error in ${context}:`, error);
  return createErrorResponse(
    `${context} failed: ${error instanceof Error ? error.message : String(error)}`,
  );
}

/**
 * Tool for listing tab groups
 */
class ListTabGroupsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUPS_LIST;

  async execute(args: {
    windowId?: number;
    title?: string;
    color?: string;
    collapsed?: boolean;
    includeTabs?: boolean;
  }): Promise<ToolResult> {
    const { windowId, title, color, collapsed, includeTabs = true } = args ?? {};

    if (color !== undefined && !isColor(color)) {
      return createErrorResponse(
        `Invalid color '${color}'. Valid colors: ${GROUP_COLORS.join(', ')}`,
      );
    }

    try {
      const queryInfo: chrome.tabGroups.QueryInfo = {};
      if (typeof windowId === 'number') queryInfo.windowId = windowId;
      if (title !== undefined) queryInfo.title = title;
      if (isColor(color)) queryInfo.color = color;
      if (typeof collapsed === 'boolean') queryInfo.collapsed = collapsed;

      const groups = await chrome.tabGroups.query(queryInfo);

      const includeMemberTabs =
        includeTabs && groups.length > 0 ? await chrome.tabs.query({ windowType: 'normal' }) : [];

      const result = {
        success: true,
        groupCount: groups.length,
        groups: groups.map((group) => {
          const tabs = includeMemberTabs
            .filter((tab) => tab.groupId === group.id)
            .map((tab) => ({
              tabId: tab.id || 0,
              url: tab.url || '',
              title: tab.title || '',
              active: tab.active || false,
            }));
          return {
            ...serializeGroup(group),
            tabCount: tabs.length,
            ...(includeTabs ? { tabs } : {}),
          };
        }),
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(result) }],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('ListTabGroupsTool.execute', error);
    }
  }
}

/**
 * Tool for creating a tab group
 */
class CreateTabGroupTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_CREATE;

  async execute(args: {
    tabIds?: number[];
    windowId?: number;
    title?: string;
    color?: string;
    collapsed?: boolean;
  }): Promise<ToolResult> {
    const { tabIds, windowId, title, color, collapsed } = args ?? {};

    if (color !== undefined && !isColor(color)) {
      return createErrorResponse(
        `Invalid color '${color}'. Valid colors: ${GROUP_COLORS.join(', ')}`,
      );
    }

    const hasTabIds = Array.isArray(tabIds) && tabIds.length > 0;
    if (!hasTabIds && typeof windowId !== 'number') {
      return createErrorResponse(
        'Either tabIds or windowId is required: provide tabIds to group existing tabs, or windowId to create a new group seeded with a blank tab.',
      );
    }

    try {
      let groupId: number;
      let seedTabId: number | undefined;

      if (hasTabIds) {
        const createProperties: { windowId?: number } = {};
        if (typeof windowId === 'number') createProperties.windowId = windowId;
        groupId = await chrome.tabs.group({
          tabIds: tabIds as number[],
          createProperties,
        });
      } else {
        const targetWindowId =
          typeof windowId === 'number' ? windowId : (await chrome.windows.getLastFocused()).id;
        const seedTab = await chrome.tabs.create({
          windowId: targetWindowId,
          active: false,
          url: 'about:blank',
        });
        seedTabId = seedTab.id;
        groupId = await chrome.tabs.group({
          tabIds: [seedTab.id as number],
        });
      }

      const updateOptions: chrome.tabGroups.UpdateProperties = {};
      if (title !== undefined) updateOptions.title = title;
      if (isColor(color)) updateOptions.color = color;
      if (typeof collapsed === 'boolean') updateOptions.collapsed = collapsed;
      if (Object.keys(updateOptions).length > 0) {
        await chrome.tabGroups.update(groupId, updateOptions);
      }

      const updatedGroup = await getGroupOrError(groupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully created tab group${title ? ` '${title}'` : ''}`,
              ...serializeGroup(updatedGroup),
              ...(seedTabId !== undefined ? { seedTabId } : {}),
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('CreateTabGroupTool.execute', error);
    }
  }
}

/**
 * Tool for updating a tab group (rename, recolor, collapse/expand)
 */
class UpdateTabGroupTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_UPDATE;

  async execute(args: {
    groupId: number;
    title?: string;
    color?: string;
    collapsed?: boolean;
  }): Promise<ToolResult> {
    const { groupId, title, color, collapsed } = args ?? {};

    if (typeof groupId !== 'number') {
      return createErrorResponse('groupId parameter is required and must be a number');
    }
    if (title === undefined && color === undefined && collapsed === undefined) {
      return createErrorResponse(
        'At least one of title, color, or collapsed must be provided to update the group',
      );
    }
    if (color !== undefined && !isColor(color)) {
      return createErrorResponse(
        `Invalid color '${color}'. Valid colors: ${GROUP_COLORS.join(', ')}`,
      );
    }

    try {
      await getGroupOrError(groupId);

      const updateProperties: chrome.tabGroups.UpdateProperties = {};
      if (title !== undefined) updateProperties.title = title;
      if (isColor(color)) updateProperties.color = color;
      if (typeof collapsed === 'boolean') updateProperties.collapsed = collapsed;

      await chrome.tabGroups.update(groupId, updateProperties);
      const updatedGroup = await getGroupOrError(groupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully updated tab group ID: ${groupId}`,
              ...serializeGroup(updatedGroup),
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('UpdateTabGroupTool.execute', error);
    }
  }
}

/**
 * Tool for deleting a tab group (ungroup its tabs or close them)
 */
class DeleteTabGroupTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_DELETE;

  async execute(args: { groupId: number; closeTabs?: boolean }): Promise<ToolResult> {
    const { groupId, closeTabs = false } = args ?? {};

    if (typeof groupId !== 'number') {
      return createErrorResponse('groupId parameter is required and must be a number');
    }

    try {
      const group = await getGroupOrError(groupId);
      const memberTabs = await chrome.tabs.query({ groupId });

      if (memberTabs.length === 0) {
        return createErrorResponse(`Tab group ID ${groupId} has no member tabs`);
      }

      const tabIds = memberTabs.map((tab) => tab.id as number);

      if (closeTabs) {
        await chrome.tabs.remove(tabIds);
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully closed tab group '${group.title}' (ID: ${groupId}) and its ${tabIds.length} tab(s)`,
                groupId,
                closedTabIds: tabIds,
              }),
            },
          ],
          isError: false,
        };
      }

      await chrome.tabs.ungroup(tabIds);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully deleted tab group '${group.title}' (ID: ${groupId}); ${tabIds.length} tab(s) remain open`,
              groupId,
              ungroupedTabIds: tabIds,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('DeleteTabGroupTool.execute', error);
    }
  }
}

/**
 * Tool for moving a whole tab group within its window or to another window
 */
class MoveTabGroupTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TAB_GROUP_MOVE;

  async execute(args: { groupId: number; index?: number; windowId?: number }): Promise<ToolResult> {
    const { groupId, index, windowId } = args ?? {};

    if (typeof groupId !== 'number') {
      return createErrorResponse('groupId parameter is required and must be a number');
    }
    if (index === undefined && windowId === undefined) {
      return createErrorResponse(
        'At least one of index or windowId must be provided to move the group',
      );
    }

    try {
      await getGroupOrError(groupId);

      const moveProperties: chrome.tabGroups.MoveProperties = {
        index: typeof index === 'number' ? index : -1,
      };
      if (typeof windowId === 'number') moveProperties.windowId = windowId;

      await chrome.tabGroups.move(groupId, moveProperties);
      const movedGroup = await getGroupOrError(groupId);

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully moved tab group ID: ${groupId}`,
              ...serializeGroup(movedGroup),
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('MoveTabGroupTool.execute', error);
    }
  }
}

/**
 * Tool for managing tab membership in tab groups (add/remove tabs)
 */
class TabsGroupMembershipTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.TABS_GROUP_MEMBERSHIP;

  async execute(args: {
    action: 'add' | 'remove';
    tabIds: number[];
    groupId?: number;
  }): Promise<ToolResult> {
    const { action, tabIds, groupId } = args ?? {};

    if (action !== 'add' && action !== 'remove') {
      return createErrorResponse("action parameter is required and must be 'add' or 'remove'");
    }
    if (!Array.isArray(tabIds) || tabIds.length === 0) {
      return createErrorResponse(
        'tabIds parameter is required and must be a non-empty array of numbers',
      );
    }
    if (action === 'add' && typeof groupId !== 'number') {
      return createErrorResponse("groupId parameter is required when action is 'add'");
    }

    try {
      if (action === 'add') {
        const group = await getGroupOrError(groupId as number);
        await chrome.tabs.group({ tabIds, groupId });
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                success: true,
                message: `Successfully added ${tabIds.length} tab(s) to group '${group.title}' (ID: ${groupId})`,
                groupId,
                tabIds,
              }),
            },
          ],
          isError: false,
        };
      }

      await chrome.tabs.ungroup(tabIds);
      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              message: `Successfully removed ${tabIds.length} tab(s) from their group(s)`,
              tabIds,
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return toErrorResponse('TabsGroupMembershipTool.execute', error);
    }
  }
}

export const listTabGroupsTool = new ListTabGroupsTool();
export const createTabGroupTool = new CreateTabGroupTool();
export const updateTabGroupTool = new UpdateTabGroupTool();
export const deleteTabGroupTool = new DeleteTabGroupTool();
export const moveTabGroupTool = new MoveTabGroupTool();
export const tabsGroupMembershipTool = new TabsGroupMembershipTool();
