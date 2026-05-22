import { BrushPreset } from "./types";
import { createCanvas, ctx2d } from "../canvas";

// Each built-in tip is rendered at a canonical 128x128 alpha-only canvas.
const CANONICAL = 128;

function softRoundTip(hardness: number): HTMLCanvasElement {
  const c = createCanvas(CANONICAL, CANONICAL);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(CANONICAL, CANONICAL);
  const d = img.data;
  const r = CANONICAL / 2;
  for (let y = 0; y < CANONICAL; y++) {
    for (let x = 0; x < CANONICAL; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) / r;
      let a = 0;
      if (dist <= 1) {
        // Hardness 1 = hard disc, 0 = smooth falloff
        if (dist < hardness) a = 1;
        else a = 1 - (dist - hardness) / (1 - hardness);
        a = Math.max(0, Math.min(1, a));
      }
      const i = (y * CANONICAL + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(a * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function noiseTip(density: number, hardness: number): HTMLCanvasElement {
  const c = createCanvas(CANONICAL, CANONICAL);
  const ctx = ctx2d(c);
  const img = ctx.createImageData(CANONICAL, CANONICAL);
  const d = img.data;
  const r = CANONICAL / 2;
  for (let y = 0; y < CANONICAL; y++) {
    for (let x = 0; x < CANONICAL; x++) {
      const dx = x - r + 0.5;
      const dy = y - r + 0.5;
      const dist = Math.sqrt(dx * dx + dy * dy) / r;
      if (dist > 1) continue;
      const env = Math.max(0, dist < hardness ? 1 : 1 - (dist - hardness) / (1 - hardness));
      const noise = Math.random() < density ? Math.random() * env : 0;
      const i = (y * CANONICAL + x) * 4;
      d[i] = 255;
      d[i + 1] = 255;
      d[i + 2] = 255;
      d[i + 3] = Math.round(noise * 255);
    }
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function chalkTip(): HTMLCanvasElement {
  const c = createCanvas(CANONICAL, CANONICAL);
  const ctx = ctx2d(c);
  // Base soft disc
  const grad = ctx.createRadialGradient(CANONICAL / 2, CANONICAL / 2, 0, CANONICAL / 2, CANONICAL / 2, CANONICAL / 2);
  grad.addColorStop(0, "rgba(255,255,255,0.9)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.55)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANONICAL, CANONICAL);
  // Subtract speckle holes
  const img = ctx.getImageData(0, 0, CANONICAL, CANONICAL);
  const d = img.data;
  for (let i = 3; i < d.length; i += 4) {
    if (Math.random() < 0.35) d[i] = Math.max(0, d[i] - Math.random() * 180);
  }
  ctx.putImageData(img, 0, 0);
  return c;
}

function splatterTip(): HTMLCanvasElement {
  const c = createCanvas(CANONICAL, CANONICAL);
  const ctx = ctx2d(c);
  ctx.fillStyle = "white";
  // A handful of overlapping discs
  const r0 = CANONICAL / 2;
  for (let i = 0; i < 28; i++) {
    const ang = Math.random() * Math.PI * 2;
    const rad = Math.random() * r0 * 0.85;
    const cx = r0 + Math.cos(ang) * rad;
    const cy = r0 + Math.sin(ang) * rad;
    const rr = (Math.random() * 0.18 + 0.05) * r0;
    ctx.beginPath();
    ctx.arc(cx, cy, rr, 0, Math.PI * 2);
    ctx.globalAlpha = Math.random() * 0.7 + 0.3;
    ctx.fill();
  }
  ctx.globalAlpha = 1;
  return c;
}

function brushLineTip(): HTMLCanvasElement {
  // Calligraphic flat tip — elongated horizontally
  const c = createCanvas(CANONICAL, CANONICAL);
  const ctx = ctx2d(c);
  const grad = ctx.createLinearGradient(0, CANONICAL / 2 - 12, 0, CANONICAL / 2 + 12);
  grad.addColorStop(0, "rgba(255,255,255,0)");
  grad.addColorStop(0.3, "rgba(255,255,255,0.95)");
  grad.addColorStop(0.7, "rgba(255,255,255,0.95)");
  grad.addColorStop(1, "rgba(255,255,255,0)");
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, CANONICAL, CANONICAL);
  return c;
}

export const BUILTIN_BRUSHES: BrushPreset[] = [
  {
    id: "soft-round",
    name: "Soft Round",
    source: "builtin",
    tip: softRoundTip(0.0),
    spacing: 0.18,
    defaultSize: 30,
    hardness: 0,
  },
  {
    id: "medium-round",
    name: "Medium Round",
    source: "builtin",
    tip: softRoundTip(0.5),
    spacing: 0.2,
    defaultSize: 24,
    hardness: 0.5,
  },
  {
    id: "hard-round",
    name: "Hard Round",
    source: "builtin",
    tip: softRoundTip(0.95),
    spacing: 0.25,
    defaultSize: 16,
    hardness: 0.95,
  },
  {
    id: "airbrush",
    name: "Airbrush",
    source: "builtin",
    tip: noiseTip(0.6, 0),
    spacing: 0.08,
    defaultSize: 50,
    hardness: 0,
  },
  {
    id: "chalk",
    name: "Chalk",
    source: "builtin",
    tip: chalkTip(),
    spacing: 0.3,
    defaultSize: 28,
    hardness: 0.4,
  },
  {
    id: "splatter",
    name: "Splatter",
    source: "builtin",
    tip: splatterTip(),
    spacing: 0.6,
    defaultSize: 40,
    hardness: 0.5,
  },
  {
    id: "calligraphy",
    name: "Calligraphy",
    source: "builtin",
    tip: brushLineTip(),
    spacing: 0.1,
    defaultSize: 36,
    hardness: 0.6,
  },
];
