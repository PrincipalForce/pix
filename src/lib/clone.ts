import { BrushSettings, Layer, Selection } from "@/types/editor";
import { createCanvas, ctx2d } from "./canvas";
import { getBrush, renderTip } from "./brushes/registry";

// Doc-space rasterization of a layer with its transform applied. Used as the
// source snapshot for a clone stroke so we sample the pixels as they were
// when the stroke started — not as we smear them while painting.
export function rasterizeLayerToDoc(
  layer: Layer,
  docW: number,
  docH: number
): HTMLCanvasElement {
  const out = createCanvas(docW, docH);
  const ctx = ctx2d(out);
  ctx.save();
  ctx.translate(layer.x + layer.width / 2, layer.y + layer.height / 2);
  ctx.rotate(layer.rotation);
  ctx.drawImage(layer.canvas, -layer.width / 2, -layer.height / 2, layer.width, layer.height);
  ctx.restore();
  return out;
}

export interface CloneStrokeState {
  // Doc-sized snapshot of the source layer at stroke start.
  sourceSnapshot: HTMLCanvasElement;
  // accumulator for stamp spacing
  accum: number;
  last?: { x: number; y: number };
}

export function startCloneStroke(
  sourceLayer: Layer,
  docW: number,
  docH: number
): CloneStrokeState {
  return {
    sourceSnapshot: rasterizeLayerToDoc(sourceLayer, docW, docH),
    accum: 0,
  };
}

// Paint a segment of a clone stroke onto `targetLayer`. `offsetDoc` is the
// doc-space delta from dest → source (sourceDoc = destDoc + offsetDoc), set
// once at stroke start.
export function paintCloneSegment(
  targetLayer: Layer,
  fromDoc: { x: number; y: number },
  toDoc: { x: number; y: number },
  brush: BrushSettings,
  offsetDoc: { x: number; y: number },
  selection: Selection,
  state: CloneStrokeState
): void {
  const preset = getBrush(brush.presetId) ?? getBrush("medium-round")!;
  const spacing = Math.max(0.02, brush.spacing ?? preset.spacing) * brush.size;

  const stamp = (destDoc: { x: number; y: number }) => {
    const srcDoc = { x: destDoc.x + offsetDoc.x, y: destDoc.y + offsetDoc.y };
    paintCloneStamp(
      targetLayer,
      state.sourceSnapshot,
      srcDoc,
      destDoc,
      brush,
      preset,
      selection
    );
  };

  if (state.last === undefined) {
    stamp(fromDoc);
    state.last = fromDoc;
    state.accum = 0;
  }

  const dx = toDoc.x - fromDoc.x;
  const dy = toDoc.y - fromDoc.y;
  const dist = Math.hypot(dx, dy);
  if (dist <= 0.0001) {
    state.last = toDoc;
    return;
  }
  const ux = dx / dist;
  const uy = dy / dist;
  let next = spacing - state.accum;
  while (next <= dist) {
    stamp({ x: fromDoc.x + ux * next, y: fromDoc.y + uy * next });
    next += spacing;
  }
  state.accum = (state.accum + dist) % spacing;
  state.last = toDoc;
}

function paintCloneStamp(
  targetLayer: Layer,
  sourceSnapshot: HTMLCanvasElement,
  srcDoc: { x: number; y: number },
  destDoc: { x: number; y: number },
  brush: BrushSettings,
  preset: ReturnType<typeof getBrush> & object,
  selection: Selection
): void {
  // Convert dest doc point to target layer-local pixel.
  const destPx = docToLayerPx(targetLayer, destDoc.x, destDoc.y);
  const sx = targetLayer.canvas.width / targetLayer.width;
  const sy = targetLayer.canvas.height / targetLayer.height;
  // Brush size is in canvas pixels (consistent with brush.ts). Approximate the
  // stamp diameter accounting for layer-vs-canvas scaling — uniform-scale-only.
  const scale = (sx + sy) / 2;
  const stampPx = Math.max(1, Math.round(brush.size));

  // Build a scratch the size of the target's canvas. For each stamp we draw the
  // source snapshot, translated so that srcDoc → destDoc, into target-local
  // coordinates; then mask by a circular brush tip; then composite.
  const scratch = createCanvas(targetLayer.canvas.width, targetLayer.canvas.height);
  const ctx = ctx2d(scratch);
  ctx.save();
  ctx.scale(sx, sy);
  ctx.translate(targetLayer.width / 2, targetLayer.height / 2);
  ctx.rotate(-targetLayer.rotation);
  ctx.translate(-(targetLayer.x + targetLayer.width / 2), -(targetLayer.y + targetLayer.height / 2));
  ctx.translate(destDoc.x - srcDoc.x, destDoc.y - srcDoc.y);
  ctx.drawImage(sourceSnapshot, 0, 0);
  ctx.restore();

  // Brush tip as alpha mask, painted at the dest position in target-local px.
  const tip = renderTip(preset!, stampPx, "#ffffff", 1);
  ctx.globalCompositeOperation = "destination-in";
  ctx.drawImage(tip.canvas, destPx.x - tip.diameter / 2, destPx.y - tip.diameter / 2);

  // Clip by selection if any.
  if (selection.mask) {
    const clip = layerLocalSelectionClip(targetLayer, selection.mask);
    ctx.drawImage(clip, 0, 0);
  }

  // Apply opacity * flow as a global alpha when compositing onto the layer.
  const op = Math.max(0, Math.min(1, brush.opacity * brush.flow));
  const targetCtx = ctx2d(targetLayer.canvas);
  targetCtx.globalCompositeOperation = "source-over";
  targetCtx.globalAlpha = op;
  targetCtx.drawImage(scratch, 0, 0);
  targetCtx.globalAlpha = 1;
  void scale;
}

function docToLayerPx(layer: Layer, x: number, y: number): { x: number; y: number } {
  const cx = layer.x + layer.width / 2;
  const cy = layer.y + layer.height / 2;
  const dx = x - cx;
  const dy = y - cy;
  const cos = Math.cos(-layer.rotation);
  const sin = Math.sin(-layer.rotation);
  const lx = dx * cos - dy * sin + layer.width / 2;
  const ly = dx * sin + dy * cos + layer.height / 2;
  const sx = layer.canvas.width / layer.width;
  const sy = layer.canvas.height / layer.height;
  return { x: lx * sx, y: ly * sy };
}

function layerLocalSelectionClip(
  layer: Layer,
  docMask: HTMLCanvasElement
): HTMLCanvasElement {
  const out = createCanvas(layer.canvas.width, layer.canvas.height);
  const ctx = ctx2d(out);
  ctx.save();
  const sx = layer.canvas.width / layer.width;
  const sy = layer.canvas.height / layer.height;
  ctx.scale(sx, sy);
  ctx.translate(layer.width / 2, layer.height / 2);
  ctx.rotate(-layer.rotation);
  ctx.translate(-(layer.x + layer.width / 2), -(layer.y + layer.height / 2));
  ctx.drawImage(docMask, 0, 0);
  ctx.restore();
  return out;
}
