import { Layer, Selection } from "@/types/editor";
import { createCanvas, ctx2d } from "./canvas";

export function emptySelection(): Selection {
  return { mask: null, bounds: null };
}

export function rectSelection(
  docW: number,
  docH: number,
  x: number,
  y: number,
  w: number,
  h: number
): Selection {
  const mask = createCanvas(docW, docH);
  const c = ctx2d(mask);
  c.fillStyle = "white";
  c.fillRect(x, y, w, h);
  const path = new Path2D();
  path.rect(x, y, w, h);
  return { mask, bounds: { x, y, width: w, height: h }, path };
}

export function ellipseSelection(
  docW: number,
  docH: number,
  x: number,
  y: number,
  w: number,
  h: number
): Selection {
  const mask = createCanvas(docW, docH);
  const c = ctx2d(mask);
  c.fillStyle = "white";
  c.beginPath();
  c.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  c.fill();
  const path = new Path2D();
  path.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
  return { mask, bounds: { x, y, width: w, height: h }, path };
}

export function polygonSelection(
  docW: number,
  docH: number,
  pts: { x: number; y: number }[]
): Selection {
  if (pts.length < 3) return emptySelection();
  const mask = createCanvas(docW, docH);
  const c = ctx2d(mask);
  c.fillStyle = "white";
  c.beginPath();
  c.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) c.lineTo(pts[i].x, pts[i].y);
  c.closePath();
  c.fill();
  const path = new Path2D();
  path.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) path.lineTo(pts[i].x, pts[i].y);
  path.closePath();
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const p of pts) {
    if (p.x < minX) minX = p.x;
    if (p.y < minY) minY = p.y;
    if (p.x > maxX) maxX = p.x;
    if (p.y > maxY) maxY = p.y;
  }
  return {
    mask,
    bounds: { x: minX, y: minY, width: maxX - minX, height: maxY - minY },
    path,
  };
}

// Magic wand: flood fill on a sampled doc composite at (sx,sy) within `tolerance`.
export function magicWandSelection(
  composite: HTMLCanvasElement,
  sx: number,
  sy: number,
  tolerance: number
): Selection {
  const w = composite.width;
  const h = composite.height;
  const data = ctx2d(composite).getImageData(0, 0, w, h);
  const src = data.data;
  const idx0 = (Math.floor(sy) * w + Math.floor(sx)) * 4;
  const r0 = src[idx0];
  const g0 = src[idx0 + 1];
  const b0 = src[idx0 + 2];
  const a0 = src[idx0 + 3];

  const visited = new Uint8Array(w * h);
  const stack: number[] = [Math.floor(sy) * w + Math.floor(sx)];
  const mask = createCanvas(w, h);
  const mctx = ctx2d(mask);
  const out = mctx.createImageData(w, h);
  const od = out.data;

  const tol2 = tolerance * tolerance * 4;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

  while (stack.length) {
    const p = stack.pop()!;
    if (visited[p]) continue;
    visited[p] = 1;
    const i = p * 4;
    const dr = src[i] - r0;
    const dg = src[i + 1] - g0;
    const db = src[i + 2] - b0;
    const da = src[i + 3] - a0;
    if (dr * dr + dg * dg + db * db + da * da > tol2) continue;
    od[i] = 255;
    od[i + 1] = 255;
    od[i + 2] = 255;
    od[i + 3] = 255;
    const x = p % w;
    const y = (p - x) / w;
    if (x < minX) minX = x;
    if (y < minY) minY = y;
    if (x > maxX) maxX = x;
    if (y > maxY) maxY = y;
    if (x > 0) stack.push(p - 1);
    if (x < w - 1) stack.push(p + 1);
    if (y > 0) stack.push(p - w);
    if (y < h - 1) stack.push(p + w);
  }
  mctx.putImageData(out, 0, 0);
  if (minX === Infinity) return emptySelection();
  return {
    mask,
    bounds: {
      x: minX,
      y: minY,
      width: maxX - minX + 1,
      height: maxY - minY + 1,
    },
    outline: edgeCanvas(out, w, h),
  };
}

