import { FilterDef } from "./types";
import { clamp, copy, hex2rgb, hslToRgb, luminance, newLike, rgbToHsl } from "./imgutil";

const brightnessContrast: FilterDef = {
  id: "brightness-contrast",
  name: "Brightness / Contrast",
  category: "adjust",
  params: [
    { key: "brightness", label: "Brightness", type: "range", min: -150, max: 150, step: 1, default: 0 },
    { key: "contrast", label: "Contrast", type: "range", min: -100, max: 100, step: 1, default: 0 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const b = p.brightness as number;
    const c = (p.contrast as number) / 100;
    const f = (1 + c) / (1 - c);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(f * (d[i] - 128) + 128 + b);
      d[i + 1] = clamp(f * (d[i + 1] - 128) + 128 + b);
      d[i + 2] = clamp(f * (d[i + 2] - 128) + 128 + b);
    }
    return out;
  },
};

const levels: FilterDef = {
  id: "levels",
  name: "Levels",
  category: "adjust",
  params: [
    { key: "inBlack", label: "Input Black", type: "range", min: 0, max: 255, step: 1, default: 0 },
    { key: "inWhite", label: "Input White", type: "range", min: 0, max: 255, step: 1, default: 255 },
    { key: "gamma", label: "Gamma", type: "range", min: 0.1, max: 9.99, step: 0.01, default: 1.0 },
    { key: "outBlack", label: "Output Black", type: "range", min: 0, max: 255, step: 1, default: 0 },
    { key: "outWhite", label: "Output White", type: "range", min: 0, max: 255, step: 1, default: 255 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const ib = p.inBlack as number;
    const iw = Math.max(ib + 1, p.inWhite as number);
    const ob = p.outBlack as number;
    const ow = p.outWhite as number;
    const invG = 1 / Math.max(0.0001, p.gamma as number);
    const lut = new Uint8ClampedArray(256);
    for (let v = 0; v < 256; v++) {
      let n = (v - ib) / (iw - ib);
      n = Math.max(0, Math.min(1, n));
      n = Math.pow(n, invG);
      lut[v] = clamp(ob + n * (ow - ob));
    }
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    return out;
  },
};

// Curves: a "curve" param holds an array of [x, y] points 0..255. Interpolated linearly.
const curves: FilterDef = {
  id: "curves",
  name: "Curves",
  category: "adjust",
  params: [
    { key: "points", label: "Curve", type: "curve", default: [0, 0, 255, 255] },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const lut = curveLut(p.points as number[]);
    for (let i = 0; i < d.length; i += 4) {
      d[i] = lut[d[i]];
      d[i + 1] = lut[d[i + 1]];
      d[i + 2] = lut[d[i + 2]];
    }
    return out;
  },
};

export function curveLut(points: number[]): Uint8ClampedArray {
  // Sort by x, ensure endpoints
  const pts: Array<[number, number]> = [];
  for (let i = 0; i < points.length; i += 2) pts.push([points[i], points[i + 1]]);
  pts.sort((a, b) => a[0] - b[0]);
  if (pts.length === 0 || pts[0][0] > 0) pts.unshift([0, 0]);
  if (pts[pts.length - 1][0] < 255) pts.push([255, 255]);
  const lut = new Uint8ClampedArray(256);
  let j = 0;
  for (let x = 0; x < 256; x++) {
    while (j < pts.length - 2 && x > pts[j + 1][0]) j++;
    const [x0, y0] = pts[j];
    const [x1, y1] = pts[j + 1];
    const t = x1 === x0 ? 0 : (x - x0) / (x1 - x0);
    lut[x] = clamp(y0 + t * (y1 - y0));
  }
  return lut;
}

const hueSaturation: FilterDef = {
  id: "hue-saturation",
  name: "Hue / Saturation",
  category: "adjust",
  params: [
    { key: "hue", label: "Hue", type: "range", min: -180, max: 180, step: 1, default: 0 },
    { key: "saturation", label: "Saturation", type: "range", min: -100, max: 100, step: 1, default: 0 },
    { key: "lightness", label: "Lightness", type: "range", min: -100, max: 100, step: 1, default: 0 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const dh = ((p.hue as number) % 360) / 360;
    const ds = (p.saturation as number) / 100;
    const dl = (p.lightness as number) / 100;
    for (let i = 0; i < d.length; i += 4) {
      const [h, s, l] = rgbToHsl(d[i], d[i + 1], d[i + 2]);
      let nh = h + dh; if (nh < 0) nh += 1; if (nh > 1) nh -= 1;
      const ns = Math.max(0, Math.min(1, s + ds * (ds > 0 ? 1 - s : s)));
      const nl = Math.max(0, Math.min(1, l + dl));
      const [r2, g2, b2] = hslToRgb(nh, ns, nl);
      d[i] = r2; d[i + 1] = g2; d[i + 2] = b2;
    }
    return out;
  },
};

const colorBalance: FilterDef = {
  id: "color-balance",
  name: "Color Balance",
  category: "adjust",
  params: [
    { key: "cyanRed", label: "Cyan ↔ Red", type: "range", min: -100, max: 100, step: 1, default: 0 },
    { key: "magentaGreen", label: "Magenta ↔ Green", type: "range", min: -100, max: 100, step: 1, default: 0 },
    { key: "yellowBlue", label: "Yellow ↔ Blue", type: "range", min: -100, max: 100, step: 1, default: 0 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const dr = (p.cyanRed as number) * 1.275;
    const dg = (p.magentaGreen as number) * 1.275;
    const db = (p.yellowBlue as number) * 1.275;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = clamp(d[i] + dr);
      d[i + 1] = clamp(d[i + 1] + dg);
      d[i + 2] = clamp(d[i + 2] + db);
    }
    return out;
  },
};

const exposure: FilterDef = {
  id: "exposure",
  name: "Exposure",
  category: "adjust",
  params: [
    { key: "exposure", label: "Exposure (EV)", type: "range", min: -5, max: 5, step: 0.05, default: 0 },
    { key: "offset", label: "Offset", type: "range", min: -0.5, max: 0.5, step: 0.005, default: 0 },
    { key: "gamma", label: "Gamma", type: "range", min: 0.1, max: 9.99, step: 0.01, default: 1.0 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const m = Math.pow(2, p.exposure as number);
    const off = (p.offset as number) * 255;
    const invG = 1 / Math.max(0.0001, p.gamma as number);
    for (let i = 0; i < d.length; i += 4) {
      for (let c = 0; c < 3; c++) {
        let v = d[i + c] * m + off;
        v = 255 * Math.pow(Math.max(0, v / 255), invG);
        d[i + c] = clamp(v);
      }
    }
    return out;
  },
};

const blackAndWhite: FilterDef = {
  id: "black-white",
  name: "Black & White",
  category: "adjust",
  params: [
    { key: "red", label: "Reds", type: "range", min: -200, max: 300, step: 1, default: 40 },
    { key: "yellow", label: "Yellows", type: "range", min: -200, max: 300, step: 1, default: 60 },
    { key: "green", label: "Greens", type: "range", min: -200, max: 300, step: 1, default: 40 },
    { key: "cyan", label: "Cyans", type: "range", min: -200, max: 300, step: 1, default: 60 },
    { key: "blue", label: "Blues", type: "range", min: -200, max: 300, step: 1, default: 20 },
    { key: "magenta", label: "Magentas", type: "range", min: -200, max: 300, step: 1, default: 80 },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const wR = (p.red as number) / 100;
    const wY = (p.yellow as number) / 100;
    const wG = (p.green as number) / 100;
    const wC = (p.cyan as number) / 100;
    const wB = (p.blue as number) / 100;
    const wM = (p.magenta as number) / 100;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      // Six color region weights
      const mn = Math.min(r, g, b);
      const mx = Math.max(r, g, b);
      // gray = sum of (max - min) * weight for hue regions, plus base luminance
      const gray = 0.3 * r + 0.59 * g + 0.11 * b;
      // Hue masks
      const cr = Math.max(0, r - Math.max(g, b)); // red
      const cy = Math.max(0, Math.min(r, g) - b);  // yellow
      const cg = Math.max(0, g - Math.max(r, b));
      const cc = Math.max(0, Math.min(g, b) - r);
      const cb = Math.max(0, b - Math.max(r, g));
      const cm = Math.max(0, Math.min(r, b) - g);
      const v =
        gray +
        cr * (wR - 1) +
        cy * (wY - 1) +
        cg * (wG - 1) +
        cc * (wC - 1) +
        cb * (wB - 1) +
        cm * (wM - 1);
      const out8 = clamp(v);
      d[i] = out8; d[i + 1] = out8; d[i + 2] = out8;
    }
    return out;
  },
};

const photoFilter: FilterDef = {
  id: "photo-filter",
  name: "Photo Filter",
  category: "adjust",
  params: [
    { key: "color", label: "Color", type: "color", default: "#ec8b00" },
    { key: "density", label: "Density", type: "range", min: 0, max: 100, step: 1, default: 25 },
    { key: "preserveLum", label: "Preserve Luminosity", type: "boolean", default: true },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const [tr, tg, tb] = hex2rgb(p.color as string);
    const k = (p.density as number) / 100;
    const preserve = p.preserveLum as boolean;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      let nr = r * (1 - k) + ((r * tr) / 255) * k;
      let ng = g * (1 - k) + ((g * tg) / 255) * k;
      let nb = b * (1 - k) + ((b * tb) / 255) * k;
      if (preserve) {
        const l0 = luminance(r, g, b);
        const l1 = luminance(nr, ng, nb) || 1;
        const m = l0 / l1;
        nr *= m; ng *= m; nb *= m;
      }
      d[i] = clamp(nr); d[i + 1] = clamp(ng); d[i + 2] = clamp(nb);
    }
    return out;
  },
};

const invert: FilterDef = {
  id: "invert",
  name: "Invert",
  category: "adjust",
  params: [],
  apply(src) {
    const out = copy(src);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = 255 - d[i]; d[i + 1] = 255 - d[i + 1]; d[i + 2] = 255 - d[i + 2];
    }
    return out;
  },
};

