import React, { useEffect, useRef, useState } from "react";
import { Upload } from "lucide-react";
import { listBrushes, getBrush } from "@/lib/brushes/registry";
import { importAbrFile } from "@/lib/brushes/importer";

interface Props {
  selectedId: string;
  onSelect: (id: string) => void;
}

export default function BrushPicker({ selectedId, onSelect }: Props) {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", onDown);
    return () => window.removeEventListener("mousedown", onDown);
  }, [open]);

  const brushes = listBrushes();
  const current = getBrush(selectedId) ?? brushes[0];

  return (
    <div className="brush-picker" ref={ref}>
      <button className="brush-trigger" onClick={() => setOpen((v) => !v)}>
        <BrushThumb canvas={current.tip} />
        <span className="brush-name">{current.name}</span>
        <span className="brush-caret">▾</span>
      </button>
      {open && (
        <div className="brush-pop">
          <div className="brush-pop-grid">
            {brushes.map((b) => (
              <button
                key={b.id}
                className={`brush-cell ${b.id === selectedId ? "is-on" : ""}`}
                title={b.name}
                onClick={() => {
                  onSelect(b.id);
                  setOpen(false);
                }}
              >
                <BrushThumb canvas={b.tip} size={36} />
                <span>{b.name}</span>
              </button>
            ))}
          </div>
          <label className="brush-import">
            <Upload size={12} />
            <span>Import .abr…</span>
            <input
              type="file"
              accept=".abr"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const imported = await importAbrFile(f);
                  if (imported.length === 0) alert("No brushes were imported.");
                  else {
                    onSelect(imported[0].id);
                    setVersion((v) => v + 1);
                  }
                } catch (err) {
                  alert("Failed to read .abr: " + (err as Error).message);
                }
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </label>
        </div>
      )}
      <span style={{ display: "none" }}>{version}</span>
    </div>
  );
}

function BrushThumb({ canvas, size = 24 }: { canvas: HTMLCanvasElement; size?: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    c.width = size;
    c.height = size;
    const ctx = c.getContext("2d")!;
    ctx.clearRect(0, 0, size, size);
    // White background to make the tip visible.
    ctx.fillStyle = "#0d1015";
    ctx.fillRect(0, 0, size, size);
    // Tint the tip with light gray for the swatch preview.
    const tmp = document.createElement("canvas");
    tmp.width = canvas.width;
    tmp.height = canvas.height;
    const tctx = tmp.getContext("2d")!;
    tctx.drawImage(canvas, 0, 0);
    tctx.globalCompositeOperation = "source-in";
    tctx.fillStyle = "#e7ebf2";
    tctx.fillRect(0, 0, tmp.width, tmp.height);
    ctx.drawImage(tmp, 0, 0, size, size);
  }, [canvas, size]);
  return <canvas ref={ref} className="brush-thumb" />;
}
