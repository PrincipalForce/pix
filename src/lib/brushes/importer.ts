// Import Photoshop .abr brush presets via ag-psd. Each brush tip becomes a BrushPreset.
import { BrushPreset } from "./types";
import { registerBrush } from "./registry";
import { createCanvas, ctx2d } from "../canvas";

interface AbrBrush {
  name?: string;
  spacing?: number;
  image?: ImageData;
  // ag-psd's `Brush` interface has additional shape options we won't use here.
}

export async function importAbrFile(file: File): Promise<BrushPreset[]> {
  const buf = await file.arrayBuffer();
  const { readAbr } = await import("ag-psd");
  const brushes = (readAbr as any)(buf) as AbrBrush[];
  const out: BrushPreset[] = [];
  brushes.forEach((b, i) => {
    if (!b.image) return;
    const tip = imageDataToTip(b.image);
    if (!tip) return;
    const preset: BrushPreset = {
      id: `abr-${file.name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${i}-${Date.now()}`,
      name: b.name?.trim() || `${file.name} ${i + 1}`,
      source: "abr",
      tip,
      spacing: b.spacing ?? 0.25,
      defaultSize: Math.min(120, Math.max(8, Math.max(tip.width, tip.height))),
      hardness: 0.5,
    };
    registerBrush(preset);
    out.push(preset);
  });
  return out;
}

// Photoshop tips are typically grayscale where black = full alpha, white = transparent.
// Convert to an alpha-only canvas where the brush tint can be applied via source-in.
function imageDataToTip(img: ImageData): HTMLCanvasElement | null {
  const w = img.width;
  const h = img.height;
  if (w === 0 || h === 0) return null;
  const c = createCanvas(w, h);
  const ctx = ctx2d(c);
  const out = ctx.createImageData(w, h);
  const od = out.data;
  const sd = img.data;
  for (let i = 0; i < sd.length; i += 4) {
    // Use luminance, treat darker as more opaque (PS .abr convention).
    const lum = 0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2];
    const a = 255 - Math.round(lum);
    od[i] = 255;
    od[i + 1] = 255;
    od[i + 2] = 255;
    od[i + 3] = (a * sd[i + 3]) / 255; // multiply by source alpha if present
  }
  ctx.putImageData(out, 0, 0);
  return c;
}
