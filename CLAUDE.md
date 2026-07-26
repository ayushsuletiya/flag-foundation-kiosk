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
  Chakra god-rays (depth pre-pass + shadow map + 512px ray-march + 48-tap streak) are CACHED in
  an offscreen RT and recomputed only when the pose moves — throttled to 1-in-3 frames for the
  slow idle spin / cloth breeze, 0 frames at rest, every frame only during fast transitions —
  then blitted under the wheel each frame (Chakra3D lightRT/blitScene). Running the full-screen
  volumetric every frame saturated the Arc iGPU and delayed touch (fixed 2026-07-21). Keep the
  blit `toneMapped:false` + lightRT `NoColorSpace` or the cached glow shifts/blows out.
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
- Monumental Flags opens straight on the map (intro video removed — user decision).
- Waving flag markers → `1-monumental-flags/map/flag-marker/f_0001.png…` (static.png until present)
- Symbol turntables → `4-national-symbols/turntables/<slug>/f_0001.png…` (static.png poster)
- Symbol DYK close-ups → `4-national-symbols/detail/dyk/<slug>.png` (falls back to static cutout)
- History per year → `2-history-of-tiranga/<year>/flag/flag.png` (1200×768 RGBA, 25:16 —
  the year-flag box ratio, zero crop) + `background/` + `gallery/gallery-1..6.png`
- Map backdrop still placement solved in `monumentalGeo.ts` (`map/background/bg.png`)

## Key user decisions (do not regress)
- Select State overlay: selection highlights only; **Continue** applies.
- Map: **only the selected state renders** (outline, lift, markers); other states = bare render.
  Only states WITH installations are tap targets — states with zero Excel data are UNTOUCHABLE
  (pointer-events:none) and omitted from the Select State grid (user 2026-07-25: tapping a no-data
  state used to bounce the map to the first Excel state, Andaman & Nicobar). Long state names use
  `stateShortLabel()` (schema.ts) in the pills/chips — e.g. "Andaman & Nicobar" (fits the pill).
  One marker per district (dedupe in render).
- Symbols detail: "Did You Know?" heading is a FIXED label; chevrons page FACTS, not symbols.
- Symbols carousel: 3D ring; press-hold lifts ALL cards into a floating orbit — **finger drag is the
  only thing that spins it** (no auto-spin); release = drop-to-select (nearest-front card wins).
  Turntable sequences play on EVERY card including side thumbnails. **One uniform glass recipe on
  all cards in all states** (no center-card special case, NO persistent halo — user removed it;
  only the transient arrival border-trace + press touch-glow remain).
- Chakra: virtue list order = Excel spoke order; DYK facts ≤135 chars; wheel drag-spins on its axle;
  Design tab uses 3D dims mode; Flag tab plays the chakra-docks-into-flag animation.
- Chakra tabs share ONE PERSISTENT Chakra3D scene (user 2026-07-20: the wheel must never
  disappear between pills). Canvas = .ck-wheel-stage 961×1608 at stage (449,183); every camera
  constant in Chakra3D is derived for that exact box — do not move/resize it or remount the
  scene per tab. Pill switches re-pose the scene live: camera TWEENS values↔design, dims
  callouts FADE (the build-from-nothing assembly no longer plays on tab switches), and the
  flag dock plays forward into the flag and in REVERSE back out of it.
- Chakra section ENTRANCE (user 2026-07-20; TIGHTENED for snappiness 2026-07-25): arriving from
  outside /chakra → a short background beat (250ms — the sunset keeps fading in UNDER the roll) →
  the finished wheel ROLLS in from stage left (Chakra3D entrance="roll": the scene drives the
  .ck-wheel box translateX AND the axle spin from one remaining-travel number, so it never slips),
  settles with a small rock-back → chrome rises in staggered. `ROLL_MS` is **1500** (user
  2026-07-26: "slow the speed of chakra entrance"). It had been cut 1800→1000 on 2026-07-25 for
  "too lazy, black screen for ~2s" — but that complaint was the BLACK SCREEN, not the pace; with
  the stage warm from frame 1 and the roll no longer losing its opening frames to shader compile,
  the slower travel reads as graceful. Don't go back above 1800. The roll's clock starts only once
  a frame has rendered AND the GLSL programs are linked (Chakra3D `programsReady`, 1500ms backstop)
  so the whole travel is spent on screen instead of being eaten by the lazy compile. The reveal is
  gated on onRollDone with a **3400ms** wall-clock fallback (was 7000, then 2600) — it must stay
  past the worst-case hold+roll or it raises the chrome mid-travel. Any touch
  skips; in-section tab hops never replay it (gated on navTrace previousPathname, like History).
  NO BLACK DIP (user 2026-07-25: "why that fucking black screen comes"). Two causes were killed:
  (1) the .ck-screen / .ck-intro-hold base is the sunset gradient SAMPLED from bg.png (warm amber,
  not the old near-black #241205), so any cold-load gap reads as the sunset already there;
  (2) the chakra <DynamicBackground fadeIn={false}> paints the (pre-warmed) sunset at opacity 1 on
  the first frame instead of the 600ms `.dbg-enter` fade-up-from-black. Entrance dressing: the
  sunset shows BARE while the wheel travels (no scrim, brightness 1.14), scrim eases back at reveal;
  the roll waits for the background to be ready (useDynamicBackground).
  Background blur is PROGRESSIVE (user 2026-07-20): sharp plate + a blur(7px) copy in
  .ck-bg-blur gradient-masked to die out by the ground — sky soft, sea/shore crisp.
- Page transitions: a **CROSS-DISSOLVE** handled centrally in `AnimatedRoutes` (App.tsx). The
  arriving page fades in (`.page-enter`, 300ms opacity) ON TOP of the outgoing page, which is kept
  fully painted underneath (a stack of live pages keyed by transitionKey) until the fade finishes —
  so a completed page is ALWAYS on screen and the transition never dips through the stage/black
  (user 2026-07-25, hard req). Both trees are briefly alive (~300ms) — keep the fade short (iGPU).
  Do NOT go back to a one-sided fade over the stage, and do NOT re-add a home-leave opacity fade:
  the tile onClick calls navigate() immediately (only feedback is the tile :active press,
  `.home-tile:active` scale 0.96) — the cross-dissolve does the visual hand-off. (Superseded the
  2026-07-19 "instant, no animation" decision once every layer was made warm — a dissolve over a
  warm-but-painted page can't flash black.) The symbols screen still opens AT REST on the tiger.
- NO BLACK anywhere on entry (user 2026-07-25, hard requirement). The stack was full of pure-#000
  fills that flashed black in every load/transition gap; all are now WARM: (a) a static boot splash
  in index.html (warm radial + wordmark + pulse) paints BEFORE React so a cold load / kiosk boot is
  never the black <body> — main.tsx fades+removes #boot-splash after first paint; (b) html/body/#root
  and <Stage> are #2a1a0e (warm-dark), not #000; (c) every screen base is a warm sunset tone, never
  near-black (home #a86a34, chakra sampled gradient). Keep it this way — never reintroduce a #000 fill
  or an opacity-fade that exposes an empty stage.
- History: entering the section from OUTSIDE plays the WebGL "rewind to the past" intro
  (RewindIntro.tsx + rewindGL.ts — lazy chunk, any touch skips) and the section now
  DEFAULTS TO 1857 (user decision 2026-07-20 — story reads oldest-first; was 1947).
  In-section hops (year pills, Know More back) never replay the intro.
- History year backgrounds are REAL archival images (see docs/IMAGE-PROVENANCE.md;
  no invented AI scenes — generative EXPAND of the real photo is allowed with approval).
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
