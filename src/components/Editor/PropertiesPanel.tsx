import React from "react";
import { EditorAPI } from "@/hooks/useEditor";
import { renderTextLayer, renderShapeLayer } from "@/lib/document";
import FontPicker from "../UI/FontPicker";

interface Props {
  api: EditorAPI;
}

// Context-sensitive Properties panel — mirrors Photoshop's right-side Properties.
// Shows tool-specific OR layer-specific controls based on what's active.
export default function PropertiesPanel({ api }: Props) {
  return (
    <div className="panel properties">
      <div className="panel-head">
        <span className="panel-title">Properties</span>
      </div>
      <div className="prop-body">
        {renderToolSection(api)}
        {renderLayerSection(api)}
      </div>
    </div>
  );
}

function renderToolSection(api: EditorAPI) {
  const t = api.tool;

  if (t === "brush" || t === "eraser") {
    const b = api.brush;
    return (
      <section className="prop-section">
        <h4>{t === "brush" ? "Brush" : "Eraser"}</h4>
        <Row label="Size">
          <NumberInput
            value={b.size}
            min={1}
            max={500}
            onChange={(v) => api.setBrush({ ...b, size: v })}
          />
          <input
            type="range"
            min={1}
            max={500}
            value={b.size}
            onChange={(e) => api.setBrush({ ...b, size: parseInt(e.target.value) })}
          />
        </Row>
        <Row label="Hardness">
          <PctInput value={b.hardness} onChange={(v) => api.setBrush({ ...b, hardness: v })} />
        </Row>
        <Row label="Opacity">
          <PctInput value={b.opacity} onChange={(v) => api.setBrush({ ...b, opacity: v })} />
        </Row>
        <Row label="Flow">
          <PctInput value={b.flow} onChange={(v) => api.setBrush({ ...b, flow: v })} />
        </Row>
        {t === "brush" && (
          <Row label="Color">
            <ColorInput value={b.color} onChange={(v) => api.setBrush({ ...b, color: v })} />
          </Row>
        )}
      </section>
    );
  }

  if (t === "magic-wand") {
    return (
      <section className="prop-section">
        <h4>Magic Wand</h4>
        <div className="muted">Click to select connected pixels by color. Tolerance fixed at 24 for now.</div>
      </section>
    );
  }

  if (t === "text") {
    return (
      <section className="prop-section">
        <h4>Text Tool</h4>
        <div className="muted">Click on the canvas to place a text layer. Edit text in the layer properties below.</div>
      </section>
    );
  }

  return null;
}

