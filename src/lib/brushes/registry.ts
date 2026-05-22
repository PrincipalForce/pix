import { BrushPreset, RenderedTip } from "./types";
import { BUILTIN_BRUSHES } from "./builtin";
import { createCanvas, ctx2d } from "../canvas";

const customBrushes = new Map<string, BrushPreset>();

export function listBrushes(): BrushPreset[] {
  return [...BUILTIN_BRUSHES, ...customBrushes.values()];
}

export function getBrush(id: string): BrushPreset | undefined {
  return BUILTIN_BRUSHES.find((b) => b.id === id) ?? customBrushes.get(id);
}

export function registerBrush(b: BrushPreset): void {
  customBrushes.set(b.id, b);
}

export function removeBrush(id: string): void {
  customBrushes.delete(id);
}

// Take a brush preset and produce a tinted, sized tip ready to stamp.
export function renderTip(
  preset: BrushPreset,
  diameterPx: number,
  color: string,
  alpha: number
): RenderedTip {
  const size = Math.max(2, Math.round(diameterPx));
  const c = createCanvas(size, size);
  const ctx = ctx2d(c);
  ctx.drawImage(preset.tip, 0, 0, size, size);
  // Tint with brush color (keeps the alpha shape).
  ctx.globalCompositeOperation = "source-in";
  ctx.fillStyle = color;
  ctx.globalAlpha = Math.max(0, Math.min(1, alpha));
  ctx.fillRect(0, 0, size, size);
  ctx.globalCompositeOperation = "source-over";
  ctx.globalAlpha = 1;
  return { canvas: c, diameter: size };
}
