// OpenAI gpt-image-1 (and DALL-E 3) for generate + edit.
// Uses the REST endpoint at https://api.openai.com/v1/images/* with a user-supplied key.

import { EditOptions, GenerateOptions, ImageOutput, ImageProvider } from "../types";
import { getKey, getModels } from "../settings";

const BASE = "https://api.openai.com/v1";

async function jsonOrThrow(res: Response): Promise<any> {
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OpenAI ${res.status}: ${text}`);
  }
  return res.json();
}

function ensureKey(): string {
  const k = getKey("openai");
  if (!k) throw new Error("No OpenAI API key. Add one in AI Settings.");
  return k;
}

function nearestSquare(w?: number, h?: number): string {
  // gpt-image-1 supports 1024x1024, 1024x1536, 1536x1024, "auto"
  if (!w || !h) return "auto";
  if (Math.abs(w - h) < 64) return "1024x1024";
  if (w > h) return "1536x1024";
  return "1024x1536";
}

export const OpenAI: ImageProvider = {
  id: "openai",
  name: "OpenAI gpt-image-1",
  async generate(opts: GenerateOptions) {
    const key = ensureKey();
    const model = getModels().openai;
    const res = await fetch(`${BASE}/images/generations`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${key}`,
      },
      body: JSON.stringify({
        model,
        prompt: opts.prompt,
        n: opts.count ?? 1,
        size: nearestSquare(opts.width, opts.height),
        response_format: "b64_json",
      }),
    });
    const json = await jsonOrThrow(res);
    return Promise.all(
      (json.data as any[]).map(async (d) => {
        const dims = await sniffPngDims(d.b64_json);
        return { base64Png: d.b64_json, width: dims.w, height: dims.h };
      })
    );
  },
  async edit(opts: EditOptions) {
    const key = ensureKey();
    const model = getModels().openai;
    const fd = new FormData();
    fd.append("model", model);
    fd.append("prompt", opts.prompt);
    fd.append("n", "1");
    fd.append("response_format", "b64_json");
    fd.append("image", await b64ToBlob(opts.image.base64Png), "image.png");
    if (opts.mask) fd.append("mask", await b64ToBlob(opts.mask.base64Png), "mask.png");
    const res = await fetch(`${BASE}/images/edits`, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}` },
      body: fd,
    });
    const json = await jsonOrThrow(res);
    return Promise.all(
      (json.data as any[]).map(async (d) => {
        const dims = await sniffPngDims(d.b64_json);
        return { base64Png: d.b64_json, width: dims.w, height: dims.h };
      })
    );
  },
};

async function b64ToBlob(b64: string): Promise<Blob> {
  const bin = atob(b64);
  const len = bin.length;
  const u8 = new Uint8Array(len);
  for (let i = 0; i < len; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: "image/png" });
}

async function sniffPngDims(b64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}
