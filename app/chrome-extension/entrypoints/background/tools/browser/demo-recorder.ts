/**
 * Product Demo Recorder
 *
 * Records agent-driven product walkthroughs as WebM with step overlays
 * (title banner + narration caption) and a step timeline for later subtitles.
 */

import { createErrorResponse, ToolResult } from '@/common/tool-handler';
import { BaseBrowserToolExecutor } from '../base-browser';
import { TOOL_NAMES } from 'agent-chrome-mcp-shared';
import {
  MessageTarget,
  OFFSCREEN_MESSAGE_TYPES,
  OffscreenMessageType,
} from '@/common/message-types';
import { cdpSessionManager } from '@/utils/cdp-session-manager';
import { offscreenManager } from '@/utils/offscreen-manager';
import { createImageBitmapFromUrl } from '@/utils/image-utils';
import {
  type ActionEvent,
  type ActionMetadata,
  pruneActionEventsInPlace,
  renderGifEnhancedOverlays,
  resolveCapturePlanForAction,
  resolveGifEnhancedRenderingConfig,
} from './gif-enhanced-renderer';

const CDP_SESSION_KEY = 'demo-recorder';

/** Brand UI font (matches agentchromemcp.com Archivo) + CJK fallbacks. */
const DEMO_UI_FONT =
  '"Archivo", "PingFang SC", "Hiragino Sans GB", "Noto Sans SC", "Microsoft YaHei", "Segoe UI", sans-serif';

/** Keep captions above typical video-player scrubber chrome (~10–12% of frame). */
const NARRATION_BOTTOM_SAFE_RATIO = 0.12;
/** Keep step titles below typical site nav/header (~9% of frame ≈ 64px @720p). */
const TITLE_TOP_SAFE_RATIO = 0.09;

let demoFontsReady: Promise<void> | null = null;

async function ensureDemoFonts(): Promise<void> {
  if (demoFontsReady) return demoFontsReady;
  demoFontsReady = (async () => {
    const fontSet = (globalThis as unknown as { fonts?: FontFaceSet }).fonts;
    if (!fontSet || typeof FontFace === 'undefined') return;
    const base = chrome.runtime.getURL('fonts/');
    const specs: Array<{ file: string; weight: string }> = [
      { file: 'Archivo-500.woff2', weight: '500' },
      { file: 'Archivo-600.woff2', weight: '600' },
      { file: 'Archivo-700.woff2', weight: '700' },
    ];
    await Promise.all(
      specs.map(async ({ file, weight }) => {
        try {
          const face = new FontFace('Archivo', `url(${base}${file})`, {
            weight,
            style: 'normal',
            display: 'swap',
          });
          const loaded = await face.load();
          fontSet.add(loaded);
        } catch (error) {
          console.warn('[DemoRecorder] failed to load Archivo', weight, error);
        }
      }),
    );
  })();
  return demoFontsReady;
}

function demoFont(weight: number | string, sizePx: number): string {
  return `${weight} ${sizePx}px ${DEMO_UI_FONT}`;
}

/**
 * Archivo's `&` glyph reads oddly at overlay sizes (heavy / off-baseline).
 * Prefer plain "and" for titles and captions.
 */
function normalizeOverlayText(text: string): string {
  return text
    .replace(/\s*&\s*/g, ' and ')
    .replace(/\s{2,}/g, ' ')
    .trim();
}

/** Default click/drag overlays for product demos (visible ripple + path). */
const DEMO_RENDERING = resolveGifEnhancedRenderingConfig({
  enabled: true,
  clickIndicators: {
    enabled: true,
    color: '#FF3B30',
    fillColor: 'rgba(255, 59, 48, 0.35)',
    radiusPx: 28,
    lineWidthPx: 4,
    durationMs: 900,
    animationFrames: 4,
    animationIntervalMs: 70,
    animationFrameDelayCs: 7,
  },
  dragPaths: {
    enabled: true,
    color: '#FF9500',
    lineWidthPx: 3,
    durationMs: 1200,
  },
  // Clicks keep the ripple indicator only — no text "旁白" labels on click/drag.
  labels: {
    enabled: false,
    mode: 'both',
    showForClicks: false,
    maxLength: 40,
    durationMs: 1000,
  },
});

type DemoAction = 'start' | 'step' | 'stop' | 'status' | 'clear';
type DemoPreset = 'product' | 'compact';

/** Agent-controlled overlay slot. `none` hides that overlay. */
type OverlaySlot =
  | 'top'
  | 'bottom'
  | 'center'
  | 'top-left'
  | 'top-right'
  | 'bottom-left'
  | 'bottom-right'
  | 'none';

type OverlayTheme = 'light' | 'dark';
/** Narration rendering: shadow = readable text without a panel; box = filled caption. */
type CaptionStyle = 'shadow' | 'box';
/** Title rendering: shadow = no panel (won't cover site nav); pill = compact chip; banner = full-width bar. */
type TitleStyle = 'shadow' | 'pill' | 'banner';

const OVERLAY_SLOTS: OverlaySlot[] = [
  'top',
  'bottom',
  'center',
  'top-left',
  'top-right',
  'bottom-left',
  'bottom-right',
  'none',
];

interface OverlayLayout {
  titlePosition: OverlaySlot;
  narrationPosition: OverlaySlot;
  /** Overlay chrome theme. Default: light (readable on product UIs). */
  theme: OverlayTheme;
  /** How to render narration. Default: shadow (no background panel). */
  captionStyle: CaptionStyle;
  /** How to render title. Default: shadow (does not cover site nav). */
  titleStyle: TitleStyle;
  /** Optional 0–1 frame fraction; overrides slot X when set. */
  titleX?: number;
  /** Optional 0–1 frame fraction; overrides slot Y when set. */
  titleY?: number;
  narrationX?: number;
  narrationY?: number;
}

