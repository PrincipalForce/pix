import React from "react";
import { Sparkles } from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";
import { listFilters } from "@/lib/filters/registry";
import { CATEGORY_LABELS, FilterCategory } from "@/lib/filters/types";

interface Props {
  api: EditorAPI;
  onOpenGallery: (filterId?: string) => void;
}

// Compact in-rail surface — quick-access list of common filters and a button to open the full gallery.
const QUICK_PICKS: string[] = [
  "brightness-contrast",
  "levels",
  "hue-saturation",
  "vibrance",
  "grayscale",
  "exposure",
  "gaussian-blur",
  "unsharp-mask",
  "find-edges",
  "oil-paint",
];

export default function FilterPanel({ api, onOpenGallery }: Props) {
  const layer = api.selectedLayer;
  const canApply = !!layer && layer.kind === "raster" && !layer.locked;
  const filters = listFilters();
  const quick = QUICK_PICKS
    .map((id) => filters.find((f) => f.id === id))
    .filter((f): f is NonNullable<typeof f> => !!f);

  return (
    <div className="panel">
      <div className="panel-head">
        <span className="panel-title">Filters</span>
      </div>
      <div className="filter-grid">
        {quick.map((f) => (
          <button
            key={f.id}
            className="filter-btn"
            disabled={!canApply}
            onClick={() => onOpenGallery(f.id)}
            title={`${CATEGORY_LABELS[f.category as FilterCategory]} — ${f.name}`}
          >
            {f.name}
          </button>
        ))}
      </div>
      <div style={{ padding: "0 12px 12px" }}>
        <button
          className="btn"
          disabled={!canApply}
          onClick={() => onOpenGallery()}
          style={{ width: "100%", justifyContent: "center" }}
        >
          <Sparkles size={14} /> Filter Gallery…
        </button>
      </div>
      {!canApply && (
        <div className="muted small" style={{ padding: "0 12px 12px" }}>
          {layer?.locked
            ? "This layer is locked — unlock it to apply filters."
            : "Select a raster layer to apply filters."}
        </div>
      )}
    </div>
  );
}
