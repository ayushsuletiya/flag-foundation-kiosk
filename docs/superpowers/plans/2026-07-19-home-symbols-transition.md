# Home → Symbols Cinematic Transition Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Tapping the National Symbols tile on Home plays a ~5s cinematic: other tiles slide out, screen goes black, the tile glows and morphs into a random symbol card, which duplicates into 14 cards that fly onto the podium — replacing the symbols screen's trail-sweep intro.

**Architecture:** Two self-contained phases with the seam hidden at a fully-black frame. HomeScreen owns phase 1 (exit + morph) and navigates with `{ seed, cinematic }` router state; SymbolsCarouselScreen owns phase 2 (`'arrive'` mode replacing `'intro'`). One tiny shared contract file carries the handoff pose, timings, and state type. Both phases are single-rAF master clocks with all per-frame values derived in render (the chakra-assembly pattern), completion-gated for StrictMode.

**Tech Stack:** React 18 + TS strict, react-router-dom (`useNavigate`/`useLocation` state), CSS transforms/opacity only, existing `SymbolVisual` component. No new dependencies.

## Global Constraints

- Fixed 1920×1080 stage coordinates; positions are literal pixels (CLAUDE.md iron rule).
- Perf: animated properties are transform/opacity only (one exception: the single morphing element in phase 1 animates width/height/border-radius for 700ms — one element, accepted). No new backdrop-filters.
- TS strict; `npm run typecheck` MUST pass before every commit.
- StrictMode dev double-mount: rAF timeline effects gate on COMPLETION (ref set when finished), cancel their own frame in cleanup (CLAUDE.md gotcha).
- The black used on both sides of the seam is `#020715` (the symbols screen base navy).
- Skip on any touch at every phase (kiosk rule).
- Verification is `npm run typecheck` + browser walkthrough on the dev server (project has no unit-test framework; do not add one).

---

### Task 1: Transition contract + arrive-pose groundwork

**Files:**
- Create: `src/screens/symbols/transitionContract.ts`
- Modify: `src/screens/symbols/SymbolsCarouselScreen.tsx:50-71` (expose numeric track pose)

**Interfaces:**
- Produces: `HANDOFF`, all timing constants, `SymbolsEntryState`, `readEntryState(state: unknown): SymbolsEntryState | null` — consumed by Tasks 2 and 3. `trackPoseNum(u: number)` (module-internal to SymbolsCarouselScreen) returning `{ x, y, z, ry, s, o, dim, zIndex }` — consumed by Task 3's flight interpolation.

- [ ] **Step 1: Create the contract file**

```ts
/**
 * transitionContract — the ONLY thing shared between HomeScreen (phase 1,
 * exit + morph) and SymbolsCarouselScreen (phase 2, arrive) of the
 * Home → Symbols cinematic transition (spec 2026-07-19).
 *
 * HANDOFF is the stage-space rect the morphing card ends at on the Home
 * side and starts at on the symbols side. It equals the carousel's
 * CENTER-SLOT card rect: carousel origin (100, 200) + card offset
 * (354, 51) → stage (454, 251), 379x472, radius 60 — so the seed card is
 * already exactly on its slot-0 pose when the symbols screen takes over.
 */
export const HANDOFF = { left: 454, top: 251, width: 379, height: 472, radius: 60 } as const

// ---- Phase 1 (HomeScreen exit) — ~1.9s -----------------------------
export const EXIT_SLIDE_MS = 600 // other tiles slide out, veil rises
export const EXIT_GLOW_MS = 600 // 600–1200: black; symbols tile glows
export const EXIT_MORPH_START = 1200
export const EXIT_MORPH_MS = 700 // 1200–1900: tile → glass symbol card
export const EXIT_TOTAL_MS = 1900

// ---- Phase 2 (SymbolsCarouselScreen arrive) — ~3.1s ----------------
export const ARRIVE_DEAL_START = 300 // hold black + seed card first
export const DEAL_STAGGER_MS = 55 // 13 cards deal out one by one
export const DEAL_CARD_MS = 380 // last deal ends 300+12*55+380 = 1340
export const VEIL_OUT_START = 1000 // podium reveal overlaps the fan
export const VEIL_OUT_MS = 1400
export const FLIGHT_START = 1400 // all deals complete (1340) by then
export const FLIGHT_MS = 1700
export const ARRIVE_TOTAL_MS = 3100

/** Router state passed by HomeScreen when navigating to /symbols. */
export interface SymbolsEntryState {
  seed: string
  cinematic: boolean
}

/** location.state is unknown-shaped; validate instead of trusting casts. */
export function readEntryState(state: unknown): SymbolsEntryState | null {
  if (typeof state !== 'object' || state === null) return null
  const s = state as Record<string, unknown>
  if (typeof s['seed'] !== 'string' || typeof s['cinematic'] !== 'boolean') return null
  return { seed: s['seed'], cinematic: s['cinematic'] }
}
```

