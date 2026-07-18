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
  dimGroup: THREE.Group | null
}

/** Never scale to exactly 0 — degenerate matrices produce NaN normals. Shared
 *  with Chakra3D's construction-time hide block so the two cannot drift. */
export const MIN_SCALE = 0.0001

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
}
