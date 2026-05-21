import React from "react";
import {
  MousePointer2,
  Square as SquareIcon,
  Circle as CircleIcon,
  Lasso,
  Wand2,
  Brush,
  Eraser,
  PaintBucket,
  Pipette,
  Type,
  Square,
  Circle,
  Crop,
  Hand,
  ZoomIn,
} from "lucide-react";
import { Tool } from "@/types/editor";

interface Props {
  selectedTool: Tool;
  onToolSelect: (t: Tool) => void;
  foreground: string;
  background: string;
  onSwapColors: () => void;
  onResetColors: () => void;
  onForegroundClick: () => void;
}

const SECTIONS: Array<Array<{ id: Tool; Icon: any; label: string; shortcut: string }>> = [
  [
    { id: "move", Icon: MousePointer2, label: "Move", shortcut: "V" },
  ],
  [
    { id: "marquee-rect", Icon: SquareIcon, label: "Rectangular Marquee", shortcut: "M" },
    { id: "marquee-ellipse", Icon: CircleIcon, label: "Elliptical Marquee", shortcut: "M" },
    { id: "lasso-polygon", Icon: Lasso, label: "Polygonal Lasso", shortcut: "L" },
    { id: "magic-wand", Icon: Wand2, label: "Magic Wand", shortcut: "W" },
  ],
  [
    { id: "crop", Icon: Crop, label: "Crop", shortcut: "C" },
    { id: "eyedropper", Icon: Pipette, label: "Eyedropper", shortcut: "I" },
  ],
  [
    { id: "brush", Icon: Brush, label: "Brush", shortcut: "B" },
    { id: "eraser", Icon: Eraser, label: "Eraser", shortcut: "E" },
    { id: "fill", Icon: PaintBucket, label: "Paint Bucket", shortcut: "G" },
  ],
  [
    { id: "text", Icon: Type, label: "Text", shortcut: "T" },
    { id: "shape-rect", Icon: Square, label: "Rectangle", shortcut: "U" },
    { id: "shape-ellipse", Icon: Circle, label: "Ellipse", shortcut: "U" },
  ],
  [
    { id: "hand", Icon: Hand, label: "Hand", shortcut: "H" },
    { id: "zoom", Icon: ZoomIn, label: "Zoom", shortcut: "Z" },
  ],
];

export default function ToolPanel({
  selectedTool,
  onToolSelect,
  foreground,
  background,
  onSwapColors,
  onResetColors,
  onForegroundClick,
}: Props) {
  return (
    <div className="tool-rail">
      {SECTIONS.map((section, i) => (
        <div key={i} className="tool-section">
          {section.map(({ id, Icon, label, shortcut }) => (
            <button
              key={id}
              className={`tool-btn ${selectedTool === id ? "is-active" : ""}`}
              onClick={() => onToolSelect(id)}
              title={`${label} (${shortcut})`}
            >
              <Icon size={16} strokeWidth={1.6} />
            </button>
          ))}
        </div>
      ))}

      <div className="tool-section color-chips">
        <div className="chip-stack">
          <button
            className="color-chip chip-bg"
            style={{ background }}
            title="Background color"
          />
          <button
            className="color-chip chip-fg"
            style={{ background: foreground }}
            title="Foreground color"
            onClick={onForegroundClick}
          />
        </div>
        <div className="chip-actions">
          <button onClick={onSwapColors} title="Swap (X)" className="chip-mini">
            ⇄
          </button>
          <button onClick={onResetColors} title="Default colors (D)" className="chip-mini">
            ◐
          </button>
        </div>
      </div>
    </div>
  );
}
