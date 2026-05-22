import { BrushSettings, Layer, Selection } from "@/types/editor";
import { createCanvas, ctx2d } from "./canvas";
import { getBrush, renderTip } from "./brushes/registry";

// Persistent stroke state — must live for the duration of a single stroke so we can
// space out stamps correctly across multiple `paintSegment` calls.
export interface StrokeState {
  // Distance accumulated since the last stamp (in layer-local pixels).
  accum: number;
  // Last stamped layer-local position, used as the previous segment endpoint.
  last?: { x: number; y: number };
}

export function createStrokeState(): StrokeState {
  return { accum: 0 };
}

// Convert doc-space point to layer-local pixel coordinates, accounting for layer transform.
function docToLayer(layer: Layer, x: number, y: number): { x: number; y: number } {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-layer.rotation);
  const sin = Math.sin(-layer.rotation);
  const lx = dx * cos - dy * sin + layer.width / 2;
  const ly = dx * sin + dy * cos + layer.height / 2;
  // If layer is uniformly sized to its canvas, then layer-local == canvas-local.
  const sx = layer.canvas.width / layer.width;
  const sy = layer.canvas.height / layer.height;
  return { x: lx * sx, y: ly * sy };
}

export interface StrokeSeg {
  fromDoc: { x: number; y: number };
  toDoc: { x: number; y: number };
}

// Apply a stroke segment to the target buffer of a layer (either its canvas or its mask).
// Honors selection by clipping with selection.mask.
//
// `state` carries cross-segment information (stamp accumulator) so spacing stays
// consistent across a continuous stroke. Pass undefined for one-off stamps.
export function paintSegment(
  layer: Layer,
  target: HTMLCanvasElement,
  seg: StrokeSeg,
  brush: BrushSettings,
  isEraser: boolean,
  selection: Selection,
  isMaskTarget: boolean,
  state?: StrokeState
): void {
  const a = docToLayer(layer, seg.fromDoc.x, seg.fromDoc.y);
  const b = docToLayer(layer, seg.toDoc.x, seg.toDoc.y);

  // Build the stroke onto a scratch the same size as target, then composite respecting
  // the selection if present.
  const scratch = createCanvas(target.width, target.height);
  const c = ctx2d(scratch);

  const preset = getBrush(brush.presetId) ?? getBrush("medium-round")!;
  const spacing = Math.max(0.02, brush.spacing ?? preset.spacing) * brush.size;

  // Color for the stamps. When painting a mask we stamp in pure white/black; when
  // erasing pixels we stamp opaque black on the scratch and composite with destination-out.
  let color: string;
  if (isMaskTarget) color = isEraser ? "#000000" : "#ffffff";
  else color = isEraser ? "#000000" : brush.color;
  const stampAlpha = Math.max(0, Math.min(1, brush.opacity * brush.flow));

  // For the soft-round / hard-round generated tips we apply per-stroke hardness
  // by regenerating the tip from the global registry's cached tip image — but
  // because the registry tips are precomputed, we approximate hardness by drawing
  // through a radial gradient mask. For other brushes we use the tip directly.
  const tip = renderTip(preset, brush.size, color, stampAlpha);

  // Walk the segment, stamping at every `spacing` interval. `state.accum` carries
  // any leftover distance from the previous segment so dots stay evenly spaced.
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dist = Math.hypot(dx, dy);
  let walked = 0;

  const stamp = (x: number, y: number) => {
    c.drawImage(tip.canvas, x - tip.diameter / 2, y - tip.diameter / 2);
  };

  // Stamp at the start of a stroke (when state has no previous point).
  if (state && !state.last) {
    stamp(a.x, a.y);
    state.last = { x: a.x, y: a.y };
    state.accum = 0;
  }

  if (dist > 0.0001) {
    const ux = dx / dist;
    const uy = dy / dist;
    let remaining = (state?.accum ?? 0);
    // First stamp falls at `spacing - remaining` from a.
    let next = spacing - remaining;
    while (next <= dist) {
      const sx = a.x + ux * next;
      const sy = a.y + uy * next;
      stamp(sx, sy);
      walked = next;
      next += spacing;
    }
    if (state) {
      state.accum = (state.accum + dist) % spacing;
      state.last = { x: b.x, y: b.y };
    }
  }

  // Clip to selection (in layer-local space).
  if (selection.mask) {
    const clip = layerLocalSelectionClip(layer, selection.mask);
    c.globalCompositeOperation = "destination-in";
    c.drawImage(clip, 0, 0);
    c.globalCompositeOperation = "source-over";
  }

  // Composite scratch onto target.
  const t = ctx2d(target);
  if (isMaskTarget) {
    t.globalCompositeOperation = "source-over";
    t.drawImage(scratch, 0, 0);
  } else if (isEraser) {
    t.globalCompositeOperation = "destination-out";
    t.drawImage(scratch, 0, 0);
  } else {
    t.globalCompositeOperation = "source-over";
    t.drawImage(scratch, 0, 0);
  }
  t.globalCompositeOperation = "source-over";
  void walked;
}

