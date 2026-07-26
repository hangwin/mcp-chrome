/**
 * WebM Encoder for Offscreen Document
 *
 * Uses canvas.captureStream + MediaRecorder to encode product demo videos.
 */

import { MessageTarget, OFFSCREEN_MESSAGE_TYPES } from '@/common/message-types';

interface DemoEncoderState {
  canvas: HTMLCanvasElement | null;
  ctx: CanvasRenderingContext2D | null;
  track: MediaStreamTrack | null;
  recorder: MediaRecorder | null;
  chunks: Blob[];
  width: number;
  height: number;
  frameCount: number;
  started: boolean;
}

interface DemoStartMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.DEMO_START;
  width: number;
  height: number;
  fps: number;
  mimeType?: string;
  videoBitsPerSecond?: number;
}

interface DemoAddFrameMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.DEMO_ADD_FRAME;
  imageDataUrl: string;
  width: number;
  height: number;
}

interface DemoFinishMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.DEMO_FINISH;
}

interface DemoResetMessage {
  target: MessageTarget;
  type: typeof OFFSCREEN_MESSAGE_TYPES.DEMO_RESET;
}

type DemoMessage = DemoStartMessage | DemoAddFrameMessage | DemoFinishMessage | DemoResetMessage;

interface DemoMessageResponse {
  success: boolean;
  error?: string;
  frameCount?: number;
  mimeType?: string;
  byteLength?: number;
  /** base64-encoded WebM without data: prefix */
  webmBase64?: string;
}

const state: DemoEncoderState = {
  canvas: null,
  ctx: null,
  track: null,
  recorder: null,
  chunks: [],
  width: 0,
  height: 0,
  frameCount: 0,
  started: false,
};

function pickMimeType(preferred?: string): string {
  // Prefer VP8 for product demos: Chrome's VP9 MediaRecorder often looks soft on UI text.
  const candidates = [
    preferred,
    'video/webm;codecs=vp8',
    'video/webm;codecs=vp9',
    'video/webm',
  ].filter(Boolean) as string[];

  for (const type of candidates) {
    if (typeof MediaRecorder !== 'undefined' && MediaRecorder.isTypeSupported(type)) {
      return type;
    }
  }
  return 'video/webm';
}

function resetEncoder(): void {
  try {
    if (state.recorder && state.recorder.state !== 'inactive') {
      state.recorder.stop();
    }
  } catch {
    // ignore
  }
  try {
    state.track?.stop();
  } catch {
    // ignore
  }
  try {
    state.canvas?.remove();
  } catch {
    // ignore
  }
  state.canvas = null;
  state.ctx = null;
  state.track = null;
  state.recorder = null;
  state.chunks = [];
  state.width = 0;
  state.height = 0;
  state.frameCount = 0;
  state.started = false;
}

function startEncoder(
  width: number,
  height: number,
  fps: number,
  mimeType?: string,
  videoBitsPerSecond = 8_000_000,
): string {
  resetEncoder();

  // Use an HTMLCanvasElement in the offscreen document DOM.
  // OffscreenCanvas.captureStream is not available in this context.
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  // Keep it out of layout but attached so captureStream stays alive.
  canvas.style.cssText = 'position:fixed;left:-99999px;top:0;width:1px;height:1px;opacity:0;';
  document.documentElement.appendChild(canvas);

  const ctx = canvas.getContext('2d', { alpha: false, desynchronized: true });
  if (!ctx) {
    throw new Error('Failed to create 2D canvas context for WebM encoding');
  }

  // Fill black so the first encoded frame is never empty.
  ctx.fillStyle = '#000';
  ctx.fillRect(0, 0, width, height);

  const mediaStream = canvas.captureStream(0);
  if (!mediaStream) {
    throw new Error('HTMLCanvasElement.captureStream is not available in this browser');
  }

  const track = mediaStream.getVideoTracks()[0] || null;
  const selectedMime = pickMimeType(mimeType);
  const bitRate = Math.max(4_000_000, Math.floor(videoBitsPerSecond || 12_000_000));
  const recorder = new MediaRecorder(mediaStream, {
    mimeType: selectedMime,
    videoBitsPerSecond: bitRate,
    // Some Chromium builds honor bitsPerSecond more consistently than videoBitsPerSecond alone.
    bitsPerSecond: bitRate,
  } as MediaRecorderOptions);

  const chunks: Blob[] = [];
  recorder.ondataavailable = (event: BlobEvent) => {
    if (event.data && event.data.size > 0) {
      chunks.push(event.data);
    }
  };

  recorder.start(250);

  state.canvas = canvas;
  state.ctx = ctx;
  state.track = track;
  state.recorder = recorder;
  state.chunks = chunks;
  state.width = width;
  state.height = height;
  state.frameCount = 0;
  state.started = true;

  // Keep fps around for callers that may want pacing; requestFrame drives timing.
  void fps;
  return selectedMime;
}

