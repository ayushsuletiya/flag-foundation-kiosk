# Chakra Assembly Animation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Play an 8-second sequence on entering the Ashok Chakra → Design tab in which the wheel is drafted flat on the ground, assembled part by part with measurement callouts, then stands up into the existing annotated dims view.

**Architecture:** A single master progress value `buildP` (0 → 1, time-based) drives every sub-state deterministically, mirroring the existing `applyFlagTimeline` pattern. The choreography itself lives in a new pure module `chakraAssembly.ts`; `Chakra3D.tsx` keeps scene ownership and only drives `buildP` and calls in. The timeline is **scene-owned** (started from `setDims`, advanced in the existing rAF loop, destroyed by `dispose()`), never effect-owned.

**Tech Stack:** three.js, React 18, TypeScript (strict), Vite.

## Global Constraints

- Fixed 1920×1080 coordinate system — positions are literal Figma pixels, never responsive.
- `npm run typecheck` MUST pass before every commit (all three tsconfigs).
- Perf guards (Intel Arc iGPU): three.js stays behind lazy import; god-rays recompute every frame and are the known hitch point.
- The final frame at `buildP === 1` MUST be pixel-identical to the current static dims pose.
- Values and Chakra-in-Flag tabs MUST be visually unchanged by this work.
- Timeline stays scene-owned. Do NOT move the rAF or timeline state into a React effect.
- Do not change wheel geometry, the lighting rig, or material appearance.
- No emoji in filenames.

## Testing note (read before starting)

**This repo has no test runner** — no vitest, jest, playwright, or testing-library, and no `test` script. Do not introduce one; it is out of scope.

The verification gate for every task is:

1. `npm run typecheck` — must pass.
2. `npm run lint` — must pass.
3. **Deterministic visual check** using the dev-only scrub hook added in Task 1. It lets you freeze the timeline at an exact `buildP` and screenshot it, so beats are checked at fixed values rather than by trying to catch a moving animation.

