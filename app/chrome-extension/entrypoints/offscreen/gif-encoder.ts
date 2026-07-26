/**
 * GIF Encoder Module for Offscreen Document
 *
 * Handles GIF encoding using the gifenc library in the offscreen document context.
 * This module provides frame-by-frame GIF encoding with palette quantization.
 */

import { GIFEncoder, quantize, applyPalette } from 'gifenc';
import { MessageTarget, OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';

// ============================================================================
// Types
// ============================================================================

interface GifEncoderState {
  encoder: ReturnType<typeof GIFEncoder> | null;
  width: number;
  height: number;
  frameCount: number;
  isInitialized: boolean;
}

interface GifAddFrameMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME;
  imageData?: number[];
  imageDataUrl?: string;
  width: number;
  height: number;
  delay: number;
  maxColors?: number;
}

interface GifFinishMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.GIF_FINISH;
}

interface GifResetMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.GIF_RESET;
}

type GifMessage = GifAddFrameMessage | GifFinishMessage | GifResetMessage;

interface GifMessageResponse {
  success: boolean;
  error?: string;
  frameCount?: number;
  gifData?: number[];
  byteLength?: number;
}

// ============================================================================
// State
// ============================================================================

const state: GifEncoderState = {
  encoder: null,
  width: 0,
  height: 0,
  frameCount: 0,
  isInitialized: false,
};

// ============================================================================
// Handlers
// ============================================================================

function initializeEncoder(width: number, height: number): void {
  state.encoder = GIFEncoder();
  state.width = width;
  state.height = height;
  state.frameCount = 0;
  state.isInitialized = true;
}

function addFrame(
  imageData: Uint8ClampedArray,
  width: number,
  height: number,
  delayCs: number,
  maxColors: number = 256,
): void {
  // Initialize encoder on first frame
  if (!state.isInitialized || state.width !== width || state.height !== height) {
    initializeEncoder(width, height);
  }

  if (!state.encoder) {
    throw new Error('GIF encoder not initialized');
  }

  // Quantize colors to create palette
  const palette = quantize(imageData, maxColors, { format: 'rgb444' });

  // Map pixels to palette indices
  const indexedPixels = applyPalette(imageData, palette, 'rgb444');

  // Write frame to encoder
  state.encoder.writeFrame(indexedPixels, width, height, {
    palette,
    delay: Math.max(10, Math.round(delayCs * 10)),
    dispose: 2, // Restore to background color
  });

  state.frameCount++;
}

async function addFrameFromDataUrl(
  imageDataUrl: string,
  width: number,
  height: number,
  delay: number,
  maxColors: number = 256,
): Promise<void> {
  const response = await fetch(imageDataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  const canvas = new OffscreenCanvas(width, height);
  const ctx = canvas.getContext('2d');
  if (!ctx) {
    bitmap.close();
    throw new Error('Failed to get offscreen canvas context');
  }

  ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const imageData = ctx.getImageData(0, 0, width, height);
  addFrame(imageData.data, width, height, delay, maxColors);
}

function finishEncoding(): Uint8Array {
  if (!state.encoder) {
    throw new Error('GIF encoder not initialized');
  }

  state.encoder.finish();
  const bytes = state.encoder.bytes();

  // Reset state after finishing
  resetEncoder();

  return bytes;
}

function resetEncoder(): void {
  if (state.encoder) {
    state.encoder.reset();
  }
  state.encoder = null;
  state.width = 0;
  state.height = 0;
  state.frameCount = 0;
  state.isInitialized = false;
}

// ============================================================================
// Message Handler
// ============================================================================

function isGifMessage(message: unknown): message is GifMessage {
  if (!message || typeof message !== 'object') return false;
  const msg = message as Record<string, unknown>;
  if (msg.target !== MessageTarget.Offscreen) return false;

  const gifTypes = [
    OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME,
    OFFSCREEN_MESSAGE_TYPES.GIF_FINISH,
    OFFSCREEN_MESSAGE_TYPES.GIF_RESET,
  ];

  return typeof msg.type === 'string' && gifTypes.includes(msg.type as GifMessage['type']);
}

export function handleGifMessage(
  message: unknown,
  sendResponse: (response: GifMessageResponse) => void,
): boolean {
  if (!isGifMessage(message)) {
    return false;
  }

  try {
    switch (message.type) {
      case OFFSCREEN_MESSAGE_TYPES.GIF_ADD_FRAME: {
        const { imageData, imageDataUrl, width, height, delay, maxColors } = message;
        if (typeof imageDataUrl === 'string' && imageDataUrl.length > 0) {
          void addFrameFromDataUrl(imageDataUrl, width, height, delay, maxColors)
            .then(() => {
              sendResponse({
                success: true,
                frameCount: state.frameCount,
              });
            })
            .catch((error) => {
              const errorMessage = error instanceof Error ? error.message : String(error);
              console.error('GIF encoder error:', errorMessage);
              sendResponse({ success: false, error: errorMessage });
            });
          return true;
        }

        if (!Array.isArray(imageData)) {
          sendResponse({
            success: false,
            error: 'GIF_ADD_FRAME requires imageData or imageDataUrl',
          });
          break;
        }

        const clampedData = new Uint8ClampedArray(imageData);
        addFrame(clampedData, width, height, delay, maxColors);
        sendResponse({
          success: true,
          frameCount: state.frameCount,
        });
        break;
      }

      case OFFSCREEN_MESSAGE_TYPES.GIF_FINISH: {
        const gifBytes = finishEncoding();
        sendResponse({
          success: true,
          gifData: Array.from(gifBytes),
          byteLength: gifBytes.byteLength,
        });
        break;
      }

      case OFFSCREEN_MESSAGE_TYPES.GIF_RESET: {
        resetEncoder();
        sendResponse({ success: true });
        break;
      }

      default:
        sendResponse({ success: false, error: `Unknown GIF message type` });
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    console.error('GIF encoder error:', errorMessage);
    sendResponse({ success: false, error: errorMessage });
  }

  return true;
}

console.log('GIF encoder module loaded');