interface DemoRecorderParams {
  action: DemoAction;
  tabId?: number;
  preset?: DemoPreset;
  title?: string;
  narration?: string;
  holdMs?: number;
  fps?: number;
  width?: number;
  height?: number;
  maxDurationMs?: number;
  filename?: string;
  /** Where to draw the step/demo title (default: top). */
  titlePosition?: OverlaySlot;
  /** Where to draw narration (default: bottom). */
  narrationPosition?: OverlaySlot;
  /** Overlay panel theme: light (default) or dark. */
  overlayTheme?: OverlayTheme;
  /** Narration style: shadow (default, no box) or box. */
  captionStyle?: CaptionStyle;
  /** Title style: shadow (default, no bar over nav), pill, or banner (full-width). */
  titleStyle?: TitleStyle;
  /** 0–1 horizontal position override for title box. */
  titleX?: number;
  /** 0–1 vertical position override for title box. */
  titleY?: number;
  /** 0–1 horizontal position override for narration box. */
  narrationX?: number;
  /** 0–1 vertical position override for narration box. */
  narrationY?: number;
}

interface DemoStep {
  index: number;
  title: string;
  narration: string;
  startMs: number;
  endMs?: number;
  layout?: OverlayLayout;
}

interface DemoOverlay {
  demoTitle: string;
  stepTitle: string;
  narration: string;
  layout: OverlayLayout;
}

interface DemoSession {
  tabId: number;
  width: number;
  height: number;
  fps: number;
  videoBitsPerSecond: number;
  maxDurationMs: number;
  filename?: string;
  startTime: number;
  frameCount: number;
  captureTimer: ReturnType<typeof setTimeout> | null;
  pendingCapture: Promise<void> | null;
  stopping: boolean;
  overlay: DemoOverlay;
  steps: DemoStep[];
  actionEvents: ActionEvent[];
  viewportWidth: number;
  viewportHeight: number;
  mimeType?: string;
}

type OffscreenResponseBase = { success: boolean; error?: string };

interface DemoFinishResponse extends OffscreenResponseBase {
  webmBase64?: string;
  byteLength?: number;
  mimeType?: string;
  frameCount?: number;
}

const PRESETS: Record<
  DemoPreset,
  { width: number; height: number; fps: number; maxDurationMs: number; videoBitsPerSecond: number }
> = {
  // Higher bitrates — Chrome MediaRecorder often undershoots; UI text needs headroom.
  product: {
    width: 1920,
    height: 1080,
    fps: 15,
    maxDurationMs: 180_000,
    videoBitsPerSecond: 24_000_000,
  },
  compact: {
    width: 1280,
    height: 720,
    fps: 12,
    maxDurationMs: 120_000,
    videoBitsPerSecond: 12_000_000,
  },
};

let session: DemoSession | null = null;

