import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

class WindowTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_WINDOWS_AND_TABS;
  async execute(): Promise<ToolResult> {
    try {
      const windows = await chrome.windows.getAll({ populate: true });
      let tabCount = 0;

      const allTabs = windows.flatMap((window) => window.tabs || []);
      const groupedTabs = allTabs.filter(
        (tab) => typeof tab.groupId === 'number' && tab.groupId !== -1,
      );
      const groups =
        groupedTabs.length > 0
          ? await chrome.tabGroups.query({}).catch(() => [] as chrome.tabGroups.TabGroup[])
          : ([] as chrome.tabGroups.TabGroup[]);
      const groupsById = new Map(groups.map((group) => [group.id, group]));

      const structuredWindows = windows.map((window) => {
        const tabs =
          window.tabs?.map((tab) => {
            tabCount++;
            const group =
              typeof tab.groupId === 'number' && tab.groupId !== -1
                ? groupsById.get(tab.groupId)
                : undefined;
            return {
              tabId: tab.id || 0,
              url: tab.url || '',
              title: tab.title || '',
              active: tab.active || false,
              ...(group
                ? { groupId: group.id, groupTitle: group.title || '', groupColor: group.color }
                : {}),
            };
          }) || [];

        return {
          windowId: window.id || 0,
          tabs: tabs,
        };
      });

      const result = {
        windowCount: windows.length,
        tabCount: tabCount,
        windows: structuredWindows,
      };

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
      console.error('Error in WindowTool.execute:', error);
      return createErrorResponse(
        `Error getting windows and tabs information: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const windowTool = new WindowTool();
