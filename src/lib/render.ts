import { DocumentState, Layer, Viewport } from "@/types/editor";
import { createCanvas, ctx2d } from "./canvas";

// Render a single layer (with mask applied) into a transient canvas the size of the doc,
// positioned at (layer.x, layer.y) and rotated around its center.
function rasterizeLayerToDoc(layer: Layer, docWidth: number, docHeight: number): HTMLCanvasElement {
  const out = createCanvas(docWidth, docHeight);
  const ctx = ctx2d(out);

  // Compose pixel+mask in a scratch the size of the layer
  const scratch = createCanvas(layer.canvas.width, layer.canvas.height);
  const sctx = ctx2d(scratch);
  sctx.drawImage(layer.canvas, 0, 0);
  if (layer.mask && layer.maskEnabled) {
    sctx.globalCompositeOperation = "destination-in";
    // Convert mask to alpha: white=opaque, black=transparent. Canvas already
    // honors the mask's alpha; if mask is RGB we need luminance->alpha. We
    // generate a per-channel-alpha temp.
    const lumMask = luminanceToAlpha(layer.mask);
    sctx.drawImage(lumMask, 0, 0);
    sctx.globalCompositeOperation = "source-over";
  }

  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate(layer.rotation);
  ctx.drawImage(scratch, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  ctx.restore();
  return out;
}

function luminanceToAlpha(mask: HTMLCanvasElement): HTMLCanvasElement {
  const out = createCanvas(mask.width, mask.height);
  const ctx = ctx2d(out);
  ctx.drawImage(mask, 0, 0);
  const img = ctx.getImageData(0, 0, mask.width, mask.height);
  const d = img.data;
  for (let i = 0; i < d.length; i += 4) {
    const l = 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    d[i] = d[i + 1] = d[i + 2] = 255;
    d[i + 3] = l;
  }
  ctx.putImageData(img, 0, 0);
  return out;
}

// Composite the entire document into a target canvas sized to doc dimensions.
// If `includeBackground` is true, paint doc.background first; otherwise leave transparent.
export function compositeDocument(
  doc: DocumentState,
  target?: HTMLCanvasElement,
  options: { includeBackground?: boolean; skipHiddenLayers?: boolean } = {}
): HTMLCanvasElement {
  const out = target ?? createCanvas(doc.width, doc.height);
  if (out.width !== doc.width || out.height !== doc.height) {
    out.width = doc.width;
    out.height = doc.height;
  }
  const ctx = ctx2d(out);
  ctx.clearRect(0, 0, out.width, out.height);

  if (options.includeBackground && doc.background !== "transparent") {
    ctx.fillStyle = doc.background;
    ctx.fillRect(0, 0, out.width, out.height);
  }

  for (const layer of doc.layers) {
    if (options.skipHiddenLayers !== false && !layer.visible) continue;
    if (layer.opacity <= 0) continue;
    const rasterized = rasterizeLayerToDoc(layer, doc.width, doc.height);
    ctx.globalAlpha = layer.opacity;
    ctx.globalCompositeOperation = layer.blendMode as GlobalCompositeOperation;
    ctx.drawImage(rasterized, 0, 0);
    ctx.globalAlpha = 1;
    ctx.globalCompositeOperation = "source-over";
  }

  return out;
}

// Render the document to a viewport canvas with zoom/pan and checkerboard under the doc.
// `logicalWidth`/`logicalHeight` are in CSS pixels (i.e. the area the caller has set
// up as the drawing region). The caller should apply any DPR transform on `target`
// before calling.
export function renderViewport(
  doc: DocumentState,
  view: Viewport,
  target: HTMLCanvasElement,
  logicalWidth?: number,
  logicalHeight?: number
): void {
  const ctx = ctx2d(target);
  const lw = logicalWidth ?? target.width;
  const lh = logicalHeight ?? target.height;
  // Page background (outside the doc): dark editor gray
  ctx.fillStyle = "#1f2330";
  ctx.fillRect(0, 0, lw, lh);

  ctx.save();
  ctx.translate(view.panX, view.panY);
  ctx.scale(view.zoom, view.zoom);

  // Doc shadow
  ctx.shadowColor = "rgba(0,0,0,0.45)";
  ctx.shadowBlur = 20 / view.zoom;
  ctx.shadowOffsetY = 8 / view.zoom;
  ctx.fillStyle = "#000";
  ctx.fillRect(0, 0, doc.width, doc.height);
  ctx.shadowBlur = 0;
  ctx.shadowOffsetY = 0;

  // Checkerboard for transparent areas of the doc
  drawCheckerboard(ctx, doc.width, doc.height, 12);

  // The composited doc
  const composite = compositeDocument(doc, undefined, { includeBackground: true });
  ctx.imageSmoothingEnabled = view.zoom < 4;
  ctx.drawImage(composite, 0, 0);

  // Doc border
  ctx.strokeStyle = "rgba(255,255,255,0.08)";
  ctx.lineWidth = 1 / view.zoom;
  ctx.strokeRect(0, 0, doc.width, doc.height);

  ctx.restore();
}

function drawCheckerboard(
  ctx: CanvasRenderingContext2D,
  w: number,
  h: number,
  cell: number
): void {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#cfcfcf";
  for (let y = 0; y < h; y += cell) {
    for (let x = 0; x < w; x += cell) {
      if (((x / cell + y / cell) | 0) % 2 === 0) ctx.fillRect(x, y, cell, cell);
    }
  }
}

// Convert viewport coordinates (relative to target canvas) into document coordinates.
export function viewportToDoc(
  px: number,
  py: number,
  view: Viewport
): { x: number; y: number } {
  return { x: (px - view.panX) / view.zoom, y: (py - view.panY) / view.zoom };
}

export function fitViewport(
  docW: number,
  docH: number,
  vpW: number,
  vpH: number,
  pad = 40
): Viewport {
  const z = Math.min((vpW - pad * 2) / docW, (vpH - pad * 2) / docH, 1);
  return {
    zoom: z,
    panX: Math.round((vpW - docW * z) / 2),
    panY: Math.round((vpH - docH * z) / 2),
  };
}

export function renderLayerThumbnail(layer: Layer, maxSize = 40): string {
  const ratio = layer.canvas.width / layer.canvas.height;
  const w = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
  const h = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize;
  const c = createCanvas(w, h);
  const ctx = ctx2d(c);
  // checkerboard
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = "#ccc";
  const cell = 4;
  for (let y = 0; y < h; y += cell)
    for (let x = 0; x < w; x += cell)
      if (((x / cell + y / cell) | 0) % 2 === 0) ctx.fillRect(x, y, cell, cell);
  ctx.drawImage(layer.canvas, 0, 0, w, h);
  return c.toDataURL("image/png");
}

export function renderMaskThumbnail(mask: HTMLCanvasElement | null, maxSize = 40): string | null {
  if (!mask) return null;
  const ratio = mask.width / mask.height;
  const w = ratio >= 1 ? maxSize : Math.round(maxSize * ratio);
  const h = ratio >= 1 ? Math.round(maxSize / ratio) : maxSize;
  const c = createCanvas(w, h);
  ctx2d(c).drawImage(mask, 0, 0, w, h);
  return c.toDataURL("image/png");
}
