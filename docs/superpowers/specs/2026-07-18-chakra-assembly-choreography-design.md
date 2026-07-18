# Chakra Assembly Animation — Choreography Design

**Date:** 2026-07-18
**Screen:** Ashok Chakra → Design tab (`ChakraExplorerScreen`, `Chakra3D`)
**Status:** Approved choreography. Implementation plan not yet written.

## Purpose

The Design tab currently opens on a finished, annotated wheel. A visitor sees the
answer without ever seeing the reasoning. This sequence shows the Chakra being
*drafted and assembled* — construction circles struck on the ground, hub set,
spokes swept out, rim seated — then standing up into the annotated view that is
already there.

The animation must **end frame-identical to the current static dims pose**, so it
earns that view rather than replacing it.

## Placement and trigger

- Plays as the **Design tab intro**. No new tab, no nav change.
- Replays on every entry to the tab, following the precedent already set by the
  Flag tab's docking sequence ("Remounts on every tab entry, so the docking
  animation replays each visit").
- The spec cards (stats, title block) stay visible throughout — they are DOM and
  untouched by this work.

## Duration and pacing

**8.0 s total**, brisk.

The original ask was "every piece one by one with measurements". At 8 s that is
not achievable for 24 spokes — individually annotating them needs ~30 s. The
approved resolution is that **spokes cascade as one staggered radial wave** with
shared callouts. This is a deliberate trade, not an oversight.

## Beat sheet

`buildP` is a single master progress value 0 → 1, time-based (frame-rate
independent). Every sub-state derives deterministically from it, mirroring the
existing `applyFlagTimeline` pattern.

| Beat | Time (s) | `buildP` | Action |
|---|---|---|---|
| **0 · Draft** | 0.0–0.8 | 0.000–0.100 | Gold dashed construction circles sweep on across the ground like a compass stroke — ⌀185, ⌀160, ⌀64, ⌀32. `⌀185` chip lands. |
| **1 · Hub** | 0.8–1.7 | 0.100–0.2125 | Hub ⌀32 scales up at centre; boss + 40 flutes settle onto it. `⌀32 hub` chip lands. |
| **2 · Spokes** | 1.7–3.6 | 0.2125–0.450 | 24 spokes grow outward from the hub in a staggered clockwise cascade, each locking into its 15° slot. `15°` wedge and `6 → 2` taper land mid-cascade. The centrepiece. |
| **3 · Rim** | 3.6–4.7 | 0.450–0.5875 | Rim drops in from outside and seats onto the spoke tips. `⌀160` and `⌀7 × 24` scallop callout land. |
| **4 · Stand up** | 4.7–6.5 | 0.5875–0.8125 | Assembly rotates flat → upright while the camera lowers from top-down to `DIMS_CAM`. Ground shadow gathers. God-rays ramp in. |
| **5 · Settle** | 6.5–8.0 | 0.8125–1.000 | Eases into the exact static dims pose. Callouts reach steady-state opacity. |

### Spoke cascade timing

