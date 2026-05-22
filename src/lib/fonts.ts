// Font registry: built-in (system) + Google web fonts (lazy-loaded) + custom user uploads
// persisted in IndexedDB so they survive reloads.

export interface FontEntry {
  family: string;
  source: "system" | "google" | "custom";
  weights?: number[];
  // For custom: the binary blob stored in IndexedDB.
  // (Loaded into a FontFace at startup.)
  bytes?: ArrayBuffer;
}

const SYSTEM_FONTS: FontEntry[] = [
  { family: "Inter", source: "google", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Arial", source: "system" },
  { family: "Helvetica", source: "system" },
  { family: "Times New Roman", source: "system" },
  { family: "Georgia", source: "system" },
  { family: "Courier New", source: "system" },
  { family: "Verdana", source: "system" },
  { family: "Tahoma", source: "system" },
  { family: "Trebuchet MS", source: "system" },
  { family: "Impact", source: "system" },
  { family: "Comic Sans MS", source: "system" },
];

// Curated Google Fonts — loaded on demand from Google's CSS endpoint.
const GOOGLE_FONTS: FontEntry[] = [
  { family: "Roboto", source: "google", weights: [300, 400, 500, 700, 900] },
  { family: "Open Sans", source: "google", weights: [300, 400, 600, 700, 800] },
  { family: "Lato", source: "google", weights: [300, 400, 700, 900] },
  { family: "Montserrat", source: "google", weights: [300, 400, 500, 600, 700, 800, 900] },
  { family: "Poppins", source: "google", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Playfair Display", source: "google", weights: [400, 500, 600, 700, 800, 900] },
  { family: "Merriweather", source: "google", weights: [300, 400, 700, 900] },
  { family: "Oswald", source: "google", weights: [300, 400, 500, 600, 700] },
  { family: "Raleway", source: "google", weights: [300, 400, 500, 600, 700, 800] },
  { family: "Bebas Neue", source: "google", weights: [400] },
  { family: "Anton", source: "google", weights: [400] },
  { family: "Pacifico", source: "google", weights: [400] },
  { family: "Lobster", source: "google", weights: [400] },
  { family: "Caveat", source: "google", weights: [400, 500, 600, 700] },
  { family: "Dancing Script", source: "google", weights: [400, 500, 600, 700] },
  { family: "Permanent Marker", source: "google", weights: [400] },
  { family: "Press Start 2P", source: "google", weights: [400] },
  { family: "Fira Code", source: "google", weights: [300, 400, 500, 600, 700] },
  { family: "JetBrains Mono", source: "google", weights: [400, 500, 600, 700] },
  { family: "Source Code Pro", source: "google", weights: [300, 400, 500, 600, 700, 900] },
];

const customFonts = new Map<string, FontEntry>();
const googleLoaded = new Set<string>();

export function listFonts(): FontEntry[] {
  return [...SYSTEM_FONTS, ...GOOGLE_FONTS, ...customFonts.values()];
}

// Ensure the given family is available. For Google fonts, inject a stylesheet link
// (first call only). For custom fonts, the FontFace is already loaded on import.
export function ensureFontLoaded(family: string): void {
  const def = listFonts().find((f) => f.family === family);
  if (!def) return;
  if (def.source !== "google") return;
  if (googleLoaded.has(family)) return;
  googleLoaded.add(family);
  const link = document.createElement("link");
  link.rel = "stylesheet";
  const weights = def.weights?.join(";") ?? "400";
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(family).replace(/%20/g, "+")}:wght@${weights}&display=swap`;
  document.head.appendChild(link);
}

// --- Custom font import + IndexedDB persistence ---------------------------

const DB_NAME = "pix-fonts-v1";
const STORE = "fonts";

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE, { keyPath: "family" });
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function dbPut(family: string, bytes: ArrayBuffer): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).put({ family, bytes });
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function dbAll(): Promise<Array<{ family: string; bytes: ArrayBuffer }>> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readonly");
    const req = tx.objectStore(STORE).getAll();
    req.onsuccess = () => resolve(req.result as any);
    req.onerror = () => reject(req.error);
  });
}

async function dbDelete(family: string): Promise<void> {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE, "readwrite");
    tx.objectStore(STORE).delete(family);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

// Register a FontFace from raw bytes (TTF/OTF/WOFF/WOFF2).
async function loadFontFace(family: string, bytes: ArrayBuffer): Promise<void> {
  const face = new FontFace(family, bytes);
  await face.load();
  (document.fonts as any).add(face);
}

// Restore any custom fonts saved in IndexedDB. Call at app startup.
export async function rehydrateCustomFonts(): Promise<void> {
  try {
    const rows = await dbAll();
    for (const row of rows) {
      try {
        await loadFontFace(row.family, row.bytes);
        customFonts.set(row.family, { family: row.family, source: "custom", bytes: row.bytes });
      } catch (e) {
        console.warn("Failed to rehydrate font", row.family, e);
      }
    }
  } catch (e) {
    console.warn("Font rehydration failed", e);
  }
}

// Import a custom font file. Returns the family name registered.
export async function importFontFile(file: File): Promise<string> {
  const buf = await file.arrayBuffer();
  // Derive a family from the file name; user can override.
  const family = file.name.replace(/\.(ttf|otf|woff|woff2)$/i, "").replace(/[_-]+/g, " ").trim() || file.name;
  await loadFontFace(family, buf);
  customFonts.set(family, { family, source: "custom", bytes: buf });
  try {
    await dbPut(family, buf);
  } catch (e) {
    console.warn("Could not persist font; it will be lost on reload.", e);
  }
  return family;
}

export async function removeCustomFont(family: string): Promise<void> {
  customFonts.delete(family);
  await dbDelete(family);
}
