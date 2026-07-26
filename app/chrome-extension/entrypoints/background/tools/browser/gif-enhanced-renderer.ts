/**
 * GIF Enhanced Renderer
 *
 * Draws visual affordances (click indicators, drag paths, labels) onto a canvas
 * before encoding frames. This keeps the offscreen document focused on encoding
 * while the background capture pipeline handles compositing.
 *
 * Coordinates are expected to be in viewport CSS pixels. If a caller provides
 * screenshot-space coordinates, it should convert them to viewport space first.
 */

// ============================================================================
// Types
// ============================================================================

export type ActionType =
  | 'click'
  | 'double_click'
  | 'triple_click'
  | 'right_click'
  | 'drag'
  | 'scroll'
  | 'type'
  | 'key'
  | 'navigate'
  | 'hover'
  | 'fill'
  | 'annotation'
  | 'other';

export type CoordinateSpace = 'viewport' | 'screenshot';

export interface Point {
  x: number;
  y: number;
}

export interface ActionMetadata {
  type: ActionType;
  coordinates?: Point;
  startCoordinates?: Point;
  endCoordinates?: Point;
  text?: string;
  url?: string;
  ref?: string;

  // Enhanced rendering hints
  label?: string;
  coordinateSpace?: CoordinateSpace;
  timestampMs?: number;
}

export interface GifEnhancedRenderingConfig {
  enabled?: boolean;

  clickIndicators?: {
    enabled?: boolean;
    color?: string;
    fillColor?: string;
    radiusPx?: number;
    lineWidthPx?: number;
    durationMs?: number;
    // Capture-side animation hints (auto-capture mode only)
    animationFrames?: number;
    animationIntervalMs?: number;
    animationFrameDelayCs?: number;
  };

  dragPaths?: {
    enabled?: boolean;
    color?: string;
    lineWidthPx?: number;
    durationMs?: number;
    arrowSizePx?: number;
    dash?: number[];
    startDotRadiusPx?: number;
    endDotRadiusPx?: number;
  };

  labels?: {
    enabled?: boolean;
    mode?: 'action' | 'annotation' | 'both';
    showForClicks?: boolean;
    font?: string;
    maxLength?: number;
    durationMs?: number;
    backgroundColor?: string;
    borderColor?: string;
    textColor?: string;
    paddingX?: number;
    paddingY?: number;
    radiusPx?: number;
    offsetPx?: number;
  };
}

// ============================================================================
// Resolved Config Types
// ============================================================================

export interface ResolvedClickIndicatorConfig {
  enabled: boolean;
  color: string;
  fillColor: string;
  radiusPx: number;
  lineWidthPx: number;
  durationMs: number;
  animationFrames: number;
  animationIntervalMs: number;
  animationFrameDelayCs: number;
}

export interface ResolvedDragPathConfig {
  enabled: boolean;
  color: string;
  lineWidthPx: number;
  durationMs: number;
  arrowSizePx: number;
  dash: number[];
  startDotRadiusPx: number;
  endDotRadiusPx: number;
}

export interface ResolvedLabelsConfig {
  enabled: boolean;
  mode: 'action' | 'annotation' | 'both';
  showForClicks: boolean;
  font: string;
  maxLength: number;
  durationMs: number;
  backgroundColor: string;
  borderColor: string;
  textColor: string;
  paddingX: number;
  paddingY: number;
  radiusPx: number;
  offsetPx: number;
}

export interface ResolvedGifEnhancedRenderingConfig {
  enabled: boolean;
  clickIndicators: ResolvedClickIndicatorConfig;
  dragPaths: ResolvedDragPathConfig;
  labels: ResolvedLabelsConfig;
}

export interface ActionEvent {
  action: ActionMetadata;
  atMs: number;
}

export interface CapturePlan {
  frames: number;
  intervalMs: number;
  delayCs: number;
}

