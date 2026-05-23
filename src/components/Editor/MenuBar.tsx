import React, { useEffect, useRef, useState } from "react";
import { EditorAPI } from "@/hooks/useEditor";

interface Props {
  api: EditorAPI;
  onNew: () => void;
  onOpen: () => void;
  onExport: () => void;
  onCanvasSize: () => void;
  onImageSize: () => void;
  onCamera: () => void;
  onShare: () => void;
  onOpenFilterGallery: (filterId?: string) => void;
  onOpenAISettings: () => void;
}

type Menu = "file" | "edit" | "image" | "layer" | "select" | "filter" | "view" | null;

export default function MenuBar(p: Props) {
  const [open, setOpen] = useState<Menu>(null);
  const barRef = useRef<HTMLDivElement>(null);

  const closeAndDo = (fn: () => void) => () => {
    setOpen(null);
    fn();
  };

  // Close on click outside or Escape.
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (barRef.current && !barRef.current.contains(e.target as Node)) {
        setOpen(null);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(null);
    };
    window.addEventListener("mousedown", onDown);
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("mousedown", onDown);
      window.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="menubar" ref={barRef}>
      <div className="brand">
        <span className="brand-dot" />
        <span className="brand-name">Pix.</span>
      </div>

      <Menu name="File" open={open === "file"} onOpen={() => setOpen("file")}>
        <Item label="New…" shortcut="⌘N" onClick={closeAndDo(p.onNew)} />
        <Item label="Open…" shortcut="⌘O" onClick={closeAndDo(p.onOpen)} />
        <Item label="Capture from Camera…" onClick={closeAndDo(p.onCamera)} />
        <Sep />
        <Item label="Export As…" shortcut="⌘⇧E" onClick={closeAndDo(p.onExport)} />
        <Item label="Share…" onClick={closeAndDo(p.onShare)} />
      </Menu>

      <Menu name="Edit" open={open === "edit"} onOpen={() => setOpen("edit")}>
        <Item label="Undo" shortcut="⌘Z" onClick={closeAndDo(p.api.undo)} disabled={p.api.historyIndex <= 0} />
        <Item
          label="Redo"
          shortcut="⌘⇧Z"
          onClick={closeAndDo(p.api.redo)}
          disabled={p.api.historyIndex >= p.api.history.length - 1}
        />
        <Sep />
        <Item
          label="Cut"
          shortcut="⌘X"
          onClick={closeAndDo(p.api.cutSelection)}
          disabled={!p.api.selection.mask || !p.api.selectedLayer || p.api.selectedLayer.locked || p.api.selectedLayer.kind !== "raster"}
        />
        <Item
          label="Copy"
          shortcut="⌘C"
          onClick={closeAndDo(p.api.copySelection)}
          disabled={!p.api.selection.mask || !p.api.selectedLayer || p.api.selectedLayer.kind !== "raster"}
        />
        <Item
          label="Paste"
          shortcut="⌘V"
          onClick={closeAndDo(p.api.pasteSelection)}
          disabled={!p.api.hasClipboard}
        />
      </Menu>

      <Menu name="Image" open={open === "image"} onOpen={() => setOpen("image")}>
        <Item label="Canvas Size…" onClick={closeAndDo(p.onCanvasSize)} />
        <Item label="Image Size…" onClick={closeAndDo(p.onImageSize)} />
      </Menu>

      <Menu name="Layer" open={open === "layer"} onOpen={() => setOpen("layer")}>
        <Item label="New Layer" onClick={closeAndDo(p.api.addBlankLayer)} />
        <Item
          label="New Fill Layer (white)…"
          onClick={closeAndDo(() => p.api.addFillLayer("#ffffff", "Background", true))}
        />
        <Item
          label="New Fill Layer (color)…"
          onClick={closeAndDo(() => {
            const input = document.createElement("input");
            input.type = "color";
            input.value = "#1f2937";
            input.oninput = () => p.api.addFillLayer(input.value, "Background", true);
            input.click();
          })}
        />
        <Item
          label="Duplicate Layer"
          onClick={closeAndDo(p.api.duplicateSelectedLayer)}
          disabled={!p.api.selectedLayer}
        />
        <Item
          label="Delete Layer"
          onClick={closeAndDo(() => p.api.selectedLayer && p.api.deleteLayer(p.api.selectedLayer.id))}
          disabled={!p.api.selectedLayer}
        />
        <Sep />
        <Item
          label={p.api.selectedLayer?.mask ? "Delete Mask" : "Add Mask"}
          onClick={closeAndDo(() => {
            if (!p.api.selectedLayer) return;
            if (p.api.selectedLayer.mask) p.api.removeMaskFromSelected();
            else p.api.addMaskToSelected();
          })}
          disabled={!p.api.selectedLayer}
        />
      </Menu>

      <Menu name="Select" open={open === "select"} onOpen={() => setOpen("select")}>
        <Item label="All" shortcut="⌘A" onClick={closeAndDo(p.api.selectAllDoc)} />
        <Item label="Deselect" shortcut="⌘D" onClick={closeAndDo(p.api.deselectAll)} />
        <Item label="Reselect" shortcut="⌘⇧D" onClick={closeAndDo(p.api.reselect)} />
        <Item label="Inverse" shortcut="⌘⇧I" onClick={closeAndDo(p.api.invertSelection)} />
        <Sep />
        <Item
          label="Select Layer Bounds"
          onClick={closeAndDo(p.api.selectLayerAlpha)}
          disabled={!p.api.selectedLayer}
        />
        <Sep />
        <Item
          label="Modify › Expand…"
          onClick={closeAndDo(() => {
            const px = parseFloat(prompt("Expand by (px)", "4") || "0");
            if (px > 0) p.api.expandSel(px);
          })}
        />
        <Item
          label="Modify › Contract…"
          onClick={closeAndDo(() => {
            const px = parseFloat(prompt("Contract by (px)", "4") || "0");
            if (px > 0) p.api.contractSel(px);
          })}
        />
        <Item
          label="Modify › Feather…"
          onClick={closeAndDo(() => {
            const px = parseFloat(prompt("Feather radius (px)", "4") || "0");
            if (px > 0) p.api.featherSel(px);
          })}
        />
      </Menu>

      <Menu name="Filter" open={open === "filter"} onOpen={() => setOpen("filter")}>
        <Item label="Filter Gallery…" shortcut="⌘F" onClick={closeAndDo(() => p.onOpenFilterGallery())} />
        <Sep />
        <Item label="Brightness / Contrast…" onClick={closeAndDo(() => p.onOpenFilterGallery("brightness-contrast"))} />
        <Item label="Levels…" onClick={closeAndDo(() => p.onOpenFilterGallery("levels"))} />
        <Item label="Curves…" onClick={closeAndDo(() => p.onOpenFilterGallery("curves"))} />
        <Item label="Hue / Saturation…" onClick={closeAndDo(() => p.onOpenFilterGallery("hue-saturation"))} />
        <Item label="Color Balance…" onClick={closeAndDo(() => p.onOpenFilterGallery("color-balance"))} />
        <Sep />
        <Item label="Gaussian Blur…" onClick={closeAndDo(() => p.onOpenFilterGallery("gaussian-blur"))} />
        <Item label="Motion Blur…" onClick={closeAndDo(() => p.onOpenFilterGallery("motion-blur"))} />
        <Item label="Unsharp Mask…" onClick={closeAndDo(() => p.onOpenFilterGallery("unsharp-mask"))} />
        <Sep />
        <Item label="Find Edges" onClick={closeAndDo(() => p.onOpenFilterGallery("find-edges"))} />
        <Item label="Emboss…" onClick={closeAndDo(() => p.onOpenFilterGallery("emboss"))} />
        <Item label="Oil Paint…" onClick={closeAndDo(() => p.onOpenFilterGallery("oil-paint"))} />
        <Item label="Rotoscope…" onClick={closeAndDo(() => p.onOpenFilterGallery("rotoscope"))} />
        <Sep />
        <Item label="Clouds…" onClick={closeAndDo(() => p.onOpenFilterGallery("clouds"))} />
        <Item label="Lens Flare…" onClick={closeAndDo(() => p.onOpenFilterGallery("lens-flare"))} />
      </Menu>

      <Menu name="AI" open={open === ("ai" as any)} onOpen={() => setOpen("ai" as any)}>
        <Item label="AI Settings…" onClick={closeAndDo(p.onOpenAISettings)} />
      </Menu>
      <Menu name="View" open={open === "view"} onOpen={() => setOpen("view")}>
        <Item label="Fit to Window" onClick={closeAndDo(() => {
          const stage = document.querySelector(".canvas-stage") as HTMLElement | null;
          if (stage) p.api.fitView(stage.clientWidth, stage.clientHeight);
        })} />
        <Item label="Actual Pixels" onClick={closeAndDo(() => p.api.setView({ ...p.api.view, zoom: 1 }))} />
      </Menu>

      <div className="menubar-spacer" />
      <div className="doc-name">{p.api.doc.name} · {p.api.doc.width} × {p.api.doc.height}</div>
    </div>
  );
}

function Menu({
  name,
  open,
  onOpen,
  children,
}: {
  name: string;
  open: boolean;
  onOpen: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className={`menu ${open ? "is-open" : ""}`} onMouseEnter={onOpen}>
      <button className="menu-trigger" onClick={onOpen}>
        {name}
      </button>
      {open && <div className="menu-pop">{children}</div>}
    </div>
  );
}

function Item({
  label,
  shortcut,
  onClick,
  disabled,
}: {
  label: string;
  shortcut?: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button className="menu-item" disabled={disabled} onClick={onClick}>
      <span>{label}</span>
      {shortcut && <span className="kbd">{shortcut}</span>}
    </button>
  );
}

function Sep() {
  return <div className="menu-sep" />;
}