async function addFrame(imageDataUrl: string, width: number, height: number): Promise<void> {
  if (!state.started || !state.ctx || !state.canvas) {
    throw new Error('Demo WebM encoder is not started');
  }
  if (width !== state.width || height !== state.height) {
    throw new Error(
      `Frame size mismatch: got ${width}x${height}, expected ${state.width}x${state.height}`,
    );
  }

  const response = await fetch(imageDataUrl);
  const blob = await response.blob();
  const bitmap = await createImageBitmap(blob);
  state.ctx.imageSmoothingEnabled = true;
  state.ctx.imageSmoothingQuality = 'high';
  state.ctx.clearRect(0, 0, width, height);
  state.ctx.drawImage(bitmap, 0, 0, width, height);
  bitmap.close();

  const trackWithRequest = state.track as MediaStreamTrack & {
    requestFrame?: () => void;
  };
  trackWithRequest.requestFrame?.();

  state.frameCount += 1;
}

async function finishEncoder(): Promise<{
  webmBase64: string;
  byteLength: number;
  mimeType: string;
  frameCount: number;
}> {
  if (!state.started || !state.recorder) {
    throw new Error('Demo WebM encoder is not started');
  }

  const recorder = state.recorder;
  const mimeType = recorder.mimeType || 'video/webm';
  const frameCount = state.frameCount;

  const blob: Blob = await new Promise((resolve, reject) => {
    const timeout = setTimeout(
      () => reject(new Error('Timed out finishing WebM recording')),
      15000,
    );

    recorder.onerror = () => {
      clearTimeout(timeout);
      reject(new Error('MediaRecorder error while finishing WebM'));
    };

    recorder.onstop = () => {
      clearTimeout(timeout);
      resolve(new Blob(state.chunks, { type: mimeType }));
    };

    try {
      if (recorder.state === 'recording') {
        recorder.requestData?.();
        recorder.stop();
      } else {
        clearTimeout(timeout);
        resolve(new Blob(state.chunks, { type: mimeType }));
      }
    } catch (error) {
      clearTimeout(timeout);
      reject(error);
    }
  });

  const buffer = await blob.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(i, i + chunkSize));
  }
  const webmBase64 = btoa(binary);

  resetEncoder();

  return {
    webmBase64,
    byteLength: bytes.byteLength,
    mimeType,
    frameCount,
  };
}

export function handleDemoMessage(
  message: { target?: string; type?: string },
  sendResponse: (response: DemoMessageResponse) => void,
): boolean {
  if (message.target !== MessageTarget.Offscreen) {
    return false;
  }

  const type = message.type;
  if (
    type !== OFFSCREEN_MESSAGE_TYPES.DEMO_START &&
    type !== OFFSCREEN_MESSAGE_TYPES.DEMO_ADD_FRAME &&
    type !== OFFSCREEN_MESSAGE_TYPES.DEMO_FINISH &&
    type !== OFFSCREEN_MESSAGE_TYPES.DEMO_RESET
  ) {
    return false;
  }

  const demoMessage = message as DemoMessage;

  (async () => {
    try {
      switch (demoMessage.type) {
        case OFFSCREEN_MESSAGE_TYPES.DEMO_START: {
          const mimeType = startEncoder(
            demoMessage.width,
            demoMessage.height,
            demoMessage.fps,
            demoMessage.mimeType,
            demoMessage.videoBitsPerSecond,
          );
          sendResponse({ success: true, mimeType, frameCount: 0 });
          break;
        }
        case OFFSCREEN_MESSAGE_TYPES.DEMO_ADD_FRAME: {
          await addFrame(demoMessage.imageDataUrl, demoMessage.width, demoMessage.height);
          sendResponse({ success: true, frameCount: state.frameCount });
          break;
        }
        case OFFSCREEN_MESSAGE_TYPES.DEMO_FINISH: {
          const result = await finishEncoder();
          sendResponse({
            success: true,
            webmBase64: result.webmBase64,
            byteLength: result.byteLength,
            mimeType: result.mimeType,
            frameCount: result.frameCount,
          });
          break;
        }
        case OFFSCREEN_MESSAGE_TYPES.DEMO_RESET: {
          resetEncoder();
          sendResponse({ success: true, frameCount: 0 });
          break;
        }
      }
    } catch (error) {
      sendResponse({
        success: false,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  })();

  return true;
}
