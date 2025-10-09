import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'chrome-mcp-shared';
import { ERROR_MESSAGES } from '@/common/constants';

interface DragPoint {
  x: number;
  y: number;
}
interface DragParams {
  from?: DragPoint;
  to?: DragPoint;
  fromElement?: string;
  toElement?: string;
  scrollIntoView?: boolean;
}

class DragTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.DRAG;

  async execute(args: DragParams): Promise<ToolResult> {
    const { from, to, fromElement, toElement, scrollIntoView = true } = args || {};

    // 检查是否至少提供了一组有效的参数
    if (!from && !fromElement) {
      return createErrorResponse(
        ERROR_MESSAGES.INVALID_PARAMETERS +
          ': 必须提供 from (坐标对象 {x, y}) 或 fromElement (元素选择器字符串) 参数',
      );
    }

    if (!to && !toElement) {
      return createErrorResponse(
        ERROR_MESSAGES.INVALID_PARAMETERS +
          ': 必须提供 to (坐标对象 {x, y}) 或 toElement (元素选择器字符串) 参数',
      );
    }

    try {
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      const tab = tabs[0];

      if (!tab || !tab.id) {
        return createErrorResponse(ERROR_MESSAGES.TAB_NOT_FOUND);
      }

      // 注入桥和拖拽脚本（MAIN 世界）
      await this.injectContentScript(tab.id, ['inject-scripts/drag-helper.js']);

      const result = await this.sendMessageToTab(tab.id, {
        action: 'dragElement',
        options: {
          from,
          to,
          fromElement,
          toElement,
          scrollIntoView,
        },
      });

      if (result?.error) {
        return createErrorResponse(result.error);
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({ success: true, detail: result?.data }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('拖拽操作中出错:', error);
      return createErrorResponse(
        `执行拖拽时出错: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const dragTool = new DragTool();
