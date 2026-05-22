import { FilterDef } from "./types";
import { newLike, sampleBilinear } from "./imgutil";

function remap(
  src: ImageData,
  mapper: (x: number, y: number) => [number, number]
): ImageData {
  const w = src.width, h = src.height;
  const out = newLike(src);
  const sd = src.data, od = out.data;
  const tmp = [0, 0, 0, 0];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const [sx, sy] = mapper(x, y);
      sampleBilinear(sd, w, h, sx, sy, tmp);
      const j = (y * w + x) * 4;
      od[j] = tmp[0]; od[j + 1] = tmp[1]; od[j + 2] = tmp[2]; od[j + 3] = tmp[3];
    }
  }
  return out;
}

const pinch: FilterDef = {
  id: "pinch",
  name: "Pinch",
  category: "distort",
  params: [{ key: "amount", label: "Amount", type: "range", min: -100, max: 100, step: 1, default: 50 }],
  apply(src, p) {
    const cx = src.width / 2, cy = src.height / 2;
    const rmax = Math.min(cx, cy);
    const k = (p.amount as number) / 100;
    return remap(src, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy) / rmax;
      if (r >= 1) return [x, y];
      const t = Math.pow(Math.sin((Math.PI / 2) * r), -k + 1);
      return [cx + dx * t / (r || 1), cy + dy * t / (r || 1)];
    });
  },
};

const twirl: FilterDef = {
  id: "twirl",
  name: "Twirl",
  category: "distort",
  params: [{ key: "angle", label: "Angle (°)", type: "angle", min: -540, max: 540, step: 1, default: 90 }],
  apply(src, p) {
    const cx = src.width / 2, cy = src.height / 2;
    const rmax = Math.min(cx, cy);
    const ang = ((p.angle as number) * Math.PI) / 180;
    return remap(src, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= rmax) return [x, y];
      const t = (1 - r / rmax) * ang;
      const c = Math.cos(t), s = Math.sin(t);
      return [cx + dx * c - dy * s, cy + dx * s + dy * c];
    });
  },
};

const spherize: FilterDef = {
  id: "spherize",
  name: "Spherize",
  category: "distort",
  params: [{ key: "amount", label: "Amount", type: "range", min: -100, max: 100, step: 1, default: 60 }],
  apply(src, p) {
    const cx = src.width / 2, cy = src.height / 2;
    const rmax = Math.min(cx, cy);
    const a = (p.amount as number) / 100;
    return remap(src, (x, y) => {
      const dx = x - cx, dy = y - cy;
      const r = Math.sqrt(dx * dx + dy * dy);
      if (r >= rmax) return [x, y];
      const n = r / rmax;
      // map distance through arcsin curve
      const t = a > 0
        ? (Math.asin(n) * 2) / Math.PI
        : Math.sin((n * Math.PI) / 2);
      const m = Math.abs(a);
      const nr = n * (1 - m) + t * m;
      const sc = nr / (n || 1);
      return [cx + dx * sc, cy + dy * sc];
    });
  },
};

const wave: FilterDef = {
  id: "wave",
  name: "Wave",
  category: "distort",
  params: [
    { key: "amplitude", label: "Amplitude (px)", type: "range", min: 0, max: 80, step: 1, default: 10 },
    { key: "wavelength", label: "Wavelength (px)", type: "range", min: 1, max: 200, step: 1, default: 40 },
    {
      key: "axis", label: "Axis", type: "select", default: "horizontal",
      options: [{ label: "Horizontal", value: "horizontal" }, { label: "Vertical", value: "vertical" }, { label: "Both", value: "both" }],
    },
  ],
  apply(src, p) {
    const amp = p.amplitude as number;
    const wl = Math.max(1, p.wavelength as number);
    const axis = p.axis as string;
    return remap(src, (x, y) => {
      let nx = x, ny = y;
      if (axis === "horizontal" || axis === "both") nx = x + Math.sin((y / wl) * Math.PI * 2) * amp;
      if (axis === "vertical" || axis === "both") ny = y + Math.sin((x / wl) * Math.PI * 2) * amp;
      return [nx, ny];
    });
  },
};

export const DISTORTS: FilterDef[] = [pinch, twirl, spherize, wave];
