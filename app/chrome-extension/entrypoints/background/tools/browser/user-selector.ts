import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';

interface UserSelectorParams {
  prompt?: string;
  timeout?: number;
  highlightMode?: 'border' | 'overlay' | 'both';
  selectionType?: 'single' | 'multiple';
}

class UserSelectorTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.USER_SELECTOR;

  async execute(args: UserSelectorParams): Promise<ToolResult> {
    try {
      const { prompt, timeout, highlightMode = 'both', selectionType = 'single' } = args || {};

      // 获取当前活动标签页
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0] || !tabs[0].id) {
        return createErrorResponse('未找到活动标签页');
      }
      const tabId = tabs[0].id;

      // 注入选择器脚本
      await this.injectContentScript(tabId, ['inject-scripts/user-selector-helper.js']);

      // 发送启动消息
      const result = await this.sendMessageToTab(tabId, {
        action: 'startUserSelector',
        options: { prompt, timeout, highlightMode, selectionType },
      });

      if (!result || result.success !== true) {
        return createErrorResponse(result?.error || '用户未选择任何元素');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, elements: result.elements || [] }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      return createErrorResponse(
        `用户选择元素时出错: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const userSelectorTool = new UserSelectorTool();
