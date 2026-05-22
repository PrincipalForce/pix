// User-provided API keys live in localStorage. They never leave the browser
// except in the direct API call to the matching provider. Never logged.

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
  return read()[p] || "";
}

export function setKey(p: ProviderId, value: string): void {
  const bag = read();
  if (value.trim()) bag[p] = value.trim();
  else delete bag[p];
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
