/**
 * GIF Auto-Capture Hook System
 *
 * Provides automatic frame capture for GIF recording when browser actions succeed.
 * Tools like chrome_computer and chrome_navigate can trigger frame captures
 * after successful operations, creating smooth recordings of user interactions.
 *
 * Architecture:
 * - Centralized capture manager with per-tab recording state
 * - Hooks can be registered/unregistered per tab
 * - Configurable capture delay for UI stabilization
 * - Enhanced rendering overlays (click indicators, drag paths, labels)
 */

import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { OFFSCREEN_MESSAGE_TYPES, MessageTarget } from '@/common/message-types';
import { offscreenManager } from '@/utils/offscreen-manager';
import { createImageBitmapFromUrl } from '@/utils/image-utils';
import {
  pruneActionEventsInPlace,
  renderGifEnhancedOverlays,
  resolveCapturePlanForAction,
  resolveGifEnhancedRenderingConfig,
  type ActionEvent,
  type ActionMetadata,
  type ActionType,
  type GifEnhancedRenderingConfig,
  type ResolvedGifEnhancedRenderingConfig,
} from './gif-enhanced-renderer';

// Re-export types for consumers
export type {
  ActionMetadata,
  ActionType,
  GifEnhancedRenderingConfig,
} from './gif-enhanced-renderer';

// ============================================================================
// Constants
// ============================================================================

const CDP_SESSION_KEY = 'gif-auto-capture';
const DEFAULT_CAPTURE_DELAY_MS = 150;
const DEFAULT_WIDTH = 800;
const DEFAULT_HEIGHT = 600;
const DEFAULT_FRAME_DELAY_CS = 20; // 20 centiseconds = 200ms per frame
const DEFAULT_MAX_COLORS = 256;

// ============================================================================
// Types
// ============================================================================

export interface AutoCaptureConfig {
  width: number;
  height: number;
  maxColors: number;
  frameDelayCs: number;
  captureDelayMs: number;
  maxFrames: number;
  enhancedRendering?: GifEnhancedRenderingConfig;
}

interface TabCaptureState {
  tabId: number;
  config: AutoCaptureConfig;
  rendering: ResolvedGifEnhancedRenderingConfig;
  frameCount: number;
  startTime: number;
  canvas: OffscreenCanvas;
  ctx: OffscreenCanvasRenderingContext2D;
  pendingCapture: Promise<void> | null;
  actions: ActionMetadata[];
  actionEvents: ActionEvent[];
  lastViewportWidth: number;
  lastViewportHeight: number;
}

// ============================================================================
// State Management
// ============================================================================

const tabStates = new Map<number, TabCaptureState>();

// ============================================================================
// Utilities
// ============================================================================

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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

function normalizeActionMetadata(action: ActionMetadata, atMs: number): ActionMetadata {
  const normalized: ActionMetadata = {
    ...action,
    timestampMs: atMs,
    coordinateSpace: action.coordinateSpace ?? 'viewport',
  };

  // For drag, treat `coordinates` as end position (legacy) and also populate `endCoordinates`
  if (normalized.type === 'drag') {
    const end = normalized.endCoordinates ?? normalized.coordinates;
    if (end) {
      normalized.endCoordinates = end;
      normalized.coordinates = end;
    }
  }

  return normalized;
}

// ============================================================================
// Offscreen Communication
// ============================================================================

async function sendToOffscreen<T extends { success: boolean; error?: string }>(
  type: string,
  payload: Record<string, unknown> = {},
): Promise<T> {
  await offscreenManager.ensureOffscreenDocument();

  const response = (await chrome.runtime.sendMessage({
    target: MessageTarget.Offscreen,
    type,
    ...payload,
  })) as T | undefined;

  if (!response) {
    throw new Error('No response from offscreen document');
  }
  if (!response.success) {
    throw new Error(response.error || 'Unknown offscreen error');
  }

  return response;
}

// ============================================================================
// Frame Capture
// ============================================================================