function layerLocalSelectionClip(
  layer: Layer,
  docMask: HTMLCanvasElement
): HTMLCanvasElement {
  const out = createCanvas(layer.canvas.width, layer.canvas.height);
  const ctx = ctx2d(out);
  ctx.save();
  // Transform docMask into layer-local space (inverse of layer transform).
  const sx = layer.canvas.width / layer.width;
  const sy = layer.canvas.height / layer.height;
  ctx.scale(sx, sy);
  ctx.translate(layer.width / 2, layer.height / 2);
  ctx.rotate(-layer.rotation);
  ctx.translate(-(layer.x + layer.width / 2), -(layer.y + layer.height / 2));
  ctx.drawImage(docMask, 0, 0);
  ctx.restore();
  return out;
}

// Fill the entire target (the layer canvas or its mask), clipped by the current selection.
export function fillLayer(
  layer: Layer,
  color: string,
  selection: Selection,
  isMaskTarget: boolean
): void {
  const target = isMaskTarget ? layer.mask! : layer.canvas;
  const ctx = ctx2d(target);
  ctx.save();
  if (selection.mask) {
    const clip = layerLocalSelectionClip(layer, selection.mask);
    const scratch = createCanvas(target.width, target.height);
    const sctx = ctx2d(scratch);
    sctx.fillStyle = color;
    sctx.fillRect(0, 0, scratch.width, scratch.height);
    sctx.globalCompositeOperation = "destination-in";
    sctx.drawImage(clip, 0, 0);
    ctx.drawImage(scratch, 0, 0);
  } else {
    ctx.fillStyle = color;
    ctx.fillRect(0, 0, target.width, target.height);
  }
  ctx.restore();
}

