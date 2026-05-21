import React, { useMemo, useState } from "react";
import Modal from "./Modal";
import { EditorAPI } from "@/hooks/useEditor";
import { ExportFormat, exportDocument } from "@/lib/export";
import { compositeDocument } from "@/lib/render";

interface Props {
  api: EditorAPI;
  onClose: () => void;
}

const FORMATS: Array<{ id: ExportFormat; name: string; alpha: boolean; quality: boolean; desc: string }> = [
  { id: "png", name: "PNG", alpha: true, quality: false, desc: "Lossless · transparency · best for screens" },
  { id: "jpeg", name: "JPEG", alpha: false, quality: true, desc: "Lossy · smaller files · no transparency" },
  { id: "webp", name: "WebP", alpha: true, quality: true, desc: "Modern · alpha + small files" },
  { id: "gif", name: "GIF", alpha: true, quality: false, desc: "256 colors · 1-bit transparency" },
  { id: "bmp", name: "BMP", alpha: false, quality: false, desc: "Uncompressed 24-bit bitmap" },
  { id: "tiff", name: "TIFF", alpha: true, quality: false, desc: "Lossless · print/archive" },
  { id: "psd", name: "PSD", alpha: true, quality: false, desc: "Photoshop · keeps layers + masks" },
];

export default function ExportDialog({ api, onClose }: Props) {
  const [format, setFormat] = useState<ExportFormat>("png");
  const [filename, setFilename] = useState(api.doc.name.replace(/\s+/g, "-").toLowerCase());
  const [quality, setQuality] = useState(0.92);
  const [scale, setScale] = useState(1);
  const [background, setBg] = useState("#ffffff");
  const [busy, setBusy] = useState(false);

  const meta = FORMATS.find((f) => f.id === format)!;
  const previewUrl = useMemo(() => {
    const c = compositeDocument(api.doc, undefined, { includeBackground: true });
    return c.toDataURL("image/png");
  }, [api.doc, api.dirtyTick]);

  const finalSize = useMemo(() => {
    const w = Math.round(api.doc.width * scale);
    const h = Math.round(api.doc.height * scale);
    return `${w} × ${h} px`;
  }, [api.doc.width, api.doc.height, scale]);

  return (
    <Modal title="Export As" onClose={onClose} width={720}>
      <div className="export-grid">
        <div className="export-preview">
          <div className="preview-frame">
            <img src={previewUrl} alt="" />
          </div>
          <div className="preview-meta">
            <div>{finalSize}</div>
            <div className="muted">{api.doc.layers.length} layer{api.doc.layers.length === 1 ? "" : "s"}</div>
          </div>
        </div>
        <div className="export-controls">
          <div className="field">
            <label>Filename</label>
            <div className="filename-row">
              <input
                className="input"
                value={filename}
                onChange={(e) => setFilename(e.target.value)}
              />
              <span className="ext">.{format === "jpeg" ? "jpg" : format}</span>
            </div>
          </div>

          <div className="field">
            <label>Format</label>
            <div className="format-grid">
              {FORMATS.map((f) => (
                <button
                  key={f.id}
                  className={`format-card ${format === f.id ? "is-on" : ""}`}
                  onClick={() => setFormat(f.id)}
                >
                  <div className="fc-name">{f.name}</div>
                  <div className="fc-desc">{f.desc}</div>
                </button>
              ))}
            </div>
          </div>

          {meta.quality && (
            <div className="field">
              <label>Quality · {Math.round(quality * 100)}%</label>
              <input
                type="range"
                min={5}
                max={100}
                value={Math.round(quality * 100)}
                onChange={(e) => setQuality(parseInt(e.target.value) / 100)}
              />
            </div>
          )}

          <div className="field">
            <label>Scale</label>
            <div className="scale-pills">
              {[0.5, 1, 1.5, 2, 3].map((s) => (
                <button
                  key={s}
                  className={`pill ${scale === s ? "is-on" : ""}`}
                  onClick={() => setScale(s)}
                >
                  {s}×
                </button>
              ))}
            </div>
          </div>

          {!meta.alpha && (
            <div className="field">
              <label>Matte (background)</label>
              <input
                type="color"
                value={background}
                onChange={(e) => setBg(e.target.value)}
              />
              <span className="mono small muted" style={{ marginLeft: 8 }}>
                {background}
              </span>
            </div>
          )}

          <div className="modal-actions">
            <button className="btn ghost" onClick={onClose}>
              Cancel
            </button>
            <button
              className="btn primary"
              disabled={busy || !filename.trim()}
              onClick={async () => {
                setBusy(true);
                try {
                  await exportDocument(api.doc, {
                    format,
                    filename: filename.trim(),
                    quality,
                    scale,
                    background,
                    flatten: format !== "psd",
                  });
                  onClose();
                } catch (e) {
                  console.error(e);
                  alert("Export failed: " + (e as Error).message);
                } finally {
                  setBusy(false);
                }
              }}
            >
              {busy ? "Exporting…" : "Export"}
            </button>
          </div>
        </div>
      </div>
    </Modal>
  );
}
