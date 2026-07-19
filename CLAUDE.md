# Flag Foundation of India — Museum Kiosk

1920×1080 touchscreen kiosk app (Electron + React 18 + TS strict + Vite) reproducing the Figma design
(`figma.com/design/SGS26MDJpekIP2K2HKW65Z/Flag-Foundation`, page "Final Page 3") pixel-perfectly.
Target hardware: **ASUS NUC 14 Pro Plus** (NUC14RVSU5), Intel **Core Ultra 5 125H**
(Meteor Lake, 14C/18T), **Intel Arc iGPU** (Xe-LPG, 7 Xe-cores), Windows 11, x64.
Barebone kit — RAM/SSD added separately. **CRITICAL: populate BOTH SO-DIMM slots
(dual-channel DDR5-5600) — the Arc iGPU is bandwidth-bound and runs at ~half GPU
perf on a single stick.** This is a capable iGPU (~2-3× 11th-gen UHD); the three.js
chakra scene + god-ray volumetrics run comfortably at 1080p when dual-channel.

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
  Chakra god-rays recompute every frame (depth pre-pass + shadow map + 512px ray-march) — fine on
  the Arc iGPU, but pause the recompute while the wheel is idle if headroom is ever needed.
- **Glass system** lives in `src/styles/tokens.css` (extracted from Figma's native GLASS effect via
  plugin API — the REST export drops it). Use the `.glass` classes / `--glass-*` vars, don't invent fills.
- Pixel changes are verified against Figma screenshots (`../figma-refs/` has references).

## Asset drop-in conventions (zero code changes)
Assets live in numbered category folders (`assets/0-home`, `1-monumental-flags`,
`2-history-of-tiranga`, `3-ashok-chakra`, `4-national-symbols`, `_shared`) with a
client-facing README.txt in each. Paths are centralized in `src/assets/paths.ts` —
screens never hardcode them.
- **Every `background/` folder is dynamic** (`src/components/DynamicBackground.tsx`):
  `bg.mp4` wins → else `bg-1..5.png` (2+ = 2.5s crossfade) → else `bg.png` → styled
  placeholder. Applies to home, map, select-state, all history years, chakra, both
  symbols stages. Chakra additionally needs `bg.png` kept beside any `bg.mp4`
  (three.js env texture samples the still).
- Monumental intro → `1-monumental-flags/intro/intro.mp4` (plays once → map; poster.png under it)
- Waving flag markers → `1-monumental-flags/map/flag-marker/f_0001.png…` (static.png until present)
- Symbol turntables → `4-national-symbols/turntables/<slug>/f_0001.png…` (static.png poster)
- Symbol DYK close-ups → `4-national-symbols/detail/dyk/<slug>.png` (falls back to static cutout)
- History per year → `2-history-of-tiranga/<year>/flag/flag.png` (1200×768 RGBA, 25:16 —
  the year-flag box ratio, zero crop) + `background/` + `gallery/gallery-1..6.png`
- Map backdrop still placement solved in `monumentalGeo.ts` (`map/background/bg.png`)

## Key user decisions (do not regress)
- Select State overlay: selection highlights only; **Continue** applies.
- Map: **only the selected state renders** (outline, lift, markers); other states = bare render,
  invisible tap targets only. One marker per district (dedupe in render).
- Symbols detail: "Did You Know?" heading is a FIXED label; chevrons page FACTS, not symbols.
- Symbols carousel: 3D ring; press-hold lifts ALL cards into a floating orbit — **finger drag is the
  only thing that spins it** (no auto-spin); release = drop-to-select (nearest-front card wins).
  Turntable sequences play on EVERY card including side thumbnails. **One uniform glass recipe on
  all cards in all states** (no center-card special case, NO persistent halo — user removed it;
  only the transient arrival border-trace + press touch-glow remain).
- Chakra: virtue list order = Excel spoke order; DYK facts ≤135 chars; wheel drag-spins on its axle;
  Design tab uses 3D dims mode; Flag tab plays the chakra-docks-into-flag animation.
- Home → Symbols: **NO transition animation** (user decision 2026-07-19, after two iterations —
  a full home-exit + arrive cinematic was built and then removed entirely; do not reintroduce).
  All 4 home tiles navigate instantly. The symbols screen has no intro either (trail sweep also
  removed): it opens AT REST on the tiger behind a brief 0.9s black fade.
- History year flags/backgrounds: generated placeholders until real art lands (specs baked into them).
- No emoji in filenames. Idle reset (120s) returns home — intended kiosk behavior.

## Pending (next session)
- Wire from the design handoff (`~/Downloads/Design Brief_ Homepage Design-handoff.zip`, unzip →
  `project/assets` + `project/uploads`): india_map_loop / india_map_fx_loop (map base — user picks
  variant), tiranga_bg_loop vs flag_loop (home bg — user picks), flag_timeline_assets (history year
  backgrounds + thumbnails), peacock_kling_loop, quiz q-bg-*.png. Turntable sequences already wired.
- Phase 7: kiosk hardening + Windows/NSIS packaging (autostart, watchdog, soak test).

## Geo layer
`src/data/geo/districts.json` maps (state, district) → normalized map coords (affine fit, rms 0.8%).
Hand-correct via `geo-report.json` + README in `src/data/geo/`. Chandigarh has no map shape.

## Gotchas
- React StrictMode double-mounts in dev: an effect that owns a rAF/timer timeline must gate on
  COMPLETION (ref set when finished), cancel in its OWN cleanup, and restart on re-run. A
  started-guard + external cancel leaves the timeline dead after the simulated unmount (this froze
  the symbols intro mid-fly when entering from Home, where content is already loaded at mount).
- Figma MCP `get_metadata` on this file often returns stale/no children (page cache) — use plugin API
  or download_assets rawImages; whole-canvas metadata times out.
- The Figma GLASS effect and image fills don't survive REST export — plugin API only.
- Excel is BINARY: never let two people edit `data/content.xlsx` on parallel branches — merge is
  impossible; coordinate edits and pull first.