function renderLayerSection(api: EditorAPI) {
  const layer = api.selectedLayer;
  if (!layer) {
    return (
      <section className="prop-section">
        <h4>Layer</h4>
        <div className="muted">No layer selected.</div>
      </section>
    );
  }
  return (
    <>
      <section className="prop-section">
        <h4>{layer.name}</h4>
        <Row label="Name">
          <input
            className="input"
            value={layer.name}
            onChange={(e) => api.updateLayer(layer.id, { name: e.target.value })}
            onBlur={() => api.pushHistory("Rename Layer")}
          />
        </Row>
      </section>

      <section className="prop-section">
        <h4>Transform {layer.locked && <span className="lock-tag">locked</span>}</h4>
        <Row label="X">
          <NumberInput
            value={layer.x}
            disabled={layer.locked}
            onChange={(v) => api.updateLayer(layer.id, { x: v })}
            onCommit={() => api.pushHistory("Move")}
          />
        </Row>
        <Row label="Y">
          <NumberInput
            value={layer.y}
            disabled={layer.locked}
            onChange={(v) => api.updateLayer(layer.id, { y: v })}
            onCommit={() => api.pushHistory("Move")}
          />
        </Row>
        <Row label="W">
          <NumberInput
            value={layer.width}
            min={1}
            disabled={layer.locked}
            onChange={(v) => api.updateLayer(layer.id, { width: v })}
            onCommit={() => api.pushHistory("Resize")}
          />
        </Row>
        <Row label="H">
          <NumberInput
            value={layer.height}
            min={1}
            disabled={layer.locked}
            onChange={(v) => api.updateLayer(layer.id, { height: v })}
            onCommit={() => api.pushHistory("Resize")}
          />
        </Row>
        <Row label="Rotation">
          <NumberInput
            value={Math.round((layer.rotation * 180) / Math.PI)}
            disabled={layer.locked}
            onChange={(v) =>
              api.updateLayer(layer.id, { rotation: (v * Math.PI) / 180 })
            }
            onCommit={() => api.pushHistory("Rotate")}
          />
          <span className="suffix">°</span>
        </Row>
      </section>

      {layer.mask && (
        <section className="prop-section">
          <h4>Mask</h4>
          <Row label="Enabled">
            <input
              type="checkbox"
              checked={layer.maskEnabled}
              onChange={(e) =>
                api.updateLayerWithHistory(
                  layer.id,
                  { maskEnabled: e.target.checked },
                  e.target.checked ? "Enable Mask" : "Disable Mask"
                )
              }
            />
          </Row>
          <Row label="Edit target">
            <button
              className={`pill ${!api.doc.maskTargetActive ? "is-on" : ""}`}
              onClick={() => api.setMaskTargetActive(false)}
            >
              Layer
            </button>
            <button
              className={`pill ${api.doc.maskTargetActive ? "is-on" : ""}`}
              onClick={() => api.setMaskTargetActive(true)}
            >
              Mask
            </button>
          </Row>
          <Row label="">
            <button className="btn" onClick={() => api.removeMaskFromSelected()}>
              Delete mask
            </button>
          </Row>
        </section>
      )}

      {layer.kind === "text" && layer.text && (
        <section className="prop-section">
          <h4>Text</h4>
          <Row label="Content">
            <input
              className="input"
              value={layer.text.text}
              onChange={(e) => {
                const t = { ...layer.text!, text: e.target.value };
                const updated = { ...layer, text: t };
                renderTextLayer(updated);
                api.updateLayer(layer.id, { text: t });
                api.bump();
              }}
            />
          </Row>
          <Row label="Font">
            <FontPicker
              value={layer.text.fontFamily}
              onChange={(family) => {
                const t = { ...layer.text!, fontFamily: family };
                const updated = { ...layer, text: t };
                renderTextLayer(updated);
                api.updateLayer(layer.id, { text: t });
                api.bump();
              }}
            />
          </Row>
          <Row label="Size">
            <NumberInput
              value={layer.text.fontSize}
              min={4}
              max={400}
              onChange={(v) => {
                const t = { ...layer.text!, fontSize: v };
                const updated = { ...layer, text: t };
                renderTextLayer(updated);
                api.updateLayer(layer.id, { text: t });
                api.bump();
              }}
            />
          </Row>
          <Row label="Weight">
            <select
              className="input"
              value={layer.text.fontWeight}
              onChange={(e) => {
                const t = { ...layer.text!, fontWeight: parseInt(e.target.value) };
                const updated = { ...layer, text: t };
                renderTextLayer(updated);
                api.updateLayer(layer.id, { text: t });
                api.bump();
              }}
            >
              {[300, 400, 500, 600, 700, 800, 900].map((w) => (
                <option key={w} value={w}>
                  {w}
                </option>
              ))}
            </select>
          </Row>
          <Row label="Color">
            <ColorInput
              value={layer.text.color}
              onChange={(v) => {
                const t = { ...layer.text!, color: v };
                const updated = { ...layer, text: t };
                renderTextLayer(updated);
                api.updateLayer(layer.id, { text: t });
                api.bump();
              }}
            />
          </Row>
          <Row label="Align">
            {(["left", "center", "right"] as const).map((a) => (
              <button
                key={a}
                className={`pill ${layer.text!.align === a ? "is-on" : ""}`}
                onClick={() => {
                  const t = { ...layer.text!, align: a };
                  const updated = { ...layer, text: t };
                  renderTextLayer(updated);
                  api.updateLayer(layer.id, { text: t });
                  api.bump();
                }}
              >
                {a}
              </button>
            ))}
          </Row>
        </section>
      )}

      {layer.kind === "shape" && layer.shape && (
        <section className="prop-section">
          <h4>Shape</h4>
          <Row label="Fill">
            <input
              type="checkbox"
              checked={!!layer.shape.fill}
              onChange={(e) => {
                const s = { ...layer.shape!, fill: e.target.checked ? layer.shape!.fill || "#3b82f6" : null };
                const updated = { ...layer, shape: s };
                renderShapeLayer(updated);
                api.updateLayer(layer.id, { shape: s });
                api.bump();
              }}
            />
            {layer.shape.fill && (
              <ColorInput
                value={layer.shape.fill}
                onChange={(v) => {
                  const s = { ...layer.shape!, fill: v };
                  const updated = { ...layer, shape: s };
                  renderShapeLayer(updated);
                  api.updateLayer(layer.id, { shape: s });
                  api.bump();
                }}
              />
            )}
          </Row>
          <Row label="Stroke">
            <input
              type="checkbox"
              checked={!!layer.shape.stroke}
              onChange={(e) => {
                const s = { ...layer.shape!, stroke: e.target.checked ? layer.shape!.stroke || "#000" : null };
                const updated = { ...layer, shape: s };
                renderShapeLayer(updated);
                api.updateLayer(layer.id, { shape: s });
                api.bump();
              }}
            />
            {layer.shape.stroke && (
              <ColorInput
                value={layer.shape.stroke}
                onChange={(v) => {
                  const s = { ...layer.shape!, stroke: v };
                  const updated = { ...layer, shape: s };
                  renderShapeLayer(updated);
                  api.updateLayer(layer.id, { shape: s });
                  api.bump();
                }}
              />
            )}
          </Row>
          <Row label="Stroke W">
            <NumberInput
              value={layer.shape.strokeWidth}
              min={0}
              max={64}
              onChange={(v) => {
                const s = { ...layer.shape!, strokeWidth: v };
                const updated = { ...layer, shape: s };
                renderShapeLayer(updated);
                api.updateLayer(layer.id, { shape: s });
                api.bump();
              }}
            />
          </Row>
        </section>
      )}
    </>
  );
}

function Row({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="prop-row">
      <label>{label}</label>
      <div className="prop-row-fields">{children}</div>
    </div>
  );
}

function NumberInput({
  value,
  onChange,
  onCommit,
  min,
  max,
  disabled,
}: {
  value: number;
  onChange: (v: number) => void;
  onCommit?: () => void;
  min?: number;
  max?: number;
  disabled?: boolean;
}) {
  return (
    <input
      className="input num"
      type="number"
      value={value}
      min={min}
      max={max}
      disabled={disabled}
      onChange={(e) => {
        const v = parseFloat(e.target.value);
        if (!Number.isNaN(v)) onChange(v);
      }}
      onBlur={onCommit}
    />
  );
}

function PctInput({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="pct">
      <input
        type="range"
        min={0}
        max={100}
        value={Math.round(value * 100)}
        onChange={(e) => onChange(parseInt(e.target.value) / 100)}
      />
      <span>{Math.round(value * 100)}%</span>
    </div>
  );
}

function ColorInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="color-input">
      <input
        type="color"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <input
        type="text"
        className="input mono"
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
