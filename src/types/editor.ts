export type Tool =
  | "move"
  | "marquee-rect"
  | "marquee-ellipse"
  | "lasso-polygon"
  | "magic-wand"
  | "brush"
  | "eraser"
  | "fill"
  | "gradient"
  | "eyedropper"
  | "text"
  | "shape-rect"
  | "shape-ellipse"
  | "crop"
  | "hand"
  | "zoom";

export interface GradientSettings {
  kind: "linear" | "radial";
  reverse: boolean;
  // Colors are sourced from the editor's foreground/background at apply time so the
  // gradient updates when the user changes either color.
}

export type LayerKind = "raster" | "text" | "shape";

export type BlendMode =
  | "normal"
  | "multiply"
  | "screen"
  | "overlay"
  | "soft-light"
  | "hard-light"
  | "color-dodge"
  | "color-burn"
  | "darken"
  | "lighten"
  | "difference"
  | "exclusion"
  | "hue"
  | "saturation"
  | "color"
  | "luminosity";

export interface TextLayerProps {
  text: string;
  fontFamily: string;
  fontSize: number;
  fontWeight: number;
  color: string;
  align: "left" | "center" | "right";
}

export interface ShapeLayerProps {
  kind: "rect" | "ellipse";
  fill: string | null;
  stroke: string | null;
  strokeWidth: number;
}

export interface Layer {
  id: string;
  name: string;
  kind: LayerKind;
  visible: boolean;
  locked: boolean;
  opacity: number; // 0..1
  blendMode: BlendMode;
  // Document-space placement of the layer's bitmap origin
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number; // radians, around layer center
  // Pixel buffer (raster layers). For text/shape, we cache a render here.
  canvas: HTMLCanvasElement;
  // Optional raster mask, same size as canvas. White = visible, black = hidden.
  mask: HTMLCanvasElement | null;
  maskEnabled: boolean;
  // Per-layer kind-specific props
  text?: TextLayerProps;
  shape?: ShapeLayerProps;
}

export interface DocumentState {
  id: string;
  name: string;
  width: number;
  height: number;
  background: "transparent" | "white" | "black" | string;
  layers: Layer[];
  selectedLayerId: string | null;
  // Whether brush/eraser target the layer's mask vs. its pixels
  maskTargetActive: boolean;
}

export interface Viewport {
  zoom: number;
  panX: number;
  panY: number;
}

// Selection: rasterized alpha mask of doc-sized region
export interface Selection {
  // doc-sized mask, 255 = selected, 0 = not. Null = no selection (act on whole layer).
  mask: HTMLCanvasElement | null;
  bounds: { x: number; y: number; width: number; height: number } | null;
  // Optional vector geometry (rect/ellipse/poly). Used for crisp marching-ants outline.
  path?: Path2D;
  // Pre-computed 1px white edge canvas (used for magic-wand where there is no vector geometry).
  outline?: HTMLCanvasElement;
}

export interface BrushSettings {
  size: number;
  hardness: number; // 0..1 (only used by built-in soft-round when chosen)
  color: string;
  opacity: number; // 0..1
  flow: number; // 0..1
  presetId: string; // brush preset id (see lib/brushes)
  spacing?: number; // overrides preset spacing if defined
}

export interface HistoryEntry {
  id: string;
  label: string;
  timestamp: number;
  // Full document snapshot (layers serialized to PNG data URLs for canvases)
  snapshot: DocumentSnapshot;
}

export interface LayerSnapshot {
  meta: Omit<Layer, "canvas" | "mask">;
  canvasDataUrl: string;
  maskDataUrl: string | null;
}

export interface DocumentSnapshot {
  width: number;
  height: number;
  background: string;
  selectedLayerId: string | null;
  maskTargetActive: boolean;
  layers: LayerSnapshot[];
}
