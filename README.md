# Pix

A full-featured browser-based image editor — layers, masks, non-destructive selections, brushes, gradients, clone stamp, filters, text, shapes, recordable actions, and an optional AI assistant. Opens and saves layered PSDs. Runs entirely in the browser; no server, no upload, no account.

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
- Modify › Expand / Contract / Feather (proper number-input dialogs, not browser prompts)
- Animated marching-ants outline
- **Copy / Cut / Paste** of selection pixels — paste creates a new layer at the source position and switches to Move so you can immediately drag it
- Polygonal lasso has an in-canvas **Finish / Cancel** action bar (works on touch where there's no double-click)

### Painting
- Brush, eraser, paint bucket, and gradient tools
- **Clone Stamp** — Alt-click to set a source, then paint to copy pixels from there. Aligned mode (the source/dest offset stays consistent across strokes) and a source snapshot taken at stroke start so you can clone near your dest without smearing onto the source.
- Adjustable size, hardness, opacity, flow
- Custom brush presets, including `.abr` (Photoshop brush) import
- Linear, radial, angle, reflected, diamond gradients with reversible color stops
- All paint tools respect the current selection mask
- Eyedropper (samples the live composite)

### Text & shapes
- Editable text layers — font family, weight, size, alignment, color
- Custom font import — `.ttf`, `.otf`, `.woff`, `.woff2` (loaded fonts persist across sessions)
- Rectangle and ellipse shape layers with fill + stroke

### Filters & adjustments
- Brightness / Contrast, Levels, Curves, Hue / Saturation, Color Balance
- Gaussian Blur, Motion Blur, Unsharp Mask
- Find Edges, Emboss, Oil Paint, Rotoscope
- Clouds, Lens Flare
- Filter Gallery dialog with live preview

### Crop
- Drag to define a crop region — the crop is **previewed first** (with rule-of-thirds guides and darkened surround) rather than applied immediately
- Commit with Enter, double-click inside the rect, or the **Apply Crop** button that floats next to the preview; cancel with Escape or the **Cancel** button

### Canvas
- Canvas Size (non-resampling with 9-point anchor) and Image Size (high-quality resample)
- Zoom from 5% → 3200%, pan, fit-to-window, actual-pixels
- Touch / pinch-to-zoom support on mobile
- **Two transparency themes** — classic light checkerboard or a dark variant that blends with the editor UI (View › Transparency: Dark)

### Import / export
- **Open layered PSDs** — preserves per-layer pixels, position, opacity, visibility, blend modes, and masks (groups flattened; smart objects / adjustment layers fall back to the rasterized layer if present)
- Open PNG / JPEG / WebP / GIF / BMP / TIFF
- Camera capture, drag-and-drop, paste-image-from-clipboard
- Export to PNG, JPEG, WebP, GIF, BMP, TIFF, **and layered PSD** (preserves layers, masks, transforms, and blend modes)
- Direct share / download

### Actions
- Record any sequence of edits, save it, and replay on another document — Photoshop-style `.atn`-inspired action panel

### AI assistant (optional)
- Built-in agentic editing surface: describe an edit in natural language and let an assistant apply it as tool calls (add layers, apply filters, transform, generate / edit images, remove background, upscale, etc.)
- Multi-provider — Anthropic (Claude), Google (Gemini), OpenAI, Replicate, Remove.bg
- Bring-your-own keys via env vars or the in-app **AI Settings** dialog (stored in `localStorage`, never transmitted to a server you don't control)
- Per-provider model selection so you can pick e.g. `claude-opus-4-7` vs `claude-sonnet-4-6`

### UX
- Collapsible right-rail panels (AI / Properties / Layers / Filters / Actions / History) — each section remembers whether it was collapsed
- Mobile-aware layout — floating tool / panel / **delete-layer** action buttons, large touch targets for transform handles, all "in-progress, then commit" tools (crop, polygonal lasso) expose explicit on-canvas Apply / Cancel buttons so you don't need a keyboard
- Full keyboard shortcuts (V/M/L/W/B/E/**S** clone/G/I/T/U/C/H/Z, Cmd-Z/Shift+Cmd-Z, Cmd-A/D, Cmd-C/X/V, [ / ] for brush size, X / D for color swap/reset)

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

## Deploy

**Easiest path — one click, no coding, no credit card:**

1. Sign up for a free [Launchmatic](https://launchmatic.io) account.
2. Open the free Pix template: **[app.launchmatic.io/marketplace/pix](https://app.launchmatic.io/marketplace/pix)**
3. Click **Deploy** — you get your own live Pix instance on a `*.apps.launchmatic.io` subdomain with HTTPS, no Dockerfile, no build config, no setup.

Simple, free, awesome.

---

### Advanced — fork & deploy your own variant

Everything below is for users who want to customize the source before deploying. The repo already includes a multi-stage `Dockerfile` (Node build → Nginx serve) and `nginx.conf`, so it works either as a static-site deploy or as a containerized one.

#### Option A — Static deploy (recommended)

1. Push this repo to GitHub.
2. In Launchmatic, **New Project → Import from GitHub** and pick this repo.
3. Settings:
   - **Framework preset:** Vite
   - **Build command:** `npm install --legacy-peer-deps && npm run build`
   - **Output directory:** `dist`
   - **Node version:** 20.x
4. (Optional) Add environment variables for the AI assistant — see below.
5. Click **Deploy**. Subsequent pushes to `main` redeploy automatically.

#### Option B — Container deploy

The included `Dockerfile` builds with Node and serves with Nginx on port 80.

1. In Launchmatic, **New Project → Docker → From GitHub**.
2. Point it at this repo; no extra configuration is needed — the `Dockerfile` and `nginx.conf` are picked up automatically.
3. Set the exposed port to **80**.
4. Add env vars if needed, then deploy.

### Environment variables

All are optional — Pix runs fully offline without them. The AI panel reads keys at build time via Vite's `import.meta.env`, so they must be prefixed `VITE_` and set on the Launchmatic project **before** the build runs. Any of the aliases below work for each provider.

| Provider | Env vars (aliases) |
|---|---|
| Anthropic / Claude | `VITE_ANTHROPIC_API_KEY`, `VITE_CLAUDE_API_KEY` |
| Google / Gemini | `VITE_GEMINI_API_KEY`, `VITE_GOOGLE_API_KEY`, `VITE_NANO_BANANA_API_KEY` |
| OpenAI | `VITE_OPENAI_API_KEY` |
| Replicate | `VITE_REPLICATE_API_KEY`, `VITE_REPLICATE_API_TOKEN` |
| Remove.bg | `VITE_REMOVEBG_API_KEY`, `VITE_REMOVE_BG_API_KEY` |

> **A note on key safety:** `VITE_*` env vars are *baked into the JavaScript bundle at build time*. Anyone who loads your deployed site can extract them from devtools. That's fine for low-risk dev / demo keys, but don't ship a production-billed key this way — proxy through your own server instead, or have users paste their own keys via the in-app **AI Settings** dialog (those stay in their browser's `localStorage` and are never sent anywhere except the matching provider).

### Custom domain

In Launchmatic → **Domains**, add your domain and follow the DNS instructions. Pix is a pure SPA so no rewrites are required beyond the standard `index.html` fallback (already handled by both the static preset and the bundled `nginx.conf`).

## License

MIT.