- [ ] **Step 2: Expose numeric track poses in SymbolsCarouselScreen**

In `SymbolsCarouselScreen.tsx`, split `trackPose` (lines 58–71) so the numeric
lerp is reusable by the Task-3 flight code. Replace the existing `trackPose`
function with:

```ts
function trackPoseNum(u: number) {
  const cu = Math.max(-2, Math.min(2, u))
  const i = Math.max(0, Math.min(3, Math.floor(cu + 2)))
  const a = TRACK_KEYPOSES[i]!
  const b = TRACK_KEYPOSES[i + 1]!
  const f = (cu - a.u) / (b.u - a.u)
  const l = (p: number, q: number) => p + (q - p) * f
  return {
    x: l(a.x, b.x),
    y: l(a.y, b.y),
    z: l(a.z, b.z),
    ry: l(a.ry, b.ry),
    s: l(a.s, b.s),
    o: l(a.o, b.o),
    dim: l(a.dim, b.dim),
    zIndex: Math.round(120 - Math.abs(cu) * 30),
  }
}

function trackPose(u: number) {
  const p = trackPoseNum(u)
  return {
    transform: `translate3d(${p.x.toFixed(1)}px, ${p.y.toFixed(1)}px, ${p.z.toFixed(1)}px) rotateY(${p.ry.toFixed(1)}deg) scale(${p.s.toFixed(3)})`,
    opacity: p.o,
    dim: p.dim,
    zIndex: p.zIndex,
  }
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean exit (no errors; `trackPoseNum` is used by `trackPose` so
`noUnusedLocals` passes).

- [ ] **Step 4: Commit**

```bash
git add src/screens/symbols/transitionContract.ts src/screens/symbols/SymbolsCarouselScreen.tsx
git commit -m "feat: transition contract + numeric track poses for home→symbols cinematic"
```

---

### Task 2: HomeScreen exit phase

**Files:**
- Modify: `src/screens/home/HomeScreen.tsx`
- Modify: `src/screens/home/HomeScreen.css` (append)

**Interfaces:**
- Consumes: `HANDOFF`, `EXIT_*` constants, `SymbolsEntryState` from `transitionContract.ts`; `symbolSlug`, `symbolShortName` from `symbolsData.ts`; `SymbolVisual`.
- Produces: `navigate('/symbols', { state })` where `state` satisfies `SymbolsEntryState` — `cinematic: true` on completion, `cinematic: false` on skip. Task 3 relies on exactly this shape.

- [ ] **Step 1: Add exit state machine and morph rendering to HomeScreen.tsx**

Replace the whole component body (keep the existing constants, `TILES`,
`PhotoBox`, `TileSpec`, `designedLabel` as they are; new imports at top):

```tsx
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { VideoLoop } from '../../components/VideoLoop.tsx'
import { SymbolVisual } from '../symbols/SymbolVisual.tsx'
import { symbolShortName, symbolSlug } from '../symbols/symbolsData.ts'
import {
  EXIT_GLOW_MS,
  EXIT_MORPH_MS,
  EXIT_MORPH_START,
  EXIT_SLIDE_MS,
  EXIT_TOTAL_MS,
  HANDOFF,
  type SymbolsEntryState,
} from '../symbols/transitionContract.ts'
import './HomeScreen.css'
```

Inside `HomeScreen()` (after the existing `homeTiles` line):

```tsx
  // ---- Symbols exit cinematic (spec 2026-07-19) ---------------------
  // One rAF master clock; every beat below derives from exitT in render.
  // Completion-gated (exitDone) so StrictMode's double-mount restarts the
  // clock instead of freezing it (CLAUDE.md gotcha).
  const [exitSeed, setExitSeed] = useState<{ slug: string; name: string } | null>(null)
  const [exitT, setExitT] = useState(0)
  const exitDone = useRef(false)
  const exitRaf = useRef<number | null>(null)
  const exiting = exitSeed !== null

  const beginSymbolsExit = () => {
    if (exiting) return
    const ids = content?.symbolIdentities ?? []
    if (ids.length === 0) {
      navigate('/symbols') // content not ready — plain navigation
      return
    }
    const pick = ids[Math.floor(Math.random() * ids.length)]!
    setExitSeed({ slug: symbolSlug(pick.symbol), name: symbolShortName(pick) })
  }

  useEffect(() => {
    if (exitSeed === null || exitDone.current) return
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = now - start
      setExitT(t)
      if (t < EXIT_TOTAL_MS) {
        exitRaf.current = requestAnimationFrame(tick)
      } else {
        exitRaf.current = null
        exitDone.current = true
        const state: SymbolsEntryState = { seed: exitSeed.slug, cinematic: true }
        navigate('/symbols', { state })
      }
    }
    exitRaf.current = requestAnimationFrame(tick)
    return () => {
      if (exitRaf.current !== null) {
        cancelAnimationFrame(exitRaf.current)
        exitRaf.current = null
      }
    }
  }, [exitSeed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kiosk rule: any touch mid-cinematic skips it.
  const skipExit = () => {
    if (exitSeed === null || exitDone.current) return
    exitDone.current = true
    if (exitRaf.current !== null) {
      cancelAnimationFrame(exitRaf.current)
      exitRaf.current = null
    }
    const state: SymbolsEntryState = { seed: exitSeed.slug, cinematic: false }
    navigate('/symbols', { state })
  }

  // ---- beat values (all pure functions of exitT) --------------------
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const easeOut = (v: number) => 1 - Math.pow(1 - v, 3)
  const easeInOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2)
  const veilP = clamp01((exitT - 250) / 600)
  const chromeFade = 1 - clamp01(exitT / 500)
  const glowP = easeOut(clamp01((exitT - EXIT_SLIDE_MS) / EXIT_GLOW_MS))
  const morphP = easeInOut(clamp01((exitT - EXIT_MORPH_START) / EXIT_MORPH_MS))
  const lerp = (a: number, b: number) => a + (b - a) * morphP
  // Home tile rect of the symbols card → HANDOFF rect on the stage.
  const morphRect = {
    left: lerp(1123.9, HANDOFF.left),
    top: lerp(553, HANDOFF.top),
    width: lerp(294.104, HANDOFF.width),
    height: lerp(403.343, HANDOFF.height),
    radius: lerp(49.61, HANDOFF.radius),
  }
  const glowOpacity = glowP * (1 - 0.6 * morphP)