async function captureFrameData(tabId: number, state: TabCaptureState): Promise<string> {
  const width = state.config.width;
  const height = state.config.height;
  const ctx = state.ctx;

  // Get viewport metrics
  const metrics: { layoutViewport?: { clientWidth: number; clientHeight: number } } =
    await cdpSessionManager.sendCommand(tabId, 'Page.getLayoutMetrics', {});

  const viewportWidth = metrics.layoutViewport?.clientWidth || width;
  const viewportHeight = metrics.layoutViewport?.clientHeight || height;

  // Store viewport dimensions for coordinate projection
  state.lastViewportWidth = viewportWidth;
  state.lastViewportHeight = viewportHeight;

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

  // Scale to target dimensions
  ctx.clearRect(0, 0, width, height);
  ctx.drawImage(imageBitmap, 0, 0, width, height);
  imageBitmap.close();

  // Apply enhanced rendering overlays
  if (state.rendering.enabled) {
    const nowMs = Date.now();
    renderGifEnhancedOverlays({
      ctx,
      outputWidth: width,
      outputHeight: height,
      viewportWidth,
      viewportHeight,
      nowMs,
      events: state.actionEvents,
      config: state.rendering,
    });
    pruneActionEventsInPlace(state.actionEvents, nowMs, state.rendering);
  }

  const blob = await ctx.canvas.convertToBlob({ type: 'image/png' });
  return blobToDataUrl(blob);
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('Failed to read blob'));
    reader.readAsDataURL(blob);
  });
}

// ============================================================================
// Public API
// ============================================================================

/**
 * Start auto-capture for a tab. This initializes the GIF encoder
 * and prepares for automatic frame capture on tool actions.
 */
export async function startAutoCapture(
  tabId: number,
  config?: Partial<AutoCaptureConfig>,
): Promise<{ success: boolean; error?: string }> {
  if (tabStates.has(tabId)) {
    return { success: false, error: 'Auto-capture already active for this tab' };
  }

  const finalConfig: AutoCaptureConfig = {
    width: config?.width ?? DEFAULT_WIDTH,
    height: config?.height ?? DEFAULT_HEIGHT,
    maxColors: config?.maxColors ?? DEFAULT_MAX_COLORS,
    frameDelayCs: config?.frameDelayCs ?? DEFAULT_FRAME_DELAY_CS,
    captureDelayMs: config?.captureDelayMs ?? DEFAULT_CAPTURE_DELAY_MS,
    maxFrames: config?.maxFrames ?? 100,
    enhancedRendering: config?.enhancedRendering,
  };

  try {
    // Attach CDP session
    await cdpSessionManager.attach(tabId, CDP_SESSION_KEY);

    // Reset offscreen encoder
    await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_RESET, {});

    // Create canvas
    if (typeof OffscreenCanvas === 'undefined') {
      throw new Error('OffscreenCanvas not available');
    }

    const canvas = new OffscreenCanvas(finalConfig.width, finalConfig.height);
    const ctx = canvas.getContext('2d');
    if (!ctx) {
      throw new Error('Failed to get canvas context');
    }

    const state: TabCaptureState = {
      tabId,
      config: finalConfig,
      rendering: resolveGifEnhancedRenderingConfig(finalConfig.enhancedRendering),
      frameCount: 0,
      startTime: Date.now(),
      canvas,
      ctx,
      pendingCapture: null,
      actions: [],
      actionEvents: [],
      lastViewportWidth: finalConfig.width,
      lastViewportHeight: finalConfig.height,
    };

    tabStates.set(tabId, state);

    return { success: true };
  } catch (error) {
    // Cleanup on failure
    try {
      await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
    } catch {
      // Ignore
    }

    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}

/**
 * Stop auto-capture and finalize the GIF.
 * Returns the GIF data for saving/downloading.
 */
export async function stopAutoCapture(tabId: number): Promise<{
  success: boolean;
  gifData?: Uint8Array;
  frameCount?: number;
  durationMs?: number;
  actions?: ActionMetadata[];
  error?: string;
}> {
  const state = tabStates.get(tabId);
  if (!state) {
    return { success: false, error: 'No auto-capture active for this tab' };
  }

  try {
    // Wait for any pending capture
    if (state.pendingCapture) {
      await withTimeout(state.pendingCapture, 5000, 'Timed out waiting for pending GIF capture');
    }

    const frameCount = state.frameCount;
    const durationMs = Date.now() - state.startTime;
    const actions = [...state.actions];

    if (frameCount === 0) {
      return {
        success: false,
        error: 'No frames captured',
        frameCount: 0,
        durationMs,
        actions,
      };
    }

    // Finalize GIF
    const response = await withTimeout(
      sendToOffscreen<{
        success: boolean;
        gifData?: number[];
        byteLength?: number;
        error?: string;
      }>(OFFSCREEN_MESSAGE_TYPES.GIF_FINISH, {}),
      20000,
      'Timed out finishing GIF encoding',
    );

    if (!response || !response.gifData || response.gifData.length === 0) {
      return {
        success: false,
        error: 'Failed to encode GIF',
        frameCount,
        durationMs,
        actions,
      };
    }

    return {
      success: true,
      gifData: new Uint8Array(response.gifData),
      frameCount,
      durationMs,
      actions,
    };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Cleanup
    tabStates.delete(tabId);
    try {
      await cdpSessionManager.detach(tabId, CDP_SESSION_KEY);
    } catch {
      // Ignore
    }
  }
}