export interface RenderGifEnhancedOverlaysParams {
  ctx: OffscreenCanvasRenderingContext2D;
  outputWidth: number;
  outputHeight: number;
  viewportWidth: number;
  viewportHeight: number;
  nowMs: number;
  events: readonly ActionEvent[];
  config: ResolvedGifEnhancedRenderingConfig;
}

// ============================================================================
// Constants
// ============================================================================

const CLICK_ACTIONS: readonly ActionType[] = [
  'click',
  'double_click',
  'triple_click',
  'right_click',
];

// ============================================================================
// Utility Functions
// ============================================================================

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function normalizePositiveNumber(
  value: unknown,
  fallback: number,
  min: number,
  max: number,
): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(value, min, max);
}

function normalizePositiveInt(value: unknown, fallback: number, min: number, max: number): number {
  if (typeof value !== 'number' || !Number.isFinite(value)) return fallback;
  return clamp(Math.floor(value), min, max);
}

function normalizeDash(value: unknown, fallback: number[]): number[] {
  if (!Array.isArray(value)) return fallback;
  const nums = value.filter((n) => typeof n === 'number' && Number.isFinite(n) && n > 0);
  return nums.length >= 2 ? (nums as number[]) : fallback;
}

function easeOutCubic(t: number): number {
  const x = clamp(t, 0, 1);
  return 1 - Math.pow(1 - x, 3);
}

function projectPoint(
  point: Point,
  viewportWidth: number,
  viewportHeight: number,
  outputWidth: number,
  outputHeight: number,
): Point | null {
  if (
    typeof point.x !== 'number' ||
    typeof point.y !== 'number' ||
    !Number.isFinite(point.x) ||
    !Number.isFinite(point.y)
  ) {
    return null;
  }

  const vw = viewportWidth > 0 ? viewportWidth : outputWidth;
  const vh = viewportHeight > 0 ? viewportHeight : outputHeight;

  return {
    x: (point.x / vw) * outputWidth,
    y: (point.y / vh) * outputHeight,
  };
}

function buildRoundedRectPath(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  width: number,
  height: number,
  radius: number,
): void {
  const r = Math.max(0, Math.min(radius, Math.min(width, height) / 2));
  const x2 = x + width;
  const y2 = y + height;

  ctx.moveTo(x + r, y);
  ctx.arcTo(x2, y, x2, y2, r);
  ctx.arcTo(x2, y2, x, y2, r);
  ctx.arcTo(x, y2, x, y, r);
  ctx.arcTo(x, y, x2, y, r);
}

function truncate(text: string, maxLength: number): string {
  const trimmed = text.trim();
  if (trimmed.length <= maxLength) return trimmed;
  return `${trimmed.slice(0, Math.max(0, maxLength - 1))}…`;
}

// ============================================================================
// Label Resolution
// ============================================================================

function resolveActionLabel(action: ActionMetadata, cfg: ResolvedLabelsConfig): string | null {
  const explicit = typeof action.label === 'string' ? action.label.trim() : '';
  const isExplicit = explicit.length > 0;

  const mode = cfg.mode;
  const canShowAction = mode === 'action' || mode === 'both';
  const canShowAnnotation = mode === 'annotation' || mode === 'both';

  if ((action.type === 'annotation' || isExplicit) && canShowAnnotation) {
    const labelText = explicit || (typeof action.text === 'string' ? action.text.trim() : '');
    return labelText.length > 0 ? truncate(labelText, cfg.maxLength) : null;
  }

  if (!canShowAction) return null;

  switch (action.type) {
    case 'click':
    case 'double_click':
    case 'triple_click':
    case 'right_click':
      if (!cfg.showForClicks) return null;
      return action.type.replace('_', ' ').toUpperCase();
    case 'drag':
      return 'DRAG';
    case 'scroll':
      return 'SCROLL';
    case 'hover':
      return 'HOVER';
    case 'navigate': {
      if (!action.url) return 'NAVIGATE';
      try {
        const host = new URL(action.url).hostname;
        return host ? `→ ${host}` : 'NAVIGATE';
      } catch {
        return 'NAVIGATE';
      }
    }
    case 'type': {
      const content = typeof action.text === 'string' ? action.text : '';
      return content.trim().length > 0 ? `TYPE "${truncate(content, cfg.maxLength)}"` : 'TYPE';
    }
    case 'key': {
      const content = typeof action.text === 'string' ? action.text : '';
      return content.trim().length > 0 ? `KEY [${truncate(content, cfg.maxLength)}]` : 'KEY';
    }
    case 'fill': {
      const content = typeof action.text === 'string' ? action.text : '';
      return content.trim().length > 0 ? `FILL "${truncate(content, cfg.maxLength)}"` : 'FILL';
    }
    default:
      return null;
  }
}