// Build a canvas with 1px-wide white outline of the input mask (used for magic wand).
function edgeCanvas(maskData: ImageData, w: number, h: number): HTMLCanvasElement {
  const out = createCanvas(w, h);
  const ctx = ctx2d(out);
  const img = ctx.createImageData(w, h);
  const d = maskData.data;
  const o = img.data;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      if (d[i + 3] < 128) continue;
      // Check 4-neighbors
      const up = y > 0 ? d[((y - 1) * w + x) * 4 + 3] : 0;
      const dn = y < h - 1 ? d[((y + 1) * w + x) * 4 + 3] : 0;
      const lf = x > 0 ? d[(y * w + x - 1) * 4 + 3] : 0;
      const rt = x < w - 1 ? d[(y * w + x + 1) * 4 + 3] : 0;
      if (up < 128 || dn < 128 || lf < 128 || rt < 128) {
        o[i] = 255;
        o[i + 1] = 255;
        o[i + 2] = 255;
        o[i + 3] = 255;
      }
    }
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// Draw the selection: a translucent tint over the selected region, plus a
// high-contrast marching-ants outline. Caller has already applied the
// doc-space transform (translate+scale) to `ctx`.
export function drawSelectionAnts(
  ctx: CanvasRenderingContext2D,
  selection: Selection,
  zoom: number,
  dashOffset: number
): void {
  if (!selection.mask) return;
  ctx.save();

  // Tint the selected region for legibility (semi-transparent blue).
  ctx.globalAlpha = 0.18;
  ctx.globalCompositeOperation = "source-over";
  // Use the mask as a clipping shape via destination-in trick on a scratch.
  // Simpler: drawImage of the mask with a tint via a temp canvas.
  const tinted = tintMask(selection.mask, "#4c8bf5");
  ctx.drawImage(tinted, 0, 0);
  ctx.globalAlpha = 1;

  // Outline
  if (selection.path) {
    // Two-pass dashed stroke for the marching-ants effect.
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.lineDashOffset = -dashOffset / zoom;
    ctx.strokeStyle = "#000";
    ctx.stroke(selection.path);
    ctx.lineDashOffset = -dashOffset / zoom + 5 / zoom;
    ctx.strokeStyle = "#fff";
    ctx.stroke(selection.path);
  } else if (selection.outline) {
    // Magic-wand: outline canvas is already 1px white edges. Composite the
    // marching-ants stripe pattern in a scratch canvas first — using `source-in`
    // directly on the main ctx would wipe out the document composite that was
    // already rendered into the viewport.
    const tmp = createCanvas(selection.outline.width, selection.outline.height);
    const tctx = ctx2d(tmp);
    tctx.imageSmoothingEnabled = false;
    tctx.drawImage(selection.outline, 0, 0);
    const stripe = stripePattern(tctx, dashOffset);
    if (stripe) {
      tctx.globalCompositeOperation = "source-in";
      tctx.fillStyle = stripe;
      tctx.fillRect(0, 0, tmp.width, tmp.height);
    }
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(tmp, 0, 0);
  } else if (selection.bounds) {
    // Last resort: bounds rectangle.
    const b = selection.bounds;
    ctx.lineWidth = 1.5 / zoom;
    ctx.setLineDash([5 / zoom, 5 / zoom]);
    ctx.lineDashOffset = -dashOffset / zoom;
    ctx.strokeStyle = "#000";
    ctx.strokeRect(b.x, b.y, b.width, b.height);
    ctx.lineDashOffset = -dashOffset / zoom + 5 / zoom;
    ctx.strokeStyle = "#fff";
    ctx.strokeRect(b.x, b.y, b.width, b.height);
  }

  ctx.restore();
}

function tintMask(mask: HTMLCanvasElement, color: string): HTMLCanvasElement {
  const out = createCanvas(mask.width, mask.height);
  const ctx = ctx2d(out);
  ctx.fillStyle = color;
  ctx.fillRect(0, 0, out.width, out.height);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(mask, 0, 0);
  return out;
}

// --- Selection operations -------------------------------------------------

export function selectAll(docW: number, docH: number): Selection {
  return rectSelection(docW, docH, 0, 0, docW, docH);
}

// Inverse: produce a mask that selects everything currently unselected.
export function invertSelection(sel: Selection, docW: number, docH: number): Selection {
  if (!sel.mask) return emptySelection();
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  // Start fully selected (white), then knock out the existing selection.
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, docW, docH);
  // Convert the existing mask to alpha-based shape, then subtract.
  ctx.globalCompositeOperation = "destination-out";
  // The mask uses opaque white where selected; drawImage of it directly knocks the right pixels out.
  ctx.drawImage(sel.mask, 0, 0);
  ctx.globalCompositeOperation = "source-over";
  return {
    mask: out,
    bounds: { x: 0, y: 0, width: docW, height: docH },
  };
}

