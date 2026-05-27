import React, { useEffect, useRef, useState } from "react";
import Modal from "./Modal";

interface Props {
  title: string;
  label: string;
  defaultValue: number;
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
  confirmLabel?: string;
  onClose: () => void;
  onConfirm: (value: number) => void;
}

export default function NumberPromptDialog({
  title,
  label,
  defaultValue,
  min = 0,
  max = 9999,
  step = 1,
  unit,
  confirmLabel = "Apply",
  onClose,
  onConfirm,
}: Props) {
  const [value, setValue] = useState<string>(String(defaultValue));
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
    inputRef.current?.select();
  }, []);

  const submit = () => {
    const n = parseFloat(value);
    if (!isFinite(n)) return;
    const clamped = Math.max(min, Math.min(max, n));
    onConfirm(clamped);
    onClose();
  };

  return (
    <Modal title={title} onClose={onClose} width={360}>
      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
        <label style={{ display: "flex", flexDirection: "column", gap: 6, fontSize: 12, color: "var(--text-dim)" }}>
          <span>{label}</span>
          <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <input
              ref={inputRef}
              type="number"
              inputMode="numeric"
              value={value}
              min={min}
              max={max}
              step={step}
              onChange={(e) => setValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
              style={{
                flex: 1,
                padding: "10px 12px",
                background: "var(--surface-2, #1a1d26)",
                border: "1px solid var(--line, rgba(255,255,255,0.12))",
                borderRadius: 6,
                color: "var(--text, #fff)",
                fontSize: 14,
              }}
            />
            {unit && <span style={{ color: "var(--text-dim)", fontSize: 13 }}>{unit}</span>}
          </div>
        </label>
        <div style={{ display: "flex", gap: 8, justifyContent: "flex-end" }}>
          <button className="btn ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn primary" onClick={submit}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </Modal>
  );
}
