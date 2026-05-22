// Importers for third-party filter formats.
// - .cube  — 3D color lookup table (de-facto Photoshop "Look" exchange format)
// - .acv   — Photoshop curves preset
// All importers turn the foreign format into a FilterDef registered as a user filter.

import { FilterDef } from "./types";
import { clamp, copy, sampleBilinear } from "./imgutil";
import { curveLut } from "./adjustments";
import { registerUserFilter, savePreset } from "./registry";

// --- .cube (3D LUT) ---------------------------------------------------------

interface CubeLut {
  size: number; // grid size (LUT_3D_SIZE)
  domainMin: [number, number, number];
  domainMax: [number, number, number];
  // Flat RGB triplets in row-major B → G → R order (LUT convention).
  // Indexed by (r + g*size + b*size*size) * 3
  table: Float32Array;
}

export function parseCube(text: string): CubeLut {
  const lines = text.split(/\r?\n/);
  let size = 0;
  let domainMin: [number, number, number] = [0, 0, 0];
  let domainMax: [number, number, number] = [1, 1, 1];
  const entries: number[] = [];
  for (const raw of lines) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const upper = line.toUpperCase();
    if (upper.startsWith("TITLE")) continue;
    if (upper.startsWith("LUT_3D_SIZE")) {
      size = parseInt(line.split(/\s+/)[1], 10);
      continue;
    }
    if (upper.startsWith("LUT_1D_SIZE")) {
      // Treat 1D as 3D of size N where every line has same r=g=b.
      throw new Error("1D .cube LUTs not yet supported");
    }
    if (upper.startsWith("DOMAIN_MIN")) {
      const [, a, b, c] = line.split(/\s+/);
      domainMin = [parseFloat(a), parseFloat(b), parseFloat(c)];
      continue;
    }
    if (upper.startsWith("DOMAIN_MAX")) {
      const [, a, b, c] = line.split(/\s+/);
      domainMax = [parseFloat(a), parseFloat(b), parseFloat(c)];
      continue;
    }
    const nums = line.split(/\s+/).map(parseFloat);
    if (nums.length >= 3 && nums.every((n) => !Number.isNaN(n))) {
      entries.push(nums[0], nums[1], nums[2]);
    }
  }
  if (size === 0 || entries.length !== size * size * size * 3) {
    throw new Error(`Malformed .cube LUT (got ${entries.length / 3} entries, expected ${size ** 3})`);
  }
  return { size, domainMin, domainMax, table: Float32Array.from(entries) };
}

// Trilinear sample of LUT for input rgb in [0,1].
function lutSample(lut: CubeLut, r: number, g: number, b: number): [number, number, number] {
  const s = lut.size - 1;
  const rx = clamp(r) * s;
  const gx = clamp(g) * s;
  const bx = clamp(b) * s;
  const r0 = Math.floor(rx), r1 = Math.min(s, r0 + 1);
  const g0 = Math.floor(gx), g1 = Math.min(s, g0 + 1);
  const b0 = Math.floor(bx), b1 = Math.min(s, b0 + 1);
  const tr = rx - r0, tg = gx - g0, tb = bx - b0;

  function at(R: number, G: number, B: number): [number, number, number] {
    const i = (R + G * lut.size + B * lut.size * lut.size) * 3;
    return [lut.table[i], lut.table[i + 1], lut.table[i + 2]];
  }
  const c000 = at(r0, g0, b0);
  const c100 = at(r1, g0, b0);
  const c010 = at(r0, g1, b0);
  const c110 = at(r1, g1, b0);
  const c001 = at(r0, g0, b1);
  const c101 = at(r1, g0, b1);
  const c011 = at(r0, g1, b1);
  const c111 = at(r1, g1, b1);
  const out: [number, number, number] = [0, 0, 0];
  for (let c = 0; c < 3; c++) {
    const c00 = c000[c] * (1 - tr) + c100[c] * tr;
    const c01 = c001[c] * (1 - tr) + c101[c] * tr;
    const c10 = c010[c] * (1 - tr) + c110[c] * tr;
    const c11 = c011[c] * (1 - tr) + c111[c] * tr;
    const c0 = c00 * (1 - tg) + c10 * tg;
    const c1 = c01 * (1 - tg) + c11 * tg;
    out[c] = c0 * (1 - tb) + c1 * tb;
  }
  return out;
}

function lutToFilter(lut: CubeLut, name: string, id: string): FilterDef {
  return {
    id,
    name,
    category: "adjust",
    params: [{ key: "strength", label: "Strength (%)", type: "range", min: 0, max: 100, step: 1, default: 100 }],
    apply(src, p) {
      const out = copy(src);
      const d = out.data;
      const k = (p.strength as number) / 100;
      for (let i = 0; i < d.length; i += 4) {
        const r = d[i] / 255, g = d[i + 1] / 255, b = d[i + 2] / 255;
        const [nr, ng, nb] = lutSample(lut, r, g, b);
        d[i] = clamp((d[i] * (1 - k)) + nr * 255 * k);
        d[i + 1] = clamp((d[i + 1] * (1 - k)) + ng * 255 * k);
        d[i + 2] = clamp((d[i + 2] * (1 - k)) + nb * 255 * k);
      }
      return out;
    },
  };
}

export function importCubeLut(text: string, name: string): FilterDef {
  const lut = parseCube(text);
  const id = `lut-${name.toLowerCase().replace(/[^a-z0-9]/g, "-")}-${Date.now()}`;
  const def = lutToFilter(lut, name, id);
  registerUserFilter(def);
  return def;
}

// --- .acv (Photoshop Curves preset) -----------------------------------------
// Format (big-endian):
//   2 bytes: version (usually 4)
//   2 bytes: number of curves N (typically 5: composite, R, G, B, A)
//   For each curve:
//     2 bytes: number of points P (max 19)
//     For each point: 2 bytes Y, then 2 bytes X (0..255)
// We use only the composite curve (index 0) as a single curve.

export function parseAcv(buf: ArrayBuffer): number[] {
  const dv = new DataView(buf);
  let off = 0;
  const version = dv.getUint16(off); off += 2;
  if (version !== 1 && version !== 4) {
    // Some apps emit version 1; we still proceed if the rest looks sane.
  }
  const nCurves = dv.getUint16(off); off += 2;
  if (nCurves < 1) throw new Error("No curves in .acv");
  const nPoints = dv.getUint16(off); off += 2;
  const pts: number[] = [];
  for (let i = 0; i < nPoints; i++) {
    const y = dv.getUint16(off); off += 2;
    const x = dv.getUint16(off); off += 2;
    pts.push(x, y);
  }
  if (pts.length === 0) throw new Error("Curves preset has no points");
  return pts;
}

export function importAcv(buf: ArrayBuffer, name: string): { id: string; presetId: string } {
  const points = parseAcv(buf);
  // Save as a preset of the built-in "curves" filter so the user sees it in the gallery.
  const preset = savePreset({ name, filterId: "curves", params: { points } });
  return { id: "curves", presetId: preset.id };
}

// Convenience: turn raw curve points into a LUT (re-exported for callers).
export { curveLut };
