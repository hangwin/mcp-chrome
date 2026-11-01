import { beforeEach, describe, expect, it, vi } from 'vitest';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';

const mocks = vi.hoisted(() => ({
  compressImage: vi.fn(),
  sendCommand: vi.fn(),
  withSession: vi.fn(),
}));

vi.mock('@/utils/image-utils', () => ({
  canvasToDataURL: vi.fn(),
  createImageBitmapFromUrl: vi.fn(),
  cropAndResizeImage: vi.fn(),
  stitchImages: vi.fn(),
  compressImage: mocks.compressImage,
}));

vi.mock('@/utils/cdp-session-manager', () => ({
  cdpSessionManager: {
    sendCommand: mocks.sendCommand,
    withSession: mocks.withSession,
  },
}));

import { screenshotTool } from '@/entrypoints/background/tools/browser/screenshot';
import { computerTool } from '@/entrypoints/background/tools/browser/computer';

const tab = { id: 1, windowId: 2, url: 'https://example.com/' } as chrome.tabs.Tab;
const base64Data = 'anBlZw==';
const legacyText = JSON.stringify({ base64Data, mimeType: 'image/jpeg' });

function expectImageContent(result: Awaited<ReturnType<typeof screenshotTool.execute>>) {
  expect(result.isError).toBe(false);
  expect(result.content).toEqual([
    { type: 'image', data: base64Data, mimeType: 'image/jpeg' },
    { type: 'text', text: legacyText },
  ]);
}

describe('screenshot MCP image content', () => {
  beforeEach(() => {
    vi.mocked(chrome.tabs.get).mockResolvedValue(tab);
    vi.mocked(chrome.tabs.query).mockResolvedValue([tab]);
    vi.mocked(chrome.tabs.captureVisibleTab).mockImplementation(() =>
      Promise.resolve('data:image/png;base64,cG5n'),
    );
    mocks.compressImage.mockResolvedValue({
      dataUrl: `data:image/jpeg;base64,${base64Data}`,
      mimeType: 'image/jpeg',
    });
    mocks.withSession.mockImplementation(async (_tabId, _key, callback) => callback());
    mocks.sendCommand.mockImplementation(async (_tabId, command) => {
      if (command === 'Page.getLayoutMetrics') {
        return { layoutViewport: { clientWidth: 800, clientHeight: 600 } };
      }
      if (command === 'Page.captureScreenshot') return { data: 'cG5n' };
      throw new Error(`Unexpected CDP command: ${command}`);
    });
  });

  it('returns an image block and preserves the legacy text payload for chrome_screenshot', async () => {
    const result = await screenshotTool.execute({
      name: 'test',
      tabId: tab.id,
      background: true,
      storeBase64: true,
      savePng: false,
    });

    expectImageContent(result);
  });

  it('returns the same image content through chrome_computer screenshot', async () => {
    vi.spyOn(screenshotTool as any, 'injectContentScript').mockResolvedValue(undefined);
    vi.spyOn(screenshotTool as any, 'sendMessageToTab').mockImplementation(
      async (_tabId, message: unknown) => {
        const action = (message as { action?: string }).action;
        if (action === TOOL_MESSAGE_TYPES.SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE) {
          return { success: true };
        }
        if (action === TOOL_MESSAGE_TYPES.SCREENSHOT_GET_PAGE_DETAILS) {
          return {
            totalWidth: 800,
            totalHeight: 600,
            viewportWidth: 800,
            viewportHeight: 600,
            devicePixelRatio: 1,
            currentScrollX: 0,
            currentScrollY: 0,
          };
        }
        return { success: true };
      },
    );

    const result = await computerTool.execute({ action: 'screenshot', tabId: tab.id });

    expectImageContent(result);
  });
});