// Selection from the alpha of a layer (its visible pixels become the selection).
export function selectFromLayerAlpha(
  layer: Layer,
  docW: number,
  docH: number
): Selection {
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate(layer.rotation);
  // Draw the layer's pixels — alpha becomes the selection.
  ctx.drawImage(layer.canvas, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  ctx.restore();
  // Force the RGB to white so it's a pure alpha mask.
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = "white";
  ctx.fillRect(0, 0, docW, docH);
  ctx.globalCompositeOperation = "source-over";
  // Compute bounds
  const bounds = maskBounds(out);
  return { mask: out, bounds };
}

// Feather: Gaussian blur the alpha edge of the selection mask.
export function featherSelection(sel: Selection, radius: number, docW: number, docH: number): Selection {
  if (!sel.mask || radius <= 0) return sel;
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.filter = `blur(${radius}px)`;
  ctx.drawImage(sel.mask, 0, 0);
  ctx.filter = "none";
  return { mask: out, bounds: maskBounds(out) };
}

// Expand: dilate the selection by `px`. Implemented via blur+threshold for speed.
export function expandSelection(sel: Selection, px: number, docW: number, docH: number): Selection {
  if (!sel.mask || px <= 0) return sel;
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(sel.mask, 0, 0);
  ctx.filter = "none";
  thresholdAlphaInPlace(out, 8); // anything with even a little alpha after blur becomes selected
  return { mask: out, bounds: maskBounds(out) };
}

// Contract: erode the selection by `px`. Blur+high-threshold approximation.
export function contractSelection(sel: Selection, px: number, docW: number, docH: number): Selection {
  if (!sel.mask || px <= 0) return sel;
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.filter = `blur(${px}px)`;
  ctx.drawImage(sel.mask, 0, 0);
  ctx.filter = "none";
  thresholdAlphaInPlace(out, 220); // keep only highly-covered pixels
  return { mask: out, bounds: maskBounds(out) };
}

function thresholdAlphaInPlace(c: HTMLCanvasElement, t: number): void {
  const ctx = ctx2d(c);
  const img = ctx.getImageData(0, 0, c.width, c.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const a = d[i + 3] >= t ? 255 : 0;
    d[i] = 255; d[i + 1] = 255; d[i + 2] = 255; d[i + 3] = a;
  }
  ctx.putImageData(img, 0, 0);
}

function maskBounds(c: HTMLCanvasElement): Selection["bounds"] {
  const w = c.width, h = c.height;
  const data = ctx2d(c).getImageData(0, 0, w, h).data;
  let minX = w, minY = h, maxX = -1, maxY = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] > 8) {
        if (x < minX) minX = x;
        if (x > maxX) maxX = x;
        if (y < minY) minY = y;
        if (y > maxY) maxY = y;
      }
    }
  }
  if (maxX < 0) return null;
  return { x: minX, y: minY, width: maxX - minX + 1, height: maxY - minY + 1 };
}

// --- Clipboard extraction --------------------------------------------------

// Render a layer's pixels into a doc-sized canvas at its transform.
function rasterizeLayerToDoc(layer: Layer, docW: number, docH: number): HTMLCanvasElement {
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate(layer.rotation);
  ctx.drawImage(layer.canvas, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  ctx.restore();
  return out;
}

// Extract the layer's pixels within `selection`, cropped to the selection bounds.
// Returns the cropped pixel canvas plus the doc-space origin (x,y) where it came from.
// Returns null if the selection has no mask, no bounds, or is empty.
export function extractSelectionFromLayer(
  layer: Layer,
  selection: Selection,
  docW: number,
  docH: number
): { canvas: HTMLCanvasElement; x: number; y: number } | null {
  if (!selection.mask || !selection.bounds) return null;
  const b = selection.bounds;
  if (b.width <= 0 || b.height <= 0) return null;
  // Render the layer at doc-space, then mask to the selection.
  const docSized = rasterizeLayerToDoc(layer, docW, docH);
  const mctx = ctx2d(docSized);
  mctx.globalCompositeOperation = "destination-in";
  mctx.drawImage(selection.mask, 0, 0);
  mctx.globalCompositeOperation = "source-over";
  // Crop to selection bounds.
  const out = createCanvas(b.width, b.height);
  ctx2d(out).drawImage(docSized, b.x, b.y, b.width, b.height, 0, 0, b.width, b.height);
  return { canvas: out, x: b.x, y: b.y };
}

// Erase the selection's pixels from a layer's canvas (used by Cut).
export function eraseSelectionFromLayer(layer: Layer, selection: Selection): void {
  if (!selection.mask) return;
  const ctx = ctx2d(layer.canvas);
  ctx.save();
  // Map the doc-space mask into the layer's local pixel coordinates:
  //   doc → centered/rotated → translated to layer-canvas origin, then scaled to canvas pixels.
  const sx = layer.canvas.width / layer.width;
  const sy = layer.canvas.height / layer.height;
  ctx.scale(sx, sy);
  ctx.translate(layer.width / 2, layer.height / 2);
  ctx.rotate(-layer.rotation);
  ctx.translate(-(layer.x + layer.width / 2), -(layer.y + layer.height / 2));
  ctx.globalCompositeOperation = "destination-out";
  ctx.drawImage(selection.mask, 0, 0);
  ctx.restore();
}

let stripeCache: { offset: number; pattern: CanvasPattern } | null = null;
function stripePattern(ctx: CanvasRenderingContext2D, offset: number): CanvasPattern | null {
  // 10px alternating black/white stripe; shifted by `offset` to animate.
  if (stripeCache && stripeCache.offset === offset) return stripeCache.pattern;
  const c = createCanvas(10, 10);
  const cc = ctx2d(c);
  cc.fillStyle = "#000";
  cc.fillRect(0, 0, 10, 10);
  cc.fillStyle = "#fff";
  for (let i = 0; i < 10; i++) {
    if (((i + offset) % 10) < 5) cc.fillRect(0, i, 10, 1);
  }
  const p = ctx.createPattern(c, "repeat");
  if (!p) return null;
  stripeCache = { offset, pattern: p };
  return p;
}
