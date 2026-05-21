import { Tool } from "@/types/editor";

// Build a CSS `cursor` value from an inline SVG with a hotspot.
function svgCursor(svg: string, hx: number, hy: number, fallback = "default"): string {
  const enc = encodeURIComponent(svg)
    .replace(/'/g, "%27")
    .replace(/"/g, "%22");
  return `url("data:image/svg+xml;charset=utf-8,${enc}") ${hx} ${hy}, ${fallback}`;
}

const moveSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M12 2 L15 5 L13 5 L13 11 L19 11 L19 9 L22 12 L19 15 L19 13 L13 13 L13 19 L15 19 L12 22 L9 19 L11 19 L11 13 L5 13 L5 15 L2 12 L5 9 L5 11 L11 11 L11 5 L9 5 Z' fill='black' stroke='white' stroke-width='0.8' stroke-linejoin='round'/>
</svg>`;

const lassoSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M3 8 Q3 3 9 3 Q19 3 19 9 Q19 13 14 14 L14 17 Q14 20 11 20 Q9 20 9 18 Q9 17 10 17' fill='none' stroke='white' stroke-width='2.5'/>
<path d='M3 8 Q3 3 9 3 Q19 3 19 9 Q19 13 14 14 L14 17 Q14 20 11 20 Q9 20 9 18 Q9 17 10 17' fill='none' stroke='black' stroke-width='1.2'/>
</svg>`;

const wandSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M3 21 L13 11 L15 13 L5 23 Z' fill='black' stroke='white' stroke-width='1.2'/>
<path d='M15 3 L17 3 M16 1 L16 5 M19 6 L21 8 M21 4 L19 6 M15 8 L17 10' stroke='white' stroke-width='2' stroke-linecap='round'/>
</svg>`;

const eyedropperSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M17 3 L21 7 L18 10 L16 8 L9 15 L7 17 L5 19 L3 17 L5 15 L7 13 L14 6 L12 4 Z' fill='black' stroke='white' stroke-width='1'/>
</svg>`;

const cropSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M5 1 L5 19 L23 19 M1 5 L19 5 L19 23' fill='none' stroke='white' stroke-width='3'/>
<path d='M5 1 L5 19 L23 19 M1 5 L19 5 L19 23' fill='none' stroke='black' stroke-width='1.5'/>
</svg>`;

const handSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M7 11 L7 5 Q7 3 9 3 Q11 3 11 5 L11 10 L11 4 Q11 2 13 2 Q15 2 15 4 L15 10 L15 5 Q15 3 17 3 Q19 3 19 5 L19 11 L19 8 Q19 6 21 6 Q22 6 22 8 L22 16 Q22 22 16 22 L13 22 Q9 22 7 19 L4 15 Q3 13 5 12 Q6 11 8 13 L9 14' fill='black' stroke='white' stroke-width='1'/>
</svg>`;

const zoomInSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<circle cx='10' cy='10' r='6' fill='none' stroke='black' stroke-width='2.5'/>
<circle cx='10' cy='10' r='6' fill='none' stroke='white' stroke-width='1.2'/>
<path d='M14 14 L21 21' stroke='black' stroke-width='3' stroke-linecap='round'/>
<path d='M14 14 L21 21' stroke='white' stroke-width='1.2' stroke-linecap='round'/>
<path d='M10 7 L10 13 M7 10 L13 10' stroke='white' stroke-width='1.5'/>
</svg>`;

const textSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M11 22 L11 4 M5 4 L17 4 M5 4 L5 7 M17 4 L17 7 M9 22 L13 22' stroke='black' stroke-width='2.4'/>
<path d='M11 22 L11 4 M5 4 L17 4 M5 4 L5 7 M17 4 L17 7 M9 22 L13 22' stroke='white' stroke-width='1'/>
</svg>`;

const fillSvg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<path d='M3 13 L11 5 L17 11 L9 19 Z' fill='none' stroke='white' stroke-width='2.5'/>
<path d='M3 13 L11 5 L17 11 L9 19 Z' fill='black' stroke='white' stroke-width='1'/>
<path d='M17 13 Q19 16 19 18 Q19 20 17 20 Q15 20 15 18 Q15 16 17 13 Z' fill='white' stroke='black' stroke-width='0.5'/>
</svg>`;

// Brush/eraser cursor with a ring sized to brush radius. radiusPx is in screen pixels.
function brushCursor(radiusPx: number, isEraser = false): string {
  const r = Math.max(2, Math.min(256, radiusPx));
  const size = Math.ceil(r * 2 + 6);
  const c = size / 2;
  const ring = `<circle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='black' stroke-width='1.2'/>
                <circle cx='${c}' cy='${c}' r='${r}' fill='none' stroke='white' stroke-width='0.8'/>`;
  const cross = `<path d='M${c - 3} ${c} L${c + 3} ${c} M${c} ${c - 3} L${c} ${c + 3}' stroke='${
    isEraser ? "red" : "black"
  }' stroke-width='1'/>`;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='${size}' height='${size}' viewBox='0 0 ${size} ${size}'>${ring}${cross}</svg>`;
  return svgCursor(svg, c, c, "crosshair");
}

export function cursorFor(
  tool: Tool,
  opts: { brushRadiusPx?: number } = {}
): string {
  switch (tool) {
    case "move":
      return svgCursor(moveSvg, 12, 12, "move");
    case "marquee-rect":
    case "marquee-ellipse":
      return "crosshair";
    case "lasso-polygon":
      return svgCursor(lassoSvg, 4, 19, "crosshair");
    case "magic-wand":
      return svgCursor(wandSvg, 4, 21, "crosshair");
    case "brush":
      return brushCursor(opts.brushRadiusPx ?? 5, false);
    case "eraser":
      return brushCursor(opts.brushRadiusPx ?? 10, true);
    case "fill":
      return svgCursor(fillSvg, 12, 18, "crosshair");
    case "eyedropper":
      return svgCursor(eyedropperSvg, 3, 21, "crosshair");
    case "text":
      return svgCursor(textSvg, 11, 12, "text");
    case "shape-rect":
    case "shape-ellipse":
      return "crosshair";
    case "crop":
      return svgCursor(cropSvg, 12, 12, "crosshair");
    case "hand":
      return svgCursor(handSvg, 12, 14, "grab");
    case "zoom":
      return svgCursor(zoomInSvg, 10, 10, "zoom-in");
    default:
      return "default";
  }
}
