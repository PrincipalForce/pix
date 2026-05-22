// Claude tool definitions. Each tool maps to operations on EditorAPI.
//
// JSON Schemas are intentionally narrow — the agent should only need to fill in
// the inputs it cares about. Return values are short strings that summarize the
// effect so the model can decide whether further steps are needed.

import { EditorAPI } from "@/hooks/useEditor";
import { getFilter, listFilters } from "@/lib/filters/registry";
import { fillLayer } from "@/lib/brush";
import { ctx2d, createCanvas } from "@/lib/canvas";
import { compositeDocument } from "@/lib/render";
import { Gemini } from "./providers/gemini";
import { OpenAI } from "./providers/openai";
import { RemoveBg } from "./providers/removebg";
import { Replicate } from "./providers/replicate";
import { ImageOutput } from "./types";
import { createRasterLayer } from "@/lib/document";

export interface Tool {
  name: string;
  description: string;
  input_schema: any;
}

export const TOOLS: Tool[] = [
  {
    name: "list_filters",
    description:
      "Return the list of available filter ids with their categories and parameter specs. Call this when you need to know which filters exist before calling apply_filter.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "apply_filter",
    description:
      "Apply a filter from the registry to the currently selected raster layer. Use list_filters first if unsure of the filter id or its parameters.",
    input_schema: {
      type: "object",
      properties: {
        filter_id: { type: "string", description: "Filter id (e.g. 'gaussian-blur', 'levels')" },
        params: {
          type: "object",
          description: "Parameter values keyed by the filter's param keys. Omit to use defaults.",
          additionalProperties: true,
        },
      },
      required: ["filter_id"],
    },
  },
  {
    name: "add_fill_layer",
    description: "Add a solid-color layer at the bottom of the stack (e.g. a background).",
    input_schema: {
      type: "object",
      properties: {
        color: { type: "string", description: "CSS hex color like '#ffffff'" },
        name: { type: "string", description: "Layer name (optional)" },
      },
      required: ["color"],
    },
  },
  {
    name: "add_blank_layer",
    description: "Add an empty transparent raster layer above the current selection.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "duplicate_layer",
    description: "Duplicate the currently selected layer.",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "delete_selected_layer",
    description: "Delete the currently selected layer (if not locked).",
    input_schema: { type: "object", properties: {} },
  },
  {
    name: "fill_layer",
    description:
      "Fill the selected layer (or current selection) with a color. If a selection exists, only that region is filled.",
    input_schema: {
      type: "object",
      properties: {
        color: { type: "string", description: "CSS hex color" },
      },
      required: ["color"],
    },
  },
  {
    name: "transform_layer",
    description: "Set the selected layer's position, size, or rotation.",
    input_schema: {
      type: "object",
      properties: {
        x: { type: "number" },
        y: { type: "number" },
        width: { type: "number" },
        height: { type: "number" },
        rotation_degrees: { type: "number" },
      },
    },
  },
  {
    name: "resize_canvas",
    description:
      "Change the document boundaries (crop/extend) without resampling pixels. Anchor is one of: tl,t,tr,l,c,r,bl,b,br.",
    input_schema: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
        anchor: { type: "string", description: "One of tl,t,tr,l,c,r,bl,b,br" },
      },
      required: ["width", "height"],
    },
  },
  {
    name: "resample_image",
    description: "Resample the whole document and all layers to new dimensions.",
    input_schema: {
      type: "object",
      properties: {
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["width", "height"],
    },
  },
  {
    name: "deselect",
    description: "Clear the current pixel selection.",
    input_schema: { type: "object", properties: {} },
  },
  // --- 3rd-party AI providers ---
  {
    name: "generate_image",
    description:
      "Generate a new image with a 3rd-party AI provider and add it as a layer. Use this for 'add a sunset background', 'put a dog here', etc.",
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["gemini", "openai", "replicate"], default: "gemini" },
        prompt: { type: "string" },
        width: { type: "number" },
        height: { type: "number" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "edit_image_with_ai",
    description:
      "Send the selected layer to a generative AI provider with a prompt to transform it. Replaces the layer pixels with the model's output. Best for 'make it look like an oil painting', 'change the sky to night', etc.",
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["gemini", "openai"], default: "gemini" },
        prompt: { type: "string" },
      },
      required: ["prompt"],
    },
  },
  {
    name: "remove_background",
    description: "Run AI background removal on the selected layer. Replaces the layer pixels.",
    input_schema: {
      type: "object",
      properties: {
        provider: { type: "string", enum: ["removebg", "replicate"], default: "removebg" },
      },
    },
  },
  {
    name: "upscale_layer",
    description: "Upscale the selected layer with Real-ESRGAN via Replicate.",
    input_schema: {
      type: "object",
      properties: {
        scale: { type: "number", default: 2 },
      },
    },
  },
];