const posterize: FilterDef = {
  id: "posterize",
  name: "Posterize",
  category: "adjust",
  params: [{ key: "levels", label: "Levels", type: "range", min: 2, max: 32, step: 1, default: 6 }],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const n = p.levels as number;
    const step = 255 / (n - 1);
    const inv = (n - 1) / 255;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = Math.round(d[i] * inv) * step;
      d[i + 1] = Math.round(d[i + 1] * inv) * step;
      d[i + 2] = Math.round(d[i + 2] * inv) * step;
    }
    return out;
  },
};

const threshold: FilterDef = {
  id: "threshold",
  name: "Threshold",
  category: "adjust",
  params: [{ key: "level", label: "Level", type: "range", min: 0, max: 255, step: 1, default: 128 }],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const t = p.level as number;
    for (let i = 0; i < d.length; i += 4) {
      const l = luminance(d[i], d[i + 1], d[i + 2]);
      const v = l >= t ? 255 : 0;
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    return out;
  },
};

const grayscale: FilterDef = {
  id: "grayscale",
  name: "Desaturate",
  category: "adjust",
  params: [],
  apply(src) {
    const out = copy(src);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      const v = luminance(d[i], d[i + 1], d[i + 2]);
      d[i] = v; d[i + 1] = v; d[i + 2] = v;
    }
    return out;
  },
};

