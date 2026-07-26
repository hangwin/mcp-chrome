/**
 * GIF Recorder Tool
 *
 * Records browser tab activity as an animated GIF.
 *
 * Features:
 * - Two recording modes:
 *   1. Fixed FPS mode (start): Captures frames at regular intervals
 *   2. Auto-capture mode (auto_start): Captures frames on tool actions
 * - Configurable frame rate, duration, and dimensions
 * - Quality/size optimization options
 * - CDP-based screenshot capture for background recording
 * - Offscreen document encoding via gifenc
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import { TOOL_MESSAGE_TYPES } from '@/common/message-types';
import {
  MessageTarget,
  OFFSCREEN_MESSAGE_TYPES,
  OffscreenMessageType,
} from '@/common/message-types';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { offscreenManager } from '@/utils/offscreen-manager';
import { createImageBitmapFromUrl } from '@/utils/image-utils';
import {
  startAutoCapture,
  stopAutoCapture,
  isAutoCaptureActive,
  getAutoCaptureStatus,
  captureFrameOnAction,
  captureInitialFrame,
  type ActionMetadata,
  type GifEnhancedRenderingConfig,
} from './gif-auto-capture';

// ============================================================================
// Constants
// ============================================================================

const DEFAULT_FPS = 5;
const DEFAULT_DURATION_MS = 5000;
const DEFAULT_MAX_FRAMES = 50;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_MAX_COLORS = 256;
const CDP_SESSION_KEY = 'gif-recorder';

// ============================================================================
// Types
// ============================================================================

type GifRecorderAction =
  | 'start'
  | 'stop'
  | 'status'
  | 'auto_start'
  | 'capture'
  | 'clear'
  | 'export';

interface GifRecorderParams {
  action: GifRecorderAction;
  tabId?: number;
  fps?: number;
  durationMs?: number;
  maxFrames?: number;
  width?: number;
  height?: number;
  maxColors?: number;
  filename?: string;
  // Auto-capture mode specific
  captureDelayMs?: number;
  frameDelayCs?: number;
  enhancedRendering?: GifEnhancedRenderingConfig;
  // Manual annotation for action="capture"
  annotation?: string;
  // Export action specific
  download?: boolean; // true to download, false to upload via drag&drop
  coordinates?: { x: number; y: number }; // target position for drag&drop upload
  ref?: string; // element ref for drag&drop upload (alternative to coordinates)
  selector?: string; // CSS selector for drag&drop upload (alternative to coordinates)
}

interface RecordingState {
  isRecording: boolean;
  isStopping: boolean;
  tabId: number;
  width: number;
  height: number;
  fps: number;
  durationMs: number;
  frameIntervalMs: number;
  frameDelayCs: number;
  maxFrames: number;
  maxColors: number;
  frameCount: number;
  startTime: number;
  captureTimer: ReturnType<typeof setTimeout> | null;
  captureInProgress: Promise<void> | null;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  filename?: string;
}

interface GifResult {
  success: boolean;
  action: GifRecorderAction;
  tabId?: number;
  frameCount?: number;
  durationMs?: number;
  byteLength?: number;
  downloadId?: number;
  filename?: string;
  fullPath?: string;
  isRecording?: boolean;
  mode?: 'fixed_fps' | 'auto_capture';
  actionsCount?: number;
  error?: string;
  // Clear action specific
  clearedAutoCapture?: boolean;
  clearedFixedFps?: boolean;
  clearedCache?: boolean;
  // Export action specific (drag&drop upload)
  uploadTarget?: {
    x: number;
    y: number;
    tagName?: string;
    id?: string;
  };
}

// ============================================================================
// Recording State Management
// ============================================================================

let recordingState: RecordingState | null = null;
let stopPromise: Promise<GifResult> | null = null;

// Auto-capture mode state
interface AutoCaptureMetadata {
  tabId: number;
  filename?: string;
}
let autoCaptureMetadata: AutoCaptureMetadata | null = null;

// Last recorded GIF cache for export
interface ExportableGif {
  gifData: Uint8Array;
  width: number;
  height: number;
  frameCount: number;
  durationMs: number;
  tabId: number;
  filename?: string;
  actionsCount?: number;
  mode: 'fixed_fps' | 'auto_capture';
  createdAt: number;
}
let lastRecordedGif: ExportableGif | null = null;

// Maximum cache lifetime for exportable GIF (5 minutes)
const EXPORT_CACHE_LIFETIME_MS = 5 * 60 * 1000;

// ============================================================================
// Offscreen Document Communication
// ============================================================================

type OffscreenResponseBase = { success: boolean; error?: string };

async function sendToOffscreen<TResponse extends OffscreenResponseBase>(
  type: OffscreenMessageType,
  payload: Record<string, unknown> = {},
): Promise<TResponse> {
  await offscreenManager.ensureOffscreenDocument();

  let lastError: unknown;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const response = (await chrome.runtime.sendMessage({
        target: MessageTarget.Offscreen,
        type,
        ...payload,
      })) as TResponse | undefined;

      if (!response) {
        throw new Error('No response received from offscreen document');
      }
      if (!response.success) {
        throw new Error(response.error || 'Unknown offscreen error');
      }

      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await new Promise((resolve) => setTimeout(resolve, 50 * attempt));
        continue;
      }
      throw error;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

// ============================================================================
// Frame Capture
// ============================================================================

async function captureFrame(
  tabId: number,
  width: number,
  height: number,
  ctx: OffscreenCanvasRenderingContext2D,
): Promise<string> {
  // Get viewport metrics
  const metrics: { layoutViewport?: { clientWidth: number; clientHeight: number } } =
    await cdpSessionManager.sendCommand(tabId, 'Page.getLayoutMetrics', {});

  const viewportWidth = metrics.layoutViewport?.clientWidth || width;
  const viewportHeight = metrics.layoutViewport?.clientHeight || height;

  // Capture screenshot
  const screenshot: { data: string } = await cdpSessionManager.sendCommand(
    tabId,
    'Page.captureScreenshot',
    {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    },
  );

  const imageBitmap = await createImageBitmapFromUrl(`data:image/png;base64,${screenshot.data}`);

  // Scale image to target dimensions
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  const blob = await ctx.canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

async function captureAndEncodeFrame(state: RecordingState): Promise<void> {
  const frameDataUrl = await captureFrame(state.tabId, state.width, state.height, state.ctx);

  await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME, {
    imageDataUrl: frameDataUrl,
    width: state.width,
    height: state.height,
    delay: state.frameDelayCs,
    maxColors: state.maxColors,
  });

  if (recordingState === state && state.isRecording && !state.isStopping) {
    state.frameCount += 1;
  }
}

async function captureTick(state: RecordingState): Promise<void> {
  if (recordingState !== state || !state.isRecording || state.isStopping) {
    return;
  }

  const elapsed = Date.now() - state.startTime;
  if (elapsed >= state.durationMs || state.frameCount >= state.maxFrames) {
    await stopRecording();
    return;
  }

  const startedAt = Date.now();
  state.captureInProgress = captureAndEncodeFrame(state);

  try {
    await state.captureInProgress;
  } catch (error) {
    console.error('Frame capture error:', error);
  } finally {
    if (recordingState === state) {
      state.captureInProgress = null;
    }
  }

  if (recordingState !== state || !state.isRecording || state.isStopping) {
    return;
  }

  const elapsedAfter = Date.now() - state.startTime;
  if (elapsedAfter >= state.durationMs || state.frameCount >= state.maxFrames) {
    await stopRecording();
    return;
  }

  const delayMs = Math.max(0, state.frameIntervalMs - (Date.now() - startedAt));
  state.captureTimer = setTimeout(() => {
    void captureTick(state).catch((error) => {
      console.error('GIF recorder tick error:', error);
    });
  }, delayMs);
}

// ============================================================================
// Recording Control
// ============================================================================

async function startRecording(
  tabId: number,
  fps: number,
  durationMs: number,
  maxFrames: number,
  width: number,
  height: number,
  maxColors: number,
  filename?: string,
): Promise<GifResult> {
  if (stopPromise || recordingState?.isRecording || recordingState?.isStopping) {
    return {
      success: false,
      action: 'start',
      error: 'Recording already in progress',
    };
  }

  try {
    await cdpSessionManager.attach(tabId, CDP_SESSION_KEY);
  } catch (error) {
    return {
      success: false,
      action: 'start',
      error: error instanceof Error ? error.message : String(error),
    };
  }

  try {
    await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});

    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not available in this context');
    }

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const frameIntervalMs = Math.round(1000 / fps);
    const frameDelayCs = Math.max(1, Math.round(100 / fps));

    const state: RecordingState = {
      isRecording: true,
      isStopping: false,
      tabId,
      width,
      height,
      fps,
      durationMs,
      frameIntervalMs,
      frameDelayCs,
      maxFrames,
      maxColors,
      frameCount: 0,
      startTime: Date.now(),
      captureTimer: null,
      captureInProgress: null,
      canvas,
      ctx,
      filename,
    };

    recordingState = state;

    state.captureTimer = setTimeout(() => {
      void captureTick(state).catch((error) => {
        console.error('GIF recorder tick error:', error);
      });
    }, 0);

    return {
      success: true,
      action: 'start',
      tabId,
      isRecording: true,
    };
  } catch (error) {
    recordingState = null;
    try {
      await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
    } catch {
      // ignore
    }
    return {
      success: false,
      action: 'start',
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

async function stopRecording(): Promise<GifResult> {
  if (stopPromise) {
    return stopPromise;
  }

  if (!recordingState || (!recordingState.isRecording && !recordingState.isStopping)) {
    return {
      success: false,
      action: 'stop',
      error: 'No recording in progress',
    };
  }

  stopPromise = (async () => {
    const state = recordingState!;
    const tabId = state.tabId;

    // Stop capture timer
    if (state.captureTimer) {
      clearTimeout(state.captureTimer);
      state.captureTimer = null;
    }

    state.isStopping = true;
    state.isRecording = false;

    try {
      await withTimeout(
        state.captureInProgress,
        5000,
        'Timed out waiting for active frame capture',
      );
    } catch {
      // ignore
    }

    // Best-effort final frame capture to preserve end state
    try {
      await withTimeout(
        (async () => {
          const frameDataUrl = await captureFrame(
            state.tabId,
            state.width,
            state.height,
            state.ctx,
          );
          await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME, {
            imageDataUrl: frameDataUrl,
            width: state.width,
            height: state.height,
            delay: state.frameDelayCs,
            maxColors: state.maxColors,
          });
          state.frameCount += 1;
        })(),
        8000,
        'Timed out capturing final frame',
      );
    } catch (error) {
      console.warn('GIF recorder: Final frame capture error (non-fatal):', error);
    }

    const frameCount = state.frameCount;
    const durationMs = Date.now() - state.startTime;
    const filename = state.filename;

    try {
      if (frameCount <= 0) {
        try {
          await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});
        } catch {
          // ignore
        }
        return {
          success: false,
          action: 'stop' as const,
          tabId,
          frameCount,
          durationMs,
          error: 'No frames captured',
        };
      }

      const response = await withTimeout(
        sendToOffscreen<{
          success: boolean;
          gifData?: number[];
          byteLength?: number;
        }>(OFFSCREEN_MESSAGE_TYPES.GIF_FINISH, {}),
        20000,
        'Timed out finishing GIF encoding',
      );

      if (!response || !response.gifData || response.gifData.length === 0) {
        return {
          success: false,
          action: 'stop' as const,
          tabId,
          frameCount,
          durationMs,
          error: 'No frames captured',
        };
      }

      // Convert to Uint8Array and create blob
      const gifBytes = new Uint8Array(response.gifData);

      // Cache for later export
      lastRecordedGif = {
        gifData: gifBytes,
        width: state.width,
        height: state.height,
        frameCount,
        durationMs,
        tabId,
        filename,
        mode: 'fixed_fps',
        createdAt: Date.now(),
      };

      const blob = new Blob([gifBytes], { type: 'image/gif' });
      const dataUrl = await blobToDataUrl(blob);

      // Save GIF file
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const outputFilename = filename?.replace(/[^a-z0-9_-]/gi, '_') || `recording_${timestamp}`;
      const fullFilename = outputFilename.endsWith('.gif')
        ? outputFilename
        : `${outputFilename}.gif`;

      const downloadId = await chrome.downloads.download({
        url: dataUrl,
        filename: fullFilename,
        saveAs: false,
      });

      // Wait briefly to get download info
      await new Promise((resolve) => setTimeout(resolve, 100));

      let fullPath: string | undefined;
      try {
        const [downloadItem] = await chrome.downloads.search({ id: downloadId });
        fullPath = downloadItem?.filename;
      } catch {
        // Ignore path lookup errors
      }

      return {
        success: true,
        action: 'stop' as const,
        tabId,
        frameCount,
        durationMs,
        byteLength: response.byteLength ?? gifBytes.byteLength,
        downloadId,
        filename: fullFilename,
        fullPath,
      };
    } catch (error) {
      return {
        success: false,
        action: 'stop' as const,
        error: error instanceof Error ? error.message : String(error),
      };
    } finally {
      try {
        await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
      } catch {
        // ignore
      }
      recordingState = null;
    }
  })();

  return await stopPromise.finally(() => {
    stopPromise = null;
  });
}

function getRecordingStatus(): GifResult {
  if (!recordingState) {
    return {
      success: true,
      action: 'status',
      isRecording: false,
    };
  }

  return {
    success: true,
    action: 'status',
    isRecording: recordingState.isRecording,
    tabId: recordingState.tabId,
    frameCount: recordingState.frameCount,
    durationMs: Date.now() - recordingState.startTime,
  };
}

// ============================================================================
// Utilities
// ============================================================================

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

function gifBytesToBlob(bytes: Uint8Array): Blob {
  const arrayBuffer = new Uint8Array(bytes).buffer;
  return new Blob([arrayBuffer], { type: 'image/gif' });
}

function withTimeout<T>(
  promise: Promise<T> | null,
  timeoutMs: number,
  message: string,
): Promise<T | null> {
  if (!promise) return Promise.resolve(null);
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(message)), timeoutMs);
    promise
      .then((value) => {
        clearTimeout(timer);
        resolve(value);
      })
      .catch((error) => {
        clearTimeout(timer);
        reject(error);
      });
  });
}

function normalizePositiveInt(value: unknown, fallback: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) {
    return fallback;
  }
  const result = Math.max(1, Math.floor(value));
  return max !== undefined ? Math.min(result, max) : result;
}

// ============================================================================
// Tool Implementation
// ============================================================================

class GifRecorderTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.GIF_RECORDER;

  async execute(args: GifRecorderParams): Promise<ToolResult> {
    const action = args.action;
    const validActions = ['start', 'stop', 'status', 'auto_start', 'capture', 'clear', 'export'];

    if (!action || !validActions.includes(action)) {
      return createErrorResponse(
        `Parameter [action] is required and must be one of: ${validActions.join(', ')}`,
      );
    }

    try {
      switch (action) {
        case 'start': {
          // Fixed-FPS mode: captures frames at regular intervals
          const tab = await this.resolveTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (this.isRestrictedUrl(tab.url)) {
            return createErrorResponse(
              'Cannot record special browser pages or web store pages due to security restrictions.',
            );
          }

          // Check if auto-capture is active
          if (isAutoCaptureActive(tab.id)) {
            return createErrorResponse(
              'Auto-capture mode is active for this tab. Use action="stop" to stop it first.',
            );
          }

          const fps = normalizePositiveInt(args.fps, DEFAULT_FPS, 30);
          const durationMs = normalizePositiveInt(args.durationMs, DEFAULT_DURATION_MS, 60000);
          const maxFrames = normalizePositiveInt(args.maxFrames, DEFAULT_MAX_FRAMES, 300);
          const width = normalizePositiveInt(args.width, DEFAULT_WIDTH, 1920);
          const height = normalizePositiveInt(args.height, DEFAULT_HEIGHT, 1080);
          const maxColors = normalizePositiveInt(args.maxColors, DEFAULT_MAX_COLORS, 256);

          const result = await startRecording(
            tab.id,
            fps,
            durationMs,
            maxFrames,
            width,
            height,
            maxColors,
            args.filename,
          );

          if (result.success) {
            result.mode = 'fixed_fps';
          }

          return this.buildResponse(result);
        }

        case 'auto_start': {
          // Auto-capture mode: captures frames when tools succeed
          const tab = await this.resolveTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (this.isRestrictedUrl(tab.url)) {
            return createErrorResponse(
              'Cannot record special browser pages or web store pages due to security restrictions.',
            );
          }

          // Check if fixed-FPS recording is active
          if (recordingState?.isRecording && recordingState.tabId === tab.id) {
            return createErrorResponse(
              'Fixed-FPS recording is active for this tab. Use action="stop" to stop it first.',
            );
          }

          // Check if auto-capture is already active
          if (isAutoCaptureActive(tab.id)) {
            return createErrorResponse('Auto-capture is already active for this tab.');
          }

          const width = normalizePositiveInt(args.width, DEFAULT_WIDTH, 1920);
          const height = normalizePositiveInt(args.height, DEFAULT_HEIGHT, 1080);
          const maxColors = normalizePositiveInt(args.maxColors, DEFAULT_MAX_COLORS, 256);
          const maxFrames = normalizePositiveInt(args.maxFrames, 100, 300);
          const captureDelayMs = normalizePositiveInt(args.captureDelayMs, 150, 2000);
          const frameDelayCs = normalizePositiveInt(args.frameDelayCs, 20, 100);

          const startResult = await startAutoCapture(tab.id, {
            width,
            height,
            maxColors,
            maxFrames,
            captureDelayMs,
            frameDelayCs,
            enhancedRendering: args.enhancedRendering,
          });

          if (!startResult.success) {
            return this.buildResponse({
              success: false,
              action: 'auto_start',
              tabId: tab.id,
              error: startResult.error,
            });
          }

          // Store metadata for stop
          autoCaptureMetadata = {
            tabId: tab.id,
            filename: args.filename,
          };

          // Capture initial frame
          await captureInitialFrame(tab.id);

          return this.buildResponse({
            success: true,
            action: 'auto_start',
            tabId: tab.id,
            mode: 'auto_capture',
            isRecording: true,
          });
        }

        case 'capture': {
          // Manual frame capture in auto mode
          const tab = await this.resolveTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }

          if (!isAutoCaptureActive(tab.id)) {
            return createErrorResponse(
              'Auto-capture is not active for this tab. Use action="auto_start" first.',
            );
          }

          // Support optional annotation for manual captures
          const annotation =
            typeof args.annotation === 'string' && args.annotation.trim().length > 0
              ? args.annotation.trim()
              : undefined;

          const action: ActionMetadata | undefined = annotation
            ? { type: 'annotation', label: annotation }
            : undefined;

          const captureResult = await captureFrameOnAction(tab.id, action, true);

          return this.buildResponse({
            success: captureResult.success,
            action: 'capture',
            tabId: tab.id,
            frameCount: captureResult.frameNumber,
            error: captureResult.error,
          });
        }

        case 'stop': {
          // Stop either mode
          // Check auto-capture first
          const autoTab = autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            const stopResult = await stopAutoCapture(autoTab);
            const filename = autoCaptureMetadata?.filename;
            autoCaptureMetadata = null;

            if (!stopResult.success || !stopResult.gifData) {
              return this.buildResponse({
                success: false,
                action: 'stop',
                tabId: autoTab,
                mode: 'auto_capture',
                frameCount: stopResult.frameCount,
                durationMs: stopResult.durationMs,
                actionsCount: stopResult.actions?.length,
                error: stopResult.error || 'No GIF data generated',
              });
            }

            // Cache for later export
            lastRecordedGif = {
              gifData: stopResult.gifData,
              width: DEFAULT_WIDTH, // auto mode uses default dimensions
              height: DEFAULT_HEIGHT,
              frameCount: stopResult.frameCount ?? 0,
              durationMs: stopResult.durationMs ?? 0,
              tabId: autoTab,
              filename,
              actionsCount: stopResult.actions?.length,
              mode: 'auto_capture',
              createdAt: Date.now(),
            };

            // Save GIF file
            const blob = gifBytesToBlob(stopResult.gifData);
            const dataUrl = await blobToDataUrl(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const outputFilename =
              filename?.replace(/[^a-z0-9_-]/gi, '_') || `recording_${timestamp}`;
            const fullFilename = outputFilename.endsWith('.gif')
              ? outputFilename
              : `${outputFilename}.gif`;

            const downloadId = await chrome.downloads.download({
              url: dataUrl,
              filename: fullFilename,
              saveAs: false,
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            let fullPath: string | undefined;
            try {
              const [downloadItem] = await chrome.downloads.search({ id: downloadId });
              fullPath = downloadItem?.filename;
            } catch {
              // Ignore
            }

            return this.buildResponse({
              success: true,
              action: 'stop',
              tabId: autoTab,
              mode: 'auto_capture',
              frameCount: stopResult.frameCount,
              durationMs: stopResult.durationMs,
              byteLength: stopResult.gifData.byteLength,
              actionsCount: stopResult.actions?.length,
              downloadId,
              filename: fullFilename,
              fullPath,
            });
          }

          // Fall back to fixed-FPS stop
          const result = await stopRecording();
          if (result.success) {
            result.mode = 'fixed_fps';
          }
          return this.buildResponse(result);
        }

        case 'status': {
          // Check auto-capture status first
          const autoTab = autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            const status = getAutoCaptureStatus(autoTab);
            return this.buildResponse({
              success: true,
              action: 'status',
              tabId: autoTab,
              isRecording: status.active,
              mode: 'auto_capture',
              frameCount: status.frameCount,
              durationMs: status.durationMs,
              actionsCount: status.actionsCount,
            });
          }

          // Fall back to fixed-FPS status
          const result = getRecordingStatus();
          if (result.isRecording) {
            result.mode = 'fixed_fps';
          }
          return this.buildResponse(result);
        }

        case 'clear': {
          // Clear all recording state and cached GIF
          let clearedAuto = false;
          let clearedFixedFps = false;
          let clearedCache = false;

          // Stop auto-capture if active
          const autoTab = autoCaptureMetadata?.tabId;
          if (autoTab !== undefined && isAutoCaptureActive(autoTab)) {
            await stopAutoCapture(autoTab);
            autoCaptureMetadata = null;
            clearedAuto = true;
          }

          // Stop fixed-FPS recording if active or stopping
          if (recordingState) {
            const state = recordingState;
            const wasRecording = state.isRecording || state.isStopping;
            recordingState = null;
            stopPromise = null; // Clear any pending stop promise

            // Cancel timer and cleanup without waiting for finish
            if (state.captureTimer) {
              clearTimeout(state.captureTimer);
              state.captureTimer = null;
            }
            try {
              await cdpSessionManager.detach(state.tabId, CDP_SESSION_KEY);
            } catch {
              // ignore
            }
            if (wasRecording) {
              clearedFixedFps = true;
            }
          }

          // Reset offscreen encoder
          try {
            await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});
          } catch {
            // ignore
          }

          // Clear cached GIF
          if (lastRecordedGif) {
            lastRecordedGif = null;
            clearedCache = true;
          }

          return this.buildResponse({
            success: true,
            action: 'clear',
            clearedAutoCapture: clearedAuto,
            clearedFixedFps,
            clearedCache,
          } as GifResult);
        }

        case 'export': {
          // Export the last recorded GIF (download or drag&drop upload)

          // Check if cache is valid
          if (!lastRecordedGif) {
            return createErrorResponse(
              'No recorded GIF available for export. Use action="stop" to finish a recording first.',
            );
          }

          // Check cache expiration
          if (Date.now() - lastRecordedGif.createdAt > EXPORT_CACHE_LIFETIME_MS) {
            lastRecordedGif = null;
            return createErrorResponse('Cached GIF has expired. Please record a new GIF.');
          }

          const download = args.download !== false; // Default to download

          if (download) {
            // Download mode
            const blob = gifBytesToBlob(lastRecordedGif.gifData);
            const dataUrl = await blobToDataUrl(blob);

            const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
            const filename = args.filename ?? lastRecordedGif.filename;
            const outputFilename = filename?.replace(/[^a-z0-9_-]/gi, '_') || `export_${timestamp}`;
            const fullFilename = outputFilename.endsWith('.gif')
              ? outputFilename
              : `${outputFilename}.gif`;

            const downloadId = await chrome.downloads.download({
              url: dataUrl,
              filename: fullFilename,
              saveAs: false,
            });

            await new Promise((resolve) => setTimeout(resolve, 100));

            let fullPath: string | undefined;
            try {
              const [downloadItem] = await chrome.downloads.search({ id: downloadId });
              fullPath = downloadItem?.filename;
            } catch {
              // Ignore
            }

            return this.buildResponse({
              success: true,
              action: 'export',
              mode: lastRecordedGif.mode,
              frameCount: lastRecordedGif.frameCount,
              durationMs: lastRecordedGif.durationMs,
              byteLength: lastRecordedGif.gifData.byteLength,
              downloadId,
              filename: fullFilename,
              fullPath,
            });
          } else {
            // Drag&drop upload mode
            const { coordinates, ref, selector } = args;

            if (!coordinates && !ref && !selector) {
              return createErrorResponse(
                'For drag&drop upload, provide coordinates, ref, or selector to identify the drop target.',
              );
            }

            // Resolve target tab
            const tab = await this.resolveTargetTab(args.tabId);
            if (!tab?.id) {
              return createErrorResponse(
                typeof args.tabId === 'number'
                  ? `Tab not found: ${args.tabId}`
                  : 'No active tab found',
              );
            }

            // Security check
            if (this.isRestrictedUrl(tab.url)) {
              return createErrorResponse(
                'Cannot upload to special browser pages or web store pages.',
              );
            }

            // Prepare GIF data as base64
            const gifBase64 = btoa(
              Array.from(lastRecordedGif.gifData)
                .map((b) => String.fromCharCode(b))
                .join(''),
            );

            // Resolve drop target coordinates
            let targetX: number | undefined;
            let targetY: number | undefined;

            if (ref) {
              // Use the project's built-in ref resolution mechanism
              try {
                await this.injectContentScript(tab.id, [
                  'inject-scripts/accessibility-tree-helper.js',
                ]);
                const resolved = await this.sendMessageToTab(tab.id, {
                  action: TOOL_MESSAGE_TYPES.RESOLVE_REF,
                  ref,
                });
                if (resolved?.success && resolved.center) {
                  targetX = resolved.center.x;
                  targetY = resolved.center.y;
                } else {
                  return createErrorResponse(`Could not resolve ref: ${ref}`);
                }
              } catch (err) {
                return createErrorResponse(
                  `Failed to resolve ref: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            } else if (selector) {
              // Use executeScript to get element center coordinates by CSS selector
              try {
                const [result] = await chrome.scripting.executeScript({
                  target: { tabId: tab.id },
                  func: (cssSelector: string) => {
                    const el = document.querySelector(cssSelector);
                    if (!el) return null;
                    const rect = el.getBoundingClientRect();
                    return {
                      x: rect.left + rect.width / 2,
                      y: rect.top + rect.height / 2,
                    };
                  },
                  args: [selector],
                });

                if (result?.result) {
                  targetX = result.result.x;
                  targetY = result.result.y;
                } else {
                  return createErrorResponse(`Could not find element: ${selector}`);
                }
              } catch (err) {
                return createErrorResponse(
                  `Failed to resolve selector: ${err instanceof Error ? err.message : String(err)}`,
                );
              }
            } else if (coordinates) {
              targetX = coordinates.x;
              targetY = coordinates.y;
            }

            if (typeof targetX !== 'number' || typeof targetY !== 'number') {
              return createErrorResponse('Invalid drop target coordinates.');
            }

            // Execute drag&drop upload
            try {
              const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
              const filename =
                args.filename ?? lastRecordedGif.filename ?? `recording_${timestamp}`;
              const fullFilename = filename.endsWith('.gif') ? filename : `${filename}.gif`;

              const [result] = await chrome.scripting.executeScript({
                target: { tabId: tab.id },
                func: (base64Data: string, x: number, y: number, fname: string) => {
                  // Convert base64 to Blob
                  const byteChars = atob(base64Data);
                  const byteArray = new Uint8Array(byteChars.length);
                  for (let i = 0; i < byteChars.length; i++) {
                    byteArray[i] = byteChars.charCodeAt(i);
                  }
                  const blob = new Blob([byteArray], { type: 'image/gif' });
                  const file = new File([blob], fname, { type: 'image/gif' });

                  // Find drop target element
                  const target = document.elementFromPoint(x, y);
                  if (!target) {
                    return { success: false, error: 'No element at drop coordinates' };
                  }

                  // Create DataTransfer with the file
                  const dt = new DataTransfer();
                  dt.items.add(file);

                  // Dispatch drag events
                  const events = ['dragenter', 'dragover', 'drop'] as const;
                  for (const eventType of events) {
                    const evt = new DragEvent(eventType, {
                      bubbles: true,
                      cancelable: true,
                      dataTransfer: dt,
                      clientX: x,
                      clientY: y,
                    });
                    target.dispatchEvent(evt);
                  }

                  return {
                    success: true,
                    targetTagName: target.tagName,
                    targetId: target.id || undefined,
                  };
                },
                args: [gifBase64, targetX, targetY, fullFilename],
              });

              if (!result?.result?.success) {
                return createErrorResponse(result?.result?.error || 'Drag&drop upload failed');
              }

              return this.buildResponse({
                success: true,
                action: 'export',
                mode: lastRecordedGif.mode,
                frameCount: lastRecordedGif.frameCount,
                durationMs: lastRecordedGif.durationMs,
                byteLength: lastRecordedGif.gifData.byteLength,
                uploadTarget: {
                  x: targetX,
                  y: targetY,
                  tagName: result.result.targetTagName,
                  id: result.result.targetId,
                },
              } as GifResult);
            } catch (err) {
              return createErrorResponse(
                `Drag&drop upload failed: ${err instanceof Error ? err.message : String(err)}`,
              );
            }
          }
        }

        default:
          return createErrorResponse(`Unknown action: ${action}`);
      }
    } catch (error) {
      console.error('GifRecorderTool.execute error:', error);
      return createErrorResponse(
        `GIF recorder error: ${error instanceof Error ? error.message : String(error)}`,
      );
    }
  }

  private isRestrictedUrl(url?: string): boolean {
    if (!url) return false;
    return (
      url.startsWith('chrome://') ||
      url.startsWith('edge://') ||
      url.startsWith('https://chrome.google.com/webstore') ||
      url.startsWith('https://microsoftedge.microsoft.com/')
    );
  }

  private async resolveTargetTab(tabId?: number): Promise<chrome.tabs.Tab | null> {
    if (typeof tabId === 'number') {
      return this.tryGetTab(tabId);
    }
    try {
      return await this.getActiveTabOrThrow();
    } catch {
      return null;
    }
  }

  private buildResponse(result: GifResult): ToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(result) }],
      isError: !result.success,
    };
  }
}

export const gifRecorderTool = new GifRecorderTool();

// Re-export auto-capture utilities for use by other tools (e.g., chrome_computer, chrome_navigate)
export {
  captureFrameOnAction,
  isAutoCaptureActive,
  type ActionMetadata,
  type ActionType,
} from './gif-auto-capture';
