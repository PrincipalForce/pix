import { EditorAPI } from "@/hooks/useEditor";
import { getFilter } from "@/lib/filters/registry";
import { ctx2d } from "@/lib/canvas";
import { fillLayer } from "@/lib/brush";
import { PixAction, Step } from "./types";

// Run an action sequentially against the live editor.
export async function playAction(api: EditorAPI, action: PixAction): Promise<{ ran: number; skipped: number }> {
  let ran = 0;
  let skipped = 0;
  for (const step of action.steps) {
    try {
      await runStep(api, step);
      ran++;
    } catch (e) {
      console.warn("Step failed:", step, e);
      skipped++;
    }
    // Yield so the canvas can repaint between steps.
    await new Promise((r) => setTimeout(r, 0));
  }
  api.pushHistory(`Action: ${action.name}`);
  return { ran, skipped };
}

async function runStep(api: EditorAPI, step: Step): Promise<void> {
  switch (step.type) {
    case "applyFilter": {
      const def = getFilter(step.filterId);
      if (!def) throw new Error(`Unknown filter: ${step.filterId}`);
      const layer = api.selectedLayer;
      if (!layer || layer.kind !== "raster" || layer.locked) throw new Error("No editable raster layer");
      const ctx = ctx2d(layer.canvas);
      const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
      const out = def.apply(img, step.params);
      ctx.putImageData(out, 0, 0);
      api.bump();
      return;
    }
    case "addFillLayer":
      api.addFillLayer(step.color, step.name ?? "Background", true);
      return;
    case "addBlankLayer":
      api.addBlankLayer();
      return;
    case "duplicateLayer":
      api.duplicateSelectedLayer();
      return;
    case "fillSelection": {
      const layer = api.selectedLayer;
      if (!layer || layer.locked) return;
      fillLayer(layer, step.color, api.selection, api.doc.maskTargetActive);
      api.bump();
      return;
    }
    case "invert": {
      const def = getFilter("invert");
      const layer = api.selectedLayer;
      if (!def || !layer || layer.kind !== "raster" || layer.locked) return;
      const ctx = ctx2d(layer.canvas);
      const img = ctx.getImageData(0, 0, layer.canvas.width, layer.canvas.height);
      ctx.putImageData(def.apply(img, {}), 0, 0);
      api.bump();
      return;
    }
    case "canvasSize":
      api.applyCanvasSize(step.width, step.height, step.anchor as any);
      return;
    case "imageSize":
      api.applyImageSize(step.width, step.height);
      return;
    case "setBrush": {
      const next = { ...api.brush };
      if (step.color) next.color = step.color;
      if (step.size) next.size = step.size;
      if (step.opacity !== undefined) next.opacity = step.opacity;
      if (step.presetId) next.presetId = step.presetId;
      api.setBrush(next);
      return;
    }
    case "deselect":
      api.setSelection({ mask: null, bounds: null });
      return;
    case "selectAll": {
      // No-op selection that covers the whole doc (could compose).
      return;
    }
    case "flatten": {
      // Not implemented yet — skip.
      return;
    }
    case "unsupported":
      throw new Error(`Unsupported step: ${step.label}`);
  }
}
