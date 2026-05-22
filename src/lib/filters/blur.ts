import { FilterDef } from "./types";
import { clamp, convolveH, convolveV, copy, gaussianKernel, newLike, sampleBilinear } from "./imgutil";

const gaussian: FilterDef = {
  id: "gaussian-blur",
  name: "Gaussian Blur",
  category: "blur",
  params: [{ key: "radius", label: "Radius (px)", type: "range", min: 0.1, max: 60, step: 0.1, default: 4 }],
  apply(src, p) {
    const sigma = Math.max(0.1, p.radius as number);
    const k = gaussianKernel(sigma);
    return convolveV(convolveH(src, k), k);
  },
};

const box: FilterDef = {
  id: "box-blur",
  name: "Box Blur",
  category: "blur",
  params: [{ key: "radius", label: "Radius (px)", type: "range", min: 1, max: 40, step: 1, default: 4 }],
  apply(src, p) {
    const r = Math.round(p.radius as number);
    const size = r * 2 + 1;
    const k = new Array(size).fill(1 / size);
    return convolveV(convolveH(src, k), k);
  },
};

const motion: FilterDef = {
  id: "motion-blur",
  name: "Motion Blur",
  category: "blur",
  params: [
    { key: "angle", label: "Angle (°)", type: "angle", min: -180, max: 180, step: 1, default: 0 },
    { key: "distance", label: "Distance (px)", type: "range", min: 1, max: 100, step: 1, default: 12 },
  ],
  apply(src, p) {
    const dist = Math.round(p.distance as number);
    const angle = ((p.angle as number) * Math.PI) / 180;
    const dx = Math.cos(angle);
    const dy = Math.sin(angle);
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const half = dist;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let r = 0, g = 0, b = 0, a = 0, c = 0;
        for (let t = -half; t <= half; t++) {
          const sx = Math.round(x + dx * t);
          const sy = Math.round(y + dy * t);
          if (sx < 0 || sx >= w || sy < 0 || sy >= h) continue;
          const i = (sy * w + sx) * 4;
          r += sd[i]; g += sd[i + 1]; b += sd[i + 2]; a += sd[i + 3];
          c++;
        }
        const j = (y * w + x) * 4;
        if (c) { od[j] = r / c; od[j + 1] = g / c; od[j + 2] = b / c; od[j + 3] = a / c; }
        else { od[j] = sd[j]; od[j + 1] = sd[j + 1]; od[j + 2] = sd[j + 2]; od[j + 3] = sd[j + 3]; }
      }
    }
    return out;
  },
};

const radial: FilterDef = {
  id: "radial-blur",
  name: "Radial Blur",
  category: "blur",
  params: [
    {
      key: "method", label: "Method", type: "select", default: "spin",
      options: [{ label: "Spin", value: "spin" }, { label: "Zoom", value: "zoom" }],
    },
    { key: "amount", label: "Amount", type: "range", min: 1, max: 60, step: 1, default: 12 },
    { key: "steps", label: "Quality (samples)", type: "range", min: 4, max: 32, step: 1, default: 12 },
  ],
  apply(src, p) {
    const w = src.width, h = src.height;
    const cx = w / 2, cy = h / 2;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const amt = (p.amount as number) / 100;
    const steps = p.steps as number;
    const isSpin = p.method === "spin";
    const tmp = [0, 0, 0, 0];
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let dx = x - cx, dy = y - cy;
        const r = Math.sqrt(dx * dx + dy * dy);
        const ang0 = Math.atan2(dy, dx);
        let acc0 = 0, acc1 = 0, acc2 = 0, acc3 = 0;
        for (let i = 0; i < steps; i++) {
          const t = (i / (steps - 1) - 0.5) * 2;
          let sx: number, sy: number;
          if (isSpin) {
            const a = ang0 + t * amt;
            sx = cx + Math.cos(a) * r;
            sy = cy + Math.sin(a) * r;
          } else {
            const s = 1 - t * amt;
            sx = cx + dx * s;
            sy = cy + dy * s;
          }
          sampleBilinear(sd, w, h, sx, sy, tmp);
          acc0 += tmp[0]; acc1 += tmp[1]; acc2 += tmp[2]; acc3 += tmp[3];
        }
        const j = (y * w + x) * 4;
        od[j] = acc0 / steps;
        od[j + 1] = acc1 / steps;
        od[j + 2] = acc2 / steps;
        od[j + 3] = acc3 / steps;
      }
    }
    return out;
  },
};

const surface: FilterDef = {
  id: "surface-blur",
  name: "Surface Blur",
  category: "blur",
  params: [
    { key: "radius", label: "Radius", type: "range", min: 1, max: 12, step: 1, default: 3 },
    { key: "threshold", label: "Threshold", type: "range", min: 1, max: 100, step: 1, default: 20 },
  ],
  apply(src, p) {
    // Edge-preserving blur: only average pixels whose luminance is within threshold.
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const r = p.radius as number;
    const th = p.threshold as number;
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const i0 = (y * w + x) * 4;
        const lum0 = 0.2126 * sd[i0] + 0.7152 * sd[i0 + 1] + 0.0722 * sd[i0 + 2];
        let acc0 = 0, acc1 = 0, acc2 = 0, acc3 = 0, c = 0;
        for (let dy = -r; dy <= r; dy++) {
          const yy = y + dy;
          if (yy < 0 || yy >= h) continue;
          for (let dx = -r; dx <= r; dx++) {
            const xx = x + dx;
            if (xx < 0 || xx >= w) continue;
            const i = (yy * w + xx) * 4;
            const lum = 0.2126 * sd[i] + 0.7152 * sd[i + 1] + 0.0722 * sd[i + 2];
            if (Math.abs(lum - lum0) > th) continue;
            acc0 += sd[i]; acc1 += sd[i + 1]; acc2 += sd[i + 2]; acc3 += sd[i + 3];
            c++;
          }
        }
        const j = i0;
        if (c > 0) { od[j] = acc0 / c; od[j + 1] = acc1 / c; od[j + 2] = acc2 / c; od[j + 3] = acc3 / c; }
        else { od[j] = sd[j]; od[j + 1] = sd[j + 1]; od[j + 2] = sd[j + 2]; od[j + 3] = sd[j + 3]; }
      }
    }
    return out;
  },
};

export const BLURS: FilterDef[] = [gaussian, box, motion, radial, surface];