function normalizePositiveInt(value: unknown, fallback: number, max?: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  const result = Math.max(1, Math.floor(value));
  return max !== undefined ? Math.min(result, max) : result;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function parseOverlaySlot(value: unknown, fallback: OverlaySlot): OverlaySlot {
  if (typeof value === 'string' && (OVERLAY_SLOTS as string[]).includes(value)) {
    return value as OverlaySlot;
  }
  return fallback;
}

/** Accept 0–1 frame fraction; ignore invalid. */
function parseFraction(value: unknown): number | undefined {
  if (typeof value !== 'number' || !Number.isFinite(value)) return undefined;
  return Math.min(1, Math.max(0, value));
}

function defaultOverlayLayout(): OverlayLayout {
  return {
    titlePosition: 'top',
    narrationPosition: 'bottom',
    theme: 'light',
    // Pill + caption box read clearly on product UIs; bare shadow text looks weak.
    captionStyle: 'box',
    titleStyle: 'pill',
  };
}

function mergeOverlayLayout(base: OverlayLayout, args: DemoRecorderParams): OverlayLayout {
  const next: OverlayLayout = { ...base };
  if (args.titlePosition !== undefined) {
    next.titlePosition = parseOverlaySlot(args.titlePosition, base.titlePosition);
  }
  if (args.narrationPosition !== undefined) {
    next.narrationPosition = parseOverlaySlot(args.narrationPosition, base.narrationPosition);
  }
  if (args.overlayTheme === 'light' || args.overlayTheme === 'dark') {
    next.theme = args.overlayTheme;
  }
  if (args.captionStyle === 'shadow' || args.captionStyle === 'box') {
    next.captionStyle = args.captionStyle;
  }
  if (args.titleStyle === 'shadow' || args.titleStyle === 'pill' || args.titleStyle === 'banner') {
    next.titleStyle = args.titleStyle;
  }
  if (args.titleX !== undefined) next.titleX = parseFraction(args.titleX);
  if (args.titleY !== undefined) next.titleY = parseFraction(args.titleY);
  if (args.narrationX !== undefined) next.narrationX = parseFraction(args.narrationX);
  if (args.narrationY !== undefined) next.narrationY = parseFraction(args.narrationY);
  return next;
}

function overlayColors(theme: OverlayTheme): {
  bg: string;
  border: string;
  text: string;
  muted: string;
  shadow: string;
  captionFill: string;
  captionHalo: string;
} {
  // One glass system for both step title and narration — keep hierarchy via
  // size/weight/placement, not mismatched panel colors.
  if (theme === 'dark') {
    return {
      bg: 'rgba(248, 250, 252, 0.92)',
      border: 'rgba(255,255,255,0.35)',
      text: '#0f172a',
      muted: 'rgba(15, 23, 42, 0.65)',
      shadow: 'rgba(0,0,0,0.35)',
      captionFill: '#0f172a',
      captionHalo: 'rgba(255,255,255,0.55)',
    };
  }
  return {
    bg: 'rgba(15, 23, 42, 0.78)',
    border: 'rgba(255,255,255,0.10)',
    text: '#f8fafc',
    muted: 'rgba(248,250,252,0.72)',
    shadow: 'rgba(15, 23, 42, 0.28)',
    captionFill: '#f8fafc',
    captionHalo: 'rgba(0,0,0,0.35)',
  };
}

function isEdgeSlot(slot: OverlaySlot): boolean {
  return slot === 'top' || slot === 'bottom';
}

function sameVerticalBand(a: OverlaySlot, b: OverlaySlot): 'top' | 'bottom' | null {
  const topish = new Set<OverlaySlot>(['top', 'top-left', 'top-right']);
  const bottomish = new Set<OverlaySlot>(['bottom', 'bottom-left', 'bottom-right']);
  if (topish.has(a) && topish.has(b)) return 'top';
  if (bottomish.has(a) && bottomish.has(b)) return 'bottom';
  return null;
}

/**
 * Resolve top-left of a box from slot + optional 0–1 overrides.
 * Returns null when slot is `none`.
 */
function resolveBoxOrigin(
  slot: OverlaySlot,
  frameW: number,
  frameH: number,
  boxW: number,
  boxH: number,
  pad: number,
  xFrac?: number,
  yFrac?: number,
  bottomSafe = 0,
  topSafe = 0,
): { x: number; y: number } | null {
  if (slot === 'none') return null;

  const topPad = Math.max(pad, topSafe);
  const bottomPad = Math.max(pad, bottomSafe);
  let x = pad;
  let y = pad;
  switch (slot) {
    case 'top':
      // Top = top-left by default (not horizontally centered).
      x = pad;
      y = topPad;
      break;
    case 'bottom':
      // Bottom captions stay centered for readability; titles use top-left/top-right.
      x = Math.round((frameW - boxW) / 2);
      y = frameH - boxH - bottomPad;
      break;
    case 'center':
      x = Math.round((frameW - boxW) / 2);
      y = Math.round((frameH - boxH) / 2);
      break;
    case 'top-left':
      x = pad;
      y = topPad;
      break;
    case 'top-right':
      x = frameW - boxW - pad;
      y = topPad;
      break;
    case 'bottom-left':
      x = pad;
      y = frameH - boxH - bottomPad;
      break;
    case 'bottom-right':
      x = frameW - boxW - pad;
      y = frameH - boxH - bottomPad;
      break;
    default:
      break;
  }

  if (xFrac !== undefined) {
    x = Math.round(xFrac * Math.max(0, frameW - boxW));
  }
  if (yFrac !== undefined) {
    // Keep explicit Y above the player-safe floor when anchoring near bottom.
    const maxY = Math.max(0, frameH - boxH - (yFrac > 0.55 ? bottomSafe : 0));
    y = Math.round(yFrac * Math.max(0, frameH - boxH));
    y = Math.min(y, maxY);
  }

  x = Math.max(0, Math.min(x, frameW - boxW));
  y = Math.max(0, Math.min(y, frameH - boxH));
  return { x, y };
}

function drawTextBlock(
  ctx: OffscreenCanvasRenderingContext2D,
  opts: {
    x: number;
    y: number;
    width: number;
    height: number;
    pad: number;
    /** Horizontal inset; defaults to pad. */
    padX?: number;
    lines: string[];
    lineH: number;
    fullBleed?: boolean;
    theme: OverlayTheme;
    primary?: string;
    secondary?: string;
    eyebrowSize?: number;
    titleSize?: number;
    /** When false, skip panel fill (used for shadow captions). Default true. */
    fillBackground?: boolean;
    /** Caption/title line alignment. Default left for titles, pass center for narration. */
    align?: 'left' | 'center';
    /** Font weight for caption lines. Default 500. */
    lineWeight?: number;
    /** Corner radius for pill/box panels. */
    radius?: number;
  },
): void {
  const {
    x,
    y,
    width,
    height,
    pad,
    padX,
    lines,
    lineH,
    fullBleed,
    theme,
    primary,
    secondary,
    eyebrowSize,
    titleSize,
    fillBackground = true,
    align = 'left',
    lineWeight = 500,
    radius = 14,
  } = opts;
  const insetX = padX ?? pad;
  const colors = overlayColors(theme);

  if (fillBackground) {
    ctx.save();
    ctx.shadowColor = colors.shadow;
    ctx.shadowBlur = fullBleed ? 0 : 16;
    ctx.shadowOffsetY = fullBleed ? 0 : 4;
    ctx.fillStyle = colors.bg;
    if (fullBleed) {
      ctx.fillRect(x, y, width, height);
    } else {
      drawRoundedRect(ctx, x, y, width, height, radius);
      ctx.fill();
      // Hairline rim so glass chips separate from busy page chrome.
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.strokeStyle = colors.border;
      ctx.lineWidth = 1;
      drawRoundedRect(ctx, x + 0.5, y + 0.5, width - 1, height - 1, Math.max(0, radius - 0.5));
      ctx.stroke();
    }
    ctx.restore();
  }

  // Use top baseline so eyebrow + title never collide.
  ctx.textBaseline = 'top';
  ctx.textAlign = 'left';

  const drawHaloText = (text: string, tx: number, ty: number, size: number, fill: string) => {
    // Soft multi-pass glow — single thick stroke reads as muddy black type.
    ctx.lineJoin = 'round';
    ctx.miterLimit = 2;
    ctx.strokeStyle = colors.captionHalo;
    for (const w of [Math.max(3, size * 0.14), Math.max(1.5, size * 0.07)]) {
      ctx.lineWidth = w;
      ctx.strokeText(text, tx, ty);
    }
    ctx.fillStyle = fill;
    ctx.fillText(text, tx, ty);
  };

  let cursorY = y + pad;
  if (secondary) {
    const size = eyebrowSize ?? Math.round(lineH * 0.55);
    ctx.font = demoFont(500, size);
    const tx = align === 'center' ? x + width / 2 : x + insetX;
    ctx.textAlign = align;
    if (!fillBackground) {
      drawHaloText(secondary, tx, cursorY, size, colors.muted);
    } else {
      ctx.fillStyle = colors.muted;
      ctx.fillText(secondary, tx, cursorY);
    }
    cursorY += size + Math.max(6, Math.round(lineH * 0.22));
  }

  if (primary) {
    const size = titleSize ?? Math.round(lineH * 0.9);
    // Semi-bold title chip — clearer hierarchy than regular shadow text.
    ctx.font = demoFont(600, size);
    const tx = align === 'center' ? x + width / 2 : x + insetX;
    ctx.textAlign = align;
    if (!fillBackground) {
      drawHaloText(primary, tx, cursorY, size, colors.captionFill);
    } else {
      ctx.fillStyle = colors.text;
      ctx.fillText(primary, tx, cursorY);
    }
  }

  if (lines.length) {
    const fontSize = Math.round(lineH * 0.78);
    ctx.font = demoFont(lineWeight, fontSize);
    ctx.textAlign = align;
    lines.forEach((line, i) => {
      const ly = y + pad + i * lineH;
      const tx = align === 'center' ? x + width / 2 : x + insetX;
      if (!fillBackground) {
        drawHaloText(line, tx, ly, fontSize, colors.captionFill);
      } else {
        ctx.fillStyle = colors.text;
        ctx.fillText(line, tx, ly);
      }
    });
  }

  ctx.textBaseline = 'alphabetic';
  ctx.textAlign = 'left';
}

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

      if (!response) throw new Error('No response received from offscreen document');
      if (!response.success) throw new Error(response.error || 'Unknown offscreen error');
      return response;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        await sleep(50 * attempt);
        continue;
      }
      throw lastError;
    }
  }

  throw lastError instanceof Error ? lastError : new Error(String(lastError));
}

