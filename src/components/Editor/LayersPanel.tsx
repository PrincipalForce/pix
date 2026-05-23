import React, { useMemo, useState } from "react";
import {
  Eye,
  EyeOff,
  Lock,
  LockOpen,
  Plus,
  Trash2,
  Copy,
  ImageDown,
  Square,
} from "lucide-react";
import { EditorAPI } from "@/hooks/useEditor";
import { BlendMode } from "@/types/editor";
import { renderLayerThumbnail, renderMaskThumbnail } from "@/lib/render";

const BLEND_MODES: BlendMode[] = [
  "normal",
  "multiply",
  "screen",
  "overlay",
  "soft-light",
  "hard-light",
  "color-dodge",
  "color-burn",
  "darken",
  "lighten",
  "difference",
  "exclusion",
  "hue",
  "saturation",
  "color",
  "luminosity",
];

interface Props {
  api: EditorAPI;
}

export default function LayersPanel({ api }: Props) {
  const [dragId, setDragId] = useState<string | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  // Render top-to-bottom (visual top = end of array)
  const ordered = useMemo(() => [...api.doc.layers].reverse(), [api.doc.layers, api.dirtyTick]);

  return (
    <>
      <div className="panel-toolbar">
        <select
          value={api.selectedLayer?.blendMode ?? "normal"}
          onChange={(e) =>
            api.selectedLayer &&
            api.updateLayerWithHistory(
              api.selectedLayer.id,
              { blendMode: e.target.value as BlendMode },
              "Blend Mode"
            )
          }
          className="select-mini"
          disabled={!api.selectedLayer}
        >
          {BLEND_MODES.map((b) => (
            <option key={b} value={b}>
              {b.replace("-", " ")}
            </option>
          ))}
        </select>
        <div className="opacity-mini">
          <span>Opacity</span>
          <input
            type="range"
            min={0}
            max={100}
            value={Math.round((api.selectedLayer?.opacity ?? 1) * 100)}
            onChange={(e) =>
              api.selectedLayer &&
              api.updateLayer(api.selectedLayer.id, { opacity: parseInt(e.target.value) / 100 })
            }
            onPointerUp={() => api.selectedLayer && api.pushHistory("Opacity")}
            disabled={!api.selectedLayer}
          />
          <span className="opacity-val">{Math.round((api.selectedLayer?.opacity ?? 1) * 100)}%</span>
        </div>
      </div>

      <div className="layer-list">
        {ordered.length === 0 && (
          <div className="empty">
            <ImageDown size={28} strokeWidth={1.4} />
            <div>No layers — drop or paste an image to start.</div>
            <div className="empty-actions">
              <button className="btn ghost" onClick={() => api.addBlankLayer()}>
                New layer
              </button>
              <button
                className="btn"
                onClick={() => api.addFillLayer("#ffffff", "Background", true)}
              >
                Add white background
              </button>
              <button
                className="btn"
                onClick={() => {
                  const input = document.createElement("input");
                  input.type = "color";
                  input.value = "#1f2937";
                  input.oninput = () => api.addFillLayer(input.value, "Background", true);
                  input.click();
                }}
              >
                Add background color…
              </button>
            </div>
          </div>
        )}

        {ordered.map((layer, vi) => {
          const realIndex = api.doc.layers.length - 1 - vi;
          const isSelected = api.doc.selectedLayerId === layer.id;
          const thumb = renderLayerThumbnail(layer, 36);
          const maskThumb = renderMaskThumbnail(layer.mask, 36);
          return (
            <div
              key={layer.id}
              className={`layer-row ${isSelected ? "is-selected" : ""}`}
              draggable
              onDragStart={() => setDragId(layer.id)}
              onDragOver={(e) => {
                e.preventDefault();
                setDropIndex(vi);
              }}
              onDrop={() => {
                if (dragId) {
                  const dropReal = api.doc.layers.length - 1 - (dropIndex ?? 0);
                  api.reorderLayer(dragId, dropReal);
                }
                setDragId(null);
                setDropIndex(null);
              }}
              onClick={() => api.selectLayer(layer.id)}
            >
              <button
                className="layer-eye"
                onClick={(e) => {
                  e.stopPropagation();
                  api.updateLayerWithHistory(
                    layer.id,
                    { visible: !layer.visible },
                    layer.visible ? "Hide Layer" : "Show Layer"
                  );
                }}
                title={layer.visible ? "Hide" : "Show"}
              >
                {layer.visible ? <Eye size={14} /> : <EyeOff size={14} />}
              </button>
              <img src={thumb} alt="" className="layer-thumb" />
              {maskThumb && (
                <button
                  className={`mask-thumb ${
                    api.doc.maskTargetActive && isSelected ? "is-mask-target" : ""
                  }`}
                  title={api.doc.maskTargetActive ? "Targeting mask" : "Click to edit mask"}
                  onClick={(e) => {
                    e.stopPropagation();
                    api.selectLayer(layer.id);
                    api.setMaskTargetActive(!api.doc.maskTargetActive);
                  }}
                >
                  <img src={maskThumb} alt="" />
                </button>
              )}
              <div className="layer-meta">
                <div className="layer-name" title={layer.name}>
                  {layer.name}
                </div>
                <div className="layer-sub">
                  {layer.kind}
                  {layer.mask ? " · mask" : ""}
                </div>
              </div>
              <button
                className="layer-lock"
                onClick={(e) => {
                  e.stopPropagation();
                  api.updateLayer(layer.id, { locked: !layer.locked });
                }}
                title={layer.locked ? "Unlock" : "Lock"}
              >
                {layer.locked ? <Lock size={13} /> : <LockOpen size={13} />}
              </button>
            </div>
          );
        })}
      </div>

      <div className="layer-actions">
        <button
          onClick={() => api.addBlankLayer()}
          title="New layer"
          className="lay-act"
        >
          <Plus size={14} />
        </button>
        <button
          onClick={() => api.duplicateSelectedLayer()}
          disabled={!api.selectedLayer}
          title="Duplicate layer"
          className="lay-act"
        >
          <Copy size={14} />
        </button>
        <button
          onClick={() => {
            if (!api.selectedLayer) return;
            if (api.selectedLayer.mask) api.removeMaskFromSelected();
            else api.addMaskToSelected();
          }}
          disabled={!api.selectedLayer}
          title={api.selectedLayer?.mask ? "Remove mask" : "Add mask"}
          className="lay-act"
        >
          <Square size={14} />
        </button>
        <button
          onClick={() => api.selectedLayer && api.deleteLayer(api.selectedLayer.id)}
          disabled={!api.selectedLayer}
          title="Delete layer"
          className="lay-act danger"
        >
          <Trash2 size={14} />
        </button>
      </div>
    </>
  );
}
