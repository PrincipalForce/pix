import React, { useCallback, useEffect, useRef, useState } from "react";
import Canvas from "./components/Editor/Canvas";
import ToolPanel from "./components/Editor/ToolPanel";
import LayersPanel from "./components/Editor/LayersPanel";
import HistoryPanel from "./components/Editor/HistoryPanel";
import ActionsPanel from "./components/Editor/ActionsPanel";
import AIPanel from "./components/Editor/AIPanel";
import AISettingsDialog from "./components/UI/AISettingsDialog";
import Splash from "./components/UI/Splash";
import CollapsibleSection from "./components/UI/CollapsibleSection";
import { Settings as SettingsIcon } from "lucide-react";
import FilterPanel from "./components/Editor/FilterPanel";
import PropertiesPanel from "./components/Editor/PropertiesPanel";
import OptionsBar from "./components/Editor/OptionsBar";
import MenuBar from "./components/Editor/MenuBar";
import NewDocumentDialog from "./components/UI/NewDocumentDialog";
import CanvasSizeDialog from "./components/UI/CanvasSizeDialog";
import ImageSizeDialog from "./components/UI/ImageSizeDialog";
import ExportDialog from "./components/UI/ExportDialog";
import FilterGalleryDialog from "./components/UI/FilterGalleryDialog";
import ShareDialog from "./components/UI/ShareDialog";
import CameraCapture from "./components/UI/CameraCapture";
import ImageUpload from "./components/UI/ImageUpload";
import { useEditor } from "./hooks/useEditor";
import { Tool } from "./types/editor";
import { createTextLayer, createShapeLayer, renderTextLayer } from "./lib/document";
import { Menu, PanelRight, Layers as LayersIcon, X, Trash2 } from "lucide-react";
import { rehydrateCustomFonts } from "./lib/fonts";
import { importPsdFile } from "./lib/importPsd";

const SHORTCUTS: Record<string, Tool> = {
  v: "move",
  m: "marquee-rect",
  l: "lasso-polygon",
  w: "magic-wand",
  b: "brush",
  e: "eraser",
  s: "clone",
  g: "fill",
  i: "eyedropper",
  t: "text",
  u: "shape-rect",
  c: "crop",
  h: "hand",
  z: "zoom",
};