function drawRoundedRect(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  const radius = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + radius, y);
  ctx.arcTo(x + w, y, x + w, y + h, radius);
  ctx.arcTo(x + w, y + h, x, y + h, radius);
  ctx.arcTo(x, y + h, x, y, radius);
  ctx.arcTo(x, y, x + w, y, radius);
  ctx.closePath();
}

function wrapText(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (!words.length) return [];
  const lines: string[] = [];
  let current = words[0];
  for (let i = 1; i < words.length; i++) {
    const next = `${current} ${words[i]}`;
    if (ctx.measureText(next).width <= maxWidth) {
      current = next;
    } else {
      lines.push(current);
      current = words[i];
    }
  }
  lines.push(current);
  return lines.slice(0, 3);
}

function composeFrame(
  bitmap: ImageBitmap,
  width: number,
  height: number,
  overlay: DemoOverlay,
  actionEvents: ActionEvent[],
  viewportWidth: number,
  viewportHeight: number,
  nowMs: number,
): Promise<string> {
  return (async () => {
    await ensureDemoFonts();

    const canvas = new OffscreenCanvas(width, height);
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Failed to create overlay canvas');

    ctx.imageSmoothingEnabled = true;
    ctx.imageSmoothingQuality = 'high';
    const layoutEarly = overlay.layout || defaultOverlayLayout();
    ctx.fillStyle = layoutEarly.theme === 'light' ? '#f1f5f9' : '#000';
    ctx.fillRect(0, 0, width, height);
    // Cover-fit: fill the output frame and crop overflow — avoids black letterbox bars.
    const srcW = bitmap.width;
    const srcH = bitmap.height;
    const scale = Math.max(width / srcW, height / srcH);
    const drawW = Math.round(srcW * scale);
    const drawH = Math.round(srcH * scale);
    const dx = Math.round((width - drawW) / 2);
    const dy = Math.round((height - drawH) / 2);
    ctx.drawImage(bitmap, dx, dy, drawW, drawH);

    // Click / drag overlays (viewport CSS px → output canvas).
    renderGifEnhancedOverlays({
      ctx,
      outputWidth: width,
      outputHeight: height,
      viewportWidth: viewportWidth || srcW,
      viewportHeight: viewportHeight || srcH,
      nowMs,
      events: actionEvents,
      config: DEMO_RENDERING,
    });

    const pad = Math.round(height * 0.022);
    const layout = overlay.layout || defaultOverlayLayout();
    const gap = Math.round(pad * 0.7);
    const narrLineH = Math.round(height * 0.038);
    const eyebrowSize = Math.round(height * 0.018);
    const titleSize = Math.round(height * 0.032);
    const titleGap = Math.max(8, Math.round(height * 0.01));
    const narrationBottomSafe = Math.round(height * NARRATION_BOTTOM_SAFE_RATIO);
    const titleTopSafe = Math.round(height * TITLE_TOP_SAFE_RATIO);

    let titleBox: { x: number; y: number; w: number; h: number } | null = null;

    const hasTitle =
      layout.titlePosition !== 'none' && Boolean(overlay.demoTitle || overlay.stepTitle);
    const hasNarration = layout.narrationPosition !== 'none' && Boolean(overlay.narration);

    if (hasTitle) {
      // Prefer step heading only. Session `title` from start is metadata — do not
      // paint it as a permanent "Agent Chrome MCP" eyebrow over every beat.
      const heading = normalizeOverlayText(overlay.stepTitle || overlay.demoTitle);
      const showDemo = false;
      const titleStyle = layout.titleStyle || 'pill';
      const fullBleed = titleStyle === 'banner' && isEdgeSlot(layout.titlePosition);
      const fillBackground = titleStyle !== 'shadow';

      // Measure text so pill/shadow only covers the label — never the full nav bar.
      ctx.font = demoFont(600, titleSize);
      const headingW = ctx.measureText(heading).width;
      let eyebrowW = 0;
      if (showDemo) {
        ctx.font = demoFont(500, eyebrowSize);
        eyebrowW = ctx.measureText(overlay.demoTitle).width;
      }
      const textW = Math.max(headingW, eyebrowW);
      const contentPadX = Math.round(pad * (titleStyle === 'pill' ? 1.35 : 1.1));
      const contentPadY = Math.round(pad * (titleStyle === 'pill' ? 0.85 : 1));
      const pillW = Math.min(
        width - pad * 2,
        Math.ceil(textW + contentPadX * 2 + (titleStyle === 'pill' ? 10 : 0)),
      );
      // Shadow titles hug the text width (left-aligned), not a wide centered band.
      const boxW = fullBleed
        ? width
        : titleStyle === 'shadow'
          ? Math.min(width - pad * 2, Math.max(pillW, Math.round(width * 0.28)))
          : pillW;
      const contentH = showDemo
        ? contentPadY + eyebrowSize + titleGap + titleSize + contentPadY
        : contentPadY + titleSize + contentPadY;
      const boxH = Math.max(contentH, Math.round(height * 0.058));
      // Drop below site header unless the agent set an explicit titleY.
      const titleTopInset =
        layout.titleY === undefined &&
        (layout.titlePosition === 'top' ||
          layout.titlePosition === 'top-left' ||
          layout.titlePosition === 'top-right')
          ? titleTopSafe
          : 0;
      const origin = resolveBoxOrigin(
        layout.titlePosition,
        width,
        height,
        boxW,
        boxH,
        pad,
        layout.titleX,
        layout.titleY,
        0,
        titleTopInset,
      );
      if (origin) {
        // Only center when slot is explicitly `center` (or agent set titleX).
        let boxX = fullBleed ? 0 : origin.x;
        if (!fullBleed && layout.titleX === undefined && layout.titlePosition === 'center') {
          boxX = Math.round((width - boxW) / 2);
        }
        titleBox = { x: boxX, y: origin.y, w: boxW, h: boxH };
        drawTextBlock(ctx, {
          x: titleBox.x,
          y: titleBox.y,
          width: titleBox.w,
          height: titleBox.h,
          pad: contentPadY,
          padX: contentPadX,
          lines: [],
          lineH: titleSize,
          fullBleed,
          theme: layout.theme,
          primary: heading,
          secondary: showDemo ? overlay.demoTitle : undefined,
          eyebrowSize,
          titleSize,
          fillBackground,
          align: layout.titlePosition === 'center' ? 'center' : 'left',
          radius: titleStyle === 'pill' ? Math.round(boxH / 2) : 14,
        });
      }
    }

    if (hasNarration) {
      const narrFontSize = Math.round(height * 0.028);
      ctx.font = demoFont(500, narrFontSize);
      const maxTextWidth = Math.min(width - pad * 4, Math.round(width * 0.72));
      const lines = wrapText(ctx, normalizeOverlayText(overlay.narration), maxTextWidth);
      const longest = lines.reduce((m, line) => Math.max(m, ctx.measureText(line).width), 0);
      const useBox = (layout.captionStyle || 'box') === 'box';
      const contentPadX = Math.round(pad * (useBox ? 1.45 : 1.1));
      const contentPadY = Math.round(pad * (useBox ? 0.95 : 1));
      // Hug caption text — a full-width empty bar looks unfinished.
      const boxW = useBox
        ? Math.min(
            width - pad * 2,
            Math.max(Math.round(width * 0.28), Math.ceil(longest + contentPadX * 2)),
          )
        : Math.min(width - pad * 2, Math.round(width * 0.9));
      const boxH = contentPadY + lines.length * narrLineH + contentPadY;
      let origin = resolveBoxOrigin(
        layout.narrationPosition,
        width,
        height,
        boxW,
        boxH,
        pad,
        layout.narrationX,
        layout.narrationY,
        narrationBottomSafe,
      );

      // If title and narration share a band and agent did not set explicit Y, stack them.
      const band =
        titleBox && layout.titleY === undefined && layout.narrationY === undefined
          ? sameVerticalBand(layout.titlePosition, layout.narrationPosition)
          : null;
      if (origin && titleBox && band === 'top') {
        origin = { x: origin.x, y: titleBox.y + titleBox.h + gap };
      } else if (origin && titleBox && band === 'bottom') {
        origin = {
          x: origin.x,
          y: Math.min(titleBox.y - boxH - gap, height - boxH - narrationBottomSafe),
        };
      }

      if (origin) {
        const maxY = height - boxH - narrationBottomSafe;
        origin.y = Math.max(0, Math.min(origin.y, maxY));
        // Center the caption block in the frame when using edge/center bottom slots.
        if (
          layout.narrationX === undefined &&
          (layout.narrationPosition === 'bottom' ||
            layout.narrationPosition === 'top' ||
            layout.narrationPosition === 'center')
        ) {
          origin.x = Math.round((width - boxW) / 2);
        }
        drawTextBlock(ctx, {
          x: origin.x,
          y: origin.y,
          width: boxW,
          height: boxH,
          pad: contentPadY,
          padX: contentPadX,
          lines,
          lineH: narrLineH,
          fullBleed: false,
          theme: layout.theme,
          fillBackground: useBox,
          align: 'center',
          lineWeight: 500,
          radius: Math.round(boxH / 2),
        });
      }
    }

    // PNG keeps UI text/icons sharp (JPEG was the main blur source).
    return canvas.convertToBlob({ type: 'image/png' }).then(blobToDataUrl);
  })();
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(reader.error || new Error('Failed to read frame blob'));
    reader.readAsDataURL(blob);
  });
}

