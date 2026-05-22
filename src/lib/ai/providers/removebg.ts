// Background removal via remove.bg API.
// Free API key from https://www.remove.bg/api

import { ImageOutput, ImageProvider, RemoveBgOptions } from "../types";
import { getKey } from "../settings";

export const RemoveBg: ImageProvider = {
  id: "removebg",
  name: "remove.bg",
  async removeBackground(opts: RemoveBgOptions): Promise<ImageOutput> {
    const key = getKey("removebg");
    if (!key) throw new Error("No remove.bg API key. Add one in AI Settings.");
    const fd = new FormData();
    const blob = await b64ToBlob(opts.image.base64Png);
    fd.append("image_file", blob, "image.png");
    fd.append("size", "auto");
    fd.append("format", "png");
    const res = await fetch("https://api.remove.bg/v1.0/removebg", {
      method: "POST",
      headers: { "X-Api-Key": key },
      body: fd,
    });
    if (!res.ok) {
      const text = await res.text();
      throw new Error(`remove.bg ${res.status}: ${text}`);
    }
    const ab = await res.arrayBuffer();
    const b64 = abToBase64(ab);
    const dims = await sniffPngDims(b64);
    return { base64Png: b64, width: dims.w, height: dims.h };
  },
};

async function b64ToBlob(b64: string): Promise<Blob> {
  const bin = atob(b64);
  const u8 = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) u8[i] = bin.charCodeAt(i);
  return new Blob([u8], { type: "image/png" });
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
