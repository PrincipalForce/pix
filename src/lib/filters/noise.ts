import { FilterDef } from "./types";
import { clamp, copy, luminance, newLike } from "./imgutil";

const addNoise: FilterDef = {
  id: "add-noise",
  name: "Add Noise",
  category: "noise",
  params: [
    { key: "amount", label: "Amount", type: "range", min: 0, max: 100, step: 1, default: 12 },
    {
      key: "distribution", label: "Distribution", type: "select", default: "uniform",
      options: [{ label: "Uniform", value: "uniform" }, { label: "Gaussian", value: "gauss" }],
    },
    { key: "mono", label: "Monochrome", type: "boolean", default: false },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const amt = ((p.amount as number) / 100) * 128;
    const mono = p.mono as boolean;
    const gauss = p.distribution === "gauss";
    for (let i = 0; i < d.length; i += 4) {
      const n = mono ? rand(gauss, amt) : 0;
      d[i] = clamp(d[i] + (mono ? n : rand(gauss, amt)));
      d[i + 1] = clamp(d[i + 1] + (mono ? n : rand(gauss, amt)));
      d[i + 2] = clamp(d[i + 2] + (mono ? n : rand(gauss, amt)));
    }
    return out;
  },
};

function rand(gauss: boolean, amt: number): number {
  if (!gauss) return (Math.random() - 0.5) * 2 * amt;
  // Box-Muller
  const u1 = Math.max(1e-9, Math.random());
  const u2 = Math.random();
  return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2) * (amt / 3);
}

const median: FilterDef = {
  id: "median",
  name: "Median",
  category: "noise",
  params: [{ key: "radius", label: "Radius", type: "range", min: 1, max: 6, step: 1, default: 1 }],
  apply(src, p) {
    const r = p.radius as number;
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const window: number[] = [];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        for (let c = 0; c < 3; c++) {
          window.length = 0;
          for (let dy = -r; dy <= r; dy++) {
            const yy = Math.max(0, Math.min(h - 1, y + dy));
            for (let dx = -r; dx <= r; dx++) {
              const xx = Math.max(0, Math.min(w - 1, x + dx));
              window.push(sd[(yy * w + xx) * 4 + c]);
            }
          }
          window.sort((a, b) => a - b);
          od[(y * w + x) * 4 + c] = window[(window.length / 2) | 0];
        }
        od[(y * w + x) * 4 + 3] = sd[(y * w + x) * 4 + 3];
      }
    }
    return out;
  },
};

const despeckle: FilterDef = {
  id: "despeckle",
  name: "Despeckle",
  category: "noise",
  params: [],
  apply(src) {
    // Use median radius 1 selectively — keep edges (apply median only where local contrast is low).
    const w = src.width, h = src.height;
    const out = copy(src);
    const sd = src.data, od = out.data;
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        // Estimate local contrast via luminance
        let lo = 255, hi = 0;
        for (let dy = -1; dy <= 1; dy++) {
          for (let dx = -1; dx <= 1; dx++) {
            const i = ((y + dy) * w + (x + dx)) * 4;
            const l = luminance(sd[i], sd[i + 1], sd[i + 2]);
            if (l < lo) lo = l; if (l > hi) hi = l;
          }
        }
        if (hi - lo < 12) continue; // skip flat areas
        // Replace center with median of 9
        for (let c = 0; c < 3; c++) {
          const arr: number[] = [];
          for (let dy = -1; dy <= 1; dy++) {
            for (let dx = -1; dx <= 1; dx++) {
              arr.push(sd[((y + dy) * w + (x + dx)) * 4 + c]);
            }
          }
          arr.sort((a, b) => a - b);
          od[(y * w + x) * 4 + c] = arr[4];
        }
      }
    }
    return out;
  },
};

export const NOISES: FilterDef[] = [addNoise, median, despeckle];
