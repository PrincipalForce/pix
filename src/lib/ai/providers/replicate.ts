// Replicate provider — used for Flux, SDXL, Real-ESRGAN, etc. Browser CORS isn't
// universally allowed; some models work, others need a proxy. We surface a clear
// error when the platform blocks the request.

import { EditOptions, GenerateOptions, ImageOutput, ImageProvider, RemoveBgOptions } from "../types";
import { getKey } from "../settings";

const FLUX_SCHNELL = "black-forest-labs/flux-schnell";
const RMBG = "851-labs/background-remover";
const UPSCALE = "nightmareai/real-esrgan";

interface ReplicatePredictionResponse {
  id: string;
  status: "starting" | "processing" | "succeeded" | "failed" | "canceled";
  output: string | string[] | null;
  error?: string;
  urls?: { get: string };
}

async function runPrediction(
  model: string,
  input: Record<string, unknown>
): Promise<string[]> {
  const key = getKey("replicate");
  if (!key) throw new Error("No Replicate API key. Add one in AI Settings.");
  const start = await fetch(`https://api.replicate.com/v1/models/${model}/predictions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${key}`,
      Prefer: "wait=60",
    },
    body: JSON.stringify({ input }),
  });
  if (!start.ok) {
    const text = await start.text();
    throw new Error(`Replicate ${start.status}: ${text}`);
  }
  let pred = (await start.json()) as ReplicatePredictionResponse;
  // Poll if not finished
  while (pred.status === "starting" || pred.status === "processing") {
    await new Promise((r) => setTimeout(r, 1500));
    const r = await fetch(pred.urls!.get, {
      headers: { Authorization: `Bearer ${key}` },
    });
    pred = (await r.json()) as ReplicatePredictionResponse;
  }
  if (pred.status !== "succeeded") {
    throw new Error(`Replicate prediction ${pred.status}: ${pred.error ?? "unknown error"}`);
  }
  const out = pred.output;
  if (!out) throw new Error("Replicate returned no output");
  return Array.isArray(out) ? out : [out];
}

async function urlToImageOutput(url: string): Promise<ImageOutput> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to download ${url}: ${res.status}`);
  const ab = await res.arrayBuffer();
  const b64 = abToBase64(ab);
  const dims = await sniffPngDims(b64);
  return { base64Png: b64, width: dims.w, height: dims.h };
}

export const Replicate: ImageProvider = {
  id: "replicate",
  name: "Replicate (Flux, ESRGAN, …)",
  async generate(opts: GenerateOptions) {
    const urls = await runPrediction(FLUX_SCHNELL, {
      prompt: opts.prompt,
      num_outputs: opts.count ?? 1,
      aspect_ratio: aspectFromWH(opts.width, opts.height),
      output_format: "png",
    });
    return Promise.all(urls.map(urlToImageOutput));
  },
  async removeBackground(opts: RemoveBgOptions) {
    const urls = await runPrediction(RMBG, {
      image: `data:image/png;base64,${opts.image.base64Png}`,
    });
    return urlToImageOutput(urls[0]);
  },
  async upscale(opts) {
    const urls = await runPrediction(UPSCALE, {
      image: `data:image/png;base64,${opts.image.base64Png}`,
      scale: opts.scale ?? 2,
    });
    return urlToImageOutput(urls[0]);
  },
};

function aspectFromWH(w?: number, h?: number): string {
  if (!w || !h) return "1:1";
  const r = w / h;
  if (Math.abs(r - 1) < 0.1) return "1:1";
  if (r > 1.6) return "16:9";
  if (r > 1.2) return "4:3";
  if (r < 0.6) return "9:16";
  return "3:4";
}

function abToBase64(ab: ArrayBuffer): string {
  let binary = "";
  const bytes = new Uint8Array(ab);
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    binary += String.fromCharCode.apply(null, Array.from(bytes.subarray(i, i + chunk)));
  }
  return btoa(binary);
}

async function sniffPngDims(b64: string): Promise<{ w: number; h: number }> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}