```

In the returned JSX: add the skip handler and per-element exit styles.
Full replacement of the `return`:

```tsx
  return (
    <div className="home-screen" onPointerDown={exiting ? skipExit : undefined}>
      {/* Full-bleed background video (poster until the mp4 is delivered) */}
      <div className="home-bg">
        <VideoLoop src={BG_VIDEO} poster={BG_POSTER} />
      </div>
      <div className="home-scrim" />

      {/* Title lockup — fades first during the exit cinematic */}
      <h1 className="home-title" style={exiting ? { opacity: chromeFade } : undefined}>
        <span className="home-title-script">The </span>
        Flag Foundation
      </h1>
      <img
        className="home-swash"
        src={SWASH_SVG}
        alt=""
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />
      <div className="home-of-india" style={exiting ? { opacity: chromeFade } : undefined}>
        of india
      </div>

      {/* Category tiles */}
      {TILES.map((tile, i) => {
        const isSymbols = tile.route === '/symbols'
        // Non-symbols tiles slide LEFT off-stage, staggered by column.
        const slideP = exiting ? easeOut(Math.max(0, Math.min(1, (exitT - i * 90) / (EXIT_SLIDE_MS - 100)))) : 0
        const slideStyle =
          exiting && !isSymbols
            ? {
                transform: `translateX(${(-(tile.left + tile.width + 80) * slideP).toFixed(1)}px)`,
                opacity: 1 - slideP,
                pointerEvents: 'none' as const,
              }
            : exiting
              ? { visibility: 'hidden' as const } // symbols tile: the morph element takes over
              : undefined
        return (
          <button
            key={tile.route}
            type="button"
            className="home-tile"
            style={{ left: tile.left, width: tile.width, ...slideStyle }}
            onClick={() => {
              if (exiting) return
              if (isSymbols) beginSymbolsExit()
              else navigate(tile.route)
            }}
          >
            <img
              className="home-tile-photo"
              src={tile.image}
              alt=""
              draggable={false}
              style={{ ...tile.photo }}
            />
            <div
              className={
                tile.solidScrim === true ? 'home-tile-scrim home-tile-scrim--solid' : 'home-tile-scrim'
              }
            />
            <span className="home-tile-label" style={{ width: tile.labelWidth }}>
              {designedLabel(homeTiles[i]?.label, tile.fallbackLabel)}
            </span>
          </button>
        )
      })}

      {/* Cream wave sits above title/tiles; exported pre-clipped to frame (0,0) */}
      <img
        className="home-wave"
        src={WAVE_SVG}
        alt=""
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />
      {/* NJU logo lockup — topmost chrome layer */}
      <img
        className="home-logo"
        src={LOGO_PNG}
        alt="The Naveen Jindal Universe"
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />

      {/* ---- Exit cinematic layers (above everything) ---------------- */}
      {exiting && <div className="home-exit-veil" style={{ opacity: veilP }} />}
      {exiting && exitSeed !== null && (
        <div
          className="home-morph"
          style={{
            left: morphRect.left,
            top: morphRect.top,
            width: morphRect.width,
            height: morphRect.height,
            borderRadius: morphRect.radius,
            boxShadow: `0 0 ${(24 + 66 * glowOpacity).toFixed(0)}px ${(4 + 14 * glowOpacity).toFixed(0)}px rgba(255, 196, 84, ${(0.55 * glowOpacity).toFixed(3)}), 0 0 0 2.5px rgba(255, 226, 150, ${(0.9 * glowOpacity).toFixed(3)})`,
          }}
        >
          {/* Old face: the home tile's photo/scrim/label, fading out */}
          <div className="home-morph-old" style={{ opacity: 1 - morphP }}>
            <img
              className="home-tile-photo"
              src={TILES[3]!.image}
              alt=""
              draggable={false}
              style={{ ...TILES[3]!.photo }}
            />
            <div className="home-tile-scrim home-tile-scrim--solid" />
            <span className="home-tile-label" style={{ width: TILES[3]!.labelWidth }}>
              {designedLabel(homeTiles[3]?.label, TILES[3]!.fallbackLabel)}
            </span>
          </div>
          {/* New face: the seeded glass symbol card, fading in. Rendered at
              final 379x472 and scaled so SymbolVisual never re-lays-out. */}
          <div
            className="home-morph-card"
            style={{
              opacity: morphP,
              transform: `scale(${(morphRect.width / HANDOFF.width).toFixed(4)}, ${(morphRect.height / HANDOFF.height).toFixed(4)})`,
            }}
          >
            <SymbolVisual
              slug={exitSeed.slug}
              name={exitSeed.name}
              width={HANDOFF.width}
              height={HANDOFF.height}
              mode="still"
              fit="contain"
            />
          </div>
        </div>
      )}
    </div>
  )
