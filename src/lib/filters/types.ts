// Filter system: each filter is a pure function over ImageData, plus metadata
// describing its parameters so we can render a generic UI.

export type ParamType = "range" | "angle" | "select" | "boolean" | "curve" | "color";

export interface ParamSpec {
  key: string;
  label: string;
  type: ParamType;
  min?: number;
  max?: number;
  step?: number;
  default: number | string | boolean | number[];
  options?: { label: string; value: string | number }[];
}

export type FilterCategory =
  | "adjust"
  | "blur"
  | "sharpen"
  | "noise"
  | "distort"
  | "pixelate"
  | "stylize"
  | "render"
  | "other";

export interface FilterDef {
  id: string;
  name: string;
  category: FilterCategory;
  params: ParamSpec[];
  // Apply the filter and return new image data. May not mutate input.
  apply: (src: ImageData, params: Record<string, any>) => ImageData;
}

export const CATEGORY_LABELS: Record<FilterCategory, string> = {
  adjust: "Adjustments",
  blur: "Blur",
  sharpen: "Sharpen",
  noise: "Noise",
  distort: "Distort",
  pixelate: "Pixelate",
  stylize: "Stylize",
  render: "Render",
  other: "Other",
};
