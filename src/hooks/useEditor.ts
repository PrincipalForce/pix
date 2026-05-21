import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BrushSettings,
  DocumentState,
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
import { emptySelection } from "@/lib/selection";
import { fitViewport } from "@/lib/render";

const HISTORY_LIMIT = 60;

export function useEditor() {
  const [doc, setDoc] = useState<DocumentState>(() =>
    createBlankDocument(1280, 800, "transparent", "Untitled-1")
  );
  const [tool, setTool] = useState<Tool>("move");
  const [view, setView] = useState<Viewport>({ zoom: 1, panX: 0, panY: 0 });
  const [selection, setSelection] = useState<Selection>(emptySelection());
  const [brush, setBrush] = useState<BrushSettings>({
    size: 24,
    hardness: 0.85,
    color: "#000000",
    opacity: 1,
    flow: 1,
  });
  const [foreground, setForeground] = useState("#111827");
  const [background, setBackgroundColor] = useState("#ffffff");

  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [historyIndex, setHistoryIndex] = useState(-1);
  const restoringRef = useRef(false);
  const tickRef = useRef(0);

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

  // --- canvas/image size ---

  const applyCanvasSize = useCallback(
    (w: number, h: number, anchor: Parameters<typeof resizeCanvasSize>[3]) => {
      setDoc((d) => resizeCanvasSize(d, w, h, anchor));
      setTimeout(() => pushHistory("Canvas Size"), 0);
    },
    [pushHistory]
  );

  const applyImageSize = useCallback(
    (w: number, h: number) => {
      setDoc((d) => resampleDocument(d, w, h));
      setTimeout(() => pushHistory("Image Size"), 0);
    },
    [pushHistory]
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
    // History
    undo,
    redo,
    jumpHistory,
  };
}

export type EditorAPI = ReturnType<typeof useEditor>;