// Paint-bucket flood fill: starting at doc-space (px, py), replace all connected
// pixels on the layer whose color is within `tolerance` of the start pixel.
// Honors the current selection if present.
export function bucketFill(
  layer: Layer,
  docPx: number,
  docPy: number,
  color: string,
  tolerance: number,
  selection: Selection,
  isMaskTarget: boolean
): boolean {
  const target = isMaskTarget ? layer.mask : layer.canvas;
  if (!target) return false;

  // Convert doc point to layer-local pixel
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const cos = Math.cos(-layer.rotation);
  const sin = Math.sin(-layer.rotation);
  const lx0 = (docPx - cx) * cos - (docPy - cy) * sin + layer.width / 2;
  const ly0 = (docPx - cx) * sin + (docPy - cy) * cos + layer.height / 2;
  const sxs = target.width / layer.width;
  const sys = target.height / layer.height;
  const sx = Math.floor(lx0 * sxs);
  const sy = Math.floor(ly0 * sys);
  if (sx < 0 || sy < 0 || sx >= target.width || sy >= target.height) return false;

  const ctx = ctx2d(target);
  const w = target.width;
  const h = target.height;
  const img = ctx.getImageData(0, 0, w, h);
  const d = img.data;
  const startIdx = (sy * w + sx) * 4;
  const r0 = d[startIdx];
  const g0 = d[startIdx + 1];
  const b0 = d[startIdx + 2];
  const a0 = d[startIdx + 3];

  const target2 = hexToRgba(color);
  // If clicking exactly the same color, nothing to do.
  if (target2.r === r0 && target2.g === g0 && target2.b === b0 && target2.a === a0) return false;

  // Optional selection mask in layer-local coords (canvas-pixel space)
  let selData: Uint8ClampedArray | null = null;
  if (selection.mask) {
    const clip = layerLocalSelectionClip(layer, selection.mask);
    selData = ctx2d(clip).getImageData(0, 0, w, h).data;
  }

  const tol2 = tolerance * tolerance * 4;
  const visited = new Uint8Array(w * h);
  const stack: number[] = [sy * w + sx];

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    if (selData && selData[i + 3] < 8) continue;
    const dr = d[i] - r0;
    const dg = d[i + 1] - g0;
    const db = d[i + 2] - b0;
    const da = d[i + 3] - a0;
    if (dr * dr + dg * dg + db * db + da * da > tol2) continue;
    d[i] = target2.r;
    d[i + 1] = target2.g;
    d[i + 2] = target2.b;
    d[i + 3] = target2.a;
    const x = p % w;
    const y = (p - x) / w;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  ctx.putImageData(img, 0, 0);
  return true;
}

// Render a gradient from one doc-space point to another onto a layer's canvas (or mask).
// Honors the current selection if present.
export function drawGradient(
  layer: Layer,
  fromDoc: { x: number; y: number },
  toDoc: { x: number; y: number },
  kind: "linear" | "radial",
  color0: string,
  color1: string,
  selection: Selection,
  isMaskTarget: boolean
): void {
  const target = isMaskTarget ? layer.mask : layer.canvas;
  if (!target) return;

  // Convert doc points to layer-local pixel coords (accounts for rotation + scale).
  const a = docToLayer(layer, fromDoc.x, fromDoc.y);
  const b = docToLayer(layer, toDoc.x, toDoc.y);

  const scratch = createCanvas(target.width, target.height);
  const ctx = ctx2d(scratch);

  let grad: CanvasGradient;
  if (kind === "linear") {
    grad = ctx.createLinearGradient(a.x, a.y, b.x, b.y);
  } else {
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const r = Math.max(1, Math.hypot(dx, dy));
    grad = ctx.createRadialGradient(a.x, a.y, 0, a.x, a.y, r);
  }
  grad.addColorStop(0, color0);
  grad.addColorStop(1, color1);
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, scratch.width, scratch.height);

  // Clip by selection (transformed into layer-local space).
  if (selection.mask) {
    const clip = layerLocalSelectionClip(layer, selection.mask);
    ctx.globalCompositeOperation = "destination-in";
    ctx.drawImage(clip, 0, 0);
    ctx.globalCompositeOperation = "source-over";
  }

  const t = ctx2d(target);
  t.globalCompositeOperation = "source-over";
  t.drawImage(scratch, 0, 0);
}

function hexToRgba(hex: string): { r: number; g: number; b: number; a: number } {
  let s = hex.trim();
  if (s.startsWith("#")) s = s.slice(1);
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  const r = parseInt(s.slice(0, 2), 16);
  const g = parseInt(s.slice(2, 4), 16);
  const b = parseInt(s.slice(4, 6), 16);
  const a = s.length >= 8 ? parseInt(s.slice(6, 8), 16) : 255;
  return { r: r || 0, g: g || 0, b: b || 0, a: a || 255 };
}
