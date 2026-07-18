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

/**
 * Beat windows as fractions of the master progress.
 *
 * There is deliberately no "draft" beat: every construction circle now forms
 * with the part it measures (⌀32 with the hub, ⌀64 with the spokes, ⌀160/⌀185
 * with the rim) rather than all being struck up front, so the drawing builds
 * itself one measurement at a time. The 0.8 s the draft beat used to hold was
 * redistributed into hub/spokes/rim, which now carry the extra callout work.
 */
export const BEAT = {
  hub: [0.0, 0.1625] as const, // 0.0–1.3 s
  spokes: [0.1625, 0.4625] as const, // 1.3–3.7 s
  rim: [0.4625, 0.6625] as const, // 3.7–5.3 s
  standUp: [0.6625, 0.8625] as const, // 5.3–6.9 s
  settle: [0.8625, 1.0] as const, // 6.9–8.0 s
}

/* ---------------------------------------------------------- callout timing --
 * Inside each beat: the construction line sweeps on first, then the chips it
 * belongs to animate in, staggered so several callouts in one beat arrive in
 * sequence rather than together. */

/** Fraction of a beat over which a construction line finishes drawing. */
export const LINE_DRAW = 0.6
/** Where the first chip in a beat starts (leaves the line a head start). */
export const CHIP_LEAD = 0.25
/** How long one chip's count-up / type-on runs, as a fraction of its beat. */
export const CHIP_SPAN = 0.5

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

/**
 * Camera start: high look-down onto the drafting floor.
 *
 * Tuned against screenshots. Pulled back along the view axis (away from
 * BUILD_TGT, ~25%) from an initial (0, 210, 250): the flat assembly reads wider
 * on screen than the upright wheel, and at the closer framing the `⌀7 × 24`
 * callout pushed into the 7% edge-feather mask on `.ck-wheel` and washed out —
 * the same failure the mask caused before the Design tab was reframed. Backing
 * the camera off shrinks the whole drawing instead of weakening the mask, which
 * would let the god-ray field print its rectangle on the plate again.
 */
export const BUILD_CAM = new THREE.Vector3(0, 282, 312)
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
  dimGroup: THREE.Group | null
}

/** Never scale to exactly 0 — degenerate matrices produce NaN normals. Shared
 *  with Chakra3D's construction-time hide block so the two cannot drift. */
export const MIN_SCALE = 0.0001

/* ------------------------------------------------------ animated chip text --
 * A callout reads as if it were being written onto the sheet: symbols and words
 * type on left-to-right, and every number rolls up to its value as it is
 * reached. Both are derived from one progress value so the whole thing stays a
 * pure function of `p`.
 *
 * A tag is split into units — one per non-digit character, one per digit RUN
 * (so "185" rolls as a single number, not three characters). */

export interface TagUnit {
  /** Literal character, for symbols and words. */
  text?: string
  /** Target value, for a digit run — counts up to this. */
  num?: number
}

export function parseTagUnits(full: string): TagUnit[] {
  const units: TagUnit[] = []
  let i = 0
  while (i < full.length) {
    const c = full[i]!
    if (c >= '0' && c <= '9') {
      let j = i
      while (j < full.length && full[j]! >= '0' && full[j]! <= '9') j++
      units.push({ num: Number(full.slice(i, j)) })
      i = j
    } else {
      units.push({ text: c })
      i++
    }
  }
  return units
}

/** Units are revealed across this fraction of the chip window; the tail is left
 *  so the last number still has room to finish rolling. */
const TYPE_SPAN = 0.75
/** How long one number takes to roll up once it is reached. */
const NUM_SPAN = 0.35

/**
 * The tag's visible string at chip-progress `p`.
 *
 * At p >= 1 this returns the full text exactly — that is what lets the settled
 * frame match the static dims view character for character.
 */
export function tagTextAt(units: TagUnit[], p: number): string {
  let out = ''
  for (let i = 0; i < units.length; i++) {
    const start = (i / units.length) * TYPE_SPAN
    if (p < start) break // not yet typed — everything after is unreached too
    const u = units[i]!
    if (u.text !== undefined) {
      out += u.text
    } else {
      const q = clamp01((p - start) / NUM_SPAN)
      out += String(Math.round(u.num! * easeOutCubic(q)))
    }
  }
  return out
}

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

  // ---- callouts arrive with the part they describe
  if (r.dimGroup !== null) {
    const beatWindow: Record<number, readonly [number, number]> = {
      1: BEAT.hub,
      2: BEAT.spokes,
      3: BEAT.rim,
    }
    // How many chips share each beat — set by buildDimGroup, used to stagger them.
    const tagCounts = (r.dimGroup.userData['tagCounts'] as Record<number, number>) ?? {}

    for (const child of r.dimGroup.children) {
      const beat = (child.userData['beat'] as number | undefined) ?? 1
      const local = beatP(p, beatWindow[beat] ?? BEAT.hub)

      if (child instanceof THREE.Line) {
        // Sweep the polyline on like a compass stroke, ahead of its chips.
        const count = (child.userData['count'] as number | undefined) ?? 0
        const lineP = clamp01(local / LINE_DRAW)
        child.visible = lineP > 0
        child.geometry.setDrawRange(0, Math.max(2, Math.ceil(count * easeOutCubic(lineP))))
      } else if (child instanceof THREE.Sprite) {
        // Stagger chips within the beat so several callouts arrive in sequence.
        const n = tagCounts[beat] ?? 1
        const seq = (child.userData['seq'] as number | undefined) ?? 0
        const slack = 1 - CHIP_LEAD - CHIP_SPAN
        const start = CHIP_LEAD + (n > 1 ? (seq / (n - 1)) * slack : 0)
        const chipP = clamp01((local - start) / CHIP_SPAN)

        child.material.opacity = clamp01(chipP * 3) // pill fades in fast, then text writes
        child.visible = chipP > 0

        // Repaint only when the string actually changes. Calling this twice with
        // the same `p` is a no-op the second time, so purity is preserved while
        // texture uploads stay down to a handful per chip.
        const units = child.userData['units'] as TagUnit[] | undefined
        const draw = child.userData['draw'] as ((s: string) => void) | undefined
        if (units !== undefined && draw !== undefined) {
          const next = tagTextAt(units, chipP)
          if (next !== child.userData['lastText']) {
            child.userData['lastText'] = next
            draw(next)
          }
        }
      }
    }
  }
}
