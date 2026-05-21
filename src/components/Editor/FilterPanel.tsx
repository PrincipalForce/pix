import React from "react";
import { EditorAPI } from "@/hooks/useEditor";
import { applyBasicFilterToCanvas, BasicFilterId } from "@/utils/filters";

interface Props {
  api: EditorAPI;
}

const FILTERS: Array<{ id: BasicFilterId; name: string }> = [
  { id: "brightness", name: "Brightness" },
  { id: "contrast", name: "Contrast" },
  { id: "saturation", name: "Vibrance" },
  { id: "grayscale", name: "B&W" },
  { id: "sepia", name: "Sepia" },
  { id: "invert", name: "Invert" },
  { id: "blur", name: "Blur" },
  { id: "sharpen", name: "Sharpen" },
  { id: "vintage", name: "Vintage" },
  { id: "cold", name: "Cold" },
  { id: "warm", name: "Warm" },
  { id: "dramatic", name: "Dramatic" },
];

export default function FilterPanel({ api }: Props) {
  const layer = api.selectedLayer;
  const canApply = !!layer && layer.kind === "raster" && !layer.locked;

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Adjustments</span>
      </div>
      <div className="filter-grid">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            className="filter-btn"
            disabled={!canApply}
            onClick={() => {
              if (!layer) return;
              applyBasicFilterToCanvas(layer.canvas, f.id);
              api.bump();
              api.pushHistory(`Filter: ${f.name}`);
            }}
          >
            {f.name}
          </button>
        ))}
      </div>
      {!canApply && (
        <div className="muted small" style={{ padding: "0 12px 12px" }}>
          {layer?.locked
            ? "This layer is locked — unlock it to apply adjustments."
            : "Select a raster layer to apply adjustments."}
        </div>
      )}
    </div>
  );
}
