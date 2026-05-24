import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrushSettings,
  DocumentState,
  GradientSettings,
  Layer,
  Selection,
  Tool,
  Viewport,
  HistoryEntry,
  DocumentSnapshot,
} from "@/types/editor";
import {
  createBlankDocument,
  createRasterLayer,
  cropDocument,
  duplicateLayer,
  ensureMask,
  nextLayerId,
  renderShapeLayer,
  renderTextLayer,
  resampleDocument,
  resizeCanvasSize,
  restoreDocument,
  snapshotDocument,
} from "@/lib/document";
import {
  emptySelection,
  invertSelection,
  selectAll,
  selectFromLayerAlpha,
  featherSelection,
  expandSelection,
  contractSelection,
  extractSelectionFromLayer,
  eraseSelectionFromLayer,
} from "@/lib/selection";
import { fitViewport, TransparencyTheme } from "@/lib/render";
import { Step } from "@/lib/actions/types";

const HISTORY_LIMIT = 60;

function pickInitialDocSize(): { w: number; h: number } {
  if (typeof window === "undefined") return { w: 1920, h: 1080 };
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  // Mobile: portrait phone-photo canvas by default (matches the device's aspect).
  if (vw < 900) {
    if (vh >= vw) return { w: 1080, h: 1920 };
    return { w: 1920, h: 1080 };
  }
  // Desktop: landscape FHD-ish.
  return { w: 1920, h: 1080 };
}