Scrub usage in the browser console (or via the Browser pane's `javascript_tool`):

```js
window.__chakraScrub(0.30)   // freeze mid spoke-cascade
window.__chakraScrub(1)      // final settled frame
```

---

### Task 1: Assembly module, staging, and the scrub hook

Creates the choreography module and wires the master timeline. At the end of this task the wheel lies flat on the ground, then stands up into the dims pose — with no per-part reveal yet (all parts present the whole time). This isolates the staging/camera move so it can be judged on its own.

**Files:**
- Create: `src/screens/chakra/chakraAssembly.ts`
- Modify: `src/screens/chakra/Chakra3D.tsx`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces:
  - `ASSEMBLY_MS: number`
  - `BEAT: { draft, hub, spokes, rim, standUp, settle }` — each a readonly `[number, number]`
  - `clamp01(t: number): number`
  - `beatP(p: number, w: readonly [number, number]): number`
  - `easeOutCubic(t: number): number`, `easeInOutCubic(t: number): number`, `easeOutBack(t: number): number`
  - `BUILD_CAM: THREE.Vector3`, `BUILD_TGT: THREE.Vector3`, `BUILD_LEAN_Y: number`
  - `SPOKE_GROW_MS: number`, `SPOKE_STAGGER_MS: number`
  - `interface AssemblyRefs`
  - `applyAssemblyTimeline(p: number, r: AssemblyRefs): void`

- [ ] **Step 1: Create the choreography module**

Create `src/screens/chakra/chakraAssembly.ts`:

```ts
/**
 * Chakra assembly choreography — the Design tab's 8s build sequence.
 *
 * One master progress value `p` (0 → 1) drives every sub-state deterministically,
 * the same shape as Chakra3D's flag timeline. Keeping this a pure function of `p`
 * means the sequence can be scrubbed to any frame (see __chakraScrub) and that
 * `applyAssemblyTimeline(1, refs)` yields EXACTLY the resting dims pose — which is
 * what makes skip-to-end and the final settle frame-identical to the static view.
 *
 * Beat windows come from docs/superpowers/specs/2026-07-18-chakra-assembly-choreography-design.md
 */
import * as THREE from 'three'

export const ASSEMBLY_MS = 8000

/** Beat windows as fractions of the master progress. */
export const BEAT = {
  draft: [0.0, 0.1] as const,
  hub: [0.1, 0.2125] as const,
  spokes: [0.2125, 0.45] as const,
  rim: [0.45, 0.5875] as const,
  standUp: [0.5875, 0.8125] as const,
  settle: [0.8125, 1.0] as const,
}

export const clamp01 = (t: number): number => (t < 0 ? 0 : t > 1 ? 1 : t)

/** Local 0→1 progress inside a beat window. */
export const beatP = (p: number, w: readonly [number, number]): number =>
  clamp01((p - w[0]) / (w[1] - w[0]))

export const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3)
export const easeInOutCubic = (t: number): number =>
  t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2
/** Slight overshoot — machined parts snapping into place. easeOutBack(0)=0, (1)=1. */
export const easeOutBack = (t: number): number => {
  const c1 = 1.70158
  const c3 = c1 + 1
  return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2)
}

/** Camera start: high look-down onto the drafting floor. Tune against screenshots. */
export const BUILD_CAM = new THREE.Vector3(0, 210, 250)
export const BUILD_TGT = new THREE.Vector3(0, -80, 0)
/** Where the assembly lies while drafted (shadow catchers sit at y ≈ -91). */
export const BUILD_LEAN_Y = -80

export const SPOKE_GROW_MS = 550
export const SPOKE_STAGGER_MS = 58

export interface AssemblyRefs {
  lean: THREE.Group
  rim: THREE.Object3D
  hub: THREE.Object3D
  boss: THREE.Object3D
  flutes: THREE.Object3D
  spokes: THREE.Object3D[]
  camera: THREE.PerspectiveCamera
  camTarget: THREE.Vector3
  /** Resting pose the sequence lands on — Chakra3D's DIMS_CAM / WHEEL_TGT / lean pose. */
  restCam: THREE.Vector3
  restTgt: THREE.Vector3
  restLean: { x: number; y: number; posY: number }
}

/** Never scale to exactly 0 — degenerate matrices produce NaN normals. */
const MIN_SCALE = 0.0001

export function applyAssemblyTimeline(p: number, r: AssemblyRefs): void {
  // ---- staging: flat on the ground → upright, camera follows it up
  const up = easeInOutCubic(beatP(p, BEAT.standUp))
  r.lean.rotation.x = THREE.MathUtils.lerp(-Math.PI / 2, r.restLean.x, up)
  r.lean.rotation.y = THREE.MathUtils.lerp(0, r.restLean.y, up)
  r.lean.position.y = THREE.MathUtils.lerp(BUILD_LEAN_Y, r.restLean.posY, up)
  r.camera.position.lerpVectors(BUILD_CAM, r.restCam, up)
  r.camTarget.lerpVectors(BUILD_TGT, r.restTgt, up)
  r.camera.lookAt(r.camTarget)

  // ---- hub + boss + flutes scale up together
  const hubS = Math.max(MIN_SCALE, easeOutBack(beatP(p, BEAT.hub)))
  r.hub.scale.setScalar(hubS)
  r.boss.scale.setScalar(hubS)
  r.flutes.scale.setScalar(hubS)

  // ---- spokes grow outward from the hub, staggered clockwise.
  // Spoke geometry runs tip at +Y down to the hub root at the origin, so scaling
  // local Y about the origin literally extends each spoke outward. No opacity,
  // so no transparency sorting cost on the Arc iGPU.
  const spokeWinMs = (BEAT.spokes[1] - BEAT.spokes[0]) * ASSEMBLY_MS
  const tMs = beatP(p, BEAT.spokes) * spokeWinMs
  for (let i = 0; i < r.spokes.length; i++) {
    const local = clamp01((tMs - i * SPOKE_STAGGER_MS) / SPOKE_GROW_MS)
    r.spokes[i]!.scale.y = Math.max(MIN_SCALE, easeOutCubic(local))
  }

  // ---- rim drops in from outside and seats onto the spoke tips
  const rimP = beatP(p, BEAT.rim)
  r.rim.visible = rimP > 0
  r.rim.scale.setScalar(THREE.MathUtils.lerp(1.25, 1, easeOutCubic(rimP)))
}
```

- [ ] **Step 2: Verify beat math before wiring anything**

The windows must exactly tile 0→1 and match the spec's seconds. Run:

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && node -e "
const B={draft:[0,.1],hub:[.1,.2125],spokes:[.2125,.45],rim:[.45,.5875],standUp:[.5875,.8125],settle:[.8125,1]};
let prev=0; for(const [k,[a,b]] of Object.entries(B)){
  if(a!==prev) throw new Error('gap before '+k);
  console.log(k.padEnd(8), (a*8).toFixed(2)+'s ->', (b*8).toFixed(2)+'s'); prev=b;
}
if(prev!==1) throw new Error('does not end at 1');
const win=(.45-.2125)*8000, last=23*58+550;
console.log('spoke window', win+'ms', 'last spoke ends', last+'ms', last<=win?'OK':'OVERFLOW');
"
```

Expected: six contiguous beats ending at 1, and `spoke window 1900ms last spoke ends 1884ms OK`.

- [ ] **Step 3: Add assembly state and the scrub hook to the scene**

In `src/screens/chakra/Chakra3D.tsx`, add the import at the top with the other local imports:

```ts
import {
  applyAssemblyTimeline,
  ASSEMBLY_MS,
  clamp01,
  type AssemblyRefs,
} from './chakraAssembly.ts'
```

Inside `createChakraScene`, immediately after the `let dimGroup: THREE.Group | null = null` declaration, add:

```ts
  /* ------------------------------------------------ assembly state -- */
  // buildP === 1 means "no sequence running" — the resting pose. Values and
  // Flag never start one, so they sit at 1 for the whole of their lifetime.
  let buildP = 1
  let buildT0 = 0
  let assemblyRefs: AssemblyRefs | null = null

  function makeAssemblyRefs(): AssemblyRefs {
    return {
      lean,
      rim,
      hub,
      boss,
      flutes,
      spokes,
      camera,
      camTarget,
      restCam: DIMS_CAM,
      restTgt: WHEEL_TGT,
      restLean: { x: LEAN_X, y: LEAN_Y, posY: 3 },
    }
  }

  function startAssembly(): void {
    assemblyRefs ??= makeAssemblyRefs()
    buildT0 = performance.now()
    buildP = 0
    applyAssemblyTimeline(0, assemblyRefs)
  }

  /** Jump straight to the settled pose. p=1 yields EXACTLY the resting dims view. */
  function finishAssembly(): void {
    if (buildP >= 1) return
    buildP = 1
    assemblyRefs ??= makeAssemblyRefs()
    applyAssemblyTimeline(1, assemblyRefs)
  }
```

- [ ] **Step 4: Start the sequence from setDims and advance it in the render loop**

Replace the body of `setDims` (it currently ends after the camera reframe) with:

```ts
  function setDims(on: boolean) {
    const wasOn = dimsOn
    dimsOn = on
    if (on && dimGroup === null) {
      dimGroup = buildDimGroup()
      chakra.add(dimGroup) // parented to the wheel — callouts rotate with it
    }
    if (dimGroup !== null) dimGroup.visible = on && modeState !== 'flag' // dims never show in flag mode
    // Reframe so the callout ring clears the canvas edge-feather and the
    // stats card. Flag mode owns the camera outright — never fight it.
    if (modeState !== 'flag') {
      camera.position.copy(on ? DIMS_CAM : WHEEL_CAM)
      camTarget.copy(WHEEL_TGT)
      camera.lookAt(camTarget)
    }
    // Entering dims plays the build. Guarded on the transition so the
    // `useEffect([dims])` re-call on the same value cannot restart it.
    if (on && !wasOn && modeState !== 'flag') startAssembly()
  }
```

The render loop is `renderer.setAnimationLoop(...)` at `Chakra3D.tsx:1401`, whose first line is already `const now = performance.now()` (line 1402). Immediately after that line, insert:

```ts
    if (buildP < 1 && assemblyRefs !== null) {
      buildP = clamp01((now - buildT0) / ASSEMBLY_MS)
      applyAssemblyTimeline(buildP, assemblyRefs)
    }
```

Then find the idle-spin / selected-spoke easing block that begins:

```ts
      const goal = selectedIdx !== null ? selectedIdx * SPOKE_STEP : dimsOn ? 0 : null
```

and guard the whole block by wrapping it in:

```ts
    if (buildP >= 1) {
      // ...existing spin/selection easing block, unchanged...
    }
```

so the turntable cannot fight the sequence mid-build.

- [ ] **Step 5: Expose the dev-only scrub hook**

Still inside `createChakraScene`, just before the returned handle object, add:

```ts
  // Dev-only: freeze the sequence at an exact progress so beats can be
  // screenshotted deterministically. Stripped from production builds.
  if (import.meta.env.DEV) {
    ;(window as unknown as { __chakraScrub?: (v: number) => void }).__chakraScrub = (v) => {
      assemblyRefs ??= makeAssemblyRefs()
      buildP = clamp01(v)
      buildT0 = performance.now() - buildP * ASSEMBLY_MS
      applyAssemblyTimeline(buildP, assemblyRefs)
    }
  }
```

- [ ] **Step 6: Typecheck and lint**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && npm run typecheck && npm run lint
```

Expected: both pass with no output errors.

- [ ] **Step 7: Visually verify staging at fixed beats**

Start the dev server via the Browser pane (`preview_start` with `kiosk-dev`), navigate to `http://localhost:5173/#/chakra`, click the **Design** tab, then screenshot at each of these:

```js
window.__chakraScrub(0)     // wheel lies FLAT on the ground, camera looking down
window.__chakraScrub(0.70)  // mid stand-up, camera descending
window.__chakraScrub(1)     // upright, identical to the static dims pose
```

Expected: at `0` the wheel is flat and seen from above; at `1` it matches the pre-change Design tab exactly. All parts are visible throughout — per-part reveal arrives in Task 2.

- [ ] **Step 8: Commit**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && git add src/screens/chakra/chakraAssembly.ts src/screens/chakra/Chakra3D.tsx && git commit -m "feat(chakra): assembly timeline staging + dev scrub hook"
```

---

### Task 2: Per-part reveal

Task 1 already wrote the reveal maths into `applyAssemblyTimeline`. This task verifies it in isolation and fixes the one thing it cannot do yet: parts must be hidden *before* their beat, including on the very first frame.

**Files:**
- Modify: `src/screens/chakra/Chakra3D.tsx`

**Interfaces:**
- Consumes: `applyAssemblyTimeline`, `AssemblyRefs`, `BEAT` from Task 1.
- Produces: no new exports.

- [ ] **Step 1: Verify the reveal at fixed beats**

With the dev server running on the Design tab, screenshot each:

```js
window.__chakraScrub(0.05)   // draft: hub/spokes/rim all absent
window.__chakraScrub(0.16)   // hub present, no spokes, no rim
window.__chakraScrub(0.33)   // spoke cascade mid-sweep — a partial fan
window.__chakraScrub(0.52)   // rim seating onto the tips
window.__chakraScrub(1)      // complete
```

Expected at `0.05`: no hub, no spokes, no rim — only the ground. Expected at `0.33`: a visibly partial fan of spokes, not all 24.

- [ ] **Step 2: If any part is visible before its beat, force the initial hidden state**

`startAssembly` already calls `applyAssemblyTimeline(0, refs)`, which sets hub scale to `MIN_SCALE` and `rim.visible = false`. If a part still flashes on the first frame (possible if the scene renders once before `setDims` runs), make the assembly parts start hidden at construction. Immediately after `chakra.add(rim, hub, boss, flutes)` add:

```ts
  // Assembly starts from nothing; setDims(true) drives them back in. Values and
  // Flag call applyAssemblyTimeline(1) via finishAssembly() on their first frame,
  // which restores full scale, so this cannot leak into those tabs.
  rim.visible = false
  hub.scale.setScalar(0.0001)
  boss.scale.setScalar(0.0001)
  flutes.scale.setScalar(0.0001)
  for (const s of spokes) s.scale.y = 0.0001
```

Then, so non-dims tabs are unaffected, add to the end of `createChakraScene` just before the handle is returned:

```ts
  // Values / Flag never run a sequence — put every part at its resting scale now.
  if (initialMode !== 'flag') finishAssembly()
```

and change `finishAssembly`'s early return so it can run from the resting default:

```ts
  function finishAssembly(): void {
    assemblyRefs ??= makeAssemblyRefs()
    buildP = 1
    applyAssemblyTimeline(1, assemblyRefs)
  }
```

- [ ] **Step 3: Typecheck and lint**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 4: Verify the other two tabs are untouched**

Screenshot the **Values** tab and the **Chakra in Flag** tab. Expected: full wheel on Values (all 24 spokes, rim, hub at full size); Flag tab docking animation completes as before.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && git add src/screens/chakra/Chakra3D.tsx && git commit -m "feat(chakra): reveal assembly parts per beat"
```

---

### Task 3: Callout choreography

Makes the dimension callouts arrive with the part they describe: construction circles sweep on during the draft beat, and each chip fades in on its own beat.

**Files:**
- Modify: `src/screens/chakra/Chakra3D.tsx` (`buildDimGroup`, `makeDimTag`)
- Modify: `src/screens/chakra/chakraAssembly.ts` (`applyAssemblyTimeline`, `AssemblyRefs`)

**Interfaces:**
- Consumes: `BEAT`, `beatP`, `clamp01`, `easeOutCubic`, `AssemblyRefs` from Task 1.
- Produces: `AssemblyRefs` gains `dimGroup: THREE.Group | null`. Every `dimGroup` child carries `userData.beat: number` (0 = draft, 1 = hub, 2 = spokes, 3 = rim).

- [ ] **Step 1: Label every dim child with the beat it belongs to**

In `buildDimGroup`, add a mutable beat cursor and stamp it in the helpers. Replace the helper definitions with:

```ts
  let beat = 0 // which assembly beat this callout belongs to (see chakraAssembly BEAT)

  function line(pts: THREE.Vector3[], dashed: boolean): void {
    const g = new THREE.BufferGeometry().setFromPoints(pts)
    const m = dashed
      ? new THREE.LineDashedMaterial({ color: DIM_GOLD, dashSize: 3.5, gapSize: 2.5 })
      : new THREE.LineBasicMaterial({ color: DIM_GOLD })
    const l = new THREE.Line(g, m)
    if (dashed) l.computeLineDistances()
    l.userData['beat'] = beat
    l.userData['count'] = pts.length // full draw range, for the sweep-on
    group.add(l)
  }
```

and in `tag`:

```ts
  function tag(text: string, x: number, y: number): void {
    const t = makeDimTag(text)
    t.position.set(x, y, z + 2)
    t.userData['beat'] = beat
    group.add(t)
  }
```

Then set the cursor before each group of calls in `buildDimGroup`, leaving the calls themselves unchanged:

```ts
  // official construction circles — struck on the ground first
  beat = 0
  circle(SPEC.outerR, false) // ⌀185
  circle(SPEC.rimInnerR, true) // ⌀160
  circle(SPEC.bulgeR, true) // ⌀64
  circle(SPEC.hubR, true) // ⌀32

  seg(0, SPEC.outerR, 0, 99)
  tag('⌀185', 0, 106)

  beat = 3
  seg(69.3, 40, 80, 46.5)
  tag('⌀160', 90, 52)

  beat = 2
  seg(-27.7, -16, -40, -23)
  tag('⌀64', -50, -29)

  beat = 1
  seg(0, -SPEC.hubR, 0, -25)
  tag('⌀32 hub', 0, -33)

  // 15° wedge between two spokes (90° and 105°)
  beat = 2
  seg(0, 20, 0, 85)
  seg(20 * Math.cos(105 * D2R), 20 * Math.sin(105 * D2R), 85 * Math.cos(105 * D2R), 85 * Math.sin(105 * D2R))
  circle(60, false, 90 * D2R, 105 * D2R)
  tag('15°', -18, 68)

  // one scallop called out (352.5°, on the ⌀160 circle)
  beat = 3
  const sa = -7.5 * D2R
  circle(SPEC.scallopR, false, 0, Math.PI * 2, SPEC.rimInnerR * Math.cos(sa), SPEC.rimInnerR * Math.sin(sa))
  seg(83, -10.9, 94, -14)
  tag('⌀7 × 24', 103, -17) // pulled in from the source's (108,-16) — 910px canvas edge

  // spoke width at the ⌀64 circle (spoke pointing up)
  beat = 2
  seg(-9, 31.86, 9, 31.86)
  seg(9, 33, 22, 42)
  tag('6 → 2', 34, 47)
```

- [ ] **Step 2: Make dim tag sprites start transparent**

In `makeDimTag`, the sprite material must be able to fade. Change its construction to:

```ts
  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: new THREE.CanvasTexture(c),
      depthTest: false,
      transparent: true,
      opacity: 1,
    }),
  )
```

- [ ] **Step 3: Add dimGroup to the refs and choreograph it**

In `chakraAssembly.ts`, add to `AssemblyRefs`:

```ts
  dimGroup: THREE.Group | null
```

and append this to the end of `applyAssemblyTimeline`, before the closing brace:

```ts
  // ---- callouts arrive with the part they describe
  if (r.dimGroup !== null) {
    const beatWindow: Record<number, readonly [number, number]> = {
      0: BEAT.draft,
      1: BEAT.hub,
      2: BEAT.spokes,
      3: BEAT.rim,
    }
    for (const child of r.dimGroup.children) {
      const beat = (child.userData['beat'] as number | undefined) ?? 0
      const local = beatP(p, beatWindow[beat] ?? BEAT.draft)
      if (child instanceof THREE.Line) {
        // Sweep the polyline on like a compass stroke.
        const count = (child.userData['count'] as number | undefined) ?? 0
        child.visible = local > 0
        child.geometry.setDrawRange(0, Math.max(2, Math.ceil(count * easeOutCubic(local))))
      } else if (child instanceof THREE.Sprite) {
        child.material.opacity = local
        child.visible = local > 0
      }
    }
  }
```

- [ ] **Step 4: Pass the dimGroup through from the scene**

In `Chakra3D.tsx`, `makeAssemblyRefs` must supply it. Because `dimGroup` is created lazily in `setDims`, rebuild the refs whenever it changes. Change `makeAssemblyRefs` to include:

```ts
      dimGroup,
```

and in `startAssembly`, always rebuild rather than reuse a stale ref:

```ts
  function startAssembly(): void {
    assemblyRefs = makeAssemblyRefs() // dimGroup may have only just been created
    buildT0 = performance.now()
    buildP = 0
    applyAssemblyTimeline(0, assemblyRefs)
  }
```

- [ ] **Step 5: Typecheck and lint**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 6: Verify callouts arrive on their beats**

Screenshot at each:

```js
window.__chakraScrub(0.05)  // circles part-drawn, no chips except a fading ⌀185
window.__chakraScrub(0.16)  // "⌀32 hub" visible; "⌀160" and "⌀7 × 24" NOT yet
window.__chakraScrub(0.33)  // "15°", "6 → 2", "⌀64" arriving
window.__chakraScrub(0.52)  // "⌀160" and "⌀7 × 24" arriving
window.__chakraScrub(1)     // all chips at full opacity, circles fully drawn
```

Expected at `1`: identical to the static dims view — every circle at full draw range, every chip at opacity 1.

- [ ] **Step 7: Commit**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && git add src/screens/chakra/Chakra3D.tsx src/screens/chakra/chakraAssembly.ts && git commit -m "feat(chakra): callouts arrive with the part they measure"
```

---

### Task 4: God-ray gating, skip-on-touch, and drag lockout

Removes the predicted frame hitch and makes the sequence dismissible.

**Files:**
- Modify: `src/screens/chakra/Chakra3D.tsx`

**Interfaces:**
- Consumes: `BEAT`, `beatP`, `easeInOutCubic` from Task 1; `finishAssembly` from Task 1.
- Produces: no new exports.

- [ ] **Step 1: Skip the ray-march until the wheel stands up, then ramp it in**

The god-ray pass is pure cost while the wheel is flat and incomplete, and it is the known hitch point (depth pre-pass + shadow map + 512px ray-march every frame). Capture the tuned base strength once, next to the assembly state:

```ts
  const RAY_STRENGTH_BASE = 0.4 // matches rayMat's authored uniform
```

In the render loop, `Chakra3D.tsx:1455` currently reads:

```ts
    if (modeState === 'wheel') renderGodRays()
```

**Keep the `modeState` guard** — dropping it would fire the ray-march during flag mode. Replace that single line with:

```ts
    if (modeState === 'wheel' && buildP >= BEAT.standUp[0]) {
      // Rays bloom through the spokes as the wheel rises into the light.
      const ramp = easeInOutCubic(beatP(buildP, [BEAT.standUp[0], 1] as const))
      rayMat.uniforms['strength']!.value = RAY_STRENGTH_BASE * ramp
      renderGodRays()
    }
```

Add `BEAT`, `beatP` and `easeInOutCubic` to the `chakraAssembly.ts` import list.

> Note: commit `bb29fa2` ("Chakra rays: keep beams off the spokes + radial fade") was reverted by `d103a30` with no stated reason. God-ray changes here have been backed out before — verify this step on its own screenshot before moving on.

- [ ] **Step 2: Lock out dragging and make any touch skip**

At the very top of `onPointerDown` (`Chakra3D.tsx:1336`), before the existing `downAt = performance.now()` line, add:

```ts
    // Mid-build: the first touch dismisses the sequence and nothing else.
    if (buildP < 1) {
      finishAssembly()
      return
    }
```

Then add this same early return as the first line of both `onPointerMove` (`Chakra3D.tsx:1354`) and `onPointerUp` (`Chakra3D.tsx:1368`), so a drag begun during the build cannot spin or select on release:

```ts
    if (buildP < 1) return
```

- [ ] **Step 3: Typecheck and lint**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && npm run typecheck && npm run lint
```

Expected: both pass.

- [ ] **Step 4: Verify rays and skip**

```js
window.__chakraScrub(0.30)  // flat build: NO god-ray glow behind the wheel
window.__chakraScrub(0.75)  // standing up: rays ramping in
window.__chakraScrub(1)     // rays at full authored strength (0.4)
```

Then reload the Design tab and, while the build is running, click once on the wheel. Expected: it jumps immediately to the finished annotated pose with no partial geometry, and the wheel is draggable again afterwards.

- [ ] **Step 5: Commit**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && git add src/screens/chakra/Chakra3D.tsx && git commit -m "feat(chakra): gate god-rays to stand-up, skip build on touch"
```

---

### Task 5: Full-sequence verification and tuning

The camera and staging constants in Task 1 were explicitly written as starting values. This task tunes them against real frames and confirms nothing regressed.

**Files:**
- Modify: `src/screens/chakra/chakraAssembly.ts` (constants only)

**Interfaces:**
- Consumes: everything from Tasks 1–4.
- Produces: no new exports.

- [ ] **Step 1: Watch the sequence at full speed**

Reload the Design tab and let all 8s play without scrubbing. Note any moment where the wheel leaves frame, the camera swings too hard, or a part pops rather than travels.

- [ ] **Step 2: Tune the camera and ground constants**

Adjust only these in `chakraAssembly.ts`, re-screenshotting `__chakraScrub(0)` and `__chakraScrub(0.70)` after each change:

- `BUILD_CAM` — raise `y` for a steeper look-down, lower `z` to tighten the framing.
- `BUILD_TGT` — must sit near the assembly's ground height.
- `BUILD_LEAN_Y` — the flat assembly's height; keep it above the shadow catchers at `y ≈ -91`.

- [ ] **Step 3: Confirm callouts never fade against the `.ck-wheel` mask**

`.ck-wheel` carries a 7% edge feather that already damaged the `⌀185` and `⌀7 × 24` chips once. The flat assembly is wider on screen than the upright wheel, so check the widest moment:

```js
window.__chakraScrub(0.55)  // fully assembled, still flat — widest on-screen extent
```

Expected: every construction circle and chip fully opaque, none washing out at the edges. If any do, reduce the flat-stage scale by pulling `BUILD_CAM.z` further back rather than weakening the mask.

- [ ] **Step 4: Regression pass on the other tabs**

Screenshot **Values** and **Chakra in Flag**. Expected: Values shows the full-size wheel with all 24 spokes and no camera change; Flag completes its docking animation and shows the waving flag with the chakra seated in the white band.

- [ ] **Step 5: Final gate**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && npm run typecheck && npm run lint && npm run build
```

Expected: all three succeed. `build` additionally proves the `import.meta.env.DEV` scrub hook is stripped from the production bundle.

- [ ] **Step 6: Commit**

```bash
cd "/Users/ayush/Flag Foundation/flag-foundation-kiosk" && git add src/screens/chakra/chakraAssembly.ts && git commit -m "feat(chakra): tune assembly camera staging"
```

---

## Spec coverage

| Spec requirement | Task |
|---|---|
| Design tab intro, replays on entry | 1 (`setDims` transition guard) |
| 8.0s, six beats, `buildP` master timeline | 1 |
| Ends frame-identical to static dims pose | 1 (`applyAssemblyTimeline(1)`), 5 (verified) |
| Draft beat — circles sweep on | 3 |
| Hub / spokes / rim reveal mechanics | 1 (maths), 2 (verified + initial hidden state) |
| Spoke cascade 58ms stagger, grows from hub | 1 |
| Stand-up + camera lerp | 1, tuned in 5 |
| Callouts arrive per beat | 3 |
| God-rays skipped then ramped | 4 |
| Skip on touch, drag lockout | 4 |
| Timeline stays scene-owned (StrictMode) | 1 (lives in `createChakraScene`) |
| Choreography in its own module | 1 |
| Values / Flag unchanged | 2, 5 |
| Mask-feather check on callouts | 5 |