const vibrance: FilterDef = {
  id: "vibrance",
  name: "Vibrance",
  category: "adjust",
  params: [{ key: "vibrance", label: "Vibrance", type: "range", min: -100, max: 100, step: 1, default: 0 }],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const v = (p.vibrance as number) / 100;
    for (let i = 0; i < d.length; i += 4) {
      const r = d[i], g = d[i + 1], b = d[i + 2];
      const max = Math.max(r, g, b);
      const avg = (r + g + b) / 3;
      const amt = ((Math.abs(max - avg) * 2) / 255) * -v;
      d[i] = clamp(r + (max - r) * amt);
      d[i + 1] = clamp(g + (max - g) * amt);
      d[i + 2] = clamp(b + (max - b) * amt);
    }
    return out;
  },
};

const gradientMap: FilterDef = {
  id: "gradient-map",
  name: "Gradient Map",
  category: "adjust",
  params: [
    { key: "from", label: "Shadow", type: "color", default: "#000000" },
    { key: "to", label: "Highlight", type: "color", default: "#ffffff" },
  ],
  apply(src, p) {
    const out = copy(src);
    const d = out.data;
    const [r0, g0, b0] = hex2rgb(p.from as string);
    const [r1, g1, b1] = hex2rgb(p.to as string);
    for (let i = 0; i < d.length; i += 4) {
      const t = luminance(d[i], d[i + 1], d[i + 2]) / 255;
      d[i] = clamp(r0 + (r1 - r0) * t);
      d[i + 1] = clamp(g0 + (g1 - g0) * t);
      d[i + 2] = clamp(b0 + (b1 - b0) * t);
    }
    return out;
  },
};

export const ADJUSTMENTS: FilterDef[] = [
  brightnessContrast,
  levels,
  curves,
  exposure,
  hueSaturation,
  vibrance,
  colorBalance,
  photoFilter,
  blackAndWhite,
  grayscale,
  gradientMap,
  posterize,
  threshold,
  invert,
];
