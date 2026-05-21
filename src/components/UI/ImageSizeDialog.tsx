import React, { useEffect, useState } from "react";
import Modal from "./Modal";

interface Props {
  width: number;
  height: number;
  onClose: () => void;
  onApply: (w: number, h: number) => void;
}

export default function ImageSizeDialog({ width, height, onClose, onApply }: Props) {
  const [w, setW] = useState(width);
  const [h, setH] = useState(height);
  const [linked, setLinked] = useState(true);
  const aspect = width / height;

  useEffect(() => {
    setW(width);
    setH(height);
  }, [width, height]);

  return (
    <Modal title="Image Size" onClose={onClose}>
      <p className="muted small">
        Resamples the whole document — all layers and masks are scaled with high-quality
        interpolation.
      </p>
      <div className="field-row">
        <div className="field">
          <label>Width (px)</label>
          <input
            className="input num"
            type="number"
            min={1}
            value={w}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 0;
              setW(v);
              if (linked) setH(Math.round(v / aspect));
            }}
          />
        </div>
        <button
          className={`chain ${linked ? "is-on" : ""}`}
          onClick={() => setLinked((x) => !x)}
          title={linked ? "Aspect locked" : "Aspect unlocked"}
        >
          ⛓
        </button>
        <div className="field">
          <label>Height (px)</label>
          <input
            className="input num"
            type="number"
            min={1}
            value={h}
            onChange={(e) => {
              const v = parseInt(e.target.value) || 0;
              setH(v);
              if (linked) setW(Math.round(v * aspect));
            }}
          />
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
              onApply(w, h);
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