function resolveAnchorPoint(action: ActionMetadata): Point | null {
  if (action.type === 'drag') {
    return action.endCoordinates || action.coordinates || action.startCoordinates || null;
  }
  return action.coordinates || action.endCoordinates || action.startCoordinates || null;
}

// ============================================================================
// Drawing Functions
// ============================================================================

function drawClickIndicator(
  ctx: OffscreenCanvasRenderingContext2D,
  x: number,
  y: number,
  progress: number,
  type: ActionType,
  cfg: ResolvedClickIndicatorConfig,
): void {
  const t = clamp(progress, 0, 1);
  const eased = easeOutCubic(t);

  const base = cfg.radiusPx;
  const radius = base * (0.35 + 0.95 * eased);
  const alpha = 1 - eased;

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.lineWidth = cfg.lineWidthPx;
  ctx.strokeStyle = cfg.color;
  ctx.fillStyle = cfg.fillColor;

  ctx.shadowColor = 'rgba(0, 0, 0, 0.25)';
  ctx.shadowBlur = 8;

  ctx.beginPath();
  ctx.arc(x, y, radius, 0, Math.PI * 2);
  ctx.stroke();

  ctx.shadowBlur = 0;

  if (type === 'double_click' || type === 'triple_click') {
    ctx.globalAlpha = 1;
    ctx.fillStyle = cfg.color;
    ctx.font = `700 ${Math.max(10, Math.round(base * 0.6))}px system-ui, -apple-system, Segoe UI, Roboto, sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(type === 'double_click' ? '2×' : '3×', x, y);
  } else {
    ctx.beginPath();
    ctx.arc(x, y, Math.max(2, base * 0.16), 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function drawArrowHead(
  ctx: OffscreenCanvasRenderingContext2D,
  x1: number,
  y1: number,
  x2: number,
  y2: number,
  size: number,
): void {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const len = Math.hypot(dx, dy);
  if (!Number.isFinite(len) || len < 1) return;

  const ux = dx / len;
  const uy = dy / len;
  const px = -uy;
  const py = ux;

  const headLen = size;
  const headWidth = size * 0.65;

  const backX = x2 - ux * headLen;
  const backY = y2 - uy * headLen;

  ctx.beginPath();
  ctx.moveTo(x2, y2);
  ctx.lineTo(backX + px * headWidth, backY + py * headWidth);
  ctx.lineTo(backX - px * headWidth, backY - py * headWidth);
  ctx.closePath();
  ctx.fill();
}

function drawDragPath(
  ctx: OffscreenCanvasRenderingContext2D,
  start: Point,
  end: Point,
  progress: number,
  cfg: ResolvedDragPathConfig,
): void {
  const t = clamp(progress, 0, 1);
  const alpha = 1 - easeOutCubic(t);

  ctx.save();
  ctx.globalAlpha = alpha;

  ctx.strokeStyle = cfg.color;
  ctx.fillStyle = cfg.color;
  ctx.lineWidth = cfg.lineWidthPx;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.setLineDash(cfg.dash);

  ctx.shadowColor = 'rgba(0, 0, 0, 0.2)';
  ctx.shadowBlur = 6;

  ctx.beginPath();
  ctx.moveTo(start.x, start.y);
  ctx.lineTo(end.x, end.y);
  ctx.stroke();

  ctx.setLineDash([]);
  ctx.shadowBlur = 0;

  ctx.beginPath();
  ctx.arc(start.x, start.y, cfg.startDotRadiusPx, 0, Math.PI * 2);
  ctx.fill();

  ctx.beginPath();
  ctx.arc(end.x, end.y, cfg.endDotRadiusPx, 0, Math.PI * 2);
  ctx.fill();

  drawArrowHead(ctx, start.x, start.y, end.x, end.y, cfg.arrowSizePx);

  ctx.restore();
}

function drawLabelPill(
  ctx: OffscreenCanvasRenderingContext2D,
  text: string,
  anchor: Point | null,
  alpha: number,
  cfg: ResolvedLabelsConfig,
  outputWidth: number,
  outputHeight: number,
): void {
  ctx.save();
  ctx.globalAlpha = clamp(alpha, 0, 1);

  ctx.font = cfg.font;
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';

  const metrics = ctx.measureText(text);
  const ascent = Number.isFinite(metrics.actualBoundingBoxAscent)
    ? metrics.actualBoundingBoxAscent
    : 10;
  const descent = Number.isFinite(metrics.actualBoundingBoxDescent)
    ? metrics.actualBoundingBoxDescent
    : 4;
  const textHeight = ascent + descent;
  const pillWidth = Math.ceil(metrics.width + cfg.paddingX * 2);
  const pillHeight = Math.ceil(textHeight + cfg.paddingY * 2);

  const margin = 4;
  const ax = anchor?.x ?? margin;
  const ay = anchor?.y ?? margin;

  let x = ax + cfg.offsetPx;
  let y = ay - pillHeight / 2;

  if (x + pillWidth > outputWidth - margin) x = ax - cfg.offsetPx - pillWidth;
  if (y < margin) y = ay + cfg.offsetPx;
  if (y + pillHeight > outputHeight - margin) y = outputHeight - margin - pillHeight;

  x = clamp(x, margin, Math.max(margin, outputWidth - margin - pillWidth));
  y = clamp(y, margin, Math.max(margin, outputHeight - margin - pillHeight));

  ctx.fillStyle = cfg.backgroundColor;
  ctx.strokeStyle = cfg.borderColor;
  ctx.lineWidth = 1;

  ctx.beginPath();
  buildRoundedRectPath(ctx, x, y, pillWidth, pillHeight, cfg.radiusPx);
  ctx.fill();
  ctx.stroke();

  ctx.fillStyle = cfg.textColor;
  ctx.fillText(text, x + cfg.paddingX, y + pillHeight / 2);

  ctx.restore();
}

// ============================================================================
// Schema Input Normalization
// ============================================================================

/**
 * External schema input type that supports both shorthand (boolean) and full config.
 * This maps to what users pass via the MCP tool schema.
 */
interface SchemaEnhancedRenderingInput {
  // Global toggle (Schema allows `true` to enable all defaults)
  enabled?: boolean;

  // Sub-configs can be boolean (enable/disable) or object (custom config)
  clickIndicators?:
    | boolean
    | {
        enabled?: boolean;
        // Schema aliases (from tools.ts)
        color?: string;
        radius?: number; // alias for radiusPx
        animationDurationMs?: number; // alias for durationMs
        animationFrames?: number;
        animationIntervalMs?: number;
      };

  dragPaths?:
    | boolean
    | {
        enabled?: boolean;
        color?: string;
        lineWidth?: number; // alias for lineWidthPx
        lineDash?: number[]; // alias for dash
        arrowSize?: number; // alias for arrowSizePx
      };

  labels?:
    | boolean
    | {
        enabled?: boolean;
        font?: string;
        textColor?: string;
        bgColor?: string; // alias for backgroundColor
        padding?: number; // alias for paddingX/paddingY
        borderRadius?: number; // alias for radiusPx
        offset?: { x?: number; y?: number } | number; // alias for offsetPx
      };

  durationMs?: number; // global fallback duration for all overlays
}

function normalizeSchemaInput(raw: unknown): GifEnhancedRenderingConfig | undefined {
  // Handle `true` shorthand - enable with all defaults
  if (raw === true) {
    return { enabled: true };
  }

  // Handle `false` or falsy
  if (!raw || typeof raw !== 'object') {
    return undefined;
  }

  const input = raw as SchemaEnhancedRenderingInput;
  const result: GifEnhancedRenderingConfig = {};

  // Global enabled
  result.enabled = input.enabled ?? true; // If object passed, default to enabled

  // Global duration fallback
  const globalDuration = typeof input.durationMs === 'number' ? input.durationMs : undefined;

  // Normalize clickIndicators
  if (input.clickIndicators === false) {
    result.clickIndicators = { enabled: false };
  } else if (input.clickIndicators === true) {
    result.clickIndicators = { enabled: true };
  } else if (typeof input.clickIndicators === 'object') {
    const ci = input.clickIndicators;
    result.clickIndicators = {
      enabled: ci.enabled ?? true,
      color: ci.color,
      radiusPx: ci.radius,
      durationMs: ci.animationDurationMs ?? globalDuration,
      animationFrames: ci.animationFrames,
      animationIntervalMs: ci.animationIntervalMs,
    };
  }

  // Normalize dragPaths
  if (input.dragPaths === false) {
    result.dragPaths = { enabled: false };
  } else if (input.dragPaths === true) {
    result.dragPaths = { enabled: true };
  } else if (typeof input.dragPaths === 'object') {
    const dp = input.dragPaths;
    result.dragPaths = {
      enabled: dp.enabled ?? true,
      color: dp.color,
      lineWidthPx: dp.lineWidth,
      dash: dp.lineDash,
      arrowSizePx: dp.arrowSize,
      durationMs: globalDuration,
    };
  }

  // Normalize labels
  if (input.labels === false) {
    result.labels = { enabled: false };
  } else if (input.labels === true) {
    result.labels = { enabled: true };
  } else if (typeof input.labels === 'object') {
    const lb = input.labels;
    const offset = lb.offset;
    const offsetPx =
      typeof offset === 'number' ? offset : typeof offset === 'object' ? offset.x : undefined;
    result.labels = {
      enabled: lb.enabled ?? true,
      font: lb.font,
      textColor: lb.textColor,
      backgroundColor: lb.bgColor,
      paddingX: typeof lb.padding === 'number' ? lb.padding : undefined,
      paddingY: typeof lb.padding === 'number' ? lb.padding : undefined,
      radiusPx: lb.borderRadius,
      offsetPx,
      durationMs: globalDuration,
    };
  }

  return result;
}

// ============================================================================
// Config Resolution
// ============================================================================

export function resolveGifEnhancedRenderingConfig(
  input?: GifEnhancedRenderingConfig | unknown,
): ResolvedGifEnhancedRenderingConfig {
  // Normalize schema input (handles `true`, boolean sub-configs, field aliases)
  const normalized = normalizeSchemaInput(input) ?? (input as GifEnhancedRenderingConfig);
  const enabled = normalized?.enabled ?? false;

  const clickIntervalMs = normalizePositiveInt(
    normalized?.clickIndicators?.animationIntervalMs,
    80,
    20,
    500,
  );
  const clickDelayCsFallback = Math.max(1, Math.round(clickIntervalMs / 10));

  return {
    enabled,
    clickIndicators: {
      enabled: normalized?.clickIndicators?.enabled ?? true,
      color: normalized?.clickIndicators?.color ?? '#FF6A00',
      fillColor: normalized?.clickIndicators?.fillColor ?? 'rgba(255, 106, 0, 0.18)',
      radiusPx: normalizePositiveNumber(normalized?.clickIndicators?.radiusPx, 18, 4, 96),
      lineWidthPx: normalizePositiveNumber(normalized?.clickIndicators?.lineWidthPx, 3, 1, 16),
      durationMs: normalizePositiveInt(normalized?.clickIndicators?.durationMs, 520, 120, 5000),
      animationFrames: normalizePositiveInt(normalized?.clickIndicators?.animationFrames, 3, 1, 8),
      animationIntervalMs: clickIntervalMs,
      animationFrameDelayCs: normalizePositiveInt(
        normalized?.clickIndicators?.animationFrameDelayCs,
        clickDelayCsFallback,
        1,
        100,
      ),
    },
    dragPaths: {
      enabled: normalized?.dragPaths?.enabled ?? true,
      color: normalized?.dragPaths?.color ?? '#FF2D55',
      lineWidthPx: normalizePositiveNumber(normalized?.dragPaths?.lineWidthPx, 4, 1, 20),
      durationMs: normalizePositiveInt(normalized?.dragPaths?.durationMs, 1000, 120, 8000),
      arrowSizePx: normalizePositiveNumber(normalized?.dragPaths?.arrowSizePx, 10, 4, 40),
      dash: normalizeDash(normalized?.dragPaths?.dash, [10, 8]),
      startDotRadiusPx: normalizePositiveNumber(normalized?.dragPaths?.startDotRadiusPx, 4, 2, 24),
      endDotRadiusPx: normalizePositiveNumber(normalized?.dragPaths?.endDotRadiusPx, 5, 2, 24),
    },
    labels: {
      enabled: normalized?.labels?.enabled ?? false,
      mode: normalized?.labels?.mode ?? 'both',
      showForClicks: normalized?.labels?.showForClicks ?? false,
      font:
        normalized?.labels?.font ??
        '600 13px system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      maxLength: normalizePositiveInt(normalized?.labels?.maxLength, 48, 8, 200),
      durationMs: normalizePositiveInt(normalized?.labels?.durationMs, 1200, 120, 12000),
      backgroundColor: normalized?.labels?.backgroundColor ?? 'rgba(0, 0, 0, 0.72)',
      borderColor: normalized?.labels?.borderColor ?? 'rgba(255, 255, 255, 0.14)',
      textColor: normalized?.labels?.textColor ?? '#FFFFFF',
      paddingX: normalizePositiveNumber(normalized?.labels?.paddingX, 10, 2, 40),
      paddingY: normalizePositiveNumber(normalized?.labels?.paddingY, 6, 2, 30),
      radiusPx: normalizePositiveNumber(normalized?.labels?.radiusPx, 10, 0, 30),
      offsetPx: normalizePositiveNumber(normalized?.labels?.offsetPx, 12, 0, 80),
    },
  };
}

// ============================================================================
// Capture Plan
// ============================================================================

export function resolveCapturePlanForAction(
  config: ResolvedGifEnhancedRenderingConfig,
  action: ActionMetadata | undefined,
  defaultFrameDelayCs: number,
): CapturePlan {
  const base: CapturePlan = { frames: 1, intervalMs: 0, delayCs: defaultFrameDelayCs };
  if (!config.enabled || !action) return base;

  if (config.clickIndicators.enabled && CLICK_ACTIONS.includes(action.type)) {
    const frames = config.clickIndicators.animationFrames;
    if (frames > 1) {
      return {
        frames,
        intervalMs: config.clickIndicators.animationIntervalMs,
        delayCs: config.clickIndicators.animationFrameDelayCs,
      };
    }
  }

  return base;
}

// ============================================================================
// Main Render Function
// ============================================================================

export function renderGifEnhancedOverlays(params: RenderGifEnhancedOverlaysParams): void {
  const { ctx, outputWidth, outputHeight, viewportWidth, viewportHeight, nowMs, events, config } =
    params;

  if (!config.enabled || events.length === 0) return;

  const clickCfg = config.clickIndicators;
  const dragCfg = config.dragPaths;
  const labelCfg = config.labels;

  for (const event of events) {
    const ageMs = nowMs - event.atMs;
    if (!Number.isFinite(ageMs) || ageMs < 0) continue;

    const action = event.action;

    if (clickCfg.enabled && CLICK_ACTIONS.includes(action.type)) {
      const anchor = resolveAnchorPoint(action);
      if (anchor) {
        const p = projectPoint(anchor, viewportWidth, viewportHeight, outputWidth, outputHeight);
        if (p)
          drawClickIndicator(ctx, p.x, p.y, ageMs / clickCfg.durationMs, action.type, clickCfg);
      }
    }

    if (dragCfg.enabled && action.type === 'drag') {
      const start = action.startCoordinates || null;
      const end = action.endCoordinates || action.coordinates || null;
      if (start && end) {
        const p1 = projectPoint(start, viewportWidth, viewportHeight, outputWidth, outputHeight);
        const p2 = projectPoint(end, viewportWidth, viewportHeight, outputWidth, outputHeight);
        if (p1 && p2) drawDragPath(ctx, p1, p2, ageMs / dragCfg.durationMs, dragCfg);
      }
    }

    // Labels: only forced for explicit annotation actions.
    // Having `action.label` (e.g. "Click" from click tools) must NOT bypass labels.enabled —
    // otherwise demos always show a "Click" pill even when labels are off.
    const isAnnotation = action.type === 'annotation';
    const shouldRenderLabel = labelCfg.enabled || isAnnotation;

    if (shouldRenderLabel) {
      const text = resolveActionLabel(action, labelCfg);
      if (text) {
        const anchor = resolveAnchorPoint(action);
        const p = anchor
          ? projectPoint(anchor, viewportWidth, viewportHeight, outputWidth, outputHeight)
          : null;

        const t = clamp(ageMs / labelCfg.durationMs, 0, 1);
        const alpha = 1 - clamp((t - 0.75) / 0.25, 0, 1);

        drawLabelPill(ctx, text, p, alpha, labelCfg, outputWidth, outputHeight);
      }
    }
  }
}

// ============================================================================
// Event Pruning
// ============================================================================

export function pruneActionEventsInPlace(
  events: ActionEvent[],
  nowMs: number,
  config: ResolvedGifEnhancedRenderingConfig,
): void {
  if (events.length === 0) return;

  // Check if any events have annotations (which are always rendered)
  const hasAnnotations = events.some(
    (e) => e.action.type === 'annotation' || typeof e.action.label === 'string',
  );

  let maxLifetimeMs = 0;
  if (config.enabled) {
    if (config.clickIndicators.enabled)
      maxLifetimeMs = Math.max(maxLifetimeMs, config.clickIndicators.durationMs);
    if (config.dragPaths.enabled)
      maxLifetimeMs = Math.max(maxLifetimeMs, config.dragPaths.durationMs);
    if (config.labels.enabled) maxLifetimeMs = Math.max(maxLifetimeMs, config.labels.durationMs);
  }

  // Always account for label duration if there are annotations (they're always rendered)
  if (hasAnnotations) {
    maxLifetimeMs = Math.max(maxLifetimeMs, config.labels.durationMs);
  }

  if (maxLifetimeMs <= 0) {
    events.length = 0;
    return;
  }

  const cutoff = nowMs - maxLifetimeMs - 250;
  let dropCount = 0;
  while (dropCount < events.length && events[dropCount].atMs < cutoff) dropCount++;
  if (dropCount > 0) events.splice(0, dropCount);
}