export function useEditor() {
  const [doc, setDoc] = useState<DocumentState>(() => {
    const { w, h } = pickInitialDocSize();
    return createBlankDocument(w, h, "transparent", "Untitled-1");
  });
  const [tool, setTool] = useState<Tool>("move");
  const [view, setView] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [selection, setSelectionRaw] = useState<Selection>(emptySelection());
  const lastSelectionRef = useRef<Selection | null>(null);
  const setSelection = useCallback((next: Selection) => {
    // Whenever a real selection becomes empty, remember the previous one for Reselect.
    setSelectionRaw((prev) => {
      if (prev.mask && !next.mask) lastSelectionRef.current = prev;
      return next;
    });
  }, []);
  const [brush, setBrush] = useState<BrushSettings>({
    size: 24,
    hardness: 0.85,
    color: "#000000",
    opacity: 1,
    flow: 1,
    presetId: "medium-round",
  });
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackgroundColor] = useState("#ffffff");
  const [gradient, setGradient] = useState<GradientSettings>({ kind: "linear", reverse: false });
  const [transparencyTheme, setTransparencyThemeRaw] = useState<TransparencyTheme>(() => {
    if (typeof window === "undefined") return "light";
    const stored = window.localStorage.getItem("pix.transparencyTheme");
    return stored === "dark" ? "dark" : "light";
  });
  const setTransparencyTheme = useCallback((t: TransparencyTheme) => {
    setTransparencyThemeRaw(t);
    try {
      window.localStorage.setItem("pix.transparencyTheme", t);
    } catch {}
  }, []);

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const restoringRef = useRef(false);
  const tickRef = useRef(0);

  // Action recording: when recordingRef.current is non-null, recordStep() appends to it.
  const recordingRef = useRef<Step[] | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const startRecording = useCallback(() => {
    recordingRef.current = [];
    setIsRecording(true);
  }, []);
  const stopRecording = useCallback((): Step[] => {
    const steps = recordingRef.current ?? [];
    recordingRef.current = null;
    setIsRecording(false);
    return steps;
  }, []);
  const recordStep = useCallback((step: Step) => {
    if (recordingRef.current) recordingRef.current.push(step);
  }, []);

  // Bump on any in-place canvas mutation (brush stroke) so React re-renders
  const [dirtyTick, setDirty] = useState(0);
  const bump = useCallback(() => setDirty((t) => t + 1), []);

  const fitView = useCallback((vpW: number, vpH: number) => {
    setView(fitViewport(doc.width, doc.height, vpW, vpH));
  }, [doc.width, doc.height]);

  const selectedLayer = useMemo(
    () => doc.layers.find((l) => l.id === doc.selectedLayerId) ?? null,
    [doc.layers, doc.selectedLayerId]
  );

  const pushHistory = useCallback(
    (label: string) => {
      if (restoringRef.current) return;
      const snap = snapshotDocument(doc);
      setHistory((prev) => {
        const trimmed = prev.slice(0, historyIndex + 1);
        const entry: HistoryEntry = {
          id: `h-${++tickRef.current}`,
          label,
          timestamp: Date.now(),
          snapshot: snap,
        };
        const next = [...trimmed, entry];
        return next.length > HISTORY_LIMIT ? next.slice(next.length - HISTORY_LIMIT) : next;
      });
      setHistoryIndex((i) => Math.min(i + 1, HISTORY_LIMIT - 1));
    },
    [doc, historyIndex]
  );

  // Seed history with initial state.
  useEffect(() => {
    if (history.length === 0) {
      const snap = snapshotDocument(doc);
      setHistory([{ id: "h-0", label: "New Document", timestamp: Date.now(), snapshot: snap }]);
      setHistoryIndex(0);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const restoreFromSnapshot = useCallback(async (snap: DocumentSnapshot) => {
    restoringRef.current = true;
    try {
      const restored = await restoreDocument(snap);
      setDoc(restored);
    } finally {
      restoringRef.current = false;
    }
  }, []);

  const undo = useCallback(() => {
    if (historyIndex <= 0) return;
    const ni = historyIndex - 1;
    setHistoryIndex(ni);
    void restoreFromSnapshot(history[ni].snapshot);
  }, [history, historyIndex, restoreFromSnapshot]);

  const redo = useCallback(() => {
    if (historyIndex >= history.length - 1) return;
    const ni = historyIndex + 1;
    setHistoryIndex(ni);
    void restoreFromSnapshot(history[ni].snapshot);
  }, [history, historyIndex, restoreFromSnapshot]);

  const jumpHistory = useCallback(
    (index: number) => {
      if (index < 0 || index >= history.length) return;
      setHistoryIndex(index);
      void restoreFromSnapshot(history[index].snapshot);
    },
    [history, restoreFromSnapshot]
  );

  // --- document/layer mutators ---

  const newDocument = useCallback(
    (w: number, h: number, bg: DocumentState["background"], name = "Untitled") => {
      const d = createBlankDocument(w, h, bg, name);
      setDoc(d);
      setSelection(emptySelection());
      setHistory([]);
      setHistoryIndex(-1);
      setTimeout(() => pushHistory("New Document"), 0);
    },
    [pushHistory]
  );

  const addImageLayer = useCallback(
    (img: HTMLImageElement, label = "Image Layer") => {
      const layer = createRasterLayer({
        name: label,
        width: img.naturalWidth,
        height: img.naturalHeight,
        docWidth: doc.width,
        docHeight: doc.height,
        source: img,
        x: Math.round((doc.width - img.naturalWidth) / 2),
        y: Math.round((doc.height - img.naturalHeight) / 2),
      });
      setDoc((d) => ({
        ...d,
        layers: [...d.layers, layer],
        selectedLayerId: layer.id,
      }));
      setTimeout(() => pushHistory(`Add ${label}`), 0);
    },
    [doc.width, doc.height, pushHistory]
  );

  const addFillLayer = useCallback(
    (color: string, name = "Background", asBottom = true) => {
      recordStep({ type: "addFillLayer", color, name });
      const layer = createRasterLayer({
        name,
        width: doc.width,
        height: doc.height,
        docWidth: doc.width,
        docHeight: doc.height,
      });
      const c = layer.canvas.getContext("2d")!;
      c.fillStyle = color;
      c.fillRect(0, 0, layer.width, layer.height);
      setDoc((d) => ({
        ...d,
        layers: asBottom ? [layer, ...d.layers] : [...d.layers, layer],
        selectedLayerId: layer.id,
      }));
      setTimeout(() => pushHistory(`Add ${name}`), 0);
    },
    [doc.width, doc.height, pushHistory]
  );

  const addBlankLayer = useCallback(() => {
    recordStep({ type: "addBlankLayer" });
    const layer = createRasterLayer({
      name: `Layer ${doc.layers.length + 1}`,
      width: doc.width,
      height: doc.height,
      docWidth: doc.width,
      docHeight: doc.height,
    });
    setDoc((d) => ({
      ...d,
      layers: [...d.layers, layer],
      selectedLayerId: layer.id,
    }));
    pushHistory("New Layer");
  }, [doc.width, doc.height, doc.layers.length, pushHistory]);

  const addLayer = useCallback(
    (layer: Layer, label = "Add Layer") => {
      setDoc((d) => ({ ...d, layers: [...d.layers, layer], selectedLayerId: layer.id }));
      setTimeout(() => pushHistory(label), 0);
    },
    [pushHistory]
  );

  const updateLayer = useCallback((id: string, patch: Partial<Layer>) => {
    setDoc((d) => ({
      ...d,
      layers: d.layers.map((l) => (l.id === id ? { ...l, ...patch } : l)),
    }));
  }, []);

  const updateLayerWithHistory = useCallback(
    (id: string, patch: Partial<Layer>, label: string) => {
      updateLayer(id, patch);
      setTimeout(() => pushHistory(label), 0);
    },
    [updateLayer, pushHistory]
  );

  const selectLayer = useCallback((id: string | null) => {
    setDoc((d) => ({ ...d, selectedLayerId: id }));
  }, []);

  const deleteLayer = useCallback(
    (id: string) => {
      const target = doc.layers.find((l) => l.id === id);
      if (target?.locked) return;
      setDoc((d) => ({
        ...d,
        layers: d.layers.filter((l) => l.id !== id),
        selectedLayerId: d.selectedLayerId === id ? null : d.selectedLayerId,
      }));
      setTimeout(() => pushHistory("Delete Layer"), 0);
    },
    [doc.layers, pushHistory]
  );

  const duplicateSelectedLayer = useCallback(() => {
    recordStep({ type: "duplicateLayer" });
    setDoc((d) => {
      const idx = d.layers.findIndex((l) => l.id === d.selectedLayerId);
      if (idx < 0) return d;
      const dup = duplicateLayer(d.layers[idx]);
      const layers = [...d.layers];
      layers.splice(idx + 1, 0, dup);
      return { ...d, layers, selectedLayerId: dup.id };
    });
    setTimeout(() => pushHistory("Duplicate Layer"), 0);
  }, [pushHistory]);

  const reorderLayer = useCallback(
    (id: string, toIndex: number) => {
      setDoc((d) => {
        const from = d.layers.findIndex((l) => l.id === id);
        if (from < 0) return d;
        const layers = [...d.layers];
        const [item] = layers.splice(from, 1);
        layers.splice(toIndex, 0, item);
        return { ...d, layers };
      });
      setTimeout(() => pushHistory("Reorder Layer"), 0);
    },
    [pushHistory]
  );

  const setMaskTargetActive = useCallback((active: boolean) => {
    setDoc((d) => ({ ...d, maskTargetActive: active }));
  }, []);

  const addMaskToSelected = useCallback(() => {
    if (!doc.selectedLayerId) return;
    const layer = doc.layers.find((l) => l.id === doc.selectedLayerId);
    if (!layer) return;
    ensureMask(layer);
    setDoc((d) => ({ ...d, maskTargetActive: true }));
    bump();
    setTimeout(() => pushHistory("Add Mask"), 0);
  }, [doc.selectedLayerId, doc.layers, pushHistory, bump]);

  const removeMaskFromSelected = useCallback(() => {
    if (!doc.selectedLayerId) return;
    setDoc((d) => ({
      ...d,
      maskTargetActive: false,
      layers: d.layers.map((l) =>
        l.id === d.selectedLayerId ? { ...l, mask: null } : l
      ),
    }));
    setTimeout(() => pushHistory("Remove Mask"), 0);
  }, [doc.selectedLayerId, pushHistory]);

  // --- Selection operations ---

  const selectAllDoc = useCallback(() => {
    setSelection(selectAll(doc.width, doc.height));
  }, [doc.width, doc.height, setSelection]);

  const deselectAll = useCallback(() => {
    setSelection(emptySelection());
  }, [setSelection]);

  const reselect = useCallback(() => {
    if (lastSelectionRef.current) setSelectionRaw(lastSelectionRef.current);
  }, []);

  const invertSel = useCallback(() => {
    if (!selection.mask) {
      setSelection(selectAll(doc.width, doc.height));
      return;
    }
    setSelection(invertSelection(selection, doc.width, doc.height));
  }, [selection, doc.width, doc.height, setSelection]);

  const selectLayerAlpha = useCallback(() => {
    const layer = doc.layers.find((l) => l.id === doc.selectedLayerId);
    if (!layer) return;
    setSelection(selectFromLayerAlpha(layer, doc.width, doc.height));
  }, [doc.layers, doc.selectedLayerId, doc.width, doc.height, setSelection]);

  const featherSel = useCallback((radius: number) => {
    setSelection(featherSelection(selection, radius, doc.width, doc.height));
  }, [selection, doc.width, doc.height, setSelection]);

  const expandSel = useCallback((px: number) => {
    setSelection(expandSelection(selection, px, doc.width, doc.height));
  }, [selection, doc.width, doc.height, setSelection]);

  const contractSel = useCallback((px: number) => {
    setSelection(contractSelection(selection, px, doc.width, doc.height));
  }, [selection, doc.width, doc.height, setSelection]);

  // --- Clipboard (copy/cut/paste of selection pixels) ---
  // Stored on a ref: pasting shouldn't trigger re-renders on its own, and the
  // payload is a live canvas (not snapshot-friendly).
  const clipboardRef = useRef<{ canvas: HTMLCanvasElement; x: number; y: number } | null>(null);
  const [hasClipboard, setHasClipboard] = useState(false);

  const copySelection = useCallback(() => {
    if (!selectedLayer || selectedLayer.kind !== "raster" || !selection.mask) return;
    const clip = extractSelectionFromLayer(selectedLayer, selection, doc.width, doc.height);
    if (!clip) return;
    clipboardRef.current = clip;
    setHasClipboard(true);
  }, [selectedLayer, selection, doc.width, doc.height]);

  const cutSelection = useCallback(() => {
    if (!selectedLayer || selectedLayer.locked || selectedLayer.kind !== "raster" || !selection.mask) return;
    const clip = extractSelectionFromLayer(selectedLayer, selection, doc.width, doc.height);
    if (!clip) return;
    clipboardRef.current = clip;
    setHasClipboard(true);
    eraseSelectionFromLayer(selectedLayer, selection);
    bump();
    setTimeout(() => pushHistory("Cut"), 0);
  }, [selectedLayer, selection, doc.width, doc.height, bump, pushHistory]);

  const pasteSelection = useCallback(() => {
    const clip = clipboardRef.current;
    if (!clip) return;
    const layer = createRasterLayer({
      name: "Pasted",
      width: clip.canvas.width,
      height: clip.canvas.height,
      docWidth: doc.width,
      docHeight: doc.height,
      x: clip.x,
      y: clip.y,
    });
    // Draw the clipboard pixels at 1:1 into the new layer.
    layer.canvas.getContext("2d")!.drawImage(clip.canvas, 0, 0);
    setDoc((d) => ({
      ...d,
      layers: [...d.layers, layer],
      selectedLayerId: layer.id,
    }));
    setTimeout(() => pushHistory("Paste"), 0);
  }, [doc.width, doc.height, pushHistory]);

  // --- canvas/image size ---

  const applyCanvasSize = useCallback(
    (w: number, h: number, anchor: Parameters<typeof resizeCanvasSize>[3]) => {
      recordStep({ type: "canvasSize", width: w, height: h, anchor });
      setDoc((d) => resizeCanvasSize(d, w, h, anchor));
      setTimeout(() => pushHistory("Canvas Size"), 0);
    },
    [pushHistory, recordStep]
  );

  const applyCrop = useCallback(
    (x: number, y: number, w: number, h: number) => {
      if (w < 1 || h < 1) return;
      recordStep({ type: "canvasSize", width: Math.round(w), height: Math.round(h), anchor: "tl" });
      setDoc((d) => cropDocument(d, x, y, w, h));
      setSelection(emptySelection());
      setTimeout(() => pushHistory("Crop"), 0);
    },
    [pushHistory, recordStep, setSelection]
  );

  const applyImageSize = useCallback(
    (w: number, h: number) => {
      recordStep({ type: "imageSize", width: w, height: h });
      setDoc((d) => resampleDocument(d, w, h));
      setTimeout(() => pushHistory("Image Size"), 0);
    },
    [pushHistory, recordStep]
  );

  return {
    doc,
    setDoc,
    tool,
    setTool,
    view,
    setView,
    fitView,
    selection,
    setSelection,
    brush,
    setBrush,
    foreground,
    setForeground,
    background,
    setBackgroundColor,
    gradient,
    setGradient,
    transparencyTheme,
    setTransparencyTheme,
    selectedLayer,
    history,
    historyIndex,
    pushHistory,
    bump,
    dirtyTick,
    // Layer ops
    newDocument,
    addImageLayer,
    addBlankLayer,
    addFillLayer,
    addLayer,
    updateLayer,
    updateLayerWithHistory,
    selectLayer,
    deleteLayer,
    duplicateSelectedLayer,
    reorderLayer,
    // Mask
    setMaskTargetActive,
    addMaskToSelected,
    removeMaskFromSelected,
    // Size
    applyCanvasSize,
    applyImageSize,
    applyCrop,
    // Selection ops
    selectAllDoc,
    deselectAll,
    reselect,
    invertSelection: invertSel,
    selectLayerAlpha,
    featherSel,
    expandSel,
    contractSel,
    // Clipboard
    copySelection,
    cutSelection,
    pasteSelection,
    hasClipboard,
    // History
    undo,
    redo,
    jumpHistory,
    // Recording
    isRecording,
    startRecording,
    stopRecording,
    recordStep,
  };
}

export type EditorAPI = ReturnType<typeof useEditor>;
