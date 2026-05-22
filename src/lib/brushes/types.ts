// A brush preset = a tip bitmap (alpha-only) + behavior settings.
// At paint time we stamp the tip along the stroke path with the configured spacing.

export type BrushSource = "builtin" | "custom" | "abr";

export interface BrushPreset {
  id: string;
  name: string;
  source: BrushSource;
  // Alpha-only tip (RGB ignored). Tip rendering tints with brush color at paint time.
  tip: HTMLCanvasElement;
  // Spacing between stamps as a fraction of tip diameter (0.05..2). Photoshop default ~0.25.
  spacing: number;
  // Default size in px (the tip is normalized to a canonical size; we scale per stamp).
  defaultSize: number;
  // Default hardness 0..1 (only meaningful for generated round tips; ignored for bitmap tips).
  hardness: number;
}

// Concrete render-time tip request: a sized & tinted bitmap ready to stamp.
export interface RenderedTip {
  canvas: HTMLCanvasElement;
  diameter: number;
}
