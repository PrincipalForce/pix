import React, { useCallback, useEffect, useRef, useState } from "react";
import { EditorAPI } from "@/hooks/useEditor";
import { compositeDocument, renderViewport, viewportToDoc } from "@/lib/render";
import { paintSegment, fillLayer, bucketFill, createStrokeState, StrokeState, drawGradient } from "@/lib/brush";
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
    }
  | {
      kind: "gradient";
      startDoc: { x: number; y: number };
      currentDoc: { x: number; y: number };
    };

type TransformHandle = "nw" | "n" | "ne" | "e" | "se" | "s" | "sw" | "w" | "rot";

export default function Canvas({ api, canvasOutRef }: Props) {
  const wrapRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const offscreenOutputRef = useRef<HTMLCanvasElement | null>(null);
  const dragRef = useRef<Drag>({ kind: "none" });
  const strokeStateRef = useRef<StrokeState | null>(null);
  const [gradPreview, setGradPreview] = useState<{
    from: { x: number; y: number };
    to: { x: number; y: number };
  } | null>(null);
  const [marqueePreview, setMarqueePreview] = useState<{
    shape: "rect" | "ellipse";
    startDoc: { x: number; y: number };
    currentDoc: { x: number; y: number };
  } | null>(null);
  const [polyPoints, setPolyPoints] = useState<{ x: number; y: number }[]>([]);
  const [antsOffset, setAntsOffset] = useState(0);
  const rafRef = useRef<number | null>(null);
  // Active pointers, used to detect pinch. We store type so we can filter to touch-only for pinch.
  const pointersRef = useRef<Map<number, { x: number; y: number; type: string }>>(new Map());

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

  // Global pointer cleanup — if a pointer never fires its pointerup on the canvas
  // (e.g. finger drags off-screen), we still want to clear it from our map.
  useEffect(() => {
    const drop = (e: PointerEvent) => {
      pointersRef.current.delete(e.pointerId);
      // If we were pinching but lost a touch, downgrade out of pinch mode.
      if (dragRef.current.kind === "pinch" && touchPointerCount() < 2) {
        dragRef.current = { kind: "none" };
      }
    };
    window.addEventListener("pointerup", drop);
    window.addEventListener("pointercancel", drop);
    return () => {
      window.removeEventListener("pointerup", drop);
      window.removeEventListener("pointercancel", drop);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const touchPointerCount = () =>
    [...pointersRef.current.values()].filter((p) => p.type === "touch").length;

  // Marching ants animation loop — runs as long as there is a selection, or while
  // a marquee/lasso drag is in progress. Depending on `selection.mask` directly
  // would restart the RAF on every pointer move during a drag (which both kills
  // perf and produces visual trails). We track only "is there *some* outline?"
  // and let the offset tick freely while it stays true.
  const hasAnyOutline = !!api.selection.mask || polyPoints.length > 0 || !!marqueePreview;
  useEffect(() => {
    if (!hasAnyOutline) return;
    let raf = 0;
    const tick = () => {
      setAntsOffset((o) => (o + 1) % 8);
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [hasAnyOutline]);

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
      if (marqueePreview) drawMarqueePreview(ctx, marqueePreview, api.view.zoom, antsOffset);
      if (gradPreview) drawGradientPreview(ctx, gradPreview, api.view.zoom);
      drawSelectedLayerOverlay(ctx, api);
      ctx.restore();
    });
  }, [api.doc, api.view, api.selection, api.dirtyTick, antsOffset, polyPoints, gradPreview, marqueePreview]);

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
    pointersRef.current.set(e.pointerId, {
      x: e.clientX,
      y: e.clientY,
      type: e.pointerType || "mouse",
    });
    // Only promote to pinch when there are two TOUCH pointers (so a palm-rest with
    // a pen, or a hovering mouse, doesn't cancel an in-progress brush stroke).
    const touchPts = [...pointersRef.current.values()].filter((p) => p.type === "touch");
    if (touchPts.length === 2) {
      const dx = touchPts[0].x - touchPts[1].x;
      const dy = touchPts[0].y - touchPts[1].y;
      dragRef.current = {
        kind: "pinch",
        startDistance: Math.hypot(dx, dy) || 1,
        startZoom: api.view.zoom,
        startPan: { x: api.view.panX, y: api.view.panY },
        startCenter: {
          x: (touchPts[0].x + touchPts[1].x) / 2,
          y: (touchPts[0].y + touchPts[1].y) / 2,
        },
      };
      return;
    }
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      // Some browsers throw on captures from touch on canvas; safe to ignore.
    }
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
          const handle = hitTransformHandle(api, docPt, e.pointerType === "touch");
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
      const shape = api.tool === "marquee-rect" ? "rect" : "ellipse";
      dragRef.current = {
        kind: "marquee",
        shape,
        startDoc: docPt,
        currentDoc: docPt,
      };
      // Start with a zero-size preview; the real selection mask is only built on pointer up.
      setMarqueePreview({ shape, startDoc: docPt, currentDoc: docPt });
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
      strokeStateRef.current = createStrokeState();
      paintSegment(
        sel,
        target,
        { fromDoc: docPt, toDoc: docPt },
        api.brush,
        api.tool === "eraser",
        api.selection,
        api.doc.maskTargetActive,
        strokeStateRef.current
      );
      api.bump();
      dragRef.current = { kind: "stroke", lastDoc: docPt };
      return;
    }

    if (api.tool === "gradient") {
      const sel = api.selectedLayer;
      if (!sel || sel.locked || sel.kind !== "raster") return;
      dragRef.current = { kind: "gradient", startDoc: docPt, currentDoc: docPt };
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
      pointersRef.current.set(e.pointerId, {
        x: e.clientX,
        y: e.clientY,
        type: e.pointerType || "mouse",
      });
    }
    const drag = dragRef.current;
    if (drag.kind === "pinch" && touchPointerCount() >= 2) {
      const pts = [...pointersRef.current.values()].filter((p) => p.type === "touch");
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
        api.doc.maskTargetActive,
        strokeStateRef.current ?? undefined
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
      // Cheap preview only — no per-move mask allocation.
      setMarqueePreview({ shape: drag.shape, startDoc: drag.startDoc, currentDoc: docPt });
      return;
    }

    if (drag.kind === "gradient") {
      drag.currentDoc = docPt;
      setGradPreview({ from: drag.startDoc, to: docPt });
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
      strokeStateRef.current = null;
      api.pushHistory(api.tool === "eraser" ? "Eraser Stroke" : "Brush Stroke");
    } else if (drag.kind === "move-layer") {
      api.pushHistory("Move Layer");
    } else if (drag.kind === "marquee") {
      // Commit the real selection mask once on release.
      const a = drag.startDoc;
      const b = drag.currentDoc;
      const x = Math.min(a.x, b.x);
      const y = Math.min(a.y, b.y);
      const w = Math.abs(b.x - a.x);
      const h = Math.abs(b.y - a.y);
      if (w > 1 && h > 1) {
        api.setSelection(
          drag.shape === "rect"
            ? rectSelection(api.doc.width, api.doc.height, x, y, w, h)
            : ellipseSelection(api.doc.width, api.doc.height, x, y, w, h)
        );
      } else {
        api.setSelection({ mask: null, bounds: null });
      }
      setMarqueePreview(null);
    } else if (drag.kind === "gradient") {
      const sel = api.selectedLayer;
      if (sel && !sel.locked && sel.kind === "raster") {
        const c0 = api.gradient.reverse ? api.background : api.foreground;
        const c1 = api.gradient.reverse ? api.foreground : api.background;
        drawGradient(
          sel,
          drag.startDoc,
          drag.currentDoc,
          api.gradient.kind,
          c0,
          c1,
          api.selection,
          api.doc.maskTargetActive
        );
        api.bump();
        api.pushHistory(`Gradient (${api.gradient.kind})`);
      }
      setGradPreview(null);
    } else if (drag.kind === "transform") {
      api.pushHistory("Transform");
    }
    // Stay in pinch as long as 2+ touch pointers remain; otherwise reset.
    if (drag.kind === "pinch" && touchPointerCount() < 2) {
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

  // Track the most recently hovered point so we can show direction-aware resize cursors.
  const [hoverHandle, setHoverHandle] = useState<TransformHandle | null>(null);
  const onPointerHover = (e: React.PointerEvent) => {
    if (api.tool !== "move" || !api.selectedLayer || api.selectedLayer.locked) {
      if (hoverHandle) setHoverHandle(null);
      return;
    }
    const docPt = ptDoc(e);
    const h = hitTransformHandle(api, docPt, e.pointerType === "touch");
    if (h !== hoverHandle) setHoverHandle(h);
  };

  let cursor = cursorFor(api.tool, { brushRadiusPx: (api.brush.size / 2) * api.view.zoom });
  if (api.tool === "move" && hoverHandle && api.selectedLayer) {
    cursor = resizeCursorFor(hoverHandle, api.selectedLayer.rotation);
  }

  return (
    <div ref={wrapRef} className="canvas-stage" style={{ cursor, touchAction: "none" }}>
      <canvas
        ref={canvasRef}
        style={{ touchAction: "none" }}
        onPointerDown={(e) => { onPointerHover(e); onPointerDown(e); }}
        onPointerMove={(e) => { if (dragRef.current.kind === "none") onPointerHover(e); onPointerMove(e); }}
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

function drawMarqueePreview(
  ctx: CanvasRenderingContext2D,
  m: {
    shape: "rect" | "ellipse";
    startDoc: { x: number; y: number };
    currentDoc: { x: number; y: number };
  },
  zoom: number,
  dashOffset: number
) {
  const x = Math.min(m.startDoc.x, m.currentDoc.x);
  const y = Math.min(m.startDoc.y, m.currentDoc.y);
  const w = Math.abs(m.currentDoc.x - m.startDoc.x);
  const h = Math.abs(m.currentDoc.y - m.startDoc.y);
  if (w < 1 || h < 1) return;
  ctx.save();
  ctx.lineWidth = 1.5 / zoom;
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.lineDashOffset = -dashOffset / zoom;
  ctx.strokeStyle = "#000";
  if (m.shape === "rect") {
    ctx.strokeRect(x, y, w, h);
  } else {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.lineDashOffset = -dashOffset / zoom + 5 / zoom;
  ctx.strokeStyle = "#fff";
  if (m.shape === "rect") {
    ctx.strokeRect(x, y, w, h);
  } else {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.restore();
}

function drawGradientPreview(
  ctx: CanvasRenderingContext2D,
  g: { from: { x: number; y: number }; to: { x: number; y: number } },
  zoom: number
) {
  ctx.save();
  ctx.lineWidth = 1 / zoom;
  ctx.setLineDash([5 / zoom, 5 / zoom]);
  ctx.strokeStyle = "#fff";
  ctx.beginPath();
  ctx.moveTo(g.from.x, g.from.y);
  ctx.lineTo(g.to.x, g.to.y);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.fillStyle = "#fff";
  ctx.beginPath();
  ctx.arc(g.from.x, g.from.y, 4 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.fillStyle = "#000";
  ctx.beginPath();
  ctx.arc(g.to.x, g.to.y, 4 / zoom, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
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
  // handles — slightly larger than the original 6px so they're easier to grab.
  const hs = 9 / api.view.zoom;
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
  ctx.lineTo(0, -l.height / 2 - 18 / api.view.zoom);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(0, -l.height / 2 - 18 / api.view.zoom, hs * 0.65, 0, Math.PI * 2);
  ctx.fillStyle = "#3b82f6";
  ctx.strokeStyle = "#fff";
  ctx.lineWidth = 1 / api.view.zoom;
  ctx.fill();
  ctx.stroke();
  ctx.restore();
}

function hitTransformHandle(
  api: EditorAPI,
  pt: { x: number; y: number },
  isTouch = false
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
  // Generous hit area — visible handle is small, but tap target is big.
  const hs = (isTouch ? 26 : 14) / api.view.zoom;
  const handles: Array<[TransformHandle, number, number]> = [
    ["nw", -l.width / 2, -l.height / 2],
    ["n", 0, -l.height / 2],
    ["ne", l.width / 2, -l.height / 2],
    ["e", l.width / 2, 0],
    ["se", l.width / 2, l.height / 2],
    ["s", 0, l.height / 2],
    ["sw", -l.width / 2, l.height / 2],
    ["w", -l.width / 2, 0],
    ["rot", 0, -l.height / 2 - 18 / api.view.zoom],
  ];
  for (const [h, hx, hy] of handles) {
    if (Math.abs(lx - hx) <= hs && Math.abs(ly - hy) <= hs) return h;
  }
  return null;
}

// Direction-aware resize cursor for a hovered transform handle.
// Renders a 24x24 SVG double-headed arrow rotated to point along the handle's axis,
// then composites with the layer's rotation so it stays accurate even when the layer is rotated.
function resizeCursorFor(handle: TransformHandle, layerRotation: number): string {
  if (handle === "rot") return "grab";
  // Base axis angle in degrees for each handle.
  const baseAngle: Record<Exclude<TransformHandle, "rot">, number> = {
    e: 0,
    w: 0,
    n: 90,
    s: 90,
    ne: -45,
    sw: -45,
    nw: 45,
    se: 45,
  };
  const angle = baseAngle[handle as Exclude<TransformHandle, "rot">] + (layerRotation * 180) / Math.PI;
  const svg = `<svg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24'>
<g transform='rotate(${angle} 12 12)'>
  <path d='M3 12 L21 12 M3 12 L7 8 M3 12 L7 16 M21 12 L17 8 M21 12 L17 16'
        stroke='white' stroke-width='2.4' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
  <path d='M3 12 L21 12 M3 12 L7 8 M3 12 L7 16 M21 12 L17 8 M21 12 L17 16'
        stroke='black' stroke-width='1.2' fill='none' stroke-linecap='round' stroke-linejoin='round'/>
</g>
</svg>`;
  const enc = encodeURIComponent(svg).replace(/'/g, "%27").replace(/"/g, "%22");
  // CSS fallback cursors per axis so the OS shows a sensible icon if the SVG is rejected.
  const fallback = fallbackResizeCursor(handle, layerRotation);
  return `url("data:image/svg+xml;charset=utf-8,${enc}") 12 12, ${fallback}`;
}

function fallbackResizeCursor(handle: TransformHandle, rotation: number): string {
  // Snap rotation to the nearest 45° bucket to pick a sensible OS cursor.
  const deg = ((rotation * 180) / Math.PI) % 360;
  const norm = ((deg + 360) % 360);
  const quad = Math.round(norm / 45) % 8; // 0..7 in 45° steps
  // Tables: for each handle (base orientation), bucket [0..7] mapping the axis.
  const base: Record<Exclude<TransformHandle, "rot">, string[]> = {
    e:  ["ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize"],
    w:  ["ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize"],
    n:  ["ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize"],
    s:  ["ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize"],
    ne: ["nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize"],
    sw: ["nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize"],
    nw: ["nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize"],
    se: ["nwse-resize", "ew-resize", "nesw-resize", "ns-resize", "nwse-resize", "ew-resize", "nesw-resize", "ns-resize"],
  };
  return base[handle as Exclude<TransformHandle, "rot">][quad];
}

function computeTransformPatch(
  drag: Extract<Drag, { kind: "transform" }>,
  docPt: { x: number; y: number },
  preserveAspect: boolean
) {
  const s = drag.startLayer;
  const cx = s.x + s.width / 2;
  const cy = s.y + s.height / 2;
  // Mouse in layer-local axis-aligned space (origin = layer center, before rotation).
  const cos = Math.cos(-s.rotation);
  const sin = Math.sin(-s.rotation);
  const lx = (docPt.x - cx) * cos - (docPt.y - cy) * sin;
  const ly = (docPt.x - cx) * sin + (docPt.y - cy) * cos;

  if (drag.handle === "rot") {
    const angle = Math.atan2(docPt.y - cy, docPt.x - cx) + Math.PI / 2;
    return { rotation: angle };
  }

  // Anchor (opposite of the dragged handle) in layer-local centered coords.
  const anchorX = drag.handle.includes("w")
    ? s.width / 2
    : drag.handle.includes("e")
    ? -s.width / 2
    : 0;
  const anchorY = drag.handle.includes("n")
    ? s.height / 2
    : drag.handle.includes("s")
    ? -s.height / 2
    : 0;

  // Which axes can move
  const movesX = drag.handle.includes("w") || drag.handle.includes("e");
  const movesY = drag.handle.includes("n") || drag.handle.includes("s");
  const isCorner = movesX && movesY;

  // Sign of the dragged corner from anchor
  const sx = drag.handle.includes("w") ? -1 : drag.handle.includes("e") ? 1 : 0;
  const sy = drag.handle.includes("n") ? -1 : drag.handle.includes("s") ? 1 : 0;

  let nw = movesX ? Math.abs(lx - anchorX) : s.width;
  let nh = movesY ? Math.abs(ly - anchorY) : s.height;

  // Shift-on-corner = lock aspect ratio. (Edge handles ignore aspect lock.)
  if (preserveAspect && isCorner) {
    const aspect = s.width / s.height;
    if (nw / nh > aspect) nh = nw / aspect;
    else nw = nh * aspect;
  }

  nw = Math.max(1, nw);
  nh = Math.max(1, nh);

  // Reconstruct new center in layer-local
  const ncxLocal = movesX ? anchorX + (sx * nw) / 2 : 0;
  const ncyLocal = movesY ? anchorY + (sy * nh) / 2 : 0;

  // Rotate back to doc space
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
