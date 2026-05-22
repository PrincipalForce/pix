import { FilterDef } from "./types";
import { clamp, copy, hslToRgb, luminance, newLike, rgbToHsl } from "./imgutil";

const findEdges: FilterDef = {
  id: "find-edges",
  name: "Find Edges",
  category: "stylize",
  params: [],
  apply(src) {
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    // Sobel
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        let gx = 0, gy = 0;
        for (let c = 0; c < 3; c++) {
          const i00 = ((y - 1) * w + (x - 1)) * 4 + c;
          const i01 = ((y - 1) * w + x) * 4 + c;
          const i02 = ((y - 1) * w + (x + 1)) * 4 + c;
          const i10 = (y * w + (x - 1)) * 4 + c;
          const i12 = (y * w + (x + 1)) * 4 + c;
          const i20 = ((y + 1) * w + (x - 1)) * 4 + c;
          const i21 = ((y + 1) * w + x) * 4 + c;
          const i22 = ((y + 1) * w + (x + 1)) * 4 + c;
          gx += -sd[i00] - 2 * sd[i10] - sd[i20] + sd[i02] + 2 * sd[i12] + sd[i22];
          gy += -sd[i00] - 2 * sd[i01] - sd[i02] + sd[i20] + 2 * sd[i21] + sd[i22];
        }
        const mag = Math.min(255, Math.sqrt(gx * gx + gy * gy));
        const v = 255 - mag;
        const j = (y * w + x) * 4;
        od[j] = v; od[j + 1] = v; od[j + 2] = v; od[j + 3] = sd[j + 3];
      }
    }
    return out;
  },
};

const emboss: FilterDef = {
  id: "emboss",
  name: "Emboss",
  category: "stylize",
  params: [
    { key: "angle", label: "Angle (°)", type: "angle", min: -180, max: 180, step: 1, default: 135 },
    { key: "height", label: "Height", type: "range", min: 1, max: 10, step: 1, default: 3 },
    { key: "amount", label: "Amount (%)", type: "range", min: 1, max: 500, step: 1, default: 100 },
  ],
  apply(src, p) {
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const ang = ((p.angle as number) * Math.PI) / 180;
    const dx = Math.cos(ang) * (p.height as number);
    const dy = Math.sin(ang) * (p.height as number);
    const amt = (p.amount as number) / 100;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const sx = Math.max(0, Math.min(w - 1, Math.round(x - dx)));
        const sy = Math.max(0, Math.min(h - 1, Math.round(y - dy)));
        const i0 = (y * w + x) * 4;
        const i1 = (sy * w + sx) * 4;
        for (let c = 0; c < 3; c++) {
          od[i0 + c] = clamp(128 + (sd[i0 + c] - sd[i1 + c]) * amt);
        }
        od[i0 + 3] = sd[i0 + 3];
      }
    }
    return out;
  },
};

const solarize: FilterDef = {
  id: "solarize",
  name: "Solarize",
  category: "stylize",
  params: [{ key: "threshold", label: "Threshold", type: "range", min: 0, max: 255, step: 1, default: 128 }],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const t = p.threshold as number;
    for (let i = 0; i < d.length; i += 4) {
      if (d[i] > t) d[i] = 255 - d[i];
      if (d[i + 1] > t) d[i + 1] = 255 - d[i + 1];
      if (d[i + 2] > t) d[i + 2] = 255 - d[i + 2];
    }
    return out;
  },
};

const oilPaint: FilterDef = {
  id: "oil-paint",
  name: "Oil Paint",
  category: "stylize",
  params: [
    { key: "radius", label: "Radius", type: "range", min: 1, max: 8, step: 1, default: 3 },
    { key: "intensity", label: "Intensity", type: "range", min: 4, max: 32, step: 1, default: 16 },
  ],
  apply(src, p) {
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const r = p.radius as number;
    const bins = p.intensity as number;
    const f = bins / 256;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const histN = new Array(bins).fill(0);
        const histR = new Array(bins).fill(0);
        const histG = new Array(bins).fill(0);
        const histB = new Array(bins).fill(0);
        for (let dy = -r; dy <= r; dy++) {
          const yy = Math.max(0, Math.min(h - 1, y + dy));
          for (let dx = -r; dx <= r; dx++) {
            const xx = Math.max(0, Math.min(w - 1, x + dx));
            const i = (yy * w + xx) * 4;
            const rv = sd[i], gv = sd[i + 1], bv = sd[i + 2];
            const b = Math.min(bins - 1, Math.floor(luminance(rv, gv, bv) * f));
            histN[b]++;
            histR[b] += rv; histG[b] += gv; histB[b] += bv;
          }
        }
        let best = 0;
        for (let i = 1; i < bins; i++) if (histN[i] > histN[best]) best = i;
        const cnt = histN[best] || 1;
        const j = (y * w + x) * 4;
        od[j] = histR[best] / cnt;
        od[j + 1] = histG[best] / cnt;
        od[j + 2] = histB[best] / cnt;
        od[j + 3] = sd[j + 3];
      }
    }
    return out;
  },
};

const diffuse: FilterDef = {
  id: "diffuse",
  name: "Diffuse",
  category: "stylize",
  params: [{ key: "radius", label: "Radius", type: "range", min: 1, max: 12, step: 1, default: 4 }],
  apply(src, p) {
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const r = p.radius as number;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const dx = (Math.random() * 2 - 1) * r;
        const dy = (Math.random() * 2 - 1) * r;
        const sx = Math.max(0, Math.min(w - 1, Math.round(x + dx)));
        const sy = Math.max(0, Math.min(h - 1, Math.round(y + dy)));
        const i = (y * w + x) * 4;
        const j = (sy * w + sx) * 4;
        od[i] = sd[j]; od[i + 1] = sd[j + 1]; od[i + 2] = sd[j + 2]; od[i + 3] = sd[j + 3];
      }
    }
    return out;
  },
};

