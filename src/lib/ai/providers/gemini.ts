// Gemini 2.5 Flash Image — "Nano Banana".
// API docs: https://ai.google.dev/gemini-api/docs/image-generation
// Uses the v1beta REST endpoint; supports text→image and image+text editing.

import { EditOptions, GenerateOptions, ImageOutput, ImageProvider } from "../types";
import { getKey, getModels } from "../settings";

const BASE = "https://generativelanguage.googleapis.com/v1beta";

interface GeminiPart {
  text?: string;
  inlineData?: { mimeType: string; data: string };
}

async function callGemini(model: string, parts: GeminiPart[]): Promise<ImageOutput[]> {
  const key = getKey("gemini");
  if (!key) throw new Error("No Gemini API key. Add one in AI Settings.");
  const url = `${BASE}/models/${model}:generateContent?key=${encodeURIComponent(key)}`;
  const body = {
    contents: [{ role: "user", parts }],
    generationConfig: {
      responseModalities: ["IMAGE"],
    },
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`Gemini ${res.status}: ${text}`);
  }
  const json = await res.json();
  const out: ImageOutput[] = [];
  const candidates = json.candidates || [];
  for (const c of candidates) {
    for (const part of c.content?.parts || []) {
      if (part.inlineData?.data) {
        // Decode to find native dimensions
        const dims = await sniffPngDims(part.inlineData.data);
        out.push({
          base64Png: part.inlineData.data,
          width: dims.w,
          height: dims.h,
        });
      }
    }
  }
  if (out.length === 0) throw new Error("Gemini returned no images.");
  return out;
}

async function sniffPngDims(b64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}

export const Gemini: ImageProvider = {
  id: "gemini",
  name: "Gemini 2.5 Flash Image (Nano Banana)",
  async generate(opts: GenerateOptions) {
    const model = getModels().gemini;
    const parts: GeminiPart[] = [{ text: opts.prompt }];
    if (opts.width && opts.height) {
      parts[0].text += `\n\nTarget resolution: ${opts.width}x${opts.height} pixels.`;
    }
    return callGemini(model, parts);
  },
  async edit(opts: EditOptions) {
    const model = getModels().gemini;
    const parts: GeminiPart[] = [
      { inlineData: { mimeType: "image/png", data: opts.image.base64Png } },
      { text: opts.prompt },
    ];
    return callGemini(model, parts);
  },
};
