import React, { useEffect, useMemo, useRef, useState } from "react";
import { Upload, Search } from "lucide-react";
import { ensureFontLoaded, importFontFile, listFonts } from "@/lib/fonts";

interface Props {
  value: string;
  onChange: (family: string) => void;
}

export default function FontPicker({ value, onChange }: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [version, setVersion] = useState(0);
  const wrap = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const close = (e: MouseEvent) => {
      if (wrap.current && !wrap.current.contains(e.target as Node)) setOpen(false);
    };
    window.addEventListener("mousedown", close);
    return () => window.removeEventListener("mousedown", close);
  }, [open]);

  const fonts = useMemo(() => {
    const q = query.trim().toLowerCase();
    const all = listFonts();
    if (!q) return all;
    return all.filter((f) => f.family.toLowerCase().includes(q));
  }, [query, version, open]);

  return (
    <div className="font-picker" ref={wrap}>
      <button
        className="input font-trigger"
        style={{ fontFamily: `'${value}', sans-serif` }}
        onClick={() => setOpen((v) => !v)}
      >
        {value} <span className="brush-caret">▾</span>
      </button>
      {open && (
        <div className="font-pop">
          <div className="font-search">
            <Search size={12} />
            <input
              autoFocus
              className="input"
              placeholder="Search fonts"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <div className="font-list">
            {fonts.map((f) => (
              <button
                key={f.family}
                className={`font-row ${f.family === value ? "is-on" : ""}`}
                style={{ fontFamily: `'${f.family}', sans-serif` }}
                onMouseEnter={() => ensureFontLoaded(f.family)}
                onClick={() => {
                  ensureFontLoaded(f.family);
                  onChange(f.family);
                  setOpen(false);
                }}
              >
                <span>{f.family}</span>
                <span className="font-sample">Aa Bb 123</span>
              </button>
            ))}
          </div>
          <label className="brush-import">
            <Upload size={12} />
            <span>Import .ttf / .otf / .woff…</span>
            <input
              type="file"
              accept=".ttf,.otf,.woff,.woff2"
              style={{ display: "none" }}
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                try {
                  const family = await importFontFile(f);
                  onChange(family);
                  setVersion((v) => v + 1);
                } catch (err) {
                  alert("Failed to load font: " + (err as Error).message);
                }
                (e.target as HTMLInputElement).value = "";
              }}
            />
          </label>
        </div>
      )}
    </div>
  );
}
