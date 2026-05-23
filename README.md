# Pix

A full-featured browser-based image editor — layers, masks, non-destructive selections, brushes, gradients, filters, text, shapes, recordable actions, and an optional AI assistant. Runs entirely in the browser; no server, no upload, no account.

## Features

### Document & layers
- Multi-layer documents with independent raster, text, and shape layers
- Per-layer transform (move, scale, rotate), opacity, blend modes, visibility, lock
- Layer masks (luminance-as-alpha) with paintable mask mode
- Drag-reorder layers, duplicate, delete, layer thumbnails
- Snapshot-based undo/redo with a clickable history panel (jump to any point)

### Selections
- Rectangular, elliptical, polygonal lasso, and magic-wand (flood-fill on the composite) selections
- Select All / Deselect / Reselect / Inverse / Select Layer Bounds
- Modify › Expand / Contract / Feather
- Animated marching-ants outline
- **Copy / Cut / Paste** of selection pixels (paste creates a new layer at the source position)

### Painting
- Brush, eraser, paint bucket, and gradient tools
- Adjustable size, hardness, opacity, flow
- Custom brush presets
- Linear / radial / angle / reflected / diamond gradients with reversible color stops
- All paint tools respect the current selection mask
- Eyedropper (samples the live composite)

### Text & shapes
- Editable text layers — font family, weight, size, alignment, color
- Custom font import (loaded fonts persist across sessions)
- Rectangle and ellipse shape layers with fill + stroke

### Filters & adjustments
- Brightness / Contrast, Levels, Curves, Hue / Saturation, Color Balance
- Gaussian Blur, Motion Blur, Unsharp Mask
- Find Edges, Emboss, Oil Paint, Rotoscope
- Clouds, Lens Flare
- Filter Gallery dialog with live preview

### Canvas
- Canvas Size (non-resampling with 9-point anchor) and Image Size (high-quality resample)
- Zoom from 5% → 3200%, pan, fit-to-window, actual-pixels
- Touch / pinch-to-zoom support on mobile

### Import / export
- Open PNG / JPEG / WebP / GIF / BMP / TIFF / PSD
- Camera capture, drag-and-drop, paste-image-from-clipboard
- Export to PNG, JPEG, WebP, GIF, BMP, TIFF, **and layered PSD** (preserves layers, masks, transforms, and blend modes)
- Direct share / download

### Actions
- Record any sequence of edits, save it, and replay on another document — Photoshop-style `.atn`-inspired action panel

### AI assistant (optional)
- Built-in agentic editing surface: describe an edit in natural language and let an assistant apply it as tool calls (add layers, apply filters, transform, etc.)
- Bring-your-own keys via env vars or the in-app settings dialog (stored in `localStorage`, never transmitted to a server you don't control)

### UX
- Collapsible right-rail panels (Properties / Layers / Filters / Actions / History / AI)
- Full keyboard shortcuts (V/M/L/W/B/E/G/I/T/U/C/H/Z, Cmd-Z/Shift+Cmd-Z, Cmd-A/D, Cmd-C/X/V, [ / ] for brush size, X / D for color swap/reset)
- Mobile-aware layout with floating tool / panel drawers

## Stack

Vite + React 18 + TypeScript. Rendering is plain HTML5 Canvas — every layer has its own offscreen canvas and the renderer composites on demand. No WebGL required.

## Running locally

```bash
npm install --legacy-peer-deps
npm run dev      # Vite dev server (port 80 — needs elevated privileges on Windows)
npm run build    # type-check + production build into dist/
npm run preview  # serve the built bundle
```

> `--legacy-peer-deps` is required because `@vitejs/plugin-react`'s peer-deps lag Vite 8.

## Deploy to Launchmatic

[Launchmatic](https://launchmatic.io) deploys any Vite/React static site straight from GitHub. The repo already includes a multi-stage `Dockerfile` (Node build → Nginx serve) and `nginx.conf`, so it works either as a static-site deploy or as a containerized one.

### Option A — Static deploy (recommended)

1. Push this repo to GitHub.
2. In Launchmatic, **New Project → Import from GitHub** and pick this repo.
3. Settings:
   - **Framework preset:** Vite
   - **Build command:** `npm install --legacy-peer-deps && npm run build`
   - **Output directory:** `dist`
   - **Node version:** 20.x
4. (Optional) Add environment variables for the AI assistant — see below.
5. Click **Deploy**. Subsequent pushes to `main` redeploy automatically.

### Option B — Container deploy

The included `Dockerfile` builds with Node and serves with Nginx on port 80.

1. In Launchmatic, **New Project → Docker → From GitHub**.
2. Point it at this repo; no extra configuration is needed — the `Dockerfile` and `nginx.conf` are picked up automatically.
3. Set the exposed port to **80**.
4. Add env vars if needed, then deploy.

### Environment variables

All are optional — Pix runs fully offline without them. The AI panel reads keys at build time via Vite's `import.meta.env`, so they must be prefixed `VITE_` and set on the Launchmatic project **before** the build runs.

| Variable | Purpose |
|---|---|
| `VITE_ANTHROPIC_API_KEY` | Enables the AI assistant (Anthropic / Claude) |
| `VITE_OPENAI_API_KEY` | Enables the AI assistant (OpenAI) |

Users can also paste keys at runtime via the in-app **AI Settings** dialog; those are stored in `localStorage` on their machine only.

### Custom domain

In Launchmatic → **Domains**, add your domain and follow the DNS instructions. Pix is a pure SPA so no rewrites are required beyond the standard `index.html` fallback (already handled by both the static preset and the bundled `nginx.conf`).

## License

MIT.
