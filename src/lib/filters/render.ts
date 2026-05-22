import { FilterDef } from "./types";
import { clamp, copy, hex2rgb, newLike } from "./imgutil";

// Tile-based value noise via hash for clouds. Deterministic per (x,y).
function hash(x: number, y: number): number {
  let h = x * 374761393 + y * 668265263;
  h = (h ^ (h >> 13)) * 1274126177;
  return ((h ^ (h >> 16)) >>> 0) / 0xffffffff;
}
function smoothStep(t: number): number {
  return t * t * (3 - 2 * t);
}
function valueNoise(x: number, y: number): number {
  const xi = Math.floor(x), yi = Math.floor(y);
  const xf = x - xi, yf = y - yi;
  const a = hash(xi, yi);
  const b = hash(xi + 1, yi);
  const c = hash(xi, yi + 1);
  const d = hash(xi + 1, yi + 1);
  const u = smoothStep(xf), v = smoothStep(yf);
  return a * (1 - u) * (1 - v) + b * u * (1 - v) + c * (1 - u) * v + d * u * v;
}

const clouds: FilterDef = {
  id: "clouds",
  name: "Clouds",
  category: "render",
  params: [
    { key: "scale", label: "Scale", type: "range", min: 4, max: 256, step: 1, default: 48 },
    { key: "color1", label: "Color 1", type: "color", default: "#3b82f6" },
    { key: "color2", label: "Color 2", type: "color", default: "#ffffff" },
  ],
  apply(src, p) {
    const out = newLike(src);
    const od = out.data;
    const w = src.width, h = src.height;
    const sc = p.scale as number;
    const [r0, g0, b0] = hex2rgb(p.color1 as string);
    const [r1, g1, b1] = hex2rgb(p.color2 as string);
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let v = 0, amp = 1, freq = 1 / sc, norm = 0;
        for (let oct = 0; oct < 5; oct++) {
          v += valueNoise(x * freq, y * freq) * amp;
          norm += amp;
          amp *= 0.5;
          freq *= 2;
        }
        v /= norm;
        const i = (y * w + x) * 4;
        od[i] = clamp(r0 + (r1 - r0) * v);
        od[i + 1] = clamp(g0 + (g1 - g0) * v);
        od[i + 2] = clamp(b0 + (b1 - b0) * v);
        od[i + 3] = 255;
      }
    }
    return out;
  },
};

const lensFlare: FilterDef = {
  id: "lens-flare",
  name: "Lens Flare",
  category: "render",
  params: [
    { key: "x", label: "X (%)", type: "range", min: 0, max: 100, step: 1, default: 30 },
    { key: "y", label: "Y (%)", type: "range", min: 0, max: 100, step: 1, default: 30 },
    { key: "brightness", label: "Brightness", type: "range", min: 0, max: 200, step: 1, default: 100 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const w = src.width, h = src.height;
    const cx = ((p.x as number) / 100) * w;
    const cy = ((p.y as number) / 100) * h;
    const k = (p.brightness as number) / 100;
    const rmax = Math.hypot(w, h) * 0.45;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = x - cx, dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        // Main glow: bright at center, falls off rapidly.
        const main = Math.max(0, 1 - r / (rmax * 0.4));
        const glow = Math.pow(main, 2.5) * 280 * k;
        // Ghosts: smaller bright spots along line through center to image center
        const icx = w / 2, icy = h / 2;
        const lx = icx - cx, ly = icy - cy;
        let ghostSum = 0;
        for (let i = 1; i <= 3; i++) {
          const gx = cx + lx * (i * 0.4);
          const gy = cy + ly * (i * 0.4);
          const gr = Math.hypot(x - gx, y - gy);
          ghostSum += Math.max(0, 1 - gr / (rmax * 0.08)) * 90 * k;
        }
        const idx = (y * w + x) * 4;
        d[idx] = clamp(d[idx] + glow + ghostSum);
        d[idx + 1] = clamp(d[idx + 1] + glow * 0.9 + ghostSum * 0.8);
        d[idx + 2] = clamp(d[idx + 2] + glow * 0.7 + ghostSum * 0.5);
      }
    }
    return out;
  },
};

const fill: FilterDef = {
  id: "render-fill",
  name: "Solid Fill",
  category: "render",
  params: [
    { key: "color", label: "Color", type: "color", default: "#ffffff" },
    { key: "opacity", label: "Opacity (%)", type: "range", min: 0, max: 100, step: 1, default: 100 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const [r, g, b] = hex2rgb(p.color as string);
    const a = (p.opacity as number) / 100;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = d[i] * (1 - a) + r * a;
      d[i + 1] = d[i + 1] * (1 - a) + g * a;
      d[i + 2] = d[i + 2] * (1 - a) + b * a;
    }
    return out;
  },
};

export const RENDERS: FilterDef[] = [clouds, lensFlare, fill];