function isRestrictedUrl(url?: string): boolean {
  if (!url) return true;
  return (
    url.startsWith('chrome://') ||
    url.startsWith('chrome-extension://') ||
    url.startsWith('https://chrome.google.com/webstore') ||
    url.startsWith('edge://') ||
    url.startsWith('about:')
  );
}

/**
 * Move CDP capture to another tab (multi-step demos often span tabs).
 * Detaches the previous tab only after the new attach succeeds.
 */
async function retargetSession(active: DemoSession, nextTabId: number): Promise<boolean> {
  if (active.stopping || active.tabId === nextTabId) return active.tabId === nextTabId;

  let tab: chrome.tabs.Tab;
  try {
    tab = await chrome.tabs.get(nextTabId);
  } catch {
    return false;
  }
  if (!tab.id || isRestrictedUrl(tab.url)) return false;

  const prevTabId = active.tabId;
  try {
    await cdpSessionManager.attach(nextTabId, CDP_SESSION_KEY);
  } catch (error) {
    console.warn('[DemoRecorder] failed to attach capture tab', nextTabId, error);
    return false;
  }

  // Prefer a painted surface — background tabs often screenshot black.
  try {
    await chrome.tabs.update(nextTabId, { active: true });
  } catch {
    // attach succeeded; capture may still work
  }

  active.tabId = nextTabId;
  active.viewportWidth = 0;
  active.viewportHeight = 0;

  if (prevTabId !== nextTabId) {
    try {
      await cdpSessionManager.detach(prevTabId, CDP_SESSION_KEY);
    } catch {
      // ignore
    }
  }
  return true;
}