```

- [ ] **Step 2: Append exit styles to HomeScreen.css**

```css
/* ============================================================
   Exit cinematic → /symbols (spec 2026-07-19). All layers are
   driven per-frame from the rAF clock via inline styles; these
   rules only provide the static box recipes.
   ============================================================ */

/* Black veil — MUST match the symbols screen base (#020715) so the
   route swap at full black is invisible. Covers and blocks the tiles. */
.home-exit-veil {
  position: absolute;
  inset: 0;
  background: #020715;
  z-index: 5;
}

/* The morphing card. Glass recipe matches .sy-card3d minus the
   backdrop-filter (there is only black behind it — nothing to blur). */
.home-morph {
  position: absolute;
  z-index: 6;
  overflow: hidden;
  border: 1px solid rgba(255, 255, 255, 0.22);
  background-color: rgba(6, 10, 27, 0.52);
  background-image: linear-gradient(180deg, rgba(255, 255, 255, 0.07) 0%, rgba(255, 255, 255, 0.02) 100%);
  pointer-events: none;
}

.home-morph-old {
  position: absolute;
  inset: 0;
  overflow: hidden;
}

/* The tile's cream border rides the old face and fades with it */
.home-morph-old::after {
  content: '';
  position: absolute;
  inset: 0;
  border: 3.924px solid var(--cream-border);
  border-radius: inherit;
  pointer-events: none;
}

