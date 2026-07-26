import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import {
  canvasToDataURL,
  createImageBitmapFromUrl,
  cropAndResizeImage,
  stitchImages,
  compressImage,
} from '../../../../utils/image-utils';
import { screenshotContextManager } from '@/utils/screenshot-context';

// Screenshot-specific constants
const SCREENSHOT_CONSTANTS = {
  SCROLL_DELAY_MS: 350, // Time to wait after scroll for rendering and lazy loading
  CAPTURE_STITCH_DELAY_MS: 50, // Small delay between captures in a scroll sequence
  MAX_CAPTURE_PARTS: 50, // Maximum number of parts to capture (for infinite scroll pages)
  MAX_CAPTURE_HEIGHT_PX: 50000, // Maximum height in pixels to capture
  PIXEL_TOLERANCE: 1,
  SCRIPT_INIT_DELAY: 100, // Delay for script initialization
} as {
  readonly SCROLL_DELAY_MS: number;
  CAPTURE_STITCH_DELAY_MS: number; // This one is mutable
  readonly MAX_CAPTURE_PARTS: number;
  readonly MAX_CAPTURE_HEIGHT_PX: number;
  readonly PIXEL_TOLERANCE: number;
  readonly SCRIPT_INIT_DELAY: number;
};

// Adjust CAPTURE_STITCH_DELAY_MS to respect Chrome's capture rate if available in runtime
// Some TS typings don't expose MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND; use a safe cast with a sane fallback.
const __MAX_CAP_RATE: number | undefined = (chrome.tabs as any)
  ?.MAX_CAPTURE_VISIBLE_TAB_CALLS_PER_SECOND;
if (typeof __MAX_CAP_RATE === 'number' && __MAX_CAP_RATE > 0) {
  // Minimum interval between consecutive captureVisibleTab calls (ms)
  const minIntervalMs = Math.ceil(1000 / __MAX_CAP_RATE);
  // Our capture loop already waits SCROLL_DELAY_MS between scroll and capture; add any extra delay needed
  const requiredExtraDelay = Math.max(0, minIntervalMs - SCREENSHOT_CONSTANTS.SCROLL_DELAY_MS);
  SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS = Math.max(
    requiredExtraDelay,
    SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS,
  );
}

interface ScreenshotToolParams {
  name: string;
  selector?: string;
  tabId?: number;
  background?: boolean;
  windowId?: number;
  width?: number;
  height?: number;
  storeBase64?: boolean;
  fullPage?: boolean;
  savePng?: boolean;
  maxHeight?: number; // Maximum height to capture in pixels (for infinite scroll pages)
}

/** Page details returned by screenshot-helper content script */
interface ScreenshotPageDetails {
  totalWidth: number;
  totalHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  devicePixelRatio: number;
  currentScrollX: number;
  currentScrollY: number;
}

const PAGE_DETAILS_REQUIRED_FIELDS: Array<keyof ScreenshotPageDetails> = [
  'totalWidth',
  'totalHeight',
  'viewportWidth',
  'viewportHeight',
  'devicePixelRatio',
  'currentScrollX',
  'currentScrollY',
];

/**
 * Validates and asserts that the response from content script contains valid page details
 */
function assertValidPageDetails(details: unknown): ScreenshotPageDetails {
  if (!details || typeof details !== 'object') {
    throw new Error(
      'Screenshot helper did not respond. The content script may not be injected or cannot run on this page.',
    );
  }

  const candidate = details as Partial<ScreenshotPageDetails>;
  const invalidFields = PAGE_DETAILS_REQUIRED_FIELDS.filter(
    (field) => typeof candidate[field] !== 'number' || !Number.isFinite(candidate[field]),
  );

  if (invalidFields.length > 0) {
    throw new Error(
      `Screenshot helper returned invalid page details (missing/invalid: ${invalidFields.join(', ')}).`,
    );
  }

  return candidate as ScreenshotPageDetails;
}

/**
 * Tool for capturing screenshots of web pages
 */
class ScreenshotTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.SCREENSHOT;

  /**
   * Execute screenshot operation
   */
  async execute(args: ScreenshotToolParams): Promise<ToolResult> {
    const {
      name = 'screenshot',
      selector,
      storeBase64 = false,
      fullPage = false,
      savePng = true,
    } = args;

    console.log(`Starting screenshot with options:`, args);

    // Resolve target tab (explicit or active)
    const explicit = await this.tryGetTab(args.tabId);
    let tab = explicit || (await this.getActiveTabOrThrowInWindow(args.windowId));

    // Check URL restrictions
    if (
      tab.url?.startsWith('chrome://') ||
      tab.url?.startsWith('edge://') ||
      tab.url?.startsWith('https://chrome.google.com/webstore') ||
      tab.url?.startsWith('https://microsoftedge.microsoft.com/')
    ) {
      return createErrorResponse(
        'Cannot capture special browser pages or web store pages due to security restrictions.',
      );
    }

    let finalImageDataUrl: string | undefined;
    let finalImageWidthCss: number | undefined;
    let finalImageHeightCss: number | undefined;
    const results: any = { base64: null, fileSaved: false };
    let originalScroll: { x: number; y: number } | null = null;
    let didPreparePage = false;
    let pageDetails: ScreenshotPageDetails | undefined;

    try {
      const stayBackground = this.stayInBackground(args.background);
      // CDP path: stay in background with simple viewport capture (no fullPage, no selector)
      const canUseCdpCapture = stayBackground && !fullPage && !selector;

      // === Path 1: CDP viewport capture (no content script needed) ===
      if (canUseCdpCapture) {
        try {
          const tabId = tab.id!;
          const { cdpSessionManager } = await import('@/utils/cdp-session-manager');
          await cdpSessionManager.withSession(tabId, 'screenshot', async () => {
            const metrics: any = await cdpSessionManager.sendCommand(
              tabId,
              'Page.getLayoutMetrics',
              {},
            );
            const viewport = metrics?.layoutViewport ||
              metrics?.visualViewport || {
                clientWidth: 800,
                clientHeight: 600,
                pageX: 0,
                pageY: 0,
              };
            const shot: any = await cdpSessionManager.sendCommand(tabId, 'Page.captureScreenshot', {
              format: 'png',
            });
            const base64Data = typeof shot?.data === 'string' ? shot.data : '';
            if (!base64Data) {
              throw new Error('CDP Page.captureScreenshot returned empty data');
            }
            finalImageDataUrl = `data:image/png;base64,${base64Data}`;
            finalImageWidthCss = Math.round(viewport.clientWidth || 800);
            finalImageHeightCss = Math.round(viewport.clientHeight || 600);
          });
        } catch (e) {
          console.warn('CDP viewport capture failed, falling back to helper path:', e);
        }
      }

      // === Path 2: Helper-assisted capture (requires content script) ===
      if (!finalImageDataUrl) {
        // captureVisibleTab only sees the active tab in a window. Soft-activate
        // the target tab without raising the Chrome window to the foreground.
        if (tab.active !== true && typeof tab.id === 'number') {
          await chrome.tabs.update(tab.id, { active: true });
          // Re-read tab after activation
          tab = await chrome.tabs.get(tab.id);
        }

        // Always inject helper when we need pageDetails
        await this.injectContentScript(tab.id!, ['inject-scripts/screenshot-helper.js']);
        await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_CONSTANTS.SCRIPT_INIT_DELAY));

        // Prepare page (hide scrollbars, handle fixed elements)
        const prepareResp = await this.sendMessageToTab(tab.id!, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_PREPARE_PAGE_FOR_CAPTURE,
          options: { fullPage },
        });
        if (!prepareResp || prepareResp.success !== true) {
          throw new Error(
            'Screenshot helper did not acknowledge page preparation. The content script may not be injected or cannot run on this page.',
          );
        }
        didPreparePage = true;

        // Get page details with validation
        const rawPageDetails = await this.sendMessageToTab(tab.id!, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_GET_PAGE_DETAILS,
        });
        pageDetails = assertValidPageDetails(rawPageDetails);
        originalScroll = { x: pageDetails.currentScrollX, y: pageDetails.currentScrollY };

        if (fullPage) {
          this.logInfo('Capturing full page...');
          finalImageDataUrl = await this._captureFullPage(tab.id!, args, pageDetails);
          // Compute final CSS size
          if (args.width && args.height) {
            finalImageWidthCss = args.width;
            finalImageHeightCss = args.height;
          } else if (args.width && !args.height) {
            finalImageWidthCss = args.width;
            const ratio = pageDetails.totalHeight / pageDetails.totalWidth;
            finalImageHeightCss = Math.round(args.width * ratio);
          } else if (!args.width && args.height) {
            finalImageHeightCss = args.height;
            const ratio = pageDetails.totalWidth / pageDetails.totalHeight;
            finalImageWidthCss = Math.round(args.height * ratio);
          } else {
            finalImageWidthCss = pageDetails.totalWidth;
            finalImageHeightCss = pageDetails.totalHeight;
          }
        } else if (selector) {
          this.logInfo(`Capturing element: ${selector}`);
          finalImageDataUrl = await this._captureElement(
            tab.id!,
            args,
            pageDetails.devicePixelRatio,
          );
          if (args.width && args.height) {
            finalImageWidthCss = args.width;
            finalImageHeightCss = args.height;
          } else {
            finalImageWidthCss = pageDetails.viewportWidth;
            finalImageHeightCss = pageDetails.viewportHeight;
          }
        } else {
          // Visible area only
          this.logInfo('Capturing visible area...');
          finalImageDataUrl = await chrome.tabs.captureVisibleTab(tab.windowId, { format: 'png' });
          finalImageWidthCss = pageDetails.viewportWidth;
          finalImageHeightCss = pageDetails.viewportHeight;
        }
      }

      if (!finalImageDataUrl) {
        throw new Error('Failed to capture image data');
      }

      // 2. Process output
      // Update screenshot context for coordinate scaling by tools like chrome_computer
      try {
        if (typeof finalImageWidthCss === 'number' && typeof finalImageHeightCss === 'number') {
          let hostname = '';
          try {
            hostname = tab.url ? new URL(tab.url).hostname : '';
          } catch {
            // ignore
          }
          // Use pageDetails if available, otherwise fall back to final image dimensions
          const viewportWidth = pageDetails?.viewportWidth ?? finalImageWidthCss;
          const viewportHeight = pageDetails?.viewportHeight ?? finalImageHeightCss;
          screenshotContextManager.setContext(tab.id!, {
            screenshotWidth: finalImageWidthCss,
            screenshotHeight: finalImageHeightCss,
            viewportWidth,
            viewportHeight,
            devicePixelRatio: pageDetails?.devicePixelRatio,
            hostname,
          });
        }
      } catch (e) {
        console.warn('Failed to set screenshot context:', e);
      }
      if (storeBase64 === true) {
        // Compress image for base64 output to reduce size
        const compressed = await compressImage(finalImageDataUrl, {
          scale: 0.7, // Reduce dimensions by 30%
          quality: 0.8, // 80% quality for good balance
          format: 'image/jpeg', // JPEG for better compression
        });

        // Include base64 data in response (without prefix)
        const base64Data = compressed.dataUrl.replace(/^data:image\/[^;]+;base64,/, '');
        results.base64 = base64Data;
        return {
          content: [
            {
              type: 'text',
              text: JSON.stringify({ base64Data, mimeType: compressed.mimeType }),
            },
          ],
          isError: false,
        };
      }

      if (savePng === true) {
        // Save PNG file to downloads
        this.logInfo('Saving PNG...');
        try {
          // Generate filename
          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const filename = `${name.replace(/[^a-z0-9_-]/gi, '_') || 'screenshot'}_${timestamp}.png`;

          // Use Chrome's download API to save the file
          const downloadId = await chrome.downloads.download({
            url: finalImageDataUrl,
            filename: filename,
            saveAs: false,
          });

          results.downloadId = downloadId;
          results.filename = filename;
          results.fileSaved = true;

          // Try to get the full file path
          try {
            // Wait a moment to ensure download info is updated
            await new Promise((resolve) => setTimeout(resolve, 100));

            // Search for download item to get full path
            const [downloadItem] = await chrome.downloads.search({ id: downloadId });
            if (downloadItem && downloadItem.filename) {
              // Add full path to response
              results.fullPath = downloadItem.filename;
            }
          } catch (pathError) {
            console.warn('Could not get full file path:', pathError);
          }
        } catch (error) {
          console.error('Error saving PNG file:', error);
          results.saveError = String(error instanceof Error ? error.message : error);
        }
      }
    } catch (error) {
      console.error('Error during screenshot execution:', error);
      return createErrorResponse(
        `Screenshot error: ${error instanceof Error ? error.message : JSON.stringify(error)}`,
      );
    } finally {
      // 3. Reset page only if we prepared it
      if (didPreparePage) {
        try {
          // Only include scroll position if we successfully captured it
          const resetMessage: Record<string, unknown> = {
            action: TOOL_MESSAGE_TYPES.SCREENSHOT_RESET_PAGE_AFTER_CAPTURE,
          };
          if (originalScroll) {
            resetMessage.scrollX = originalScroll.x;
            resetMessage.scrollY = originalScroll.y;
          }
          await this.sendMessageToTab(tab.id!, resetMessage);
        } catch (err) {
          console.warn('Failed to reset page, tab might have closed:', err);
        }
      }
    }

    this.logInfo('Screenshot completed!');

    return {
      content: [
        {
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: `Screenshot [${name}] captured successfully`,
            tabId: tab.id,
            url: tab.url,
            name: name,
            ...results,
          }),
        },
      ],
      isError: false,
    };
  }

  /**
   * Log information
   */
  private logInfo(message: string) {
    console.log(`[Screenshot Tool] ${message}`);
  }

  /**
   * Capture specific element
   */
  async _captureElement(
    tabId: number,
    options: ScreenshotToolParams,
    pageDpr: number,
  ): Promise<string> {
    const elementDetails = await this.sendMessageToTab(tabId, {
      action: TOOL_MESSAGE_TYPES.SCREENSHOT_GET_ELEMENT_DETAILS,
      selector: options.selector,
    });

    const dpr = elementDetails.devicePixelRatio || pageDpr || 1;

    // Element rect is viewport-relative, in CSS pixels
    // captureVisibleTab captures in physical pixels
    const cropRectPx = {
      x: elementDetails.rect.x * dpr,
      y: elementDetails.rect.y * dpr,
      width: elementDetails.rect.width * dpr,
      height: elementDetails.rect.height * dpr,
    };

    // Small delay to ensure element is fully rendered after scrollIntoView
    await new Promise((resolve) => setTimeout(resolve, SCREENSHOT_CONSTANTS.SCRIPT_INIT_DELAY));

    const visibleCaptureDataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
    if (!visibleCaptureDataUrl) {
      throw new Error('Failed to capture visible tab for element cropping');
    }

    const croppedCanvas = await cropAndResizeImage(
      visibleCaptureDataUrl,
      cropRectPx,
      dpr,
      options.width, // Target output width in CSS pixels
      options.height, // Target output height in CSS pixels
    );
    return canvasToDataURL(croppedCanvas);
  }

  /**
   * Capture full page
   */
  async _captureFullPage(
    tabId: number,
    options: ScreenshotToolParams,
    initialPageDetails: any,
  ): Promise<string> {
    const dpr = initialPageDetails.devicePixelRatio;
    const totalWidthCss = options.width || initialPageDetails.totalWidth; // Use option width if provided
    const totalHeightCss = initialPageDetails.totalHeight; // Full page always uses actual height

    // Apply maximum height limit for infinite scroll pages
    const maxHeightPx = options.maxHeight || SCREENSHOT_CONSTANTS.MAX_CAPTURE_HEIGHT_PX;
    const limitedHeightCss = Math.min(totalHeightCss, maxHeightPx / dpr);

    const totalWidthPx = totalWidthCss * dpr;
    const totalHeightPx = limitedHeightCss * dpr;

    // Viewport dimensions (CSS pixels) - logged for debugging
    this.logInfo(
      `Viewport size: ${initialPageDetails.viewportWidth}x${initialPageDetails.viewportHeight} CSS pixels`,
    );
    this.logInfo(
      `Page dimensions: ${totalWidthCss}x${totalHeightCss} CSS pixels (limited to ${limitedHeightCss} height)`,
    );

    const viewportHeightCss = initialPageDetails.viewportHeight;

    const capturedParts = [];
    let currentScrollYCss = 0;
    let capturedHeightPx = 0;
    let partIndex = 0;

    while (capturedHeightPx < totalHeightPx && partIndex < SCREENSHOT_CONSTANTS.MAX_CAPTURE_PARTS) {
      this.logInfo(
        `Capturing part ${partIndex + 1}... (${Math.round((capturedHeightPx / totalHeightPx) * 100)}%)`,
      );

      if (currentScrollYCss > 0) {
        // Don't scroll for the first part if already at top
        const scrollResp = await this.sendMessageToTab(tabId, {
          action: TOOL_MESSAGE_TYPES.SCREENSHOT_SCROLL_PAGE,
          x: 0,
          y: currentScrollYCss,
          scrollDelay: SCREENSHOT_CONSTANTS.SCROLL_DELAY_MS,
        });
        // Update currentScrollYCss based on actual scroll achieved
        currentScrollYCss = scrollResp.newScrollY;
      }

      // Ensure rendering after scroll
      await new Promise((resolve) =>
        setTimeout(resolve, SCREENSHOT_CONSTANTS.CAPTURE_STITCH_DELAY_MS),
      );

      const dataUrl = await chrome.tabs.captureVisibleTab({ format: 'png' });
      if (!dataUrl) throw new Error('captureVisibleTab returned empty during full page capture');

      const yOffsetPx = currentScrollYCss * dpr;
      capturedParts.push({ dataUrl, y: yOffsetPx });

      const imgForHeight = await createImageBitmapFromUrl(dataUrl); // To get actual captured height
      const lastPartEffectiveHeightPx = Math.min(imgForHeight.height, totalHeightPx - yOffsetPx);

      capturedHeightPx = yOffsetPx + lastPartEffectiveHeightPx;

      if (capturedHeightPx >= totalHeightPx - SCREENSHOT_CONSTANTS.PIXEL_TOLERANCE) break;

      currentScrollYCss += viewportHeightCss;
      // Prevent overscrolling past the document height for the next scroll command
      if (
        currentScrollYCss > totalHeightCss - viewportHeightCss &&
        currentScrollYCss < totalHeightCss
      ) {
        currentScrollYCss = totalHeightCss - viewportHeightCss;
      }
      partIndex++;
    }

    // Check if we hit any limits
    if (partIndex >= SCREENSHOT_CONSTANTS.MAX_CAPTURE_PARTS) {
      this.logInfo(
        `Reached maximum number of capture parts (${SCREENSHOT_CONSTANTS.MAX_CAPTURE_PARTS}). This may be an infinite scroll page.`,
      );
    }
    if (totalHeightCss > limitedHeightCss) {
      this.logInfo(
        `Page height (${totalHeightCss}px) exceeds maximum capture height (${maxHeightPx / dpr}px). Capturing limited portion.`,
      );
    }

    this.logInfo('Stitching image...');
    const finalCanvas = await stitchImages(capturedParts, totalWidthPx, totalHeightPx);

    // If user specified width but not height (or vice versa for full page), resize maintaining aspect ratio
    let outputCanvas = finalCanvas;
    if (options.width && !options.height) {
      const targetWidthPx = options.width * dpr;
      const aspectRatio = finalCanvas.height / finalCanvas.width;
      const targetHeightPx = targetWidthPx * aspectRatio;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
      }
    } else if (options.height && !options.width) {
      const targetHeightPx = options.height * dpr;
      const aspectRatio = finalCanvas.width / finalCanvas.height;
      const targetWidthPx = targetHeightPx * aspectRatio;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
      }
    } else if (options.width && options.height) {
      // Both specified, direct resize
      const targetWidthPx = options.width * dpr;
      const targetHeightPx = options.height * dpr;
      outputCanvas = new OffscreenCanvas(targetWidthPx, targetHeightPx);
      const ctx = outputCanvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(finalCanvas, 0, 0, targetWidthPx, targetHeightPx);
      }
    }

    return canvasToDataURL(outputCanvas);
  }
}

export const screenshotTool = new ScreenshotTool();
