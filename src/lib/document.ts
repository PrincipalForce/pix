import {
  BlendMode,
  DocumentSnapshot,
  DocumentState,
  Layer,
  LayerSnapshot,
  ShapeLayerProps,
  TextLayerProps,
} from "@/types/editor";
import { cloneCanvas, createCanvas, ctx2d } from "./canvas";

let layerCounter = 0;
export function nextLayerId(prefix = "layer"): string {
  layerCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${layerCounter}`;
}

export function createBlankDocument(
  width: number,
  height: number,
  background: DocumentState["background"] = "transparent",
  name = "Untitled"
): DocumentState {
  const doc: DocumentState = {
    id: nextLayerId("doc"),
    name,
    width,
    height,
    background,
    layers: [],
    selectedLayerId: null,
    maskTargetActive: false,
  };
  if (background !== "transparent") {
    const bg = createRasterLayer({
      name: "Background",
      width,
      height,
      docWidth: width,
      docHeight: height,
    });
    const c = ctx2d(bg.canvas);
    c.fillStyle = background === "white" ? "#ffffff" : background === "black" ? "#000000" : background;
    c.fillRect(0, 0, width, height);
    bg.locked = true;
    doc.layers.push(bg);
    doc.selectedLayerId = bg.id;
  }
  return doc;
}

export interface RasterLayerInit {
  id?: string;
  name?: string;
  x?: number;
  y?: number;
  width: number;
  height: number;
  docWidth: number;
  docHeight: number;
  source?: HTMLImageElement | HTMLCanvasElement | ImageBitmap;
  opacity?: number;
  blendMode?: BlendMode;
}

export function createRasterLayer(init: RasterLayerInit): Layer {
  const w = init.width;
  const h = init.height;
  const canvas = createCanvas(w, h);
  if (init.source) {
    ctx2d(canvas).drawImage(init.source as CanvasImageSource, 0, 0, w, h);
  }
  return {
    id: init.id ?? nextLayerId(),
    name: init.name ?? "Layer",
    kind: "raster",
    visible: true,
    locked: false,
    opacity: init.opacity ?? 1,
    blendMode: init.blendMode ?? "normal",
    x: init.x ?? 0,
    y: init.y ?? 0,
    width: w,
    height: h,
    rotation: 0,
    canvas,
    mask: null,
    maskEnabled: true,
  };
}

export function createTextLayer(
  text: TextLayerProps,
  docWidth: number,
  docHeight: number
): Layer {
  // Allocate canvas roughly the text bounds; we redraw on edit.
  const w = Math.max(50, Math.ceil(text.fontSize * Math.max(8, text.text.length * 0.6)));
  const h = Math.max(text.fontSize * 1.6, 40);
  const layer: Layer = {
    id: nextLayerId("text"),
    name: text.text.slice(0, 20) || "Text",
    kind: "text",
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    x: Math.round(docWidth / 2 - w / 2),
    y: Math.round(docHeight / 2 - h / 2),
    width: w,
    height: h,
    rotation: 0,
    canvas: createCanvas(w, h),
    mask: null,
    maskEnabled: true,
    text,
  };
  renderTextLayer(layer);
  return layer;
}

export function renderTextLayer(layer: Layer): void {
  if (!layer.text) return;
  const t = layer.text;
  const c = ctx2d(layer.canvas);
  c.clearRect(0, 0, layer.canvas.width, layer.canvas.height);
  c.fillStyle = t.color;
  c.font = `${t.fontWeight} ${t.fontSize}px ${t.fontFamily}`;
  c.textBaseline = "top";
  c.textAlign = t.align;
  const x = t.align === "center" ? layer.canvas.width / 2 : t.align === "right" ? layer.canvas.width : 0;
  c.fillText(t.text, x, layer.canvas.height * 0.1);
}

export function createShapeLayer(
  shape: ShapeLayerProps,
  rect: { x: number; y: number; width: number; height: number }
): Layer {
  const layer: Layer = {
    id: nextLayerId("shape"),
    name: shape.kind === "rect" ? "Rectangle" : "Ellipse",
    kind: "shape",
    visible: true,
    locked: false,
    opacity: 1,
    blendMode: "normal",
    x: rect.x,
    y: rect.y,
    width: rect.width,
    height: rect.height,
    rotation: 0,
    canvas: createCanvas(rect.width, rect.height),
    mask: null,
    maskEnabled: true,
    shape,
  };
  renderShapeLayer(layer);
  return layer;
}

export function renderShapeLayer(layer: Layer): void {
  if (!layer.shape) return;
  const s = layer.shape;
  const c = ctx2d(layer.canvas);
  const w = layer.canvas.width;
  const h = layer.canvas.height;
  c.clearRect(0, 0, w, h);
  c.beginPath();
  if (s.kind === "rect") {
    c.rect(s.strokeWidth / 2, s.strokeWidth / 2, w - s.strokeWidth, h - s.strokeWidth);
  } else {
    c.ellipse(w / 2, h / 2, w / 2 - s.strokeWidth / 2, h / 2 - s.strokeWidth / 2, 0, 0, Math.PI * 2);
  }
  if (s.fill) {
    c.fillStyle = s.fill;
    c.fill();
  }
  if (s.stroke && s.strokeWidth > 0) {
    c.strokeStyle = s.stroke;
    c.lineWidth = s.strokeWidth;
    c.stroke();
  }
}

export function ensureMask(layer: Layer): HTMLCanvasElement {
  if (!layer.mask) {
    const m = createCanvas(layer.canvas.width, layer.canvas.height);
    const c = ctx2d(m);
    c.fillStyle = "#ffffff";
    c.fillRect(0, 0, m.width, m.height);
    layer.mask = m;
  }
  return layer.mask;
}

// --- Resize ops -------------------------------------------------------------

// Crop the document to the given doc-space rectangle. Doc dimensions become w×h
// and every layer is shifted by (-x,-y) so its position relative to the new
// origin is preserved. Layer canvases are untouched — pixels outside the new
// doc bounds simply aren't composited.
export function cropDocument(
  doc: DocumentState,
  x: number,
  y: number,
  w: number,
  h: number
): DocumentState {
  return {
    ...doc,
    width: Math.max(1, Math.round(w)),
    height: Math.max(1, Math.round(h)),
    layers: doc.layers.map((l) => ({ ...l, x: Math.round(l.x - x), y: Math.round(l.y - y) })),
  };
}

export function resizeCanvasSize(
  doc: DocumentState,
  newWidth: number,
  newHeight: number,
  anchor: "tl" | "t" | "tr" | "l" | "c" | "r" | "bl" | "b" | "br"
): DocumentState {
  const dx = anchorOffset(anchor, "x") * (newWidth - doc.width);
  const dy = anchorOffset(anchor, "y") * (newHeight - doc.height);
  return {
    ...doc,
    width: newWidth,
    height: newHeight,
    layers: doc.layers.map((l) => ({ ...l, x: l.x + dx, y: l.y + dy })),
  };
}

function anchorOffset(a: string, axis: "x" | "y"): number {
  const map: Record<string, [number, number]> = {
    tl: [0, 0],
    t: [0.5, 0],
    tr: [1, 0],
    l: [0, 0.5],
    c: [0.5, 0.5],
    r: [1, 0.5],
    bl: [0, 1],
    b: [0.5, 1],
    br: [1, 1],
  };
  return (map[a] ?? [0.5, 0.5])[axis === "x" ? 0 : 1];
}

export function resampleDocument(
  doc: DocumentState,
  newWidth: number,
  newHeight: number
): DocumentState {
  const sx = newWidth / doc.width;
  const sy = newHeight / doc.height;
  return {
    ...doc,
    width: newWidth,
    height: newHeight,
    layers: doc.layers.map((l) => resampleLayer(l, sx, sy)),
  };
}

function resampleLayer(layer: Layer, sx: number, sy: number): Layer {
  const newW = Math.max(1, Math.round(layer.width * sx));
  const newH = Math.max(1, Math.round(layer.height * sy));
  const c = createCanvas(newW, newH);
  const cc = ctx2d(c);
  cc.imageSmoothingEnabled = true;
  cc.imageSmoothingQuality = "high";
  cc.drawImage(layer.canvas, 0, 0, newW, newH);
  let mask: HTMLCanvasElement | null = null;
  if (layer.mask) {
    mask = createCanvas(newW, newH);
    ctx2d(mask).drawImage(layer.mask, 0, 0, newW, newH);
  }
  return {
    ...layer,
    x: Math.round(layer.x * sx),
    y: Math.round(layer.y * sy),
    width: newW,
    height: newH,
    canvas: c,
    mask,
  };
}

// --- Snapshots --------------------------------------------------------------

export function snapshotDocument(doc: DocumentState): DocumentSnapshot {
  return {
    width: doc.width,
    height: doc.height,
    background: doc.background,
    selectedLayerId: doc.selectedLayerId,
    maskTargetActive: doc.maskTargetActive,
    layers: doc.layers.map(snapshotLayer),
  };
}

function snapshotLayer(layer: Layer): LayerSnapshot {
  const { canvas, mask, ...meta } = layer;
  return {
    meta,
    canvasDataUrl: canvas.toDataURL("image/png"),
    maskDataUrl: mask ? mask.toDataURL("image/png") : null,
  };
}

export async function restoreDocument(snap: DocumentSnapshot): Promise<DocumentState> {
  const layers: Layer[] = await Promise.all(
    snap.layers.map(async (ls) => {
      const c = await loadImageToCanvas(ls.canvasDataUrl);
      const m = ls.maskDataUrl ? await loadImageToCanvas(ls.maskDataUrl) : null;
      return { ...(ls.meta as Layer), canvas: c, mask: m };
    })
  );
  return {
    id: nextLayerId("doc"),
    name: "Restored",
    width: snap.width,
    height: snap.height,
    background: snap.background,
    layers,
    selectedLayerId: snap.selectedLayerId,
    maskTargetActive: snap.maskTargetActive,
  };
}

function loadImageToCanvas(dataUrl: string): Promise<HTMLCanvasElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = createCanvas(img.naturalWidth, img.naturalHeight);
      ctx2d(c).drawImage(img, 0, 0);
      resolve(c);
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

export function duplicateLayer(layer: Layer): Layer {
  return {
    ...layer,
    id: nextLayerId(),
    name: `${layer.name} copy`,
    canvas: cloneCanvas(layer.canvas),
    mask: layer.mask ? cloneCanvas(layer.mask) : null,
  };
}
