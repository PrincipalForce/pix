import React, { useState } from "react";
import Modal from "./Modal";

type Anchor = "tl" | "t" | "tr" | "l" | "c" | "r" | "bl" | "b" | "br";

interface Props {
  width: number;
  height: number;
  onClose: () => void;
  onApply: (w: number, h: number, anchor: Anchor) => void;
}

export default function CanvasSizeDialog({ width, height, onClose, onApply }: Props) {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [anchor, setAnchor] = useState<Anchor>("c");
  const anchors: Anchor[] = ["tl", "t", "tr", "l", "c", "r", "bl", "b", "br"];

  return (
    <Modal title="Canvas Size" onClose={onClose}>
      <p className="muted small">
        Changes the document boundaries without resampling pixels. Anchor determines where existing
        content sits in the new canvas.
      </p>
      <div className="field-row">
        <div className="field">
          <label>Width (px)</label>
          <input
            className="input num"
            type="number"
            min={1}
            value={w}
            onChange={(e) => setW(parseInt(e.target.value) || 0)}
          />
        </div>
        <div className="field">
          <label>Height (px)</label>
          <input
            className="input num"
            type="number"
            min={1}
            value={h}
            onChange={(e) => setH(parseInt(e.target.value) || 0)}
          />
        </div>
      </div>
      <div className="field">
        <label>Anchor</label>
        <div className="anchor-grid">
          {anchors.map((a) => (
            <button
              key={a}
              className={`anchor-cell ${anchor === a ? "is-on" : ""}`}
              onClick={() => setAnchor(a)}
            />
          ))}
        </div>
      </div>
      <div className="modal-actions">
        <button className="btn ghost" onClick={onClose}>
          Cancel
        </button>
        <button
          className="btn primary"
          onClick={() => {
            if (w > 0 && h > 0) {
              onApply(w, h, anchor);
              onClose();
            }
          }}
        >
          Apply
        </button>
      </div>
    </Modal>
  );
}