Beat 2 spans 1.9 s. Each spoke's own growth takes ~0.55 s, leaving 1.35 s of
stagger across 23 gaps ≈ **58 ms apart**. Order is sequential clockwise from
spoke 1 (12 o'clock), so it reads as a compass sweep consistent with the drafting
metaphor.

## Reveal mechanics

Motion-based wherever possible. Making every part `transparent` would add
depth-sorting cost on the Arc iGPU, and machined parts read better growing into
place than fading in.

| Part | Mechanic |
|---|---|
| Hub / boss / flutes | Scale 0 → 1, slight overshoot ease |
| Spokes | Scale **Y** 0.05 → 1. The geometry runs tip at `+Y` down to the hub root at the origin, so scaling Y about the origin literally grows each spoke outward from the hub. No opacity needed. |
| Rim | Scale 1.25 → 1.0 with `easeOutCubic` — drops from outside and seats onto the tips |
| Construction circles | `setDrawRange` on the line geometry sweeps each circle on |
| Dimension chips | Sprite `material.opacity` fade (`SpriteMaterial` is already `transparent`) |

## Staging and camera

- Assembly happens flat: `lean.rotation.x` starts at `-π/2`, easing to `LEAN_X`
  across beats 4–5. `lean.rotation.y` goes 0 → `LEAN_Y` over the same window.
- `lean.position.y` starts near the ground plane (≈ −80, the shadow catchers sit
  at ≈ −91) and rises to its resting `3`, so it genuinely reads as *laid on the
  ground, then standing up*.
- Camera keys lerp exactly like `flagAnim`: a high look-down start
  (≈ `(0, 210, 250)` targeting `(0, −80, 0)`) → `DIMS_CAM` `(0, 4, 370)`
  targeting `WHEEL_TGT`.

All camera and staging numbers above are **starting values to be tuned against
screenshots**, not final.

## Interaction

- Drag-spin is disabled while `buildP < 1`, the same way flag mode gates it.
- Any touch skips: `buildP` jumps to 1 and the final state is applied in one
  step. A kiosk visitor who only wants the spec is never trapped.

## Architecture

`Chakra3D.tsx` is already ~1580 lines and owns geometry, lighting, god-rays,
picking, dims and the whole flag sequence. Adding an eight-beat timeline inline
pushes it past 1800 and makes it harder to reason about.

**The choreography goes in its own module,** `chakraAssembly.ts`, exporting:

- the beat-window constants and easing helpers,
- a pure `applyAssemblyTimeline(p, refs)` that maps `buildP` onto the scene
  objects handed to it.

`Chakra3D` keeps scene ownership and just drives `buildP` and calls in. The
timeline function stays independently readable and testable, and the two
concerns can change without disturbing each other.

`buildDimGroup()` needs a small change: its children must be labelled (via
`userData.beat`) so the timeline can address circles and chips per beat. Today
they are anonymous `Line` and `Sprite` objects.

## Risks and constraints

1. **Shared material.** `rim`, `hub`, `boss` and `flutes` all reference one
   `material` instance. Any opacity-based reveal of those parts needs cloned
   materials first. The motion-based mechanics above avoid this — but it is a
   trap if the approach changes mid-build.
2. **God-rays are the likely hitch.** They recompute every frame (depth pre-pass
   + shadow map + 512 px ray-march) and the sequence has 24 meshes moving with
   the shadow map updating. Mitigation is also a dramatic improvement: **skip
   the ray-march entirely during beats 0–3** (the wheel is flat and incomplete;
   rays are meaningless there) and **ramp it in across beats 4–5**, so the sun
   blooms through the spokes as the wheel rises into the light.
3. **React StrictMode double-mount — already mitigated by construction.** The
   rAF loop is owned by `createChakraScene` and torn down in `dispose()`, which
   the mount effect already calls in its own cleanup. A double-mount therefore
   creates → disposes → creates a whole scene, and the timeline goes with it.
   **The rule is simply: keep the timeline scene-owned and never lift it into a
   React effect.** (CLAUDE.md's warning about completion-refs applies to
   effect-owned rAF timelines — the trap that froze the symbols intro — and does
   not apply here so long as ownership stays in the scene.)
4. **Prior revert in this area.** `git log` shows commit `bb29fa2` "Chakra rays:
   keep beams off the spokes + radial fade (fix seam clipping)" was reverted by
   `d103a30`. God-ray changes in this codebase have been backed out before —
   treat the ray-throttle work as touching known-fragile ground and verify it
   independently of the choreography.
5. **Edge-feather mask interaction.** `.ck-wheel` carries a 7 % mask feather.
   During beats 0–3 the flat assembly is wider on screen than the upright wheel;
   its construction circles must be checked against that feather or they will
   fade at the edges, exactly as the `⌀185` and `⌀7 × 24` chips did.

## Verification

- Screenshot each beat boundary to confirm staging, and the final frame against
  the current static dims pose — they must match.
- Confirm Values and Flag tabs are untouched.
- Confirm skip-on-touch lands in the settled state with no partial geometry.
- Confirm no callout fades against the `.ck-wheel` mask at any point in the
  sequence.
- `npm run typecheck` must pass before commit.

## Out of scope

Individually annotated spokes, a fourth tab, changes to the spec cards, and any
change to wheel geometry, lighting rig or material appearance.