export async function executeTool(
  api: EditorAPI,
  name: string,
  input: any
): Promise<string> {
  switch (name) {
    case "list_filters": {
      const filters = listFilters().map((f) => ({
        id: f.id,
        name: f.name,
        category: f.category,
        params: f.params,
      }));
      return JSON.stringify(filters);
    }
    case "apply_filter": {
      const def = getFilter(input.filter_id);
      if (!def) return `Unknown filter: ${input.filter_id}`;
      const layer = api.selectedLayer;
      if (!layer || layer.kind !== "raster") return "No raster layer selected.";
      if (layer.locked) return "Selected layer is locked.";
      const params = { ...defaultParams(def.params), ...(input.params || {}) };
      const ctx = ctx2d(layer.canvas);
      const src = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
      const out = def.apply(src, params);
      ctx.putImageData(out, 0, 0);
      api.bump();
      api.pushHistory(`AI: Filter ${def.name}`);
      return `Applied ${def.name} to "${layer.name}".`;
    }
    case "add_fill_layer":
      api.addFillLayer(input.color, input.name ?? "Background", true);
      return `Added fill layer ${input.color}.`;
    case "add_blank_layer":
      api.addBlankLayer();
      return "Added blank layer.";
    case "duplicate_layer":
      api.duplicateSelectedLayer();
      return "Duplicated selected layer.";
    case "delete_selected_layer": {
      if (!api.selectedLayer) return "No layer selected.";
      if (api.selectedLayer.locked) return "Layer is locked.";
      api.deleteLayer(api.selectedLayer.id);
      return "Deleted layer.";
    }
    case "fill_layer": {
      const layer = api.selectedLayer;
      if (!layer || layer.locked) return "No editable layer.";
      fillLayer(layer, input.color, api.selection, api.doc.maskTargetActive);
      api.bump();
      api.pushHistory("AI: Fill");
      return `Filled with ${input.color}.`;
    }
    case "transform_layer": {
      const layer = api.selectedLayer;
      if (!layer || layer.locked) return "No editable layer.";
      const patch: any = {};
      if (typeof input.x === "number") patch.x = Math.round(input.x);
      if (typeof input.y === "number") patch.y = Math.round(input.y);
      if (typeof input.width === "number") patch.width = Math.max(1, Math.round(input.width));
      if (typeof input.height === "number") patch.height = Math.max(1, Math.round(input.height));
      if (typeof input.rotation_degrees === "number")
        patch.rotation = (input.rotation_degrees * Math.PI) / 180;
      api.updateLayerWithHistory(layer.id, patch, "AI: Transform");
      return "Transformed layer.";
    }
    case "resize_canvas":
      api.applyCanvasSize(input.width, input.height, (input.anchor ?? "c") as any);
      return `Canvas set to ${input.width}×${input.height} (${input.anchor ?? "c"}).`;
    case "resample_image":
      api.applyImageSize(input.width, input.height);
      return `Resampled to ${input.width}×${input.height}.`;
    case "deselect":
      api.setSelection({ mask: null, bounds: null });
      return "Selection cleared.";
    case "generate_image":
      return await generateImage(api, input);
    case "edit_image_with_ai":
      return await editImage(api, input);
    case "remove_background":
      return await removeBackground(api, input);
    case "upscale_layer":
      return await upscaleLayer(api, input);
    default:
      return `Tool not implemented: ${name}`;
  }
}

