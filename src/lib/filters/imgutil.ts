// Shared image-data utilities used by multiple filters.

export function newLike(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data.length), src.width, src.height);
}

export function copy(src: ImageData): ImageData {
  return new ImageData(new Uint8ClampedArray(src.data), src.width, src.height);
}

export function clamp(x: number, lo = 0, hi = 255): number {
  return x < lo ? lo : x > hi ? hi : x;
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

// Convert hex like #rrggbb to [r, g, b].
export function hex2rgb(hex: string): [number, number, number] {
  let s = hex.replace("#", "");
  if (s.length === 3) s = s.split("").map((c) => c + c).join("");
  return [parseInt(s.slice(0, 2), 16), parseInt(s.slice(2, 4), 16), parseInt(s.slice(4, 6), 16)];
}

// 1-D Gaussian kernel for given sigma. Returns normalized array.
export function gaussianKernel(sigma: number): number[] {
  const r = Math.max(1, Math.ceil(sigma * 3));
  const size = r * 2 + 1;
  const out = new Array(size);
  const s2 = 2 * sigma * sigma;
  let sum = 0;
  for (let i = -r; i <= r; i++) {
    const v = Math.exp(-(i * i) / s2);
    out[i + r] = v;
    sum += v;
  }
  for (let i = 0; i < size; i++) out[i] /= sum;
  return out;
}

// Separable 1-D horizontal convolution. Reflects at borders.
export function convolveH(src: ImageData, kernel: number[]): ImageData {
  const w = src.width;
  const h = src.height;
  const out = newLike(src);
  const d = src.data;
  const o = out.data;
  const r = (kernel.length - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let k = -r; k <= r; k++) {
        let sx = x + k;
        if (sx < 0) sx = -sx;
        else if (sx >= w) sx = 2 * w - sx - 2;
        const i = (y * w + sx) * 4;
        const wk = kernel[k + r];
        cr += d[i] * wk;
        cg += d[i + 1] * wk;
        cb += d[i + 2] * wk;
        ca += d[i + 3] * wk;
      }
      const j = (y * w + x) * 4;
      o[j] = cr;
      o[j + 1] = cg;
      o[j + 2] = cb;
      o[j + 3] = ca;
    }
  }
  return out;
}

// Separable 1-D vertical convolution.
export function convolveV(src: ImageData, kernel: number[]): ImageData {
  const w = src.width;
  const h = src.height;
  const out = newLike(src);
  const d = src.data;
  const o = out.data;
  const r = (kernel.length - 1) >> 1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let cr = 0, cg = 0, cb = 0, ca = 0;
      for (let k = -r; k <= r; k++) {
        let sy = y + k;
        if (sy < 0) sy = -sy;
        else if (sy >= h) sy = 2 * h - sy - 2;
        const i = (sy * w + x) * 4;
        const wk = kernel[k + r];
        cr += d[i] * wk;
        cg += d[i + 1] * wk;
        cb += d[i + 2] * wk;
        ca += d[i + 3] * wk;
      }
      const j = (y * w + x) * 4;
      o[j] = cr;
      o[j + 1] = cg;
      o[j + 2] = cb;
      o[j + 3] = ca;
    }
  }
  return out;
}

// Bilinear sample, clamped to edge.
export function sampleBilinear(d: Uint8ClampedArray, w: number, h: number, fx: number, fy: number, out: number[]): void {
  const x = Math.max(0, Math.min(w - 1, fx));
  const y = Math.max(0, Math.min(h - 1, fy));
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const x1 = Math.min(w - 1, x0 + 1);
  const y1 = Math.min(h - 1, y0 + 1);
  const tx = x - x0;
  const ty = y - y0;
  const i00 = (y0 * w + x0) * 4;
  const i10 = (y0 * w + x1) * 4;
  const i01 = (y1 * w + x0) * 4;
  const i11 = (y1 * w + x1) * 4;
  for (let c = 0; c < 4; c++) {
    const a = d[i00 + c] * (1 - tx) + d[i10 + c] * tx;
    const b = d[i01 + c] * (1 - tx) + d[i11 + c] * tx;
    out[c] = a * (1 - ty) + b * ty;
  }
}

// RGB → HSL (all 0..1)
export function rgbToHsl(r: number, g: number, b: number): [number, number, number] {
  r /= 255; g /= 255; b /= 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const l = (max + min) / 2;
  let h = 0, s = 0;
  if (max !== min) {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r: h = (g - b) / d + (g < b ? 6 : 0); break;
      case g: h = (b - r) / d + 2; break;
      default: h = (r - g) / d + 4;
    }
    h /= 6;
  }
  return [h, s, l];
}

export function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  if (s === 0) {
    const v = l * 255;
    return [v, v, v];
  }
  const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
  const p = 2 * l - q;
  const f = (t: number) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };
  return [f(h + 1 / 3) * 255, f(h) * 255, f(h - 1 / 3) * 255];
}

export function luminance(r: number, g: number, b: number): number {
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}