.home-morph-card {
  position: absolute;
  left: 0;
  top: 0;
  width: 379px;
  height: 472px;
  transform-origin: 0 0;
  display: flex;
  align-items: center;
  justify-content: center;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean.

- [ ] **Step 4: Verify in the browser**

With the dev server running (`preview_start` name `kiosk-dev`):
1. Navigate to `http://localhost:5173/`, wait for tiles.
2. Click the National Symbols tile (4th button).
3. Observe: 3 tiles slide left and fade (~0.6s) → black screen with the
   symbols tile intact → gold glow swells → the tile glides toward
   stage-centre-left, growing into a dark glass card showing a random
   symbol → route changes to /symbols.
4. Reload, click again — different random symbol.
5. Reload, click, then click anywhere mid-animation → immediate jump to
   /symbols (no cinematic).
6. `read_console_messages` — no errors.

Note: until Task 3 lands, the symbols screen still plays its OLD trail
intro after the black frame. That mismatch is expected mid-plan.

- [ ] **Step 5: Commit**

```bash
git add src/screens/home/HomeScreen.tsx src/screens/home/HomeScreen.css
git commit -m "feat: Home exit cinematic — slide-out, veil, glow, morph into seeded symbol card"
```

---

### Task 3: Symbols 'arrive' phase (replaces the trail intro)

**Files:**
- Modify: `src/screens/symbols/SymbolsCarouselScreen.tsx`
- Modify: `src/screens/symbols/SymbolsCarouselScreen.css`

**Interfaces:**
- Consumes: `ARRIVE_DEAL_START`, `DEAL_STAGGER_MS`, `DEAL_CARD_MS`, `VEIL_OUT_START`, `VEIL_OUT_MS`, `FLIGHT_START`, `FLIGHT_MS`, `ARRIVE_TOTAL_MS`, `readEntryState` from `transitionContract.ts`; `trackPoseNum` from Task 1; router state produced by Task 2.
- Produces: nothing consumed later; final task only verifies.

- [ ] **Step 1: Remove the trail intro and add the arrive machinery**

In `SymbolsCarouselScreen.tsx`:

1. Add imports:

```ts
import { useLocation } from 'react-router-dom'
import {
  ARRIVE_DEAL_START,
  ARRIVE_TOTAL_MS,
  DEAL_CARD_MS,
  DEAL_STAGGER_MS,
  FLIGHT_MS,
  FLIGHT_START,
  VEIL_OUT_MS,
  VEIL_OUT_START,
  readEntryState,
} from './transitionContract.ts'
```

(`useNavigate` import stays; add `useLocation` beside it.)

2. DELETE the intro constants (lines 32–41: the whole
`INTRO_TOTAL_MS … INTRO_APPEAR_MS` block and its comment).

3. Simplify `orbitPose` — remove the `radius`/`scaleMul` params (the trail
was their only caller with non-defaults). New signature:

```ts
function orbitPose(ringIndex: number, count: number, spinDeg: number) {
  const theta = (((ringIndex * 360) / count + spinDeg) * Math.PI) / 180
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const x = s * 440
  const y = 30 + (1 - c) * 30
  const z = (c - 1) * 280
  const ry = -s * 35
  const scale = 0.44 + 0.24 * (c + 1)
  return {
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
    opacity: 0.38 + 0.31 * (c + 1),
    zIndex: Math.round(100 + c * 50),
  } as const
}
```

4. Add the fan pose helper (below `orbitPose`):

```ts
/**
 * Fan pose for dealt card j of n (j = 1..n, left → right) — a hand of
 * cards spread on an arc above/around the seed card. rotateZ tilts each
 * card along the arc like a dealt hand; flight untwists it to 0.
 */
function fanPose(j: number, n: number) {
  const a = n > 1 ? (-1 + (2 * (j - 1)) / (n - 1)) * 68 : 0 // degrees
  const rad = (a * Math.PI) / 180
  return {
    x: Math.sin(rad) * 430,
    y: -Math.cos(rad) * 120 - 30,
    rz: a * 0.32,
    s: 0.62,
  }
}
```

5. Replace the mode/intro state (component body). The mode union and
initial state become:

```ts
  const location = useLocation()
  // Read once — router state survives re-renders but we only honor it at mount.
  const entryRef = useRef(readEntryState(location.state))
  const entry = entryRef.current
  const cinematic = entry !== null && entry.cinematic

  // ---- mode state machine -------------------------------------------
  // 'arrive' = the home-handoff cinematic (deal + podium reveal + flight)
  // · 'rest' = Figma slot poses · 'turn' = slide along track · 'orbit' =
  // ring floats · 'settle' = gliding home.
  const [mode, setMode] = useState<'arrive' | 'rest' | 'turn' | 'orbit' | 'settle'>(
    cinematic ? 'arrive' : 'rest',
  )
  const isArrive = mode === 'arrive'
  const [arriveT, setArriveT] = useState(0)
  const arriveDone = useRef(!cinematic)
  const arriveRaf = useRef<number | null>(null)
  // Non-cinematic entries still open from black — briefly.
  const [plainVeil, setPlainVeil] = useState(!cinematic)
```

Replace `const [introT, setIntroT] = useState(0)` / `introRaf` / `introDone`
with the above (delete the old three). Keep `spin`, `turnOffset`,
`autoTick`, `glowSlug` and all refs that are not intro-related.

6. Seed-aware default index — replace the `defaultIndex` memo:

```ts
  const defaultIndex = useMemo(() => {
    if (entry !== null) {
      const i = identities.findIndex((s) => symbolSlug(s.symbol) === entry.seed)
      if (i >= 0) return i
    }
    const t = identities.findIndex((s) => symbolSlug(s.symbol) === 'tiger')
    return t >= 0 ? t : 0
  }, [identities, entry])
```

7. Replace the intro rAF effect (lines 169–199) with the arrive clock and
the plain-veil timer:

```ts
  // Arrive timeline: one elapsed-time rAF machine; all card poses derive
  // from arriveT in render. Completion-gated (arriveDone) and cancels its
  // own frame — StrictMode-safe (CLAUDE.md gotcha).
  useEffect(() => {
    if (count === 0 || arriveDone.current) return
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = now - start
      setArriveT(t)
      if (t < ARRIVE_TOTAL_MS) {
        arriveRaf.current = requestAnimationFrame(tick)
      } else {
        arriveRaf.current = null
        arriveDone.current = true
        setMode('rest')
      }
    }
    arriveRaf.current = requestAnimationFrame(tick)
    return () => {
      if (arriveRaf.current !== null) {
        cancelAnimationFrame(arriveRaf.current)
        arriveRaf.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Non-cinematic entry: plain short fade from black, then interactive.
  useEffect(() => {
    if (!plainVeil) return
    const t = setTimeout(() => setPlainVeil(false), 900)
    return () => clearTimeout(t)
  }, [plainVeil])
```

8. Replace `skipIntro` with `skipArrive`:

```ts
  // Kiosk users won't wait: any touch during the arrive fast-forwards it.
  const skipArrive = () => {
    arriveDone.current = true
    if (arriveRaf.current !== null) {
      cancelAnimationFrame(arriveRaf.current)
      arriveRaf.current = null
    }
    suppressClick.current = true
    settleToRest() // whole ring mounts and glides home in one settle
  }
```

9. Delete the trail sweep parameter block (lines 264–268: `introP`,
`introE`, `introSpin`, `introRadius`).

10. In the JSX: root handler `onPointerDown={isArrive ? skipArrive : undefined}`.
Replace the veil block:

```tsx
      {/* Arrive veil — holds black through the deal, eases off to reveal
          the podium while the cards fan (inline opacity from the clock). */}
      {isArrive && (
        <div
          className="sy-veil sy-veil--arrive"
          style={{
            opacity:
              1 -
              (() => {
                const p = Math.max(0, Math.min(1, (arriveT - VEIL_OUT_START) / VEIL_OUT_MS))
                return p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
              })(),
          }}
        />
      )}
      {plainVeil && <div className="sy-veil" />}
```

11. Header typing waits for the reveal on cinematic entries:

```tsx
      <h1 className="sy-header">
        <BlurTypeText
          text="National Symbols of India"
          delay={cinematic ? VEIL_OUT_START + 400 : 400}
          stagger={34}
          budget={900}
        />
      </h1>
```

12. Replace the per-card intro pose logic inside `identities.map`. The
`appearP`/`appear` block and the `pose` ternary go away. New logic
(replacing lines 405–426, keeping `turn` as is):

```tsx
          // ---- arrive: deal from behind the seed, then fly to slots ----
          // Cards ordered by signed off map left→right onto the fan, so
          // flight sends each card toward its own side — no crossings.
          let arriveStyle: CSSProperties | undefined
          if (isArrive) {
            if (off === 0) {
              // The seed anchors the scene on its slot-0 pose throughout.
              arriveStyle = {
                transform: 'translate3d(0px, 0px, 0px) rotateY(0deg) scale(1)',
                opacity: 1,
                zIndex: 130,
              }
            } else {
              const half = Math.floor(count / 2)
              const rank = off < 0 ? half + off + 1 : half + off // 1..count-1, left→right
              const t0 = ARRIVE_DEAL_START + (rank - 1) * DEAL_STAGGER_MS
              const dp = Math.max(0, Math.min(1, (arriveT - t0) / DEAL_CARD_MS))
              const dealP = 1 - Math.pow(1 - dp, 3)
              const fp = fanPose(rank, count - 1)
              const flp = Math.max(0, Math.min(1, (arriveT - FLIGHT_START) / FLIGHT_MS))
              const flightP = flp < 0.5 ? 4 * flp * flp * flp : 1 - Math.pow(-2 * flp + 2, 3) / 2
              const tp = trackPoseNum(off)
              const targetO = Math.abs(off) > 2 ? 0 : tp.o
              // deal: emerge from behind the seed toward the fan pose
              const fx = fp.x * dealP
              const fy = fp.y * dealP
              const frz = fp.rz * dealP
              const fs = 0.9 + (fp.s - 0.9) * dealP
              const fo = dealP
              // flight: fan → track slot (component-wise)
              const x = fx + (tp.x - fx) * flightP
              const y = fy + (tp.y - fy) * flightP
              const z = tp.z * flightP
              const ry = tp.ry * flightP
              const rz = frz * (1 - flightP)
              const sc = fs + (tp.s - fs) * flightP
              const o = fo + (targetO - fo) * flightP
              arriveStyle = {
                transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) rotateZ(${rz.toFixed(1)}deg) scale(${sc.toFixed(3)})`,
                opacity: o,
                zIndex: flightP > 0.5 ? tp.zIndex : 90 - rank,
              }
            }
          }
          const turn = mode === 'turn' ? trackPose(off + turnOffset) : undefined
          const pose = mode === 'orbit' ? orbitPose(ringIndex, count, spin) : undefined
          const style = turn
            ? ({ transform: turn.transform, opacity: turn.opacity, zIndex: turn.zIndex } as CSSProperties)
            : (arriveStyle ??
              (pose
                ? ({ transform: pose.transform, opacity: pose.opacity, zIndex: pose.zIndex } as CSSProperties)
                : undefined))
