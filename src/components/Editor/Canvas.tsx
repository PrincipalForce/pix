import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorAPI } from "@/hooks/useEditor";
import { compositeDocument, renderViewport, viewportToDoc } from "@/lib/render";
import { paintSegment, fillLayer, bucketFill } from "@/lib/brush";
import {
  drawSelectionAnts,
  ellipseSelection,
  magicWandSelection,
  polygonSelection,
  rectSelection,
} from "@/lib/selection";
import { cursorFor } from "@/lib/cursors";
import { ctx2d } from "@/lib/canvas";

interface Props {
  api: EditorAPI;
  canvasOutRef: React.MutableRefObject<HTMLCanvasElement | null>;
}

type Drag =
  | { kind: "none" }
  | { kind: "pan"; startView: { panX: number; panY: number }; startMouse: { x: number; y: number } }
  | { kind: "stroke"; lastDoc: { x: number; y: number } }
  | {
      kind: "move-layer";
      layerId: string;
      startLayerXY: { x: number; y: number };
      startDoc: { x: number; y: number };
    }
  | {
      kind: "marquee";
      shape: "rect" | "ellipse";
      startDoc: { x: number; y: number };
      currentDoc: { x: number; y: number };
    }
  | {
      kind: "transform";
      layerId: string;
      handle: TransformHandle;
      startLayer: { x: number; y: number; width: number; height: number; rotation: number };
      startDoc: { x: number; y: number };
    }
  | {
      kind: "pinch";
      startDistance: number;
      startZoom: number;
      startPan: { x: number; y: number };
      startCenter: { x: number; y: number };
    };

type TransformHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot";