/**
 * Prefer an explicit tabId; otherwise follow the focused active tab so
 * chrome_navigate / chrome_switch_tab updates what the video shows.
 */
async function syncCaptureTarget(active: DemoSession, preferredTabId?: number): Promise<void> {
  if (active.stopping) return;

  if (typeof preferredTabId === 'number') {
    await retargetSession(active, preferredTabId);
    return;
  }

  try {
    const [focused] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    if (focused?.id && focused.id !== active.tabId && !isRestrictedUrl(focused.url)) {
      await retargetSession(active, focused.id);
    }
  } catch {
    // keep current capture tab
  }
}

async function captureComposedFrame(active: DemoSession): Promise<string> {
  // Refresh viewport metrics for accurate click projection.
  try {
    const metrics: { layoutViewport?: { clientWidth: number; clientHeight: number } } =
      await cdpSessionManager.sendCommand(active.tabId, 'Page.getLayoutMetrics', {});
    if (metrics.layoutViewport?.clientWidth) {
      active.viewportWidth = metrics.layoutViewport.clientWidth;
      active.viewportHeight = metrics.layoutViewport.clientHeight;
    }
  } catch {
    // keep previous metrics
  }

  // fromSurface must be true in MV3 / recent Chrome ("Only screenshots from surface are allowed").
  const screenshot: { data: string } = await cdpSessionManager.sendCommand(
    active.tabId,
    'Page.captureScreenshot',
    {
      format: 'png',
      captureBeyondViewport: false,
      fromSurface: true,
    },
  );

  const bitmap = await createImageBitmapFromUrl(`data:image/png;base64,${screenshot.data}`);
  try {
    pruneActionEventsInPlace(active.actionEvents, Date.now(), DEMO_RENDERING);
    return await composeFrame(
      bitmap,
      active.width,
      active.height,
      active.overlay,
      active.actionEvents,
      active.viewportWidth || bitmap.width,
      active.viewportHeight || bitmap.height,
      Date.now(),
    );
  } finally {
    bitmap.close();
  }
}

async function captureOnce(active: DemoSession, preferredTabId?: number): Promise<void> {
  if (active.stopping) return;
  if (Date.now() - active.startTime >= active.maxDurationMs) {
    // Soft-stop capture loop; caller should call stop to export.
    if (active.captureTimer) {
      clearTimeout(active.captureTimer);
      active.captureTimer = null;
    }
    return;
  }

  // Interval frames follow focus; action/step bursts may pin a tabId.
  await syncCaptureTarget(active, preferredTabId);

  const frameDataUrl = await captureComposedFrame(active);
  await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.DEMO_ADD_FRAME, {
    imageDataUrl: frameDataUrl,
    width: active.width,
    height: active.height,
  });
  active.frameCount += 1;
}

function scheduleNextCapture(active: DemoSession): void {
  if (active.stopping || active !== session) return;
  const intervalMs = Math.max(50, Math.round(1000 / active.fps));
  active.captureTimer = setTimeout(() => {
    void (async () => {
      if (!session || session !== active || active.stopping) return;
      try {
        active.pendingCapture = captureOnce(active);
        await active.pendingCapture;
      } catch (error) {
        console.error('[DemoRecorder] capture failed:', error);
      } finally {
        active.pendingCapture = null;
        scheduleNextCapture(active);
      }
    })();
  }, intervalMs);
}

async function cleanupSession(active: DemoSession, resetEncoder: boolean): Promise<void> {
  active.stopping = true;
  if (active.captureTimer) {
    clearTimeout(active.captureTimer);
    active.captureTimer = null;
  }
  if (active.pendingCapture) {
    try {
      await active.pendingCapture;
    } catch {
      // ignore
    }
  }
  try {
    await cdpSessionManager.detach(active.tabId, CDP_SESSION_KEY);
  } catch {
    // ignore
  }
  if (resetEncoder) {
    try {
      await sendToOffscreen(OFFSCREEN_MESSAGE_TYPES.DEMO_RESET, {});
    } catch {
      // ignore
    }
  }
  if (session === active) {
    session = null;
  }
}

