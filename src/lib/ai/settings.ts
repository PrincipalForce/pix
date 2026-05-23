// User-provided API keys live in localStorage. They never leave the browser
// except in the direct API call to the matching provider. Never logged.
//
// At startup we also read VITE_* env vars baked into the build, which act as a
// fallback when localStorage doesn't have a key for that provider. Env values
// are NOT written into localStorage — that keeps them controlled by the .env
// file (and lets you ship a deployed build with default keys without leaking
// them into individual user profiles).

export type ProviderId =
  | "anthropic"
  | "gemini"
  | "openai"
  | "replicate"
  | "removebg";

const KEY = "pix.ai.keys.v1";

interface Bag {
  [k: string]: string;
}

// Vite exposes env vars prefixed with VITE_*. We accept a few aliases so users
// can name them however they're used to.
const ENV_KEYS: Record<ProviderId, string[]> = {
  anthropic: ["VITE_ANTHROPIC_API_KEY", "VITE_CLAUDE_API_KEY"],
  gemini: ["VITE_GEMINI_API_KEY", "VITE_GOOGLE_API_KEY", "VITE_NANO_BANANA_API_KEY"],
  openai: ["VITE_OPENAI_API_KEY"],
  replicate: ["VITE_REPLICATE_API_KEY", "VITE_REPLICATE_API_TOKEN"],
  removebg: ["VITE_REMOVEBG_API_KEY", "VITE_REMOVE_BG_API_KEY"],
};

function envKey(p: ProviderId): string {
  const env = (import.meta as any).env || {};
  for (const name of ENV_KEYS[p]) {
    const v = env[name];
    if (typeof v === "string" && v.trim()) return v.trim();
  }
  return "";
}

function read(): Bag {
  try {
    return JSON.parse(localStorage.getItem(KEY) || "{}");
  } catch {
    return {};
  }
}

function write(b: Bag): void {
  localStorage.setItem(KEY, JSON.stringify(b));
}

export function getKey(p: ProviderId): string {
  // localStorage wins (per-user override), env is fallback.
  return read()[p] || envKey(p);
}

export type KeySource = "user" | "env" | "none";

export function getKeySource(p: ProviderId): KeySource {
  if (read()[p]) return "user";
  if (envKey(p)) return "env";
  return "none";
}

export function setKey(p: ProviderId, value: string): void {
  const bag = read();
  if (value.trim()) bag[p] = value.trim();
  else delete bag[p];
  write(bag);
}

export function clearUserKey(p: ProviderId): void {
  const bag = read();
  delete bag[p];
  write(bag);
}

export function hasKey(p: ProviderId): boolean {
  return !!getKey(p);
}

// Model selections per provider (so the user can pick "claude-opus-4-7" vs "claude-sonnet-4-6").
const MODEL_KEY = "pix.ai.models.v1";

export interface ModelSettings {
  anthropic: string;
  gemini: string;
  openai: string;
}

const DEFAULT_MODELS: ModelSettings = {
  anthropic: "claude-opus-4-7",
  gemini: "gemini-2.5-flash-image",
  openai: "gpt-image-1",
};

export function getModels(): ModelSettings {
  try {
    const v = JSON.parse(localStorage.getItem(MODEL_KEY) || "{}");
    return { ...DEFAULT_MODELS, ...v };
  } catch {
    return { ...DEFAULT_MODELS };
  }
}

export function setModel<K extends keyof ModelSettings>(k: K, v: string): void {
  const cur = getModels();
  cur[k] = v;
  localStorage.setItem(MODEL_KEY, JSON.stringify(cur));
}