export default function Canvas({ api, canvasOutRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenOutputRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<Drag>({ kind: "none" });
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [antsOffset, setAntsOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  // Active touch pointers, used to detect pinch.
  const pointersRef = useRef<Map<number, { x: number; y: number }>>(new Map());

  // Size canvas to its container
  const resize = useCallback(() => {
    const wrap = wrapRef.current;
    const canvas = canvasRef.current;
    if (!wrap || !canvas) return;
    const r = wrap.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    canvas.width = Math.floor(r.width * dpr);
    canvas.height = Math.floor(r.height * dpr);
    canvas.style.width = `${r.width}px`;
    canvas.style.height = `${r.height}px`;
    // Scale for DPR
    ctx2d(canvas).setTransform(dpr, 0, 0, dpr, 0, 0);
    api.fitView(r.width, r.height);
  }, [api]);

  useEffect(() => {
    resize();
    const ro = new ResizeObserver(resize);
    if (wrapRef.current) ro.observe(wrapRef.current);
    return () => ro.disconnect();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Marching ants animation loop
  useEffect(() => {
    if (!api.selection.mask) return;
    let raf = 0;
    const tick = () => {
      setAntsOffset((o) => (o + 1) % 8);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [api.selection.mask]);

  // Re-render on state change
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = requestAnimationFrame(() => {
      const ctx = ctx2d(canvas);
      // We applied DPR transform at resize, so we need to render into CSS pixel space.
      const dpr = window.devicePixelRatio || 1;
      const cssW = canvas.width / dpr;
      const cssH = canvas.height / dpr;
      ctx.save();
      ctx.clearRect(0, 0, cssW, cssH);
      renderViewport(api.doc, api.view, canvas, cssW, cssH);
      // overlay marching ants and transform handles, in viewport coords
      ctx.translate(api.view.panX, api.view.panY);
      ctx.scale(api.view.zoom, api.view.zoom);
      drawSelectionAnts(ctx, api.selection, api.view.zoom, antsOffset);
      drawPolyInProgress(ctx, polyPoints, api.view.zoom, antsOffset);
      drawSelectedLayerOverlay(ctx, api);
      ctx.restore();
    });
  }, [api.doc, api.view, api.selection, api.dirtyTick, antsOffset, polyPoints]);

  // Keep external composite output current for share/export
  useEffect(() => {
    const comp = compositeDocument(api.doc, undefined, { includeBackground: true });
    offscreenOutputRef.current = comp;
    canvasOutRef.current = comp;
  }, [api.doc, api.dirtyTick, canvasOutRef]);

  // --- pointer handlers ---

  const ptDoc = useCallback(
    (e: React.PointerEvent | PointerEvent) => {
      const canvas = canvasRef.current!;
      const rect = canvas.getBoundingClientRect();
      return viewportToDoc(e.clientX - rect.left, e.clientY - rect.top, api.view);
    },
    [api.view]
  );

  const onPointerDown = (e: React.PointerEvent) => {
    // Track pointer for pinch detection
    pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    if (pointersRef.current.size === 2) {
      // Promote to pinch: cancel any other drag-in-progress.
      const pts = [...pointersRef.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      dragRef.current = {
        kind: "pinch",
        startDistance: Math.hypot(dx, dy) || 1,
        startZoom: api.view.zoom,
        startPan: { x: api.view.panX, y: api.view.panY },
        startCenter: { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 },
      };
      return;
    }
    e.currentTarget.setPointerCapture(e.pointerId);
    const docPt = ptDoc(e);
    const isSpace = (e as any).spaceKey === true || e.button === 1;

    if (api.tool === "hand" || isSpace) {
      dragRef.current = {
        kind: "pan",
        startView: { panX: api.view.panX, panY: api.view.panY },
        startMouse: { x: e.clientX, y: e.clientY },
      };
      return;
    }

    if (api.tool === "zoom") {
      const factor = e.altKey ? 1 / 1.25 : 1.25;
      const nz = Math.max(0.05, Math.min(32, api.view.zoom * factor));
      // zoom around mouse
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      api.setView({
        zoom: nz,
        panX: mx - (mx - api.view.panX) * (nz / api.view.zoom),
        panY: my - (my - api.view.panY) * (nz / api.view.zoom),
      });
      return;
    }

    if (api.tool === "move") {
      // Hit-test the topmost visible layer at docPt
      const layer = topmostLayerAt(api, docPt.x, docPt.y);
      if (layer) {
        api.selectLayer(layer.id);
        if (layer.locked) {
          // Locked: allow selection, but no move/transform drags.
          return;
        }
        // Check transform handles first if already selected
        if (api.selectedLayer?.id === layer.id) {
          const handle = hitTransformHandle(api, docPt);
          if (handle) {
            dragRef.current = {
              kind: "transform",
              layerId: layer.id,
              handle,
              startLayer: {
                x: layer.x,
                y: layer.y,
                width: layer.width,
                height: layer.height,
                rotation: layer.rotation,
              },
              startDoc: docPt,
            };
            return;
          }
        }
        dragRef.current = {
          kind: "move-layer",
          layerId: layer.id,
          startLayerXY: { x: layer.x, y: layer.y },
          startDoc: docPt,
        };
      } else {
        api.selectLayer(null);
      }
      return;
    }

    if (api.tool === "marquee-rect" || api.tool === "marquee-ellipse") {
      dragRef.current = {
        kind: "marquee",
        shape: api.tool === "marquee-rect" ? "rect" : "ellipse",
        startDoc: docPt,
        currentDoc: docPt,
      };
      return;
    }

    if (api.tool === "lasso-polygon") {
      // Double-click within close range to commit
      const pts = [...polyPoints, docPt];
      if (pts.length >= 3) {
        const first = pts[0];
        const dx = docPt.x - first.x;
        const dy = docPt.y - first.y;
        if (Math.sqrt(dx * dx + dy * dy) * api.view.zoom < 10 || e.detail === 2) {
          api.setSelection(polygonSelection(api.doc.width, api.doc.height, pts));
          setPolyPoints([]);
          return;
        }
      }
      setPolyPoints(pts);
      return;
    }

    if (api.tool === "magic-wand") {
      const comp = compositeDocument(api.doc, undefined, { includeBackground: true });
      const sel = magicWandSelection(comp, docPt.x, docPt.y, 24);
      api.setSelection(sel);
      return;
    }

    if (api.tool === "brush" || api.tool === "eraser") {
      const sel = api.selectedLayer;
      if (!sel) return;
      if (sel.locked) return;
      if (api.doc.maskTargetActive && !sel.mask) return;
      const target = api.doc.maskTargetActive ? sel.mask! : sel.canvas;
      paintSegment(
        sel,
        target,
        { fromDoc: docPt, toDoc: docPt },
        api.brush,
        api.tool === "eraser",
        api.selection,
        api.doc.maskTargetActive
      );
      api.bump();
      dragRef.current = { kind: "stroke", lastDoc: docPt };
      return;
    }

    if (api.tool === "fill") {
      const sel = api.selectedLayer;
      if (!sel) {
        // No layer to paint on: surface a hint via the editor's empty state.
        return;
      }
      if (sel.locked) return;
      if (e.shiftKey || (sel.kind === "raster" && sel.canvas.width > 0 && api.selection.mask)) {
        // Shift = fill entire layer (or selection if any). Same applies when a selection
        // exists — flood-fill inside a selection is ambiguous; full-fill the selection.
        fillLayer(sel, api.foreground, api.selection, api.doc.maskTargetActive);
      } else {
        bucketFill(
          sel,
          docPt.x,
          docPt.y,
          api.foreground,
          32,
          api.selection,
          api.doc.maskTargetActive
        );
      }
      api.bump();
      api.pushHistory("Paint Bucket");
      return;
    }

    if (api.tool === "eyedropper") {
      const comp = compositeDocument(api.doc, undefined, { includeBackground: true });
      const data = ctx2d(comp).getImageData(
        Math.floor(docPt.x),
        Math.floor(docPt.y),
        1,
        1
      ).data;
      const hex = `#${[data[0], data[1], data[2]]
        .map((n) => n.toString(16).padStart(2, "0"))
        .join("")}`;
      api.setForeground(hex);
      api.setBrush({ ...api.brush, color: hex });
      return;
    }
  };

  const onPointerMove = (e: React.PointerEvent) => {
    if (pointersRef.current.has(e.pointerId)) {
      pointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
    }
    const drag = dragRef.current;
    if (drag.kind === "pinch" && pointersRef.current.size >= 2) {
      const pts = [...pointersRef.current.values()];
      const dx = pts[0].x - pts[1].x;
      const dy = pts[0].y - pts[1].y;
      const dist = Math.hypot(dx, dy) || 1;
      const center = { x: (pts[0].x + pts[1].x) / 2, y: (pts[0].y + pts[1].y) / 2 };
      const rect = canvasRef.current!.getBoundingClientRect();
      const cx = center.x - rect.left;
      const cy = center.y - rect.top;
      const ratio = dist / drag.startDistance;
      const nz = Math.max(0.05, Math.min(32, drag.startZoom * ratio));
      // Two-finger pan: difference between current center and start center, plus zoom-around-center
      const cxStart = drag.startCenter.x - rect.left;
      const cyStart = drag.startCenter.y - rect.top;
      const panX = cx - (cxStart - drag.startPan.x) * (nz / drag.startZoom);
      const panY = cy - (cyStart - drag.startPan.y) * (nz / drag.startZoom);
      api.setView({ zoom: nz, panX, panY });
      return;
    }
    if (drag.kind === "none") return;
    const docPt = ptDoc(e);

    if (drag.kind === "pan") {
      api.setView({
        zoom: api.view.zoom,
        panX: drag.startView.panX + (e.clientX - drag.startMouse.x),
        panY: drag.startView.panY + (e.clientY - drag.startMouse.y),
      });
      return;
    }

    if (drag.kind === "stroke") {
      const sel = api.selectedLayer;
      if (!sel) return;
      const target = api.doc.maskTargetActive ? sel.mask! : sel.canvas;
      paintSegment(
        sel,
        target,
        { fromDoc: drag.lastDoc, toDoc: docPt },
        api.brush,
        api.tool === "eraser",
        api.selection,
        api.doc.maskTargetActive
      );
      api.bump();
      drag.lastDoc = docPt;
      return;
    }

    if (drag.kind === "move-layer") {
      const layer = api.doc.layers.find((l) => l.id === drag.layerId);
      if (!layer) return;
      api.updateLayer(layer.id, {
        x: Math.round(drag.startLayerXY.x + (docPt.x - drag.startDoc.x)),
        y: Math.round(drag.startLayerXY.y + (docPt.y - drag.startDoc.y)),
      });
      return;
    }

    if (drag.kind === "marquee") {
      drag.currentDoc = docPt;
      // Live-preview by setting selection
      const x = Math.min(drag.startDoc.x, docPt.x);
      const y = Math.min(drag.startDoc.y, docPt.y);
      const w = Math.abs(docPt.x - drag.startDoc.x);
      const h = Math.abs(docPt.y - drag.startDoc.y);
      api.setSelection(
        drag.shape === "rect"
          ? rectSelection(api.doc.width, api.doc.height, x, y, w, h)
          : ellipseSelection(api.doc.width, api.doc.height, x, y, w, h)
      );
      return;
    }

    if (drag.kind === "transform") {
      const layer = api.doc.layers.find((l) => l.id === drag.layerId);
      if (!layer) return;
      const patch = computeTransformPatch(drag, docPt, e.shiftKey);
      api.updateLayer(layer.id, patch);
      return;
    }
  };

  const onPointerUp = (e: React.PointerEvent) => {
    pointersRef.current.delete(e.pointerId);
    const drag = dragRef.current;
    if (drag.kind === "stroke") {
      api.pushHistory(api.tool === "eraser" ? "Eraser Stroke" : "Brush Stroke");
    } else if (drag.kind === "move-layer") {
      api.pushHistory("Move Layer");
    } else if (drag.kind === "marquee") {
      // already committed in onPointerMove
    } else if (drag.kind === "transform") {
      api.pushHistory("Transform");
    }
    // Stay in pinch as long as 2+ pointers remain; otherwise reset.
    if (drag.kind === "pinch" && pointersRef.current.size < 2) {
      dragRef.current = { kind: "none" };
    } else if (drag.kind !== "pinch") {
      dragRef.current = { kind: "none" };
    }
  };

  const onWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      // zoom
      const rect = canvasRef.current!.getBoundingClientRect();
      const mx = e.clientX - rect.left;
      const my = e.clientY - rect.top;
      const factor = e.deltaY > 0 ? 1 / 1.1 : 1.1;
      const nz = Math.max(0.05, Math.min(32, api.view.zoom * factor));
      api.setView({
        zoom: nz,
        panX: mx - (mx - api.view.panX) * (nz / api.view.zoom),
        panY: my - (my - api.view.panY) * (nz / api.view.zoom),
      });
    } else {
      api.setView({
        zoom: api.view.zoom,
        panX: api.view.panX - e.deltaX,
        panY: api.view.panY - e.deltaY,
      });
    }
  };

  const cursor = cursorFor(api.tool, { brushRadiusPx: (api.brush.size / 2) * api.view.zoom });

  return (
    <div ref={wrapRef} className="canvas-stage" style={{ cursor, touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        style={{ touchAction: "none" }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onWheel={onWheel}
        onDoubleClick={() => {
          if (api.tool === "lasso-polygon" && polyPoints.length >= 3) {
            api.setSelection(polygonSelection(api.doc.width, api.doc.height, polyPoints));
            setPolyPoints([]);
          }
        }}
        onContextMenu={(e) => e.preventDefault()}
      />
    </div>
  );
}

function topmostLayerAt(api: EditorAPI, x: number, y: number) {
  for (let i = api.doc.layers.length - 1; i >= 0; i--) {
    const l = api.doc.layers[i];
    if (!l.visible) continue;
    // Inverse-transform doc point into layer-local
    const cx = l.x + l.width / 2;
    const cy = l.y + l.height / 2;
    const cos = Math.cos(-l.rotation);
    const sin = Math.sin(-l.rotation);
    const lx = (x - cx) * cos - (y - cy) * sin + l.width / 2;
    const ly = (x - cx) * sin + (y - cy) * cos + l.height / 2;
    if (lx < 0 || ly < 0 || lx >= l.width || ly >= l.height) continue;
    // alpha hit-test
    const sx = l.canvas.width / l.width;
    const sy = l.canvas.height / l.height;
    try {
      const a = ctx2d(l.canvas).getImageData(Math.floor(lx * sx), Math.floor(ly * sy), 1, 1).data[3];
      if (a > 4) return l;
    } catch {
      return l;
    }
  }
  return null;
}

function drawPolyInProgress(
  ctx: CanvasRenderingContext2D,
  pts: { x: number; y: number }[],
  zoom: number,
  offset: number
) {
  if (pts.length === 0) return;
  ctx.save();
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([4 / zoom, 4 / zoom]);
  ctx.lineDashOffset = -offset / zoom;
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length; i++) ctx.lineTo(pts[i].x, pts[i].y);
  ctx.stroke();
  // Dots
  ctx.fillStyle = "#fff";
  ctx.setLineDash([]);
  for (const p of pts) {
    ctx.beginPath();
    ctx.arc(p.x, p.y, 3 / zoom, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function drawSelectedLayerOverlay(ctx: CanvasRenderingContext2D, api: EditorAPI) {
  const l = api.selectedLayer;
  if (!l) return;
  ctx.save();
  ctx.translate(l.x + l.width / 2, l.y + l.height / 2);
  ctx.rotate(l.rotation);
  ctx.strokeStyle = l.locked ? "#9aa3b2" : "#3b82f6";
  ctx.lineWidth = 1 / api.view.zoom;
  if (l.locked) {
    ctx.setLineDash([4 / api.view.zoom, 3 / api.view.zoom]);
  }
  ctx.strokeRect(-l.width / 2, -l.height / 2, l.width, l.height);
  ctx.setLineDash([]);
  if (l.locked) {
    // No transform handles for locked layers.
    ctx.restore();
    return;
  }
  // handles
  const hs = 6 / api.view.zoom;
  const corners: Array<[number, number]> = [
    [-l.width / 2, -l.height / 2],
    [0, -l.height / 2],
    [l.width / 2, -l.height / 2],
    [l.width / 2, 0],
    [l.width / 2, l.height / 2],
    [0, l.height / 2],
    [-l.width / 2, l.height / 2],
    [-l.width / 2, 0],
  ];
  for (const [hx, hy] of corners) {
    ctx.fillStyle = "#fff";
    ctx.strokeStyle = "#3b82f6";
    ctx.fillRect(hx - hs / 2, hy - hs / 2, hs, hs);
    ctx.strokeRect(hx - hs / 2, hy - hs / 2, hs, hs);
  }
  // rotation handle
  ctx.beginPath();
  ctx.moveTo(0, -l.height / 2);
  ctx.lineTo(0, -l.height / 2 - 16 / api.view.zoom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -l.height / 2 - 16 / api.view.zoom, hs / 2, 0, Math.PI * 2);
  ctx.fillStyle = "#3b82f6";
  ctx.fill();
  ctx.restore();
}

function hitTransformHandle(
  api: EditorAPI,
  pt: { x: number; y: number }
): TransformHandle | null {
  const l = api.selectedLayer;
  if (!l) return null;
  // Convert to layer-local
  const cx = l.x + l.width / 2;
  const cy = l.y + l.height / 2;
  const cos = Math.cos(-l.rotation);
  const sin = Math.sin(-l.rotation);
  const lx = (pt.x - cx) * cos - (pt.y - cy) * sin;
  const ly = (pt.x - cx) * sin + (pt.y - cy) * cos;
  const hs = 8 / api.view.zoom;
  const handles: Array<[TransformHandle, number, number]> = [
    ["nw", -l.width / 2, -l.height / 2],
    ["n", 0, -l.height / 2],
    ["ne", l.width / 2, -l.height / 2],
    ["e", l.width / 2, 0],
    ["se", l.width / 2, l.height / 2],
    ["s", 0, l.height / 2],
    ["sw", -l.width / 2, l.height / 2],
    ["w", -l.width / 2, 0],
    ["rot", 0, -l.height / 2 - 16 / api.view.zoom],
  ];
  for (const [h, hx, hy] of handles) {
    if (Math.abs(lx - hx) <= hs && Math.abs(ly - hy) <= hs) return h;
  }
  return null;
}

function computeTransformPatch(
  drag: Extract<Drag, { kind: "transform" }>,
  docPt: { x: number; y: number },
  preserveAspect: boolean
) {
  const s = drag.startLayer;
  // Convert mouse delta into layer-local axis-aligned space
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  const cos = Math.cos(-s.rotation);
  const sin = Math.sin(-s.rotation);
  const dlx = (docPt.x - cx) * cos - (docPt.y - cy) * sin;
  const dly = (docPt.x - cx) * sin + (docPt.y - cy) * cos;

  if (drag.handle === "rot") {
    const angle = Math.atan2(docPt.y - cy, docPt.x - cx) + Math.PI / 2;
    return { rotation: angle };
  }

  let nx1 = -s.width / 2;
  let ny1 = -s.height / 2;
  let nx2 = s.width / 2;
  let ny2 = s.height / 2;

  if (drag.handle.includes("w")) nx1 = dlx;
  if (drag.handle.includes("e")) nx2 = dlx;
  if (drag.handle.includes("n")) ny1 = dly;
  if (drag.handle.includes("s")) ny2 = dly;

  let nw = nx2 - nx1;
  let nh = ny2 - ny1;

  if (preserveAspect) {
    const aspect = s.width / s.height;
    if (Math.abs(nw / aspect) > Math.abs(nh)) nh = nw / aspect * Math.sign(nh) || nw / aspect;
    else nw = nh * aspect * Math.sign(nw) || nh * aspect;
  }

  if (nw < 1) nw = 1;
  if (nh < 1) nh = 1;

  // New center in layer-local
  const ncxLocal = (nx1 + nx2) / 2;
  const ncyLocal = (ny1 + ny2) / 2;
  // Transform back to doc space
  const cos2 = Math.cos(s.rotation);
  const sin2 = Math.sin(s.rotation);
  const ncx = cx + ncxLocal * cos2 - ncyLocal * sin2;
  const ncy = cy + ncxLocal * sin2 + ncyLocal * cos2;

  return {
    x: Math.round(ncx - nw / 2),
    y: Math.round(ncy - nh / 2),
    width: Math.round(nw),
    height: Math.round(nh),
  };
}
