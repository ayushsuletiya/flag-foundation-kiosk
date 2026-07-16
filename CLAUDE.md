# Flag Foundation of India — Museum Kiosk

1920×1080 touchscreen kiosk app (Electron + React 18 + TS strict + Vite) reproducing the Figma design
(`figma.com/design/SGS26MDJpekIP2K2HKW65Z/Flag-Foundation`, page "Final Page 3") pixel-perfectly.
Target hardware: Windows, i5 11th gen, 16GB, integrated GPU.

## Commands
- `npm run dev` — vite dev server (browser preview at :5173)
- `npm run dev:electron` — dev inside the Electron kiosk window
- `npm run typecheck` — all three tsconfigs (app/node/electron); MUST pass before commit
- `npm run build` — full production build
- `npm run check:content` — validate data/content.xlsx through the real loader
- `npm run mirror:photos` — download installation Photo URLs into assets (idempotent)

## Iron rules
- **All content comes from `data/content.xlsx`** (client-editable, hot-reloads). Never hardcode copy
  that exists in the Excel. Column mapping is BY HEADER NAME (client may reorder columns).
- **Fixed 1920×1080 coordinate system** (`src/app/Stage.tsx` scales to fit). Positions are literal
  Figma pixels — do not make things responsive.
- **Perf guards (integrated GPU):** no full-screen `backdrop-filter`, never nest backdrop-filters,
  three.js only via lazy import (stays in its own chunk), PNG sequences via `PngSequencePlayer`.
- **Glass system** lives in `src/styles/tokens.css` (extracted from Figma's native GLASS effect via
  plugin API — the REST export drops it). Use the `.glass` classes / `--glass-*` vars, don't invent fills.
- Pixel changes are verified against Figma screenshots (`../figma-refs/` has references).

## Asset drop-in conventions (zero code changes)
- Home bg video → `assets/video/home-bg.mp4` (poster shows until present)
- Monumental intro → `assets/video/monumental-intro-5s.mp4` (plays once → map)
- Map loop video → `assets/video/india-map-loop.mp4` (still image until present)
- Waving flag markers → `assets/sequences/flag-marker/f_0001.png…` (static.png until present)
- Symbol turntables → `assets/sequences/symbols/<slug>/f_0001.png…` (static.png poster)
- History per year → `assets/images/history/<year>/flag.png` (1200×768, 25:16) and
  `bg-1.png` (1920×1080; bg-2+ = 2.5s crossfade loop), `gallery-1..6.png`
- Map backdrop → `assets/map/terrain-render.png` (placement solved in `monumentalGeo.ts`)

## Key user decisions (do not regress)
- Select State overlay: selection highlights only; **Continue** applies.
- Map: **only the selected state renders** (outline, lift, markers); other states = bare render,
  invisible tap targets only. One marker per district (dedupe in render).
- Symbols detail: "Did You Know?" heading is a FIXED label; chevrons page FACTS, not symbols.
- Chakra: virtue list order = Excel spoke order; DYK facts ≤135 chars; wheel drag-spins on its axle;
  Design tab uses 3D dims mode; Flag tab plays the chakra-docks-into-flag animation.
- History year flags/backgrounds: generated placeholders until real art lands (specs baked into them).
- No emoji in filenames. Idle reset (120s) returns home — intended kiosk behavior.

## Geo layer
`src/data/geo/districts.json` maps (state, district) → normalized map coords (affine fit, rms 0.8%).
Hand-correct via `geo-report.json` + README in `src/data/geo/`. Chandigarh has no map shape.

## Gotchas
- Figma MCP `get_metadata` on this file often returns stale/no children (page cache) — use plugin API
  or download_assets rawImages; whole-canvas metadata times out.
- The Figma GLASS effect and image fills don't survive REST export — plugin API only.
- Excel is BINARY: never let two people edit `data/content.xlsx` on parallel branches — merge is
  impossible; coordinate edits and pull first.
