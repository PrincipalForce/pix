import type { Psd, Layer as PsdLayer } from "ag-psd";
import { BlendMode, DocumentState, Layer } from "@/types/editor";
import { createCanvas, ctx2d } from "./canvas";
import { createRasterLayer } from "./document";

// Read a .psd File into a Pix DocumentState. Groups are flattened — each leaf
// layer becomes its own raster Pix layer. Group visibility/opacity is folded
// into each child (visible = group.visible && child.visible; opacity = product).
export async function importPsdFile(file: File): Promise<DocumentState> {
  const { readPsd, initializeCanvas } = await import("ag-psd");
  // ag-psd in the browser needs a canvas factory; default does this via
  // document.createElement, but call initializeCanvas to be explicit.
  initializeCanvas((w, h) => {
    const c = document.createElement("canvas");
    c.width = w;
    c.height = h;
    return c as any;
  });
  const buf = await file.arrayBuffer();
  const psd: Psd = readPsd(buf, { skipThumbnail: true });
  const docW = psd.width;
  const docH = psd.height;
  const layers: Layer[] = [];
  flattenPsdLayers(psd.children ?? [], docW, docH, true, 1, layers);
  // If there are no usable layers (e.g. flattened PSD) fall back to the
  // composite canvas as a single raster layer.
  if (layers.length === 0 && psd.canvas) {
    const fallback = createRasterLayer({
      name: stripExt(file.name),
      width: docW,
      height: docH,
      docWidth: docW,
      docHeight: docH,
      source: psd.canvas as HTMLCanvasElement,
      x: 0,
      y: 0,
    });
    layers.push(fallback);
  }
  return {
    id: `doc-${Date.now()}`,
    name: stripExt(file.name),
    width: docW,
    height: docH,
    background: "transparent",
    layers,
    selectedLayerId: layers[layers.length - 1]?.id ?? null,
    maskTargetActive: false,
  };
}

function flattenPsdLayers(
  psdLayers: PsdLayer[],
  docW: number,
  docH: number,
  parentVisible: boolean,
  parentOpacity: number,
  out: Layer[]
): void {
  for (const pl of psdLayers) {
    const visible = parentVisible && !pl.hidden;
    const opacity = parentOpacity * (pl.opacity ?? 1);
    if (pl.children && pl.children.length > 0) {
      flattenPsdLayers(pl.children, docW, docH, visible, opacity, out);
      continue;
    }
    const layer = psdLayerToPixLayer(pl, docW, docH, visible, opacity);
    if (layer) out.push(layer);
  }
}

function psdLayerToPixLayer(
  pl: PsdLayer,
  docW: number,
  docH: number,
  visible: boolean,
  opacity: number
): Layer | null {
  const src = pl.canvas as HTMLCanvasElement | undefined;
  if (!src || src.width <= 0 || src.height <= 0) return null;
  // PSD layer bounds — fall back to canvas size if missing.
  const left = pl.left ?? 0;
  const top = pl.top ?? 0;
  const w = pl.right != null && pl.left != null ? pl.right - pl.left : src.width;
  const h = pl.bottom != null && pl.top != null ? pl.bottom - pl.top : src.height;
  const layer = createRasterLayer({
    name: pl.name || "Layer",
    width: src.width,
    height: src.height,
    docWidth: docW,
    docHeight: docH,
    source: src,
    x: left,
    y: top,
  });
  // PSD layer canvases are already at native bounds. Force transform to match.
  layer.width = Math.max(1, w);
  layer.height = Math.max(1, h);
  layer.opacity = clamp01(opacity);
  layer.blendMode = mapBlendModeFromPsd(pl.blendMode);
  layer.visible = visible;
  // Mask
  const pm = pl.mask;
  if (pm && pm.canvas && pm.canvas.width > 0 && pm.canvas.height > 0) {
    // PSD masks live in their own bounding box; re-project into the layer-local
    // pixel space so render.ts (which expects mask.width/height == canvas dims)
    // can sample it directly.
    const maskCanvas = createCanvas(layer.canvas.width, layer.canvas.height);
    const mctx = ctx2d(maskCanvas);
    // Fill with white first — pixels outside the PSD mask bounds should be
    // fully visible (PSD convention: missing mask = opaque).
    mctx.fillStyle = "white";
    mctx.fillRect(0, 0, maskCanvas.width, maskCanvas.height);
    const ml = pm.left ?? 0;
    const mt = pm.top ?? 0;
    // Offset of mask within the layer's local coords (layer origin = left/top).
    const offX = ml - left;
    const offY = mt - top;
    mctx.drawImage(pm.canvas as HTMLCanvasElement, offX, offY);
    layer.mask = maskCanvas;
    layer.maskEnabled = !pm.disabled;
  }
  return layer;
}

function mapBlendModeFromPsd(b: string | undefined): BlendMode {
  if (!b) return "normal";
  const map: Record<string, BlendMode> = {
    normal: "normal",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    "soft light": "soft-light",
    "hard light": "hard-light",
    "color dodge": "color-dodge",
    "color burn": "color-burn",
    darken: "darken",
    lighten: "lighten",
    difference: "difference",
    exclusion: "exclusion",
    hue: "hue",
    saturation: "saturation",
    color: "color",
    luminosity: "luminosity",
  };
  return map[b.toLowerCase()] ?? "normal";
}

function clamp01(v: number): number {
  if (!isFinite(v)) return 1;
  return Math.max(0, Math.min(1, v));
}

function stripExt(name: string): string {
  const i = name.lastIndexOf(".");
  return i > 0 ? name.slice(0, i) : name;
}