function closeOpenSteps(active: DemoSession, endMs: number): void {
  for (const step of active.steps) {
    if (step.endMs == null) step.endMs = endMs;
  }
}

class DemoRecorderTool extends BaseBrowserToolExecutor {
  name = TOOL_NAMES.BROWSER.DEMO_RECORDER;

  private buildResponse(data: Record<string, unknown>): ToolResult {
    return {
      content: [{ type: 'text', text: JSON.stringify(data, null, 2) }],
      isError: false,
    };
  }

  private async resolveTargetTab(tabId?: number): Promise<chrome.tabs.Tab | undefined> {
    if (typeof tabId === 'number') {
      try {
        return await chrome.tabs.get(tabId);
      } catch {
        return undefined;
      }
    }
    const [active] = await chrome.tabs.query({ active: true, lastFocusedWindow: true });
    return active;
  }

  async execute(args: DemoRecorderParams): Promise<ToolResult> {
    const action = args.action;
    const valid: DemoAction[] = ['start', 'step', 'stop', 'status', 'clear'];
    if (!action || !valid.includes(action)) {
      return createErrorResponse(`Parameter [action] must be one of: ${valid.join(', ')}`);
    }

    try {
      switch (action) {
        case 'start': {
          if (session) {
            return createErrorResponse(
              'A demo recording is already active. Use action="stop" or action="clear" first.',
            );
          }

          const tab = await this.resolveTargetTab(args.tabId);
          if (!tab?.id) {
            return createErrorResponse(
              typeof args.tabId === 'number'
                ? `Tab not found: ${args.tabId}`
                : 'No active tab found',
            );
          }
          if (isRestrictedUrl(tab.url)) {
            return createErrorResponse(
              'Cannot record special browser pages or web store pages due to security restrictions.',
            );
          }

          const presetName: DemoPreset = args.preset === 'compact' ? 'compact' : 'product';
          const preset = PRESETS[presetName];
          const width = normalizePositiveInt(args.width, preset.width, 1920);
          const height = normalizePositiveInt(args.height, preset.height, 1080);
          const fps = normalizePositiveInt(args.fps, preset.fps, 30);
          const maxDurationMs = normalizePositiveInt(
            args.maxDurationMs,
            preset.maxDurationMs,
            600_000,
          );
          const sessionTitle =
            typeof args.title === 'string' && args.title.trim() ? args.title.trim() : '';
          const layout = mergeOverlayLayout(defaultOverlayLayout(), args);

          await ensureDemoFonts();
          await cdpSessionManager.attach(tab.id, CDP_SESSION_KEY);

          const startResult = await sendToOffscreen<{ success: boolean; mimeType?: string }>(
            OFFSCREEN_MESSAGE_TYPES.DEMO_START,
            {
              width,
              height,
              fps,
              // VP8 tends to keep UI text sharper than VP9 at the same MediaRecorder budget.
              mimeType: 'video/webm;codecs=vp8',
              videoBitsPerSecond: preset.videoBitsPerSecond,
            },
          );

          session = {
            tabId: tab.id,
            width,
            height,
            fps,
            videoBitsPerSecond: preset.videoBitsPerSecond,
            maxDurationMs,
            filename: args.filename,
            startTime: Date.now(),
            frameCount: 0,
            captureTimer: null,
            pendingCapture: null,
            stopping: false,
            overlay: {
              // Keep empty until first step — start `title` is session metadata only.
              demoTitle: '',
              stepTitle: '',
              narration: '',
              layout,
            },
            steps: [],
            actionEvents: [],
            viewportWidth: 0,
            viewportHeight: 0,
            mimeType: startResult.mimeType,
          };

          // Seed first frame immediately, then continue on interval.
          session.pendingCapture = captureOnce(session);
          await session.pendingCapture;
          session.pendingCapture = null;
          scheduleNextCapture(session);

          return this.buildResponse({
            success: true,
            action: 'start',
            tabId: tab.id,
            preset: presetName,
            width,
            height,
            fps,
            maxDurationMs,
            mimeType: startResult.mimeType,
            title: sessionTitle || undefined,
            layout,
            tip: 'Operate the browser, call action="step" for each narration beat, then action="stop". Defaults: titleStyle=pill (glass chip) + captionStyle=box (dark subtitle capsule). Place overlays with titlePosition/narrationPosition. overlayTheme defaults to light.',
          });
        }

        case 'step': {
          if (!session) {
            return createErrorResponse('No active demo recording. Call action="start" first.');
          }

          // Explicit tabId on step pins capture there (also used after chrome_navigate).
          const stepTabId = typeof args.tabId === 'number' ? args.tabId : undefined;
          await syncCaptureTarget(session, stepTabId);

          const title = normalizeOverlayText(
            typeof args.title === 'string' && args.title.trim()
              ? args.title.trim()
              : `Step ${session.steps.length + 1}`,
          );
          const narration = normalizeOverlayText(
            typeof args.narration === 'string' && args.narration.trim()
              ? args.narration.trim()
              : '',
          );
          const holdMs = normalizePositiveInt(args.holdMs, 1800, 15_000);
          const layout = mergeOverlayLayout(session.overlay.layout, args);
          const now = Date.now() - session.startTime;

          closeOpenSteps(session, now);
          session.overlay.stepTitle = title;
          session.overlay.narration = narration;
          session.overlay.layout = layout;
          session.steps.push({
            index: session.steps.length + 1,
            title,
            narration,
            startMs: now,
            layout: { ...layout },
          });

          // Force a fresh overlaid frame, then hold so viewers can read it.
          try {
            session.pendingCapture = captureOnce(session, stepTabId ?? session.tabId);
            await session.pendingCapture;
          } finally {
            session.pendingCapture = null;
          }
          await sleep(holdMs);

          const endMs = Date.now() - session.startTime;
          const current = session.steps[session.steps.length - 1];
          if (current) current.endMs = endMs;

          return this.buildResponse({
            success: true,
            action: 'step',
            step: current,
            layout,
            frameCount: session.frameCount,
            durationMs: endMs,
          });
        }

        case 'stop': {
          if (!session) {
            return createErrorResponse('No active demo recording to stop.');
          }

          const active = session;
          const endMs = Date.now() - active.startTime;
          closeOpenSteps(active, endMs);

          // One last frame, then finish encoder.
          try {
            active.pendingCapture = captureOnce(active);
            await active.pendingCapture;
          } catch {
            // ignore last-frame failures
          } finally {
            active.pendingCapture = null;
          }

          await cleanupSession(active, false);

          const finished = await sendToOffscreen<DemoFinishResponse>(
            OFFSCREEN_MESSAGE_TYPES.DEMO_FINISH,
            {},
          );

          if (!finished.webmBase64) {
            return createErrorResponse('WebM encoding finished without data');
          }

          const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
          const safeName = active.filename?.replace(/[^a-z0-9_-]/gi, '_') || `demo_${timestamp}`;
          const fullFilename = safeName.endsWith('.webm') ? safeName : `${safeName}.webm`;
          const binary = atob(finished.webmBase64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const blob = new Blob([bytes], { type: finished.mimeType || 'video/webm' });

          // Prefer Object URL; fall back to data URL in service workers without createObjectURL.
          let downloadUrl: string;
          let shouldRevoke = false;
          const createObjectURL = (URL as typeof URL & { createObjectURL?: (b: Blob) => string })
            .createObjectURL;
          if (typeof createObjectURL === 'function') {
            downloadUrl = createObjectURL(blob);
            shouldRevoke = true;
          } else {
            downloadUrl = `data:${finished.mimeType || 'video/webm'};base64,${finished.webmBase64}`;
          }

          let downloadId: number;
          try {
            downloadId = await chrome.downloads.download({
              url: downloadUrl,
              filename: fullFilename,
              saveAs: false,
            });
          } finally {
            if (shouldRevoke) {
              setTimeout(() => {
                try {
                  URL.revokeObjectURL(downloadUrl);
                } catch {
                  // ignore
                }
              }, 60_000);
            }
          }

          let fullPath: string | undefined;
          try {
            const [downloadItem] = await chrome.downloads.search({ id: downloadId });
            fullPath = downloadItem?.filename;
          } catch {
            // ignore
          }

          return this.buildResponse({
            success: true,
            action: 'stop',
            filename: fullFilename,
            fullPath,
            mimeType: finished.mimeType || 'video/webm',
            byteLength: finished.byteLength,
            frameCount: finished.frameCount ?? active.frameCount,
            durationMs: endMs,
            width: active.width,
            height: active.height,
            fps: active.fps,
            steps: active.steps,
            tip: 'steps[].startMs/endMs can be used to generate SRT subtitles.',
          });
        }

        case 'status': {
          if (!session) {
            return this.buildResponse({
              success: true,
              action: 'status',
              isRecording: false,
            });
          }
          return this.buildResponse({
            success: true,
            action: 'status',
            isRecording: true,
            tabId: session.tabId,
            frameCount: session.frameCount,
            durationMs: Date.now() - session.startTime,
            width: session.width,
            height: session.height,
            fps: session.fps,
            mimeType: session.mimeType,
            overlay: session.overlay,
            steps: session.steps,
          });
        }

        case 'clear': {
          if (!session) {
            return this.buildResponse({
              success: true,
              action: 'clear',
              cleared: false,
              message: 'No active demo recording',
            });
          }
          const active = session;
          await cleanupSession(active, true);
          return this.buildResponse({
            success: true,
            action: 'clear',
            cleared: true,
          });
        }
      }
    } catch (error) {
      return createErrorResponse(
        error instanceof Error ? error.message : `Demo recorder failed: ${String(error)}`,
      );
    }

    return createErrorResponse(`Unhandled action: ${action}`);
  }
}

export const demoRecorderTool = new DemoRecorderTool();

/** Whether a demo recording is active (optionally ignoring tab — demos follow focus). */
export function isDemoRecordingActive(_tabId?: number): boolean {
  return Boolean(session && !session.stopping);
}

/**
 * Notify the demo recorder of a browser action so click/drag overlays appear.
 * Retargets capture to the acted-on tab, then forces a short burst of frames.
 * No-op when demo recording is inactive.
 */
export async function notifyDemoAction(
  tabId: number,
  action: ActionMetadata,
): Promise<{ success: boolean; error?: string }> {
  if (!session || session.stopping) {
    return { success: true };
  }

  await syncCaptureTarget(session, tabId);

  const atMs = Date.now();
  const normalized: ActionMetadata = {
    ...action,
    coordinateSpace: action.coordinateSpace || 'viewport',
    timestampMs: atMs,
  };
  session.actionEvents.push({ action: normalized, atMs });
  pruneActionEventsInPlace(session.actionEvents, atMs, DEMO_RENDERING);

  const plan = resolveCapturePlanForAction(DEMO_RENDERING, normalized, 10);
  try {
    if (session.pendingCapture) {
      try {
        await session.pendingCapture;
      } catch {
        // ignore
      }
    }

    const actedTabId = tabId;
    const burst = (async () => {
      for (let i = 0; i < plan.frames; i++) {
        if (!session || session.stopping) return;
        await captureOnce(session, actedTabId);
        if (i < plan.frames - 1 && plan.intervalMs > 0) {
          await sleep(plan.intervalMs);
        }
      }
    })();

    session.pendingCapture = burst;
    await burst;
    session.pendingCapture = null;
    return { success: true };
  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : String(error),
    };
  }
}
