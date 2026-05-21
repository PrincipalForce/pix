import { saveAs } from "file-saver";
import type { Psd, Layer as PsdLayer } from "ag-psd";
import { DocumentState } from "@/types/editor";
import { compositeDocument } from "./render";
import { canvasToBlob, createCanvas, ctx2d } from "./canvas";

export type ExportFormat =
  | "png"
  | "jpeg"
  | "webp"
  | "gif"
  | "bmp"
  | "tiff"
  | "psd";

export interface ExportOptions {
  format: ExportFormat;
  filename: string;
  quality: number; // 0..1 for jpeg/webp
  scale: number; // multiplier
  background: string; // hex; used when format has no alpha
  flatten: boolean; // composite all layers before encoding (always true except psd)
}

export async function exportDocument(
  doc: DocumentState,
  opts: ExportOptions
): Promise<void> {
  const scaled = await scaledComposite(doc, opts.scale, formatSupportsAlpha(opts.format) ? null : opts.background);
  const name = `${opts.filename}.${formatExt(opts.format)}`;
  switch (opts.format) {
    case "png": {
      const blob = await canvasToBlob(scaled, "image/png");
      saveAs(blob, name);
      return;
    }
    case "jpeg": {
      const blob = await canvasToBlob(scaled, "image/jpeg", opts.quality);
      saveAs(blob, name);
      return;
    }
    case "webp": {
      const blob = await canvasToBlob(scaled, "image/webp", opts.quality);
      saveAs(blob, name);
      return;
    }
    case "bmp": {
      const blob = encodeBmp(scaled);
      saveAs(blob, name);
      return;
    }
    case "gif": {
      const blob = await encodeGif(scaled);
      saveAs(blob, name);
      return;
    }
    case "tiff": {
      const blob = await encodeTiff(scaled);
      saveAs(blob, name);
      return;
    }
    case "psd": {
      const blob = await encodePsd(doc, opts.scale, opts.background);
      saveAs(blob, name);
      return;
    }
  }
}

function formatExt(f: ExportFormat): string {
  if (f === "jpeg") return "jpg";
  return f;
}

function formatSupportsAlpha(f: ExportFormat): boolean {
  return f === "png" || f === "webp" || f === "tiff" || f === "psd";
}

async function scaledComposite(
  doc: DocumentState,
  scale: number,
  bg: string | null
): Promise<HTMLCanvasElement> {
  const composite = compositeDocument(doc, undefined, { includeBackground: true });
  const w = Math.max(1, Math.round(doc.width * scale));
  const h = Math.max(1, Math.round(doc.height * scale));
  const out = createCanvas(w, h);
  const ctx = ctx2d(out);
  if (bg) {
    ctx.fillStyle = bg;
    ctx.fillRect(0, 0, w, h);
  }
  ctx.imageSmoothingQuality = "high";
  ctx.drawImage(composite, 0, 0, w, h);
  return out;
}

// --- BMP encoder (24-bit) ---------------------------------------------------

function encodeBmp(canvas: HTMLCanvasElement): Blob {
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx2d(canvas).getImageData(0, 0, w, h).data;
  const rowSize = Math.floor((24 * w + 31) / 32) * 4;
  const pixelArraySize = rowSize * h;
  const fileSize = 54 + pixelArraySize;
  const buf = new ArrayBuffer(fileSize);
  const dv = new DataView(buf);
  // BMP header
  dv.setUint8(0, 0x42);
  dv.setUint8(1, 0x4d);
  dv.setUint32(2, fileSize, true);
  dv.setUint32(10, 54, true);
  // DIB header
  dv.setUint32(14, 40, true);
  dv.setInt32(18, w, true);
  dv.setInt32(22, h, true);
  dv.setUint16(26, 1, true);
  dv.setUint16(28, 24, true);
  dv.setUint32(34, pixelArraySize, true);
  dv.setInt32(38, 2835, true);
  dv.setInt32(42, 2835, true);
  // Pixel array (bottom-up, BGR)
  const u8 = new Uint8Array(buf);
  for (let y = 0; y < h; y++) {
    const dst = 54 + (h - 1 - y) * rowSize;
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      u8[dst + x * 3 + 0] = img[i + 2];
      u8[dst + x * 3 + 1] = img[i + 1];
      u8[dst + x * 3 + 2] = img[i + 0];
    }
  }
  return new Blob([buf], { type: "image/bmp" });
}

