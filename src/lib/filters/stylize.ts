import { FilterDef } from "./types";
import { clamp, copy, luminance, newLike } from "./imgutil";

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

export const STYLIZES: FilterDef[] = [findEdges, emboss, solarize, oilPaint, diffuse];
