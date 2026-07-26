import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

interface WebFetcherToolParams {
  htmlContent?: boolean; // get the visible HTML content of the current page. default: false
  textContent?: boolean; // get the visible text content of the current page. default: true
  url?: string; // optional URL to fetch content from (if not provided, uses active tab)
  selector?: string; // optional CSS selector to get content from a specific element
  tabId?: number; // target existing tab id
  background?: boolean; // default true: do not activate/focus; set false to foreground
  windowId?: number; // target window id to pick active tab or create tab
}

class WebFetcherTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.WEB_FETCHER;

  /**
   * Execute web fetcher operation
   */
  async execute(args: WebFetcherToolParams): Promise<ToolResult> {
    // Handle mutually exclusive parameters: if htmlContent is true, textContent is forced to false
    const htmlContent = args.htmlContent === true;
    const textContent = htmlContent ? false : args.textContent !== false; // Default is true, unless htmlContent is true or textContent is explicitly set to false
    const url = args.url;
    const selector = args.selector;
    const explicitTabId = args.tabId;
    const stayBackground = this.stayInBackground(args.background);
    const windowId = args.windowId;

    console.log(`Starting web fetcher with options:`, {
      htmlContent,
      textContent,
      url,
      selector,
    });

    try {
      // Get tab to fetch content from
      let tab;

      if (typeof explicitTabId === 'number') {
        tab = await chrome.tabs.get(explicitTabId);
      } else if (url) {
        // If URL is provided, check if it's already open
        console.log(`Checking if URL is already open: ${url}`);
        const allTabs = await chrome.tabs.query({});

        // Find tab with matching URL
        const matchingTabs = allTabs.filter((t) => {
          // Normalize URLs for comparison (remove trailing slashes)
          const tabUrl = t.url?.endsWith('/') ? t.url.slice(0, -1) : t.url;
          const targetUrl = url.endsWith('/') ? url.slice(0, -1) : url;
          return tabUrl === targetUrl;
        });

        if (matchingTabs.length > 0) {
          // Use existing tab
          tab = matchingTabs[0];
          console.log(`Found existing tab with URL: ${url}, tab ID: ${tab.id}`);
        } else {
          // Create new tab with the URL
          console.log(`No existing tab found with URL: ${url}, creating new tab`);
          tab = await chrome.tabs.create({ url, active: !stayBackground });

          // Wait for page to load
          console.log('Waiting for page to load...');
          await new Promise((resolve) => setTimeout(resolve, 3000));
        }
      } else {
        // Use active tab (prefer specified window)
        const tabs =
          typeof windowId === 'number'
            ? await chrome.tabs.query({ active: true, windowId })
            : await chrome.tabs.query({ active: true, currentWindow: true });
        if (!tabs[0]) {
          return createErrorResponse('No active tab found');
        }
        tab = tabs[0];
      }

      if (!tab.id) {
        return createErrorResponse('Tab has no ID');
      }

      // Foreground only when background: false
      if (!stayBackground) {
        await chrome.tabs.update(tab.id, { active: true });
        await chrome.windows.update(tab.windowId, { focused: true });
      }

      // Prepare result object
      const result: any = {
        success: true,
        url: tab.url,
        title: tab.title,
      };

      await this.injectContentScript(tab.id, ['inject-scripts/web-fetcher-helper.js']);

      // Get HTML content if requested
      if (htmlContent) {
        const htmlResponse = await this.sendMessageToTab(tab.id, {
          action: TOOL_MESSAGE_TYPES.WEB_FETCHER_GET_HTML_CONTENT,
          selector: selector,
        });

        if (htmlResponse.success) {
          result.htmlContent = htmlResponse.htmlContent;
        } else {
          console.error('Failed to get HTML content:', htmlResponse.error);
          result.htmlContentError = htmlResponse.error;
        }
      }

      // Get text content if requested (and htmlContent is not true)
      if (textContent) {
        const textResponse = await this.sendMessageToTab(tab.id, {
          action: TOOL_MESSAGE_TYPES.WEB_FETCHER_GET_TEXT_CONTENT,
          selector: selector,
        });

        if (textResponse.success) {
          result.textContent = textResponse.textContent;

          // Include article metadata if available
          if (textResponse.article) {
            result.article = {
              title: textResponse.article.title,
              byline: textResponse.article.byline,
              siteName: textResponse.article.siteName,
              excerpt: textResponse.article.excerpt,
              lang: textResponse.article.lang,
            };
          }

          // Include page metadata if available
          if (textResponse.metadata) {
            result.metadata = textResponse.metadata;
          }
        } else {
          console.error('Failed to get text content:', textResponse.error);
          result.textContentError = textResponse.error;
        }
      }

      // Interactive elements feature has been removed

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
      console.error('Error in web fetcher:', error);
      return createErrorResponse(
        `Error fetching web content: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const webFetcherTool = new WebFetcherTool();

interface GetInteractiveElementsToolParams {
  textQuery?: string; // Text to search for within interactive elements (fuzzy search)
  selector?: string; // CSS selector to filter interactive elements
  includeCoordinates?: boolean; // Include element coordinates in the response (default: true)
  types?: string[]; // Types of interactive elements to include (default: all types)
}

class GetInteractiveElementsTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GET_INTERACTIVE_ELEMENTS;

  /**
   * Execute get interactive elements operation
   */
  async execute(args: GetInteractiveElementsToolParams): Promise<ToolResult> {
    const { textQuery, selector, includeCoordinates = true, types } = args;

    console.log(`Starting get interactive elements with options:`, args);

    try {
      // Get current tab
      const tabs = await chrome.tabs.query({ active: true, currentWindow: true });
      if (!tabs[0]) {
        return createErrorResponse('No active tab found');
      }

      const tab = tabs[0];
      if (!tab.id) {
        return createErrorResponse('Active tab has no ID');
      }

      // Ensure content script is injected
      await this.injectContentScript(tab.id, ['inject-scripts/interactive-elements-helper.js']);

      // Send message to content script
      const result = await this.sendMessageToTab(tab.id, {
        action: TOOL_MESSAGE_TYPES.GET_INTERACTIVE_ELEMENTS,
        textQuery,
        selector,
        includeCoordinates,
        types,
      });

      if (!result.success) {
        return createErrorResponse(result.error || 'Failed to get interactive elements');
      }

      return {
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              success: true,
              elements: result.elements,
              count: result.elements.length,
              query: {
                textQuery,
                selector,
                types: types || 'all',
              },
            }),
          },
        ],
        isError: false,
      };
    } catch (error) {
      console.error('Error in get interactive elements operation:', error);
      return createErrorResponse(
        `Error getting interactive elements: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }
}

export const getInteractiveElementsTool = new GetInteractiveElementsTool();
