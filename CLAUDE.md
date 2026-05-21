# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

- `npm run dev` — Vite dev server (port 80 per `vite.config.ts`; may need elevated privileges).
- `npm run build` — `tsc && vite build`. Build fails on any TS error.
- `npm run preview` / `npm start` — serve the production build.
- Docker: `docker build .` → Node multi-stage build → Nginx (see `Dockerfile` + `nginx.conf`).

No test runner or linter is configured.

When installing new packages, use `npm install --legacy-peer-deps` — `@vitejs/plugin-react` peer-deps lag Vite 8 and a strict install will refuse otherwise.

## Architecture

Vite + React 18 + TypeScript SPA. Path alias `@` → `/src` (`vite.config.ts`).

The editor is built around an in-memory **document model with per-layer offscreen canvases** rather than one shared canvas. The renderer composites layers on demand; the viewport `<canvas>` is the display surface only.

### Core domain (`src/types/editor.ts`, `src/lib/`)

- **`DocumentState`** — width/height, background (`transparent`|`white`|`black`|hex), `layers: Layer[]`, `selectedLayerId`, `maskTargetActive` (whether brush paints the layer's mask or its pixels).
- **`Layer`** — own `HTMLCanvasElement`, plus optional `mask: HTMLCanvasElement` (luminance-as-alpha at render time), `kind: raster|text|shape`, transform (`x`, `y`, `width`, `height`, `rotation` radians), `blendMode`, `opacity`, kind-specific `text`/`shape` props.
- **`Viewport`** — `zoom`, `panX`, `panY`; viewport→doc conversion in `lib/render.ts:viewportToDoc`.
- **`Selection`** — doc-sized alpha mask canvas + bounds. `null` mask = no selection (operate on whole layer).
- **`HistoryEntry`** — full `DocumentSnapshot` (layer canvases serialized to PNG data URLs in `lib/document.ts:snapshotDocument`). Undo/redo restore via `restoreDocument` which decodes PNGs back into canvases. This handles `HTMLCanvasElement`/`ImageData` round-trips that JSON cloning cannot.

### `src/lib/` modules

- `canvas.ts` — `createCanvas`, `cloneCanvas`, `ctx2d`, `canvasToBlob` (every other module uses these instead of inline DOM canvas plumbing).
- `document.ts` — factories (`createRasterLayer`, `createTextLayer`, `createShapeLayer`), `ensureMask`, `resizeCanvasSize` (non-resampling, with 9-point anchor), `resampleDocument` (high-quality resample of all layers + masks), and the snapshot/restore pair.
- `render.ts` — `compositeDocument` (produces a doc-sized canvas: per-layer rasterize → mask via luminance-to-alpha → translate/rotate by layer transform → composite with `globalCompositeOperation = blendMode`), `renderViewport` (paints checkerboard, doc shadow, composite, doc border into the viewport canvas with zoom/pan applied), `renderLayerThumbnail`, `renderMaskThumbnail`.
- `brush.ts` — `paintSegment` converts doc-space stroke segments into layer-local coords (handles rotation + width/height-vs-canvas-px scaling), draws onto a scratch, optionally clips with the selection mask transformed to layer-local space, then composites onto either `layer.canvas` (paint/erase) or `layer.mask` (mask edit mode). `fillLayer` for paint-bucket.
- `selection.ts` — `rectSelection`, `ellipseSelection`, `polygonSelection`, `magicWandSelection` (flood-fill on a composited snapshot with squared color+alpha tolerance). All return a doc-sized white-on-transparent mask. `drawSelectionAnts` renders marching ants in doc space (caller is expected to have applied the doc transform).
- `cursors.ts` — `cursorFor(tool, {brushRadiusPx})` returns a CSS `cursor:` value. Brush/eraser cursors are inline SVG sized to the brush in viewport pixels (so they scale with zoom).
- `export.ts` — `exportDocument(doc, opts)` for PNG/JPEG/WebP via `toBlob`; BMP via hand-rolled 24-bit encoder; GIF via `gifenc` (palette quantize + apply); TIFF via `utif`; PSD via `ag-psd` (each layer rasterized at doc resolution × scale, transform baked in, mask serialized as-is, blend modes mapped to Photoshop names).

### State (`src/hooks/useEditor.ts`)

A single `useEditor` hook owns everything: `doc`, `tool`, `view`, `selection`, `brush`, foreground/background colors, history. **`api.bump()`** is critical — because brush strokes mutate `layer.canvas` in place, React doesn't notice; tools call `bump()` to force re-render via a `dirtyTick` counter. The selected layer is derived (`useMemo`), not stored.

History is snapshot-based with a `HISTORY_LIMIT`. `pushHistory(label)` is called after operations complete (often via `setTimeout(..., 0)` to ensure the latest `doc` is captured). `jumpHistory(i)` lets the History panel restore arbitrary entries.

### Components (`src/components/`)

- `Editor/Canvas.tsx` — the only file with raw pointer-event logic. Branches on `api.tool` per `pointerdown`/`pointermove`/`pointerup`. Implements layer hit-testing (alpha-aware), free-transform handles + rotation, marquee live-preview, lasso point capture with double-click commit, paint stroke loop, zoom-around-cursor wheel handling.
- `Editor/ToolPanel.tsx` — left rail. Tool sections + foreground/background color chips. Uses lucide-react icons.
- `Editor/OptionsBar.tsx` — context-sensitive top strip (brush size/hardness/opacity/flow when brush, zoom % everywhere).
- `Editor/PropertiesPanel.tsx` — Photoshop-style right-side Properties. Sections appear based on selected tool and/or layer kind (transform always, text props for text layers, shape fill/stroke for shape layers, mask controls when a mask exists).
- `Editor/LayersPanel.tsx` — thumbnails rendered via `renderLayerThumbnail`, drag-reorder (HTML5 DnD), mask thumbnail toggles `maskTargetActive`, lock/visibility.
- `Editor/HistoryPanel.tsx` — clickable history with current-entry highlight; calls `api.jumpHistory(i)`.
- `Editor/FilterPanel.tsx` — adjustments operate on `layer.canvas` in place via `utils/filters.ts:applyBasicFilterToCanvas`, then `bump()` + `pushHistory()`.
- `Editor/MenuBar.tsx` — File/Edit/Image/Layer/View menus. Opens dialogs.
- `UI/*Dialog.tsx` — all dialogs are children of `UI/Modal.tsx` (scrim + Esc closes).

### Add a new tool

1. Add to the `Tool` union in `types/editor.ts` and to `SHORTCUTS` in `App.tsx`.
2. Add a button + lucide icon in `ToolPanel.tsx` (sections array).
3. Add pointer-down/move/up branches in `Canvas.tsx`.
4. (Optional) Add an Options-bar field group in `OptionsBar.tsx` and Properties section in `PropertiesPanel.tsx`.
5. Add a cursor case in `cursors.ts`.

### Add a new export format

Add the case to `exportDocument` in `src/lib/export.ts`, declare it in `FORMATS` in `ExportDialog.tsx`, and update `formatExt` / `formatSupportsAlpha` if needed.

## Gotchas

- `port 80` in `vite.config.ts` typically requires admin on Windows.
- The Vite build warns that ag-psd externalizes Node's `util` — harmless for the `writePsd` path we use.
- `bump()` is required after any in-place canvas mutation; forgetting it leaves the UI stale until another state change triggers a re-render.
- `pushHistory` snapshots the *current* `doc` state, so when called immediately after `setDoc`, wrap it in `setTimeout(_, 0)` (or call it in an effect) to capture the post-update snapshot.
- Layer transform width/height can differ from `layer.canvas.width/height`; the renderer and brush both scale accordingly.