const rotoscope: FilterDef = {
  id: "rotoscope",
  name: "Rotoscope",
  category: "stylize",
  params: [
    { key: "levels", label: "Color levels", type: "range", min: 2, max: 16, step: 1, default: 5 },
    { key: "smoothing", label: "Smoothing", type: "range", min: 0, max: 8, step: 1, default: 2 },
    { key: "edgeStrength", label: "Edge strength", type: "range", min: 0, max: 100, step: 1, default: 70 },
    { key: "edgeThreshold", label: "Edge threshold", type: "range", min: 0, max: 200, step: 1, default: 60 },
    { key: "saturation", label: "Saturation boost", type: "range", min: -100, max: 200, step: 1, default: 40 },
  ],
  apply(src, p) {
    const w = src.width, h = src.height;
    const sd = src.data;
    const out = newLike(src);
    const od = out.data;

    // 1. Light blur (smoothing) — separable box of radius `smoothing`.
    const sm = p.smoothing as number;
    let smoothed: Uint8ClampedArray = new Uint8ClampedArray(sd);
    if (sm > 0) {
      const tmp = new Uint8ClampedArray(sd.length);
      smoothed = boxBlur(smoothed, w, h, sm, tmp);
    }

    // 2. Posterize (quantize each channel) + saturation boost in HSL.
    const lv = p.levels as number;
    const step = 255 / (lv - 1);
    const inv = (lv - 1) / 255;
    const sat = 1 + (p.saturation as number) / 100;
    for (let i = 0; i < smoothed.length; i += 4) {
      let r = Math.round(smoothed[i] * inv) * step;
      let g = Math.round(smoothed[i + 1] * inv) * step;
      let b = Math.round(smoothed[i + 2] * inv) * step;
      if (sat !== 1) {
        const [H, S, L] = rgbToHsl(r, g, b);
        const ns = Math.max(0, Math.min(1, S * sat));
        const [r2, g2, b2] = hslToRgb(H, ns, L);
        r = r2; g = g2; b = b2;
      }
      od[i] = r; od[i + 1] = g; od[i + 2] = b; od[i + 3] = smoothed[i + 3];
    }

    // 3. Sobel edges on the original source; draw inked outline where magnitude > threshold.
    const eStrength = (p.edgeStrength as number) / 100;
    const eThresh = p.edgeThreshold as number;
    if (eStrength > 0) {
      for (let y = 1; y < h - 1; y++) {
        for (let x = 1; x < w - 1; x++) {
          let gx = 0, gy = 0;
          for (let c = 0; c < 3; c++) {
            const i00 = ((y - 1) * w + (x - 1)) * 4 + c;
            const i01 = ((y - 1) * w + x) * 4 + c;
            const i02 = ((y - 1) * w + (x + 1)) * 4 + c;
            const i10 = (y * w + (x - 1)) * 4 + c;
            const i12 = (y * w + (x + 1)) * 4 + c;
            const i20 = ((y + 1) * w + (x - 1)) * 4 + c;
            const i21 = ((y + 1) * w + x) * 4 + c;
            const i22 = ((y + 1) * w + (x + 1)) * 4 + c;
            gx += -sd[i00] - 2 * sd[i10] - sd[i20] + sd[i02] + 2 * sd[i12] + sd[i22];
            gy += -sd[i00] - 2 * sd[i01] - sd[i02] + sd[i20] + 2 * sd[i21] + sd[i22];
          }
          const mag = Math.sqrt(gx * gx + gy * gy);
          if (mag > eThresh) {
            const ink = Math.min(1, ((mag - eThresh) / 255) * eStrength + 0.3);
            const j = (y * w + x) * 4;
            od[j] = od[j] * (1 - ink);
            od[j + 1] = od[j + 1] * (1 - ink);
            od[j + 2] = od[j + 2] * (1 - ink);
          }
        }
      }
    }

    return out;
  },
};

function boxBlur(src: Uint8ClampedArray, w: number, h: number, r: number, out: Uint8ClampedArray): Uint8ClampedArray {
  const size = r * 2 + 1;
  // Horizontal
  const tmp = new Uint8ClampedArray(src.length);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r0 = 0, g0 = 0, b0 = 0, a0 = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.max(0, Math.min(w - 1, x + k));
        const i = (y * w + xx) * 4;
        r0 += src[i]; g0 += src[i + 1]; b0 += src[i + 2]; a0 += src[i + 3];
        c++;
      }
      const j = (y * w + x) * 4;
      tmp[j] = r0 / c; tmp[j + 1] = g0 / c; tmp[j + 2] = b0 / c; tmp[j + 3] = a0 / c;
    }
  }
  // Vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let r0 = 0, g0 = 0, b0 = 0, a0 = 0, c = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.max(0, Math.min(h - 1, y + k));
        const i = (yy * w + x) * 4;
        r0 += tmp[i]; g0 += tmp[i + 1]; b0 += tmp[i + 2]; a0 += tmp[i + 3];
        c++;
      }
      const j = (y * w + x) * 4;
      out[j] = r0 / c; out[j + 1] = g0 / c; out[j + 2] = b0 / c; out[j + 3] = a0 / c;
    }
  }
  return out;
}

export const STYLIZES: FilterDef[] = [findEdges, emboss, solarize, oilPaint, diffuse, rotoscope];
