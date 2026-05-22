import { PixAction } from "./types";

const KEY = "pix.actions.v1";

export function loadActions(): PixAction[] {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return [];
    return JSON.parse(raw) as PixAction[];
  } catch {
    return [];
  }
}

export function saveActions(actions: PixAction[]): void {
  localStorage.setItem(KEY, JSON.stringify(actions));
}

export function upsertAction(action: PixAction): void {
  const all = loadActions();
  const idx = all.findIndex((a) => a.id === action.id);
  if (idx >= 0) all[idx] = action;
  else all.push(action);
  saveActions(all);
}

export function deleteAction(id: string): void {
  saveActions(loadActions().filter((a) => a.id !== id));
}

export function exportActionsBundle(): string {
  return JSON.stringify({ version: 1, actions: loadActions() }, null, 2);
}

export function importActionsBundle(json: string): number {
  const parsed = JSON.parse(json);
  if (!parsed || !Array.isArray(parsed.actions)) throw new Error("Invalid action bundle");
  const existing = loadActions();
  const byId = new Map(existing.map((a) => [a.id, a]));
  for (const a of parsed.actions as PixAction[]) byId.set(a.id, a);
  saveActions([...byId.values()]);
  return parsed.actions.length;
}