export default function App() {
  const api = useEditor();
  const canvasOutRef = useRef<HTMLCanvasElement | null>(null);

  const [showNew, setShowNew] = useState(false);
  const [showCanvasSize, setShowCanvasSize] = useState(false);
  const [showImageSize, setShowImageSize] = useState(false);
  const [showExport, setShowExport] = useState(false);
  const [showShare, setShowShare] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [mobileTools, setMobileTools] = useState(false);
  const [mobilePanels, setMobilePanels] = useState(false);
  const [galleryFilterId, setGalleryFilterId] = useState<string | null>(null);
  const [galleryOpen, setGalleryOpen] = useState(false);
  const [showAISettings, setShowAISettings] = useState(false);
  // When we handle Cmd+V via the keyboard shortcut, the browser still fires a
  // `paste` event right after. Without this gate, an old OS-clipboard image
  // would get pasted in addition to our internal selection paste.
  const suppressNextPasteRef = useRef(false);

  const openGallery = useCallback((filterId?: string) => {
    setGalleryFilterId(filterId ?? null);
    setGalleryOpen(true);
  }, []);

  // Restore any custom fonts the user imported in a previous session.
  useEffect(() => {
    void rehydrateCustomFonts();
  }, []);

  const openFile = useCallback(
    (file: File) => {
      const lower = file.name.toLowerCase();
      const isPsd =
        lower.endsWith(".psd") ||
        file.type === "image/vnd.adobe.photoshop" ||
        file.type === "application/x-photoshop";
      if (isPsd) {
        // PSD — parse layers via ag-psd and replace the current document.
        importPsdFile(file)
          .then((newDoc) => {
            api.setDoc(newDoc);
            setTimeout(() => api.pushHistory(`Open ${file.name}`), 0);
          })
          .catch((err) => {
            console.error("PSD import failed:", err);
            alert(
              "Couldn't open this PSD. The file may use features Pix doesn't yet support (smart objects, adjustment layers, etc.). Try flattening in Photoshop and re-exporting."
            );
          });
        return;
      }
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => api.addImageLayer(img, file.name);
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(file);
    },
    [api]
  );

  const onCameraCapture = useCallback(
    (src: string) => {
      const img = new Image();
      img.onload = () => api.addImageLayer(img, "Camera capture");
      img.src = src;
      setShowCamera(false);
    },
    [api]
  );

  // Keyboard shortcuts
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      if (e.ctrlKey || e.metaKey) {
        if (e.key.toLowerCase() === "z") {
          e.preventDefault();
          if (e.shiftKey) api.redo();
          else api.undo();
          return;
        }
        if (e.key.toLowerCase() === "d") {
          e.preventDefault();
          if (e.shiftKey) api.reselect();
          else api.deselectAll();
          return;
        }
        if (e.key.toLowerCase() === "a" && !e.shiftKey) {
          e.preventDefault();
          api.selectAllDoc();
          return;
        }
        if (e.key.toLowerCase() === "i" && e.shiftKey) {
          e.preventDefault();
          api.invertSelection();
          return;
        }
        if (e.key.toLowerCase() === "c" && !e.shiftKey && !e.altKey) {
          // Only hijack when we have an active selection — otherwise let the
          // browser handle normal text-copy.
          if (api.selection.mask) {
            e.preventDefault();
            api.copySelection();
            return;
          }
        }
        if (e.key.toLowerCase() === "x" && !e.shiftKey && !e.altKey) {
          if (api.selection.mask) {
            e.preventDefault();
            api.cutSelection();
            return;
          }
        }
        if (e.key.toLowerCase() === "v" && !e.shiftKey && !e.altKey) {
          if (api.hasClipboard) {
            e.preventDefault();
            suppressNextPasteRef.current = true;
            api.pasteSelection();
            return;
          }
        }
        if (e.key.toLowerCase() === "e" && e.shiftKey) {
          e.preventDefault();
          setShowExport(true);
          return;
        }
        if (e.key.toLowerCase() === "f") {
          e.preventDefault();
          openGallery();
          return;
        }
        return;
      }
      // Shift+G cycles fill ↔ gradient (Photoshop convention).
      if (e.key.toLowerCase() === "g" && e.shiftKey) {
        api.setTool(api.tool === "gradient" ? "fill" : "gradient");
        return;
      }
      const tool = SHORTCUTS[e.key.toLowerCase()];
      if (tool) {
        api.setTool(tool);
        return;
      }
      if (e.key === "[") api.setBrush({ ...api.brush, size: Math.max(1, api.brush.size - 2) });
      if (e.key === "]") api.setBrush({ ...api.brush, size: Math.min(500, api.brush.size + 2) });
      if (e.key === "x") {
        const fg = api.foreground;
        api.setForeground(api.background);
        api.setBackgroundColor(fg);
      }
      if (e.key === "d" && !e.ctrlKey && !e.metaKey) {
        api.setForeground("#000000");
        api.setBackgroundColor("#ffffff");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [api]);

  // Paste from clipboard
  useEffect(() => {
    const onPaste = (e: ClipboardEvent) => {
      // Our keyboard shortcut just handled an internal selection paste — don't
      // also paste from the OS clipboard.
      if (suppressNextPasteRef.current) {
        suppressNextPasteRef.current = false;
        return;
      }
      const items = e.clipboardData?.items;
      if (!items) return;
      for (let i = 0; i < items.length; i++) {
        if (items[i].type.startsWith("image/")) {
          const file = items[i].getAsFile();
          if (file) openFile(file);
          return;
        }
      }
    };
    window.addEventListener("paste", onPaste);
    return () => window.removeEventListener("paste", onPaste);
  }, [openFile]);

  // Drag-drop a file anywhere
  useEffect(() => {
    const onDragOver = (e: DragEvent) => e.preventDefault();
    const onDrop = (e: DragEvent) => {
      e.preventDefault();
      const f = e.dataTransfer?.files?.[0];
      if (f && f.type.startsWith("image/")) openFile(f);
    };
    window.addEventListener("dragover", onDragOver);
    window.addEventListener("drop", onDrop);
    return () => {
      window.removeEventListener("dragover", onDragOver);
      window.removeEventListener("drop", onDrop);
    };
  }, [openFile]);

  // Handle Tool=text on click — open a text layer in the center
  const onClickAddText = useCallback(() => {
    const layer = createTextLayer(
      {
        text: "Type here",
        fontFamily: "Inter",
        fontSize: 64,
        fontWeight: 700,
        color: api.foreground,
        align: "left",
      },
      api.doc.width,
      api.doc.height
    );
    api.addLayer(layer, "Text Layer");
    api.setTool("move");
  }, [api]);

  const onClickAddShape = useCallback(
    (kind: "rect" | "ellipse") => {
      const w = 300;
      const h = kind === "rect" ? 200 : 300;
      const layer = createShapeLayer(
        { kind, fill: api.foreground, stroke: null, strokeWidth: 0 },
        {
          x: Math.round(api.doc.width / 2 - w / 2),
          y: Math.round(api.doc.height / 2 - h / 2),
          width: w,
          height: h,
        }
      );
      api.addLayer(layer, kind === "rect" ? "Rectangle" : "Ellipse");
      api.setTool("move");
    },
    [api]
  );

  // When user picks text/shape tool, drop a default layer once
  useEffect(() => {
    if (api.tool === "text") onClickAddText();
    if (api.tool === "shape-rect") onClickAddShape("rect");
    if (api.tool === "shape-ellipse") onClickAddShape("ellipse");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [api.tool]);

  return (
    <div className="app">
      <Splash />
      <MenuBar
        api={api}
        onNew={() => setShowNew(true)}
        onOpen={() => document.getElementById("file-open-trigger")?.click()}
        onExport={() => setShowExport(true)}
        onCanvasSize={() => setShowCanvasSize(true)}
        onImageSize={() => setShowImageSize(true)}
        onCamera={() => setShowCamera(true)}
        onShare={() => setShowShare(true)}
        onOpenFilterGallery={openGallery}
        onOpenAISettings={() => setShowAISettings(true)}
      />
      <OptionsBar api={api} />

      <div className="workspace">
        {/* Backdrop closes any open mobile sheet */}
        {(mobileTools || mobilePanels) && (
          <div
            className="mobile-backdrop"
            onClick={() => {
              setMobileTools(false);
              setMobilePanels(false);
            }}
          />
        )}
        <div className={`tool-rail-wrap ${mobileTools ? "is-open" : ""}`}>
        <ToolPanel
          selectedTool={api.tool}
          onToolSelect={api.setTool}
          foreground={api.foreground}
          background={api.background}
          onSwapColors={() => {
            const fg = api.foreground;
            api.setForeground(api.background);
            api.setBackgroundColor(fg);
          }}
          onResetColors={() => {
            api.setForeground("#000000");
            api.setBackgroundColor("#ffffff");
          }}
          onForegroundClick={() => {
            const inp = document.getElementById("fg-color-trigger") as HTMLInputElement | null;
            inp?.click();
          }}
        />
        </div>

        <input
          id="fg-color-trigger"
          type="color"
          value={api.foreground}
          onChange={(e) => {
            api.setForeground(e.target.value);
            api.setBrush({ ...api.brush, color: e.target.value });
          }}
          style={{ position: "absolute", visibility: "hidden", pointerEvents: "none" }}
        />

        <div className="stage-wrap">
          <Canvas api={api} canvasOutRef={canvasOutRef} />
        </div>

        <aside className={`right-rail ${mobilePanels ? "is-open" : ""}`}>
          <button
            className="rail-close"
            onClick={() => setMobilePanels(false)}
            aria-label="Close panels"
          >
            <X size={16} />
          </button>
          <CollapsibleSection
            id="ai"
            title="AI Assistant"
            actions={
              <button
                className="icon-btn"
                onClick={() => setShowAISettings(true)}
                title="AI Settings"
              >
                <SettingsIcon size={14} />
              </button>
            }
          >
            <AIPanel api={api} onOpenSettings={() => setShowAISettings(true)} />
          </CollapsibleSection>
          <CollapsibleSection id="properties" title="Properties">
            <PropertiesPanel api={api} />
          </CollapsibleSection>
          <CollapsibleSection id="layers" title="Layers">
            <LayersPanel api={api} />
          </CollapsibleSection>
          <CollapsibleSection id="filters" title="Filters" defaultCollapsed>
            <FilterPanel api={api} onOpenGallery={openGallery} />
          </CollapsibleSection>
          <CollapsibleSection id="actions" title="Actions" defaultCollapsed>
            <ActionsPanel api={api} />
          </CollapsibleSection>
          <CollapsibleSection id="history" title="History" defaultCollapsed>
            <HistoryPanel api={api} />
          </CollapsibleSection>
        </aside>
      </div>

      {/* Mobile-only floating action buttons */}
      <button
        className="fab fab-tools"
        onClick={() => {
          setMobileTools((v) => !v);
          setMobilePanels(false);
        }}
        title="Tools"
      >
        <Menu size={20} />
      </button>
      <button
        className="fab fab-panels"
        onClick={() => {
          setMobilePanels((v) => !v);
          setMobileTools(false);
        }}
        title="Layers / properties"
      >
        <LayersIcon size={20} />
      </button>
      <button
        className="fab fab-trash"
        onClick={() => {
          if (api.selectedLayer) api.deleteLayer(api.selectedLayer.id);
        }}
        disabled={!api.selectedLayer}
        title={api.selectedLayer ? `Delete "${api.selectedLayer.name}"` : "No layer selected"}
        aria-label="Delete selected layer"
      >
        <Trash2 size={20} />
      </button>

      {/* hidden input used by File > Open */}
      <input
        id="file-open-trigger"
        type="file"
        accept=".png,.jpg,.jpeg,.webp,.gif,.bmp,.tif,.tiff,.psd,image/*"
        style={{ display: "none" }}
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) openFile(f);
          (e.target as HTMLInputElement).value = "";
        }}
      />

      {showNew && (
        <NewDocumentDialog
          onClose={() => setShowNew(false)}
          onCreate={(w, h, bg, name) => api.newDocument(w, h, bg, name)}
        />
      )}
      {showCanvasSize && (
        <CanvasSizeDialog
          width={api.doc.width}
          height={api.doc.height}
          onClose={() => setShowCanvasSize(false)}
          onApply={(w, h, a) => api.applyCanvasSize(w, h, a)}
        />
      )}
      {showImageSize && (
        <ImageSizeDialog
          width={api.doc.width}
          height={api.doc.height}
          onClose={() => setShowImageSize(false)}
          onApply={(w, h) => api.applyImageSize(w, h)}
        />
      )}
      {showExport && <ExportDialog api={api} onClose={() => setShowExport(false)} />}
      {showShare && <ShareDialog api={api} onClose={() => setShowShare(false)} />}
      {showCamera && <CameraCapture onCapture={onCameraCapture} onClose={() => setShowCamera(false)} />}
      {galleryOpen && (
        <FilterGalleryDialog
          api={api}
          initialFilterId={galleryFilterId ?? undefined}
          onClose={() => setGalleryOpen(false)}
        />
      )}
      {showAISettings && <AISettingsDialog onClose={() => setShowAISettings(false)} />}
    </div>
  );
}