// --- GIF encoder (single frame) --------------------------------------------

async function encodeGif(canvas: HTMLCanvasElement): Promise<Blob> {
  const { GIFEncoder, quantize, applyPalette } = await import("gifenc");
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx2d(canvas).getImageData(0, 0, w, h).data;
  const palette = quantize(img, 256, { format: "rgba4444" });
  const indexed = applyPalette(img, palette, "rgba4444");
  const gif = GIFEncoder();
  gif.writeFrame(indexed, w, h, { palette, transparent: true });
  gif.finish();
  const bytes = gif.bytes();
  const copy = new Uint8Array(bytes.length);
  copy.set(bytes);
  return new Blob([copy.buffer as ArrayBuffer], { type: "image/gif" });
}

// --- TIFF encoder ----------------------------------------------------------

async function encodeTiff(canvas: HTMLCanvasElement): Promise<Blob> {
  const UTIF = (await import("utif")).default;
  const w = canvas.width;
  const h = canvas.height;
  const img = ctx2d(canvas).getImageData(0, 0, w, h);
  const ab = (UTIF as any).encodeImage(img.data, w, h);
  return new Blob([ab], { type: "image/tiff" });
}

// --- PSD encoder (layered, via ag-psd) -------------------------------------

async function encodePsd(
  doc: DocumentState,
  scale: number,
  background: string
): Promise<Blob> {
  const { writePsd } = await import("ag-psd");
  const sw = Math.max(1, Math.round(doc.width * scale));
  const sh = Math.max(1, Math.round(doc.height * scale));

  // Composite preview
  const composite = compositeDocument(doc, undefined, { includeBackground: true });
  const scaledComp = createCanvas(sw, sh);
  ctx2d(scaledComp).drawImage(composite, 0, 0, sw, sh);

  const psdLayers: PsdLayer[] = doc.layers.map((l) => {
    // Each layer ends up rasterized at doc resolution * scale, positioned correctly.
    const layerCanvas = createCanvas(sw, sh);
    const lctx = ctx2d(layerCanvas);
    lctx.save();
    lctx.scale(scale, scale);
    lctx.translate(l.x + l.width / 2, l.y + l.height / 2);
    lctx.rotate(l.rotation);
    lctx.drawImage(l.canvas, -l.width / 2, -l.height / 2, l.width, l.height);
    lctx.restore();

    const out: PsdLayer = {
      name: l.name,
      canvas: layerCanvas,
      opacity: l.opacity,
      blendMode: mapBlendModeToPsd(l.blendMode),
      hidden: !l.visible,
    };
    if (l.mask) {
      const maskCanvas = createCanvas(sw, sh);
      const mctx = ctx2d(maskCanvas);
      mctx.save();
      mctx.scale(scale, scale);
      mctx.translate(l.x + l.width / 2, l.y + l.height / 2);
      mctx.rotate(l.rotation);
      mctx.drawImage(l.mask, -l.width / 2, -l.height / 2, l.width, l.height);
      mctx.restore();
      out.mask = { canvas: maskCanvas, disabled: !l.maskEnabled };
    }
    return out;
  });

  const psd: Psd = {
    width: sw,
    height: sh,
    canvas: scaledComp,
    children: psdLayers,
  };

  const buf = writePsd(psd);
  return new Blob([buf], { type: "image/vnd.adobe.photoshop" });
}

function mapBlendModeToPsd(b: string): any {
  // ag-psd uses Photoshop blend mode short names
  const map: Record<string, string> = {
    normal: "normal",
    multiply: "multiply",
    screen: "screen",
    overlay: "overlay",
    "soft-light": "soft light",
    "hard-light": "hard light",
    "color-dodge": "color dodge",
    "color-burn": "color burn",
    darken: "darken",
    lighten: "lighten",
    difference: "difference",
    exclusion: "exclusion",
    hue: "hue",
    saturation: "saturation",
    color: "color",
    luminosity: "luminosity",
  };
  return map[b] ?? "normal";
}