```

Also update the mount guard so the whole ring is mounted during arrive
(it already is — `lifted = mode !== 'rest'` covers 'arrive').

13. Rename remaining `isIntro` references: the carousel `onPointerDown`
guard becomes `if (isArrive) return`, and the dots/info gates become
`{!isArrive && !plainVeil && ( … )}` for the dots and `{!isArrive && ( … )}`
for the info column.

- [ ] **Step 2: CSS — rename intro selectors to arrive**

In `SymbolsCarouselScreen.css`, replace every `[data-mode='intro']` with
`[data-mode='arrive']` (4 occurrences: card transition block, dim block,
glow-ring animation:none block, glow-ring opacity block). Add after the
`.sy-veil` keyframes:

```css
/* Arrive-mode veil is driven per-frame from the clock — no keyframe */
.sy-veil--arrive {
  animation: none;
}
```

- [ ] **Step 3: Typecheck**

Run: `npm run typecheck`
Expected: clean. If `INTRO_*` or `introT` references remain anywhere,
`noUnusedLocals`/undefined-symbol errors will name them — delete the stragglers.

- [ ] **Step 4: Verify in the browser**

1. Home → tap National Symbols. Full flow: tiles out → black → glow →
   morph → **seamless black handoff** → 13 cards deal into a fan behind
   the seed → podium fades in beneath → cards fly to carousel slots →
   seed card front-centre, its name types in, dots appear.
2. The seed symbol on Home matches the front-centre card after arrival.
3. Tap mid-deal → ring settles to rest instantly (skip).
4. Direct URL `localhost:5173/symbols` (no router state) → brief black
   fade, carousel at rest on the tiger, no cinematic.
5. Swipe/tap/hold interactions after arrival all behave as before.
6. `read_console_messages` — no errors; check no StrictMode freeze
   (arrive completes after a dev reload mid-arrive).

- [ ] **Step 5: Commit**

```bash
git add src/screens/symbols/SymbolsCarouselScreen.tsx src/screens/symbols/SymbolsCarouselScreen.css
git commit -m "feat: symbols arrive cinematic — deal, podium reveal, flight; replaces trail intro"
```

---

### Task 4: End-to-end verification, tuning, docs

**Files:**
- Modify: `CLAUDE.md` (key user decisions)
- Possibly tune: `src/screens/symbols/transitionContract.ts` timing constants

**Interfaces:**
- Consumes: everything above.

- [ ] **Step 1: Full-flow browser pass**

Run the complete matrix and screenshot each state:
1. Home → symbols cinematic ×3 (different random seeds each time).
2. Skip during phase 1; skip during phase 2 deal; skip during flight.
3. Direct `/symbols`; Home → other 3 tiles (instant nav unchanged).
4. After arrival: swipe, tap-side-card, press-hold orbit, drop-to-select,
   auto-advance after 3.5s idle, Know More → detail → back.
5. Idle-reset behavior unaffected (120s timer — verify the hook still
   mounts by code inspection, don't wait it out).

- [ ] **Step 2: Fix anything the pass surfaces**

Timing/feel tweaks go in `transitionContract.ts` constants only. Visual
pose tweaks go in `fanPose`. Keep the spec's beat ORDER unchanged.

- [ ] **Step 3: Update CLAUDE.md**

In the "Key user decisions (do not regress)" list, replace the symbols
carousel bullet's intro reference (if any) and append:

```markdown
- Home → Symbols: tapping the tile plays the 5s cinematic (slide-out → black → glow →
  morph into RANDOM seed card → deal 14 → podium reveal → flight to slots). Any touch
  skips. The old trail-sweep intro is gone; direct/idle entries get a plain 0.9s fade.
  Cross-screen contract lives in src/screens/symbols/transitionContract.ts.
```

- [ ] **Step 4: Typecheck + commit**

Run: `npm run typecheck`
Expected: clean.

```bash
git add -A src/ CLAUDE.md
git commit -m "feat: home→symbols transition e2e tuning + docs"
```

---

## Self-Review

- **Spec coverage:** slide-out/veil/glow/morph (Task 2) ✓ · seam at black
  with matching pose (HANDOFF = slot-0 rect, both sides `#020715`) ✓ ·
  deal/duplication (Task 3 step 12) ✓ · podium reveal overlap (veil
  inline opacity) ✓ · direct flight to slots, seed lands centre ✓ ·
  random seed via router state ✓ · trail intro removed ✓ · non-cinematic
  fallback ✓ · skip everywhere ✓ · StrictMode gating ✓ · Excel-empty
  guard (`count === 0` return + Home plain-navigate) ✓.
- **Placeholder scan:** none — every step carries full code.
- **Type consistency:** `SymbolsEntryState { seed, cinematic }` produced in
  Task 2 = validated by `readEntryState` in Task 3 ✓ · `trackPoseNum`
  defined Task 1, consumed Task 3 ✓ · `fanPose(j, n)` defined and used in
  Task 3 only ✓ · `HANDOFF.width/height` used in Task 2 morph card ✓.