/**
 * Check if auto-capture is active for a tab.
 */
export function isAutoCaptureActive(tabId: number): boolean {
  return tabStates.has(tabId);
}

/**
 * Get current auto-capture status for a tab.
 */
export function getAutoCaptureStatus(tabId: number): {
  active: boolean;
  frameCount?: number;
  durationMs?: number;
  actionsCount?: number;
  enhancedRenderingEnabled?: boolean;
} {
  const state = tabStates.get(tabId);
  if (!state) {
    return { active: false };
  }

  return {
    active: true,
    frameCount: state.frameCount,
    durationMs: Date.now() - state.startTime,
    actionsCount: state.actions.length,
    enhancedRenderingEnabled: state.rendering.enabled,
  };
}

/**
 * Trigger a frame capture after a successful action.
 * This is the main hook that tools should call.
 *
 * @param tabId - The tab to capture
 * @param action - Optional action metadata for overlay rendering
 * @param immediate - If true, capture immediately without delay
 */
export async function captureFrameOnAction(
  tabId: number,
  action?: ActionMetadata,
  immediate = false,
): Promise<{ success: boolean; frameNumber?: number; error?: string }> {
  const state = tabStates.get(tabId);
  if (!state) {
    // No auto-capture active - silently succeed (tools shouldn't fail because recording isn't active)
    return { success: true };
  }

  // Check frame limit
  if (state.frameCount >= state.config.maxFrames) {
    return { success: false, error: 'Max frame limit reached' };
  }

  // Wait for any pending capture to complete
  if (state.pendingCapture) {
    try {
      await state.pendingCapture;
    } catch {
      // Ignore errors from previous capture
    }
  }

  // Verify state still exists (might have been stopped while awaiting)
  const currentState = tabStates.get(tabId);
  if (!currentState) {
    return { success: true };
  }

  // Calculate delay for UI stabilization
  const delayMs = immediate ? 0 : currentState.config.captureDelayMs;

  // Normalize and record action metadata
  let normalizedAction: ActionMetadata | undefined;
  if (action) {
    const atMs = Date.now() + delayMs;
    normalizedAction = normalizeActionMetadata(action, atMs);
    currentState.actions.push(normalizedAction);
    currentState.actionEvents.push({ action: normalizedAction, atMs });
  }

  // Determine capture plan (may involve multiple frames for click animations)
  const plan = resolveCapturePlanForAction(
    currentState.rendering,
    normalizedAction,
    currentState.config.frameDelayCs,
  );

  const capturePromise = (async () => {
    if (delayMs > 0) await sleep(delayMs);

    for (let i = 0; i < plan.frames; i++) {
      const activeState = tabStates.get(tabId);
      if (!activeState) return;

      if (activeState.frameCount >= activeState.config.maxFrames) return;

      try {
        const frameDataUrl = await captureFrameData(tabId, activeState);

        // Use animation delay for intermediate frames, regular delay for final frame
        const delayCs = i < plan.frames - 1 ? plan.delayCs : activeState.config.frameDelayCs;

        await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME, {
          imageDataUrl: frameDataUrl,
          width: activeState.config.width,
          height: activeState.config.height,
          delay: delayCs,
          maxColors: activeState.config.maxColors,
        });

        activeState.frameCount += 1;
      } catch (error) {
        console.error('[GIF Auto-Capture] Frame capture failed:', error);
        return;
      }

      // Wait between animation frames
      if (i < plan.frames - 1 && plan.intervalMs > 0) {
        await sleep(plan.intervalMs);
      }
    }
  })();

  state.pendingCapture = capturePromise;

  try {
    await capturePromise;
    return { success: true, frameNumber: state.frameCount };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  } finally {
    // Clean up reference to avoid holding completed Promise
    const currentState = tabStates.get(tabId);
    if (currentState?.pendingCapture === capturePromise) {
      currentState.pendingCapture = null;
    }
  }
}

/**
 * Capture an initial frame immediately (useful for recording start state).
 */
export async function captureInitialFrame(
  tabId: number,
): Promise<{ success: boolean; error?: string }> {
  return captureFrameOnAction(tabId, undefined, true);
}

/**
 * Clear all auto-capture state (useful for cleanup).
 */
export async function clearAllAutoCapture(): Promise<void> {
  const tabIds = Array.from(tabStates.keys());
  for (const tabId of tabIds) {
    try {
      await stopAutoCapture(tabId);
    } catch {
      // Ignore errors during cleanup
      tabStates.delete(tabId);
    }
  }
}
