import React, { useEffect, useState } from "react";

const TIPS = [
  "Tip: Press B for brush, V for move, Z for zoom.",
  "Tip: Hold Shift while resizing a corner to keep the aspect ratio.",
  "Tip: Drop a .cube LUT into the Filter Gallery for instant color grading.",
  "Tip: Two-finger pinch to zoom on touch devices.",
  "Tip: Right rail has Properties, Layers, Filters, Actions, History.",
  "Tip: File → Export As supports layered PSD, PNG, JPG, WebP, GIF, BMP, TIFF.",
];

interface Props {
  duration?: number;
}

export default function Splash({ duration = 1800 }: Props) {
  const [tip] = useState(() => TIPS[Math.floor(Math.random() * TIPS.length)]);
  const [hidden, setHidden] = useState(false);
  const [fading, setFading] = useState(false);

  useEffect(() => {
    const t1 = setTimeout(() => setFading(true), duration - 350);
    const t2 = setTimeout(() => setHidden(true), duration);
    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [duration]);

  if (hidden) return null;
  return (
    <div className={`splash ${fading ? "is-fading" : ""}`}>
      <div className="splash-frame">
        <div className="splash-mark">
          <div className="splash-mark-inner">Px</div>
        </div>
        <div className="splash-name">Pix.</div>
        <div className="splash-sub">web image editor</div>
        <div className="splash-progress">
          <div className="splash-progress-bar" />
        </div>
        <div className="splash-tip">{tip}</div>
        <div className="splash-credits">
          v1 · 2026 · Photoshop-inspired
        </div>
      </div>
    </div>
  );
}
