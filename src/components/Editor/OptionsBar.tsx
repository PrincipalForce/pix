import React from "react";
import { EditorAPI } from "@/hooks/useEditor";
import BrushPicker from "../UI/BrushPicker";

interface Props {
  api: EditorAPI;
}

// Photoshop-style top "Options bar" — quick controls for the active tool.
export default function OptionsBar({ api }: Props) {
  const t = api.tool;

  return (
    <div className="options-bar">
      <span className="ob-label">{labelFor(t)}</span>
      <div className="ob-sep" />
      {(t === "brush" || t === "eraser" || t === "clone") && (
        <>
          <Field label="Brush">
            <BrushPicker
              selectedId={api.brush.presetId}
              onSelect={(id) => api.setBrush({ ...api.brush, presetId: id })}
            />
          </Field>
          <Field label="Size">
            <input
              type="number"
              min={1}
              max={500}
              className="input num"
              value={api.brush.size}
              onChange={(e) =>
                api.setBrush({ ...api.brush, size: Math.max(1, parseInt(e.target.value) || 1) })
              }
            />
          </Field>
          <Field label="Hardness">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(api.brush.hardness * 100)}
              onChange={(e) =>
                api.setBrush({ ...api.brush, hardness: parseInt(e.target.value) / 100 })
              }
            />
          </Field>
          <Field label="Opacity">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(api.brush.opacity * 100)}
              onChange={(e) =>
                api.setBrush({ ...api.brush, opacity: parseInt(e.target.value) / 100 })
              }
            />
          </Field>
          <Field label="Flow">
            <input
              type="range"
              min={0}
              max={100}
              value={Math.round(api.brush.flow * 100)}
              onChange={(e) =>
                api.setBrush({ ...api.brush, flow: parseInt(e.target.value) / 100 })
              }
            />
          </Field>
          {t === "brush" && (
            <Field label="Color">
              <input
                type="color"
                value={api.brush.color}
                onChange={(e) => api.setBrush({ ...api.brush, color: e.target.value })}
              />
            </Field>
          )}
          {t === "clone" && (
            <Field label="Source">
              {api.cloneSource ? (
                <>
                  <span style={{ color: "var(--text-mute)", fontSize: 12 }}>
                    set at ({Math.round(api.cloneSource.docX)}, {Math.round(api.cloneSource.docY)})
                  </span>
                  <button className="pill" onClick={() => api.setCloneSource(null)}>
                    Reset
                  </button>
                </>
              ) : (
                <span style={{ color: "var(--text-mute)", fontSize: 12 }}>
                  Alt-click on a layer to set the clone source.
                </span>
              )}
            </Field>
          )}
        </>
      )}
      {(t === "marquee-rect" || t === "marquee-ellipse" || t === "lasso-polygon") && (
        <Field label="">
          <button className="pill" onClick={() => api.setSelection({ mask: null, bounds: null })}>
            Deselect
          </button>
        </Field>
      )}
      {t === "gradient" && (
        <>
          <Field label="Type">
            {(["linear", "radial"] as const).map((k) => (
              <button
                key={k}
                className={`pill ${api.gradient.kind === k ? "is-on" : ""}`}
                onClick={() => api.setGradient({ ...api.gradient, kind: k })}
              >
                {k}
              </button>
            ))}
          </Field>
          <Field label="Colors">
            <input
              type="color"
              value={api.foreground}
              onChange={(e) => api.setForeground(e.target.value)}
              title="Start color (foreground)"
            />
            <span style={{ color: "var(--text-mute)" }}>→</span>
            <input
              type="color"
              value={api.background}
              onChange={(e) => api.setBackgroundColor(e.target.value)}
              title="End color (background)"
            />
            <button
              className={`pill ${api.gradient.reverse ? "is-on" : ""}`}
              onClick={() => api.setGradient({ ...api.gradient, reverse: !api.gradient.reverse })}
              title="Reverse direction"
            >
              ⇄
            </button>
          </Field>
        </>
      )}
      <div className="ob-spacer" />
      <Field label="Zoom">
        <input
          type="number"
          step={5}
          className="input num"
          value={Math.round(api.view.zoom * 100)}
          onChange={(e) => {
            const z = Math.max(5, Math.min(3200, parseInt(e.target.value) || 100)) / 100;
            api.setView({ ...api.view, zoom: z });
          }}
        />
        <span className="suffix">%</span>
      </Field>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="ob-field">
      {label && <span>{label}</span>}
      {children}
    </div>
  );
}

function labelFor(t: string) {
  return {
    move: "Move",
    "marquee-rect": "Rectangular Marquee",
    "marquee-ellipse": "Elliptical Marquee",
    "lasso-polygon": "Polygonal Lasso",
    "magic-wand": "Magic Wand",
    brush: "Brush",
    eraser: "Eraser",
    clone: "Clone Stamp",
    fill: "Paint Bucket",
    gradient: "Gradient",
    eyedropper: "Eyedropper",
    text: "Text",
    "shape-rect": "Rectangle",
    "shape-ellipse": "Ellipse",
    crop: "Crop",
    hand: "Hand",
    zoom: "Zoom",
  }[t as string] ?? "";
}
