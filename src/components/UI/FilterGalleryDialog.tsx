import React, { useEffect, useMemo, useRef, useState } from "react";
import Modal from "./Modal";
import { EditorAPI } from "@/hooks/useEditor";
import { CATEGORY_LABELS, FilterCategory, FilterDef, ParamSpec } from "@/lib/filters/types";
import {
  deletePreset,
  exportPresetBundle,
  getFilter,
  importPresetBundle,
  listFilters,
  loadPresets,
  savePreset,
  UserPreset,
} from "@/lib/filters/registry";
import { importAcv, importCubeLut } from "@/lib/filters/importers";
import { createCanvas, ctx2d } from "@/lib/canvas";
import { Download, Upload, Trash2, Bookmark } from "lucide-react";

interface Props {
  api: EditorAPI;
  initialFilterId?: string;
  initialPresetId?: string;
  onClose: () => void;
}

export default function FilterGalleryDialog({ api, initialFilterId, initialPresetId, onClose }: Props) {
  const layer = api.selectedLayer;
  const [filters, setFilters] = useState<FilterDef[]>(() => listFilters());
  const [presets, setPresets] = useState<UserPreset[]>(() => loadPresets());
  const [category, setCategory] = useState<FilterCategory | "presets">(
    initialFilterId ? getFilter(initialFilterId)?.category ?? "adjust" : "adjust"
  );
  const [selected, setSelected] = useState<string>(initialFilterId ?? "brightness-contrast");
  const [params, setParams] = useState<Record<string, any>>(() =>
    defaultParams(getFilter(initialFilterId ?? "brightness-contrast"))
  );

  // Build a small preview of the active layer once.
  const previewSrc = useMemo<ImageData | null>(() => {
    if (!layer) return null;
    const maxSide = 320;
    const ratio = layer.canvas.width / layer.canvas.height;
    const w = ratio >= 1 ? maxSide : Math.round(maxSide * ratio);
    const h = ratio >= 1 ? Math.round(maxSide / ratio) : maxSide;
    const c = createCanvas(w, h);
    const ctx = ctx2d(c);
    ctx.imageSmoothingQuality = "high";
    ctx.drawImage(layer.canvas, 0, 0, w, h);
    return ctx.getImageData(0, 0, w, h);
  }, [layer?.id, api.dirtyTick]);

  const previewRef = useRef<HTMLCanvasElement>(null);

  // Live preview: apply current filter to a downscaled snapshot.
  useEffect(() => {
    if (!previewSrc || !previewRef.current) return;
    const def = getFilter(selected);
    if (!def) return;
    let cancelled = false;
    const handle = setTimeout(() => {
      if (cancelled) return;
      try {
        const out = def.apply(previewSrc, params);
        const c = previewRef.current!;
        c.width = out.width;
        c.height = out.height;
        ctx2d(c).putImageData(out, 0, 0);
      } catch (e) {
        console.error(e);
      }
    }, 40);
    return () => {
      cancelled = true;
      clearTimeout(handle);
    };
  }, [previewSrc, selected, params]);

  useEffect(() => {
    if (initialPresetId) {
      const preset = loadPresets().find((p) => p.id === initialPresetId);
      if (preset) {
        setSelected(preset.filterId);
        setParams(preset.params);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const selectedDef = getFilter(selected);
  const filteredList = useMemo(() => {
    if (category === "presets") return [];
    return filters.filter((f) => f.category === category);
  }, [filters, category]);

  const applyToLayer = () => {
    if (!layer || !selectedDef) return;
    const ctx = ctx2d(layer.canvas);
    const src = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
    const out = selectedDef.apply(src, params);
    ctx.putImageData(out, 0, 0);
    api.bump();
    api.recordStep({ type: "applyFilter", filterId: selectedDef.id, params: { ...params } });
    api.pushHistory(`Filter: ${selectedDef.name}`);
    onClose();
  };

  const refreshLists = () => {
    setFilters(listFilters());
    setPresets(loadPresets());
  };

  const handleImportFile = (file: File) => {
    const ext = file.name.split(".").pop()?.toLowerCase();
    if (ext === "cube") {
      file.text().then((txt) => {
        try {
          const def = importCubeLut(txt, file.name.replace(/\.cube$/i, ""));
          refreshLists();
          setCategory("adjust");
          setSelected(def.id);
          setParams(defaultParams(def));
        } catch (e) {
          alert("Failed to import .cube: " + (e as Error).message);
        }
      });
    } else if (ext === "acv") {
      file.arrayBuffer().then((buf) => {
        try {
          const { id, presetId } = importAcv(buf, file.name.replace(/\.acv$/i, ""));
          refreshLists();
          setCategory("presets");
          const p = loadPresets().find((x) => x.id === presetId);
          if (p) {
            setSelected(id);
            setParams(p.params);
          }
        } catch (e) {
          alert("Failed to import .acv: " + (e as Error).message);
        }
      });
    } else if (ext === "json") {
      file.text().then((txt) => {
        try {
          const n = importPresetBundle(txt);
          refreshLists();
          alert(`Imported ${n} preset${n === 1 ? "" : "s"}.`);
        } catch (e) {
          alert("Failed to import preset bundle: " + (e as Error).message);
        }
      });
    } else {
      alert("Unsupported file. Use .cube, .acv, or .json.");
    }
  };

  return (
    <Modal title="Filter Gallery" onClose={onClose} width={900}>
      <div className="gallery-grid">
        <div className="gallery-cats">
          {(Object.keys(CATEGORY_LABELS) as FilterCategory[]).map((c) => (
            <button
              key={c}
              className={`cat-btn ${category === c ? "is-on" : ""}`}
              onClick={() => setCategory(c)}
            >
              {CATEGORY_LABELS[c]}
            </button>
          ))}
          <button
            className={`cat-btn ${category === "presets" ? "is-on" : ""}`}
            onClick={() => setCategory("presets")}
          >
            Presets
          </button>

          <div className="cat-sep" />

          <label className="cat-btn import-btn">
            <Upload size={12} />
            <span>Import .cube / .acv / .json</span>
            <input
              type="file"
              accept=".cube,.acv,.json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleImportFile(f);
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </label>
          <button
            className="cat-btn"
            onClick={() => {
              const blob = new Blob([exportPresetBundle()], { type: "application/json" });
              const url = URL.createObjectURL(blob);
              const a = document.createElement("a");
              a.href = url;
              a.download = "pix-presets.json";
              a.click();
              URL.revokeObjectURL(url);
            }}
          >
            <Download size={12} /> Export presets
          </button>
        </div>

        <div className="gallery-list">
          {category === "presets" ? (
            presets.length === 0 ? (
              <div className="muted small" style={{ padding: 12 }}>
                No saved presets yet. Adjust a filter and click <strong>Save preset</strong>.
              </div>
            ) : (
              presets.map((p) => (
                <div
                  key={p.id}
                  className={`filter-row ${selected === p.filterId && JSON.stringify(params) === JSON.stringify(p.params) ? "is-on" : ""}`}
                  onClick={() => {
                    setSelected(p.filterId);
                    setParams(p.params);
                  }}
                >
                  <span>{p.name}</span>
                  <span className="muted small">{getFilter(p.filterId)?.name ?? p.filterId}</span>
                  <button
                    className="row-del"
                    onClick={(e) => {
                      e.stopPropagation();
                      deletePreset(p.id);
                      setPresets(loadPresets());
                    }}
                  >
                    <Trash2 size={12} />
                  </button>
                </div>
              ))
            )
          ) : (
            filteredList.map((f) => (
              <button
                key={f.id}
                className={`filter-row ${selected === f.id ? "is-on" : ""}`}
                onClick={() => {
                  setSelected(f.id);
                  setParams(defaultParams(f));
                }}
              >
                {f.name}
              </button>
            ))
          )}
        </div>

        <div className="gallery-detail">
          <div className="preview-frame" style={{ minHeight: 220 }}>
            {previewSrc ? <canvas ref={previewRef} /> : <div className="muted small">Select a raster layer to preview.</div>}
          </div>
          <h4 className="detail-title">{selectedDef?.name ?? "—"}</h4>
          <div className="param-list">
            {selectedDef?.params.length === 0 && (
              <div className="muted small">No parameters.</div>
            )}
            {selectedDef?.params.map((spec) => (
              <ParamRow
                key={spec.key}
                spec={spec}
                value={params[spec.key]}
                onChange={(v) => setParams({ ...params, [spec.key]: v })}
              />
            ))}
          </div>
          <div className="detail-actions">
            <button
              className="btn ghost"
              onClick={() => {
                const name = prompt("Preset name?");
                if (!name) return;
                if (!selectedDef) return;
                savePreset({ name, filterId: selectedDef.id, params: { ...params } });
                setPresets(loadPresets());
              }}
            >
              <Bookmark size={12} /> Save preset
            </button>
            <div style={{ flex: 1 }} />
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button className="btn primary" disabled={!layer || !selectedDef} onClick={applyToLayer}>
              Apply
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}

function defaultParams(def: FilterDef | undefined): Record<string, any> {
  if (!def) return {};
  const out: Record<string, any> = {};
  for (const p of def.params) out[p.key] = p.default;
  return out;
}

function ParamRow({
  spec,
  value,
  onChange,
}: {
  spec: ParamSpec;
  value: any;
  onChange: (v: any) => void;
}) {
  if (spec.type === "range" || spec.type === "angle") {
    const v = typeof value === "number" ? value : Number(spec.default);
    return (
      <div className="param-row">
        <label>{spec.label}</label>
        <div className="param-row-fields">
          <input
            type="range"
            min={spec.min}
            max={spec.max}
            step={spec.step ?? 1}
            value={v}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
          <input
            type="number"
            className="input num"
            value={v}
            min={spec.min}
            max={spec.max}
            step={spec.step ?? 1}
            onChange={(e) => onChange(parseFloat(e.target.value))}
          />
        </div>
      </div>
    );
  }
  if (spec.type === "select") {
    return (
      <div className="param-row">
        <label>{spec.label}</label>
        <select
          className="input"
          value={String(value ?? spec.default)}
          onChange={(e) => onChange(e.target.value)}
        >
          {spec.options?.map((o) => (
            <option key={String(o.value)} value={String(o.value)}>
              {o.label}
            </option>
          ))}
        </select>
      </div>
    );
  }
  if (spec.type === "boolean") {
    return (
      <div className="param-row">
        <label>{spec.label}</label>
        <input type="checkbox" checked={!!value} onChange={(e) => onChange(e.target.checked)} />
      </div>
    );
  }
  if (spec.type === "color") {
    return (
      <div className="param-row">
        <label>{spec.label}</label>
        <div className="param-row-fields">
          <input
            type="color"
            value={(value as string) ?? (spec.default as string)}
            onChange={(e) => onChange(e.target.value)}
          />
          <input
            type="text"
            className="input mono"
            value={(value as string) ?? (spec.default as string)}
            onChange={(e) => onChange(e.target.value)}
          />
        </div>
      </div>
    );
  }
  if (spec.type === "curve") {
    return (
      <CurveEditor
        value={value as number[]}
        onChange={onChange}
      />
    );
  }
  return null;
}

// Tiny curve editor: drag points, double-click to add, alt-click to remove.
function CurveEditor({
  value,
  onChange,
}: {
  value: number[];
  onChange: (pts: number[]) => void;
}) {
  const size = 220;
  const ref = useRef<SVGSVGElement>(null);
  const points = useMemo(() => {
    const pts: Array<{ x: number; y: number }> = [];
    for (let i = 0; i < value.length; i += 2) pts.push({ x: value[i], y: value[i + 1] });
    pts.sort((a, b) => a.x - b.x);
    return pts;
  }, [value]);

  const toFlat = (pts: Array<{ x: number; y: number }>): number[] => {
    const out: number[] = [];
    for (const p of pts) out.push(p.x, p.y);
    return out;
  };

  const evtPt = (e: React.MouseEvent) => {
    const r = ref.current!.getBoundingClientRect();
    const x = ((e.clientX - r.left) / r.width) * 255;
    const y = ((r.bottom - e.clientY) / r.height) * 255;
    return { x: Math.max(0, Math.min(255, x)), y: Math.max(0, Math.min(255, y)) };
  };

  return (
    <div className="curve-editor">
      <svg
        ref={ref}
        viewBox={`0 0 ${size} ${size}`}
        width={size}
        height={size}
        onDoubleClick={(e) => {
          const p = evtPt(e);
          onChange(toFlat([...points, p].sort((a, b) => a.x - b.x)));
        }}
      >
        <rect x={0} y={0} width={size} height={size} fill="#0d1015" stroke="#2b3340" />
        {[1, 2, 3].map((i) => (
          <line key={i} x1={(i * size) / 4} y1={0} x2={(i * size) / 4} y2={size} stroke="#1b2029" />
        ))}
        {[1, 2, 3].map((i) => (
          <line key={i} x1={0} y1={(i * size) / 4} x2={size} y2={(i * size) / 4} stroke="#1b2029" />
        ))}
        <line x1={0} y1={size} x2={size} y2={0} stroke="#2b3340" strokeDasharray="2,2" />
        <polyline
          points={points
            .map((p) => `${(p.x / 255) * size},${size - (p.y / 255) * size}`)
            .join(" ")}
          fill="none"
          stroke="#4c8bf5"
          strokeWidth={1.5}
        />
        {points.map((p, i) => (
          <circle
            key={i}
            cx={(p.x / 255) * size}
            cy={size - (p.y / 255) * size}
            r={4.5}
            fill="#fff"
            stroke="#4c8bf5"
            strokeWidth={1.5}
            style={{ cursor: "move" }}
            onMouseDown={(e) => {
              e.preventDefault();
              if (e.altKey) {
                if (points.length <= 2) return;
                onChange(toFlat(points.filter((_, j) => j !== i)));
                return;
              }
              const move = (ev: MouseEvent) => {
                const p2 = evtPt(ev as unknown as React.MouseEvent);
                const copy = points.slice();
                copy[i] = p2;
                onChange(toFlat(copy.sort((a, b) => a.x - b.x)));
              };
              const up = () => {
                window.removeEventListener("mousemove", move);
                window.removeEventListener("mouseup", up);
              };
              window.addEventListener("mousemove", move);
              window.addEventListener("mouseup", up);
            }}
          />
        ))}
      </svg>
      <div className="curve-help muted small">Double-click: add point · Alt-click point: remove</div>
    </div>
  );
}
