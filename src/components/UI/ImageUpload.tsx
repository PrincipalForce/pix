import React, { useRef } from "react";
import { Upload } from "lucide-react";

interface Props {
  onFile: (file: File) => void;
  compact?: boolean;
}

export default function ImageUpload({ onFile, compact }: Props) {
  const ref = useRef<HTMLInputElement>(null);
  return (
    <>
      <input
        ref={ref}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif,image/bmp,image/tiff"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) onFile(f);
          if (ref.current) ref.current.value = "";
        }}
      />
      <button
        className={compact ? "icon-btn" : "btn ghost"}
        onClick={() => ref.current?.click()}
        title="Open image"
      >
        <Upload size={14} />
        {!compact && <span>Open</span>}
      </button>
    </>
  );
}
