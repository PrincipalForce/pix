// "Action" = an ordered sequence of recordable editor steps that can be played
// back against a document. This is our own format (works fully); .atn import
// extracts steps by name and maps a subset to native operations.

export type Step =
  | { type: "applyFilter"; filterId: string; params: Record<string, any> }
  | { type: "addFillLayer"; color: string; name?: string }
  | { type: "addBlankLayer" }
  | { type: "duplicateLayer" }
  | { type: "fillSelection"; color: string }
  | { type: "invert" }                                  // shortcut filter
  | { type: "canvasSize"; width: number; height: number; anchor: string }
  | { type: "imageSize"; width: number; height: number }
  | { type: "setBrush"; presetId?: string; color?: string; size?: number; opacity?: number }
  | { type: "deselect" }
  | { type: "selectAll" }
  | { type: "flatten" }
  | { type: "unsupported"; label: string };

export interface PixAction {
  id: string;
  name: string;
  source: "user" | "atn";
  createdAt: number;
  steps: Step[];
}
