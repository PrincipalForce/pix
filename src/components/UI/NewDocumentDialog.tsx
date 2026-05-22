import React, { useState } from "react";
import Modal from "./Modal";
import { DocumentState } from "@/types/editor";

const PRESETS = [
  { name: "Phone photo 3024×4032", w: 3024, h: 4032 },
  { name: "Phone photo landscape 4032×3024", w: 4032, h: 3024 },
  { name: "Story 1080×1920", w: 1080, h: 1920 },
  { name: "Square 1080×1080", w: 1080, h: 1080 },
  { name: "Web 1920×1080", w: 1920, h: 1080 },
  { name: "Web 1280×720", w: 1280, h: 720 },
  { name: "Letter 2550×3300", w: 2550, h: 3300 },
  { name: "Print A4 2480×3508", w: 2480, h: 3508 },
];

interface Props {
  onClose: () => void;
  onCreate: (w: number, h: number, bg: DocumentState["background"], name: string) => void;
}

export default function NewDocumentDialog({ onClose, onCreate }: Props) {
  const isMobile = typeof window !== "undefined" && window.innerWidth < 900;
  const isPortrait =
    typeof window !== "undefined" && window.innerHeight > window.innerWidth;
  const [name, setName] = useState("Untitled");
  const [w, setW] = useState(isMobile ? (isPortrait ? 1080 : 1920) : 1920);
  const [h, setH] = useState(isMobile ? (isPortrait ? 1920 : 1080) : 1080);
  const [bg, setBg] = useState<DocumentState["background"]>("transparent");

  return (
    <Modal title="New Document" onClose={onClose} width={520}>
      <div className="field">
        <label>Name</label>
        <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
      </div>
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
        <label>Background</label>
        <div className="seg">
          {(["transparent", "white", "black"] as const).map((b) => (
            <button key={b} className={`seg-btn ${bg === b ? "is-on" : ""}`} onClick={() => setBg(b)}>
              {b}
            </button>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Presets</label>
        <div className="presets">
          {PRESETS.map((p) => (
            <button
              key={p.name}
              className="preset"
              onClick={() => {
                setW(p.w);
                setH(p.h);
              }}
            >
              {p.name}
            </button>
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
              onCreate(w, h, bg, name || "Untitled");
              onClose();
            }
          }}
        >
          Create
        </button>
      </div>
    </Modal>
  );
}
