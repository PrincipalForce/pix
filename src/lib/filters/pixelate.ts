import { FilterDef } from "./types";
import { newLike } from "./imgutil";

const mosaic: FilterDef = {
  id: "mosaic",
  name: "Mosaic",
  category: "pixelate",
  params: [{ key: "size", label: "Cell size (px)", type: "range", min: 2, max: 80, step: 1, default: 10 }],
  apply(src, p) {
    const sz = Math.max(2, p.size as number);
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    for (let cy = 0; cy < h; cy += sz) {
      for (let cx = 0; cx < w; cx += sz) {
        let r = 0, g = 0, b = 0, a = 0, c = 0;
        const xe = Math.min(w, cx + sz);
        const ye = Math.min(h, cy + sz);
        for (let y = cy; y < ye; y++) {
          for (let x = cx; x < xe; x++) {
            const i = (y * w + x) * 4;
            r += sd[i]; g += sd[i + 1]; b += sd[i + 2]; a += sd[i + 3];
            c++;
          }
        }
        const ar = r / c, ag = g / c, ab = b / c, aa = a / c;
        for (let y = cy; y < ye; y++) {
          for (let x = cx; x < xe; x++) {
            const i = (y * w + x) * 4;
            od[i] = ar; od[i + 1] = ag; od[i + 2] = ab; od[i + 3] = aa;
          }
        }
      }
    }
    return out;
  },
};

const pointillize: FilterDef = {
  id: "pointillize",
  name: "Pointillize",
  category: "pixelate",
  params: [{ key: "size", label: "Cell size (px)", type: "range", min: 3, max: 40, step: 1, default: 8 }],
  apply(src, p) {
    const sz = Math.max(3, p.size as number);
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    // Fill background white
    for (let i = 0; i < od.length; i += 4) {
      od[i] = 255; od[i + 1] = 255; od[i + 2] = 255; od[i + 3] = sd[i + 3];
    }
    for (let cy = 0; cy < h; cy += sz) {
      for (let cx = 0; cx < w; cx += sz) {
        const dx = (Math.random() - 0.5) * sz * 0.4;
        const dy = (Math.random() - 0.5) * sz * 0.4;
        const x0 = Math.min(w - 1, cx + sz / 2 + dx);
        const y0 = Math.min(h - 1, cy + sz / 2 + dy);
        const ci = (Math.floor(y0) * w + Math.floor(x0)) * 4;
        const cr = sd[ci], cg = sd[ci + 1], cb = sd[ci + 2];
        const radius = sz / 2;
        const x1 = Math.max(0, Math.floor(x0 - radius));
        const x2 = Math.min(w - 1, Math.floor(x0 + radius));
        const y1 = Math.max(0, Math.floor(y0 - radius));
        const y2 = Math.min(h - 1, Math.floor(y0 + radius));
        for (let y = y1; y <= y2; y++) {
          for (let x = x1; x <= x2; x++) {
            const ddx = x - x0, ddy = y - y0;
            if (ddx * ddx + ddy * ddy > radius * radius) continue;
            const i = (y * w + x) * 4;
            od[i] = cr; od[i + 1] = cg; od[i + 2] = cb;
          }
        }
      }
    }
    return out;
  },
};

const crystallize: FilterDef = {
  id: "crystallize",
  name: "Crystallize",
  category: "pixelate",
  params: [{ key: "size", label: "Cell size (px)", type: "range", min: 4, max: 80, step: 1, default: 18 }],
  apply(src, p) {
    // Voronoi-style: per-cell jittered center, paint all pixels in cell with the center's color.
    const sz = Math.max(4, p.size as number);
    const w = src.width, h = src.height;
    const out = newLike(src);
    const sd = src.data, od = out.data;
    const cols = Math.ceil(w / sz) + 1;
    const rows = Math.ceil(h / sz) + 1;
    const cx: number[] = new Array(cols * rows);
    const cy: number[] = new Array(cols * rows);
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cx[r * cols + c] = c * sz + Math.random() * sz;
        cy[r * cols + c] = r * sz + Math.random() * sz;
      }
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        const cc = Math.floor(x / sz), rr = Math.floor(y / sz);
        let bestD = Infinity, bx = 0, by = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const r2 = rr + dr, c2 = cc + dc;
            if (r2 < 0 || c2 < 0 || r2 >= rows || c2 >= cols) continue;
            const px = cx[r2 * cols + c2], py = cy[r2 * cols + c2];
            const dx = px - x, dy = py - y;
            const dd = dx * dx + dy * dy;
            if (dd < bestD) { bestD = dd; bx = px; by = py; }
          }
        }
        const sx = Math.max(0, Math.min(w - 1, Math.floor(bx)));
        const sy = Math.max(0, Math.min(h - 1, Math.floor(by)));
        const si = (sy * w + sx) * 4;
        const i = (y * w + x) * 4;
        od[i] = sd[si]; od[i + 1] = sd[si + 1]; od[i + 2] = sd[si + 2]; od[i + 3] = sd[si + 3];
      }
    }
    return out;
  },
};

export const PIXELATES: FilterDef[] = [mosaic, pointillize, crystallize];
