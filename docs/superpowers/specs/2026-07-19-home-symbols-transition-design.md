# Home → Symbols cinematic transition — design

Approved 2026-07-19. Replaces the symbols trail-sweep intro with a two-phase
cinematic handoff that starts on the Home screen.

## What it is

Tapping the **National Symbols of India** tile on Home no longer swaps routes
instantly. Instead (~5s total, any touch skips):

**Phase 1 — Home exit (~1.9s, owned by HomeScreen)**

| Time | Beat |
|---|---|
| 0–0.6s | The other 3 tiles slide left off-stage (staggered, ease-in) and fade; title/wave/logo fade; a black veil rises over everything except the symbols tile |
| 0.6–1.2s | Full black; the symbols tile glows — warm gold halo swells |
| 1.2–1.9s | Morph: the tile glides/scales to a fixed handoff pose near stage centre while crossfading from the photo-tile into the glass symbol card of a **random seed symbol** (picked at tap time from the Excel identities) |
| 1.9s | Fully black except the card → `navigate('/symbols', { state: { seed, cinematic: true } })` |

**Phase 2 — Symbols arrival (~3.1s, owned by SymbolsCarouselScreen)**

| Time | Beat |
|---|---|
| 0–0.3s | Opens black with the seed card at the exact handoff pose — the route swap is invisible (both sides of the seam are black and the card pose matches) |
| 0.3–1.4s | Duplication: 13 cards deal out from behind the seed into a fanned arc, staggered ~60ms |
| 1.0–2.4s | The black veil eases off, revealing the blue podium stage (overlaps the fan) |
| 1.4–3.1s | Flight: all 14 cards fly from fan poses to carousel poses — seed lands front-centre (it becomes the active symbol), visible slots fill, the rest recede and fade. Dots + name column type in, auto-advance arms |

## Decisions (user-locked)

- **Direct flight** — cards go straight from the fan to ring slots; the old
  1¼-turn trail sweep is REMOVED.
- **Random seed** — a different symbol fronts the carousel each visit.
  Non-cinematic entries fall back to the tiger default.
- **~5s cinematic pacing**, touch-to-skip at every point (existing kiosk rule).
- Only the symbols tile gets this treatment; the other 3 Home tiles keep
  instant navigation (future work may extend the pattern).

## Architecture

- **`src/screens/symbols/transitionContract.ts`** (new) — the single
  cross-file contract: handoff card pose (stage x/y/scale), phase timings,
  and the router-state type `{ seed: string; cinematic: boolean }`.
  Nothing else is shared between the two screens.
- **HomeScreen** — new `'exit'` mode driven by ONE rAF master clock
  (elapsed-time value, all beats derived in render — the chakra-assembly
  pattern), completion-gated for StrictMode. Skip → immediate navigate with
  `cinematic: false`.
- **SymbolsCarouselScreen** — mode `'intro'` (trail) is replaced by
  `'arrive'`: same master-clock architecture, poses interpolate
  handoff → fan → track slots. Non-cinematic entry = plain 0.6s veil fade
  to rest. Initial `selected` = seed index.
- Flight mounts all 14 persistent card elements exactly as orbit mode
  already does; every animated property is transform/opacity only.

## Edge cases

- Skip during phase 1 → navigate immediately (`cinematic: false`).
- Skip during phase 2 → snap to rest (existing `skipIntro` pattern).
- Excel not loaded on arrival → existing `count === 0` guard holds the
  black stage; plain fade when content lands.
- Effects cancel their own rAF on unmount; mid-transition navigation or
  idle reset is safe.

## Verification

- `npm run typecheck` clean.
- Visual run-through with screenshots at each beat (dev server).
- Skip path at multiple points; direct-URL `/symbols` entry; StrictMode
  double-mount (dev) does not freeze either phase.
