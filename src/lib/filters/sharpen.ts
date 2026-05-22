import { FilterDef } from "./types";
import { clamp, convolveH, convolveV, copy, gaussianKernel, newLike } from "./imgutil";

const sharpen: FilterDef = {
  id: "sharpen",
  name: "Sharpen",
  category: "sharpen",
  params: [{ key: "amount", label: "Amount", type: "range", min: 0, max: 200, step: 1, default: 50 }],
  apply(src, p) {
    const out = copy(src);
    const w = src.width, h = src.height;
    const sd = src.data, od = out.data;
    const k = (p.amount as number) / 100;
    const kernel = [0, -1, 0, -1, 5, -1, 0, -1, 0];
    for (let y = 1; y < h - 1; y++) {
      for (let x = 1; x < w - 1; x++) {
        for (let c = 0; c < 3; c++) {
          let v = 0;
          for (let ky = -1; ky <= 1; ky++) {
            for (let kx = -1; kx <= 1; kx++) {
              v += sd[((y + ky) * w + (x + kx)) * 4 + c] * kernel[(ky + 1) * 3 + (kx + 1)];
            }
          }
          const orig = sd[(y * w + x) * 4 + c];
          od[(y * w + x) * 4 + c] = clamp(orig + (v - orig) * k);
        }
      }
    }
    return out;
  },
};

const unsharpMask: FilterDef = {
  id: "unsharp-mask",
  name: "Unsharp Mask",
  category: "sharpen",
  params: [
    { key: "amount", label: "Amount (%)", type: "range", min: 0, max: 500, step: 1, default: 100 },
    { key: "radius", label: "Radius (px)", type: "range", min: 0.1, max: 20, step: 0.1, default: 1.5 },
    { key: "threshold", label: "Threshold", type: "range", min: 0, max: 80, step: 1, default: 0 },
  ],
  apply(src, p) {
    const sigma = Math.max(0.1, p.radius as number);
    const k = gaussianKernel(sigma);
    const blurred = convolveV(convolveH(src, k), k);
    const out = copy(src);
    const sd = src.data, bd = blurred.data, od = out.data;
    const amt = (p.amount as number) / 100;
    const th = p.threshold as number;
    for (let i = 0; i < sd.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        const orig = sd[i + c];
        const diff = orig - bd[i + c];
        if (Math.abs(diff) < th) od[i + c] = orig;
        else od[i + c] = clamp(orig + diff * amt);
      }
    }
    return out;
  },
};

const highPass: FilterDef = {
  id: "high-pass",
  name: "High Pass",
  category: "other",
  params: [{ key: "radius", label: "Radius (px)", type: "range", min: 0.1, max: 60, step: 0.1, default: 8 }],
  apply(src, p) {
    const sigma = Math.max(0.1, p.radius as number);
    const k = gaussianKernel(sigma);
    const blurred = convolveV(convolveH(src, k), k);
    const out = copy(src);
    const sd = src.data, bd = blurred.data, od = out.data;
    for (let i = 0; i < sd.length; i += 4) {
      od[i] = clamp(sd[i] - bd[i] + 128);
      od[i + 1] = clamp(sd[i + 1] - bd[i + 1] + 128);
      od[i + 2] = clamp(sd[i + 2] - bd[i + 2] + 128);
    }
    return out;
  },
};

export const SHARPENS: FilterDef[] = [sharpen, unsharpMask];
export const OTHERS: FilterDef[] = [highPass];
