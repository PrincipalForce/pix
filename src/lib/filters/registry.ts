import { FilterDef } from "./types";
import { ADJUSTMENTS } from "./adjustments";
import { BLURS } from "./blur";
import { SHARPENS, OTHERS } from "./sharpen";
import { NOISES } from "./noise";
import { DISTORTS } from "./distort";
import { PIXELATES } from "./pixelate";
import { STYLIZES } from "./stylize";
import { RENDERS } from "./render";

const BUILTIN: FilterDef[] = [
  ...ADJUSTMENTS,
  ...BLURS,
  ...SHARPENS,
  ...NOISES,
  ...DISTORTS,
  ...PIXELATES,
  ...STYLIZES,
  ...RENDERS,
  ...OTHERS,
];

const userFilters: Map<string, FilterDef> = new Map();

export function listFilters(): FilterDef[] {
  return [...BUILTIN, ...userFilters.values()];
}

export function getFilter(id: string): FilterDef | undefined {
  return BUILTIN.find((f) => f.id === id) ?? userFilters.get(id);
}

export function registerUserFilter(def: FilterDef): void {
  userFilters.set(def.id, def);
}

export function removeUserFilter(id: string): void {
  userFilters.delete(id);
}

// --- User presets (just saved parameter sets for a built-in filter) ----------

export interface UserPreset {
  id: string;
  name: string;
  filterId: string;
  params: Record<string, any>;
  createdAt: number;
}

const PRESET_KEY = "pix.userPresets.v1";

export function loadPresets(): UserPreset[] {
  try {
    const raw = localStorage.getItem(PRESET_KEY);
    if (!raw) return [];
    return JSON.parse(raw) as UserPreset[];
  } catch {
    return [];
  }
}

export function savePresets(presets: UserPreset[]): void {
  localStorage.setItem(PRESET_KEY, JSON.stringify(presets));
}

export function savePreset(p: Omit<UserPreset, "id" | "createdAt">): UserPreset {
  const presets = loadPresets();
  const entry: UserPreset = { ...p, id: `preset-${Date.now()}`, createdAt: Date.now() };
  presets.push(entry);
  savePresets(presets);
  return entry;
}

export function deletePreset(id: string): void {
  savePresets(loadPresets().filter((p) => p.id !== id));
}

// Export the current preset list as a JSON bundle the user can share.
export function exportPresetBundle(): string {
  return JSON.stringify({ version: 1, presets: loadPresets() }, null, 2);
}

export function importPresetBundle(json: string): number {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.presets)) throw new Error("Invalid bundle");
  const existing = loadPresets();
  const byKey = new Map(existing.map((p) => [p.id, p]));
  for (const p of parsed.presets as UserPreset[]) {
    byKey.set(p.id, p);
  }
  const merged = [...byKey.values()];
  savePresets(merged);
  return parsed.presets.length;
}