function defaultParams(specs: any[]): Record<string, any> {
  const out: Record<string, any> = {};
  for (const s of specs) out[s.key] = s.default;
  return out;
}

async function generateImage(api: EditorAPI, input: any): Promise<string> {
  const provider = input.provider || "gemini";
  const opts = {
    prompt: input.prompt,
    width: input.width ?? api.doc.width,
    height: input.height ?? api.doc.height,
  };
  const result = (await runProvider(provider, "generate", opts)) as ImageOutput[];
  if (!result || result.length === 0) return "Provider returned no image.";
  await addImageOutputAsLayer(api, result[0], `AI: ${input.prompt.slice(0, 30)}`);
  return `Added generated image as layer (${result[0].width}×${result[0].height}).`;
}

async function editImage(api: EditorAPI, input: any): Promise<string> {
  const layer = api.selectedLayer;
  if (!layer || layer.kind !== "raster" || layer.locked) return "No editable raster layer.";
  const b64 = layer.canvas.toDataURL("image/png").split(",")[1];
  const provider = input.provider || "gemini";
  const result = (await runProvider(provider, "edit", {
    prompt: input.prompt,
    image: { base64Png: b64 },
  })) as ImageOutput[];
  if (!result || result.length === 0) return "Provider returned no image.";
  await replaceLayerWithOutput(api, layer.id, result[0]);
  return `Edited "${layer.name}".`;
}

async function removeBackground(api: EditorAPI, input: any): Promise<string> {
  const layer = api.selectedLayer;
  if (!layer || layer.kind !== "raster" || layer.locked) return "No editable raster layer.";
  const b64 = layer.canvas.toDataURL("image/png").split(",")[1];
  const provider = input.provider || "removebg";
  const result = await runProvider(provider, "removeBackground", {
    image: { base64Png: b64 },
  });
  if (!result) return "Background removal failed.";
  const out = Array.isArray(result) ? result[0] : (result as ImageOutput);
  await replaceLayerWithOutput(api, layer.id, out);
  return `Removed background from "${layer.name}".`;
}

async function upscaleLayer(api: EditorAPI, input: any): Promise<string> {
  const layer = api.selectedLayer;
  if (!layer || layer.kind !== "raster" || layer.locked) return "No editable raster layer.";
  const b64 = layer.canvas.toDataURL("image/png").split(",")[1];
  const result = await Replicate.upscale!({
    image: { base64Png: b64 },
    scale: input.scale ?? 2,
  });
  await replaceLayerWithOutput(api, layer.id, result);
  return `Upscaled "${layer.name}" to ${result.width}×${result.height}.`;
}

async function runProvider(
  provider: string,
  method: "generate" | "edit" | "removeBackground",
  opts: any
): Promise<ImageOutput[] | ImageOutput | null> {
  const map: Record<string, any> = {
    gemini: Gemini,
    openai: OpenAI,
    removebg: RemoveBg,
    replicate: Replicate,
  };
  const p = map[provider];
  if (!p) throw new Error(`Unknown provider: ${provider}`);
  if (!p[method]) throw new Error(`${p.name} does not support ${method}.`);
  return p[method](opts);
}

async function addImageOutputAsLayer(
  api: EditorAPI,
  out: ImageOutput,
  name: string
): Promise<void> {
  const img = await base64ToImage(out.base64Png);
  api.addImageLayer(img, name);
}

async function replaceLayerWithOutput(api: EditorAPI, layerId: string, out: ImageOutput) {
  const img = await base64ToImage(out.base64Png);
  // Replace the layer's canvas in-place. Keep position; update size if changed.
  const layer = api.doc.layers.find((l) => l.id === layerId);
  if (!layer) return;
  const c = createCanvas(img.naturalWidth, img.naturalHeight);
  ctx2d(c).drawImage(img, 0, 0);
  api.updateLayer(layer.id, {
    canvas: c,
    width: img.naturalWidth,
    height: img.naturalHeight,
  });
  api.bump();
  api.pushHistory("AI: Replace Layer Pixels");
}

function base64ToImage(b64: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = `data:image/png;base64,${b64}`;
  });
}
