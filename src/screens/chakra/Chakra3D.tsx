/**
 * Chakra3D — interactive parametric Ashoka Chakra (three.js).
 *
 * Geometry + picking lifted from the user's "Ashoka Chakra 3D Model" build 9
 * (ashoka-chakra-3d.html): official IS1 construction-sheet dimensions —
 * 24 spokes @15°, ⌀185 : ⌀160 : ⌀32 hub, scallops ⌀7 — in navy #06038D.
 * The lil-gui/toolbar/flag-sim chrome of the source is dropped; lighting is
 * re-rigged warm so the wheel sits naturally on the Figma sunset background.
 *
 * This module is the ONLY importer of three.js and must stay behind
 * React.lazy() so the ~500 kB of three lands in its own async chunk.
 *
 * Controlled component: the parent owns `selectedSpoke` (1-based). Tapping a
 * spoke fires onSpokeTap; tapping empty canvas fires onBackgroundTap. Dragging
 * horizontally spins the wheel on its own axle with flick inertia (tap vs drag
 * is an 8px slop test — no camera orbit, kiosk users can't strand the view).
 * While a spoke is selected the wheel eases around so that spoke points up and
 * the spoke pulses gold; otherwise, ~4s after the last touch, the slow idle
 * turntable resumes. With `dims` on (Design tab) the turntable stays off and
 * the wheel carries the official construction callouts — dashed IS1 circles,
 * the 15° wedge, leader lines and chip sprites, ported from the source
 * build's buildDims() — parented to the wheel group so they track drag
 * rotation; the wheel eases back upright when the visitor lets go.
 *
 * mode="flag" (Chakra in Flag tab) ports the source build's "See chakra in
 * flag" sequence: buildFlag() (pole + finial + base + Verlet-cloth Tiranga
 * with a canvas tricolor texture, pre-warmed into a mid-wave pose), then the
 * master timeline of setFlagMode(true) — time-based flagP 0→1 over 3.2 s,
 * camera + target lerped between keyed endpoints, and the NO-OVERLAP
 * choreography of applyFlagTimeline(): the chakra shrinks in place, the flag
 * fades in behind it, the small wheel glides onto the printed chakra (⌀185 =
 * 92.5% of the white band) and melts in under a golden flash. After landing
 * the breeze ramps in and the flag waves for as long as the tab is open.
 * Drag/picking/dims are disabled in flag mode (flagMode gates them in the
 * source). Camera endpoints are re-derived for the 801×1197 hero slot (the
 * source framed a full window) and the pole is lengthened so it runs off the
 * bottom of the slot like the static flag-pole.png the scene replaces.
 *
 * entrance="roll" (section intro) rolls the finished wheel in from off-stage
 * left like a real wheel: ONE remaining-travel number drives both the box
 * translation (reported to the parent via onRollFrame — the parent owns the
 * .ck-wheel box and its edge-feather mask) and the axle spin (travel over the
 * wheel's SCREEN radius), so the tread never slips on the ground. It settles
 * with a small rock-back, then onRollDone fires and the god-rays reignite.
 */
import { useEffect, useRef, type CSSProperties } from 'react'
import * as THREE from 'three'
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import {
  applyAssemblyTimeline,
  ASSEMBLY_MS,
  BEAT,
  beatP,
  clamp01,
  MIN_SCALE,
  parseTagUnits,
  type AssemblyRefs,
} from './chakraAssembly.ts'

export interface Chakra3DProps {
  /** Square canvas size in stage px (Figma wheel box is 910). */
  size?: number
  /** Canvas width in stage px; defaults to `size`. (Flag hero slot is 801×1197.) */
  width?: number
  /** Canvas height in stage px; defaults to `size`. */
  height?: number
  /**
   * 'wheel' (default) — the interactive wheel. 'flag' — the Tiranga docking
   * scene: the wheel shrinks and locks into the white band of a waving flag.
   * Switching to 'flag' plays the master timeline forward; back to 'wheel'
   * reverses it. Unmounting disposes all flag resources.
   */
  mode?: 'wheel' | 'flag'
  /** 1-based selected spoke, or null for none. */
  selectedSpoke?: number | null
  /** Idle turntable rotation when nothing is selected. */
  spin?: boolean
  /** Show the construction-sheet dimension overlay (Design tab). */
  dims?: boolean
  /** Enable tap-to-select raycasting (drag-to-spin is always on). */
  interactive?: boolean
  /**
   * Section-entrance state machine, owned by the parent:
   *   'hold' — wheel waits UPRIGHT off-stage left (parent is still waiting
   *            for the background to be ready);
   *   'roll' — the roll timeline starts (or started);
   *   'none' — no entrance; mid-roll this is the parent's skip and snaps
   *            the wheel home instantly.
   * Whether an entrance exists at all is read at scene creation ('none' vs
   * the other two). Wheel mode only — Design/Flag mounts ignore it.
   */
  entrance?: 'hold' | 'roll' | 'none'
  /**
   * Rolling entrance frames: the current translateX for the WHEEL BOX in
   * canvas px (negative while travelling, 0 at rest). The scene owns the
   * timeline so translation and axle spin can never slip against each other;
   * the parent just writes this onto its .ck-wheel element.
   */
  onRollFrame?: (xPx: number) => void
  /** Rolling entrance settled (or was skipped) — reveal the chrome. */
  onRollDone?: () => void
  onSpokeTap?: (spoke: number) => void
  onBackgroundTap?: () => void
  className?: string
  style?: CSSProperties
}

/* ------------------------------------------------------------------ *
 * OFFICIAL CONSTRUCTION-SHEET GEOMETRY (source: build 9 SPEC)
 * ------------------------------------------------------------------ */
const SPEC = {
  outerR: 92.5, // rim outer radius            (⌀185)
  rimInnerR: 80, // rim inner edge radius       (⌀160)
  scallopR: 3.5, // half-circle bumps on the inner edge (⌀7)
  scallopCount: 24, // one between each pair of spokes, at 7.5°
  bulgeR: 32, // circle of maximum spoke width (⌀64)
  hubR: 16, // hub radius                  (⌀32)
  spokeCount: 24, // fixed by the Flag Code — every 15°
  spokeHalfWBulge: 3, // spoke half-width at the ⌀64 circle (width 6)
  spokeHalfWHub: 1, // spoke half-width at the hub        (width 2)
  colour: 0x06038d,
} as const

const DEPTH = 5.5
const BEVEL = 1.4 // generous rounded bevels roll the light like the reference render
const IDLE_SPIN = 0.0035 // rad/frame, matches source build
const IDLE_RESUME_MS = 4000 // idle turntable resumes this long after the last touch
const TAP_SLOP_PX = 8 // finger travel below this = tap (raycast select); above = drag
const DRAG_ROT = 3.2 // radians of axle spin per full canvas-width drag
const INERTIA_DAMP = 0.94 // per-frame flick decay (source OrbitControls damping 0.06)
const MAX_FLING = 0.3 // rad/frame cap on release velocity
const MIN_FLING = 0.00012 // below this the flick is spent
const DIM_GOLD = 0xffb300 // construction-line gold (source build)
const SPOKE_STEP = (Math.PI * 2) / SPEC.spokeCount
const HIGHLIGHT = new THREE.Color(0xffb300)

/* Rolling entrance (entrance="hold"/"roll"). Travel is in canvas px: the
   .ck-wheel box sits at stage x 455 and the wheel's centre lands at ~964, so
   1420px clears the whole box past the stage's left edge with margin. The
   wheel rolls UPRIGHT (a leaned wheel translating reads as sliding — user
   2026-07-20) and only leans into the 3/4 hero pose after it has landed. */
const ROLL_MS = 1800 // travel + settle rock-back
const ROLL_TRAVEL_PX = 1420
const ROLL_OVER = 0.023 // rolls ~33px past home before rocking back
const ROLL_APEX = 0.8 // fraction of the timeline spent reaching that apex
const ROLL_LEAN_MS = 650 // post-landing turn into the 3/4 resting pose
const ROLL_RAY_MS = 700 // god-ray reignite after the wheel is home

/** Constant-friction roll: velocity decays linearly to zero at an apex just
 * past home (easeOutQuad — how a real wheel coasts to a stop), then eases
 * back down the remaining 2.3% — the settle rock. C1-smooth at the apex
 * (both pieces arrive with zero velocity). */
function rollEase(t: number): number {
  if (t <= ROLL_APEX) {
    const u = t / ROLL_APEX
    return (1 + ROLL_OVER) * u * (2 - u)
  }
  const v = (t - ROLL_APEX) / (1 - ROLL_APEX)
  return 1 + (ROLL_OVER * (1 + Math.cos(Math.PI * v))) / 2
}

/** Re-home `target` to the equivalent angle (mod 2π) nearest `current`. */
function nearestTurn(target: number, current: number): number {
  return target + Math.round((current - target) / (Math.PI * 2)) * (Math.PI * 2)
}
/** Wheel lean so it reads as standing on the ground like the Figma render. */
const LEAN_Y = 0.3
const LEAN_X = 0.02

/* Inner rim contour: r=80 circle with 24 semicircular bumps (r=3.5)
   protruding inward, centred every 15° starting at 7.5° (between spokes). */
function innerContourRadius(a: number): number {
  const step = (2 * Math.PI) / SPEC.scallopCount
  const k = Math.round((a - step / 2) / step)
  const centreAngle = step / 2 + k * step
  const d = a - centreAngle
  const D = SPEC.rimInnerR
  const s = SPEC.scallopR
  const disc = s * s - D * D * Math.sin(d) * Math.sin(d)
  if (disc <= 0) return D
  return D * Math.cos(d) - Math.sqrt(disc) // near intersection = inward bump
}

function buildRimGeometry(depth: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, SPEC.outerR, 0, Math.PI * 2, false)
  const hole = new THREE.Path()
  const N = 1440
  for (let i = 0; i <= N; i++) {
    const a = -(i / N) * Math.PI * 2 // clockwise ⇒ valid hole
    const r = innerContourRadius(a)
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    if (i === 0) hole.moveTo(x, y)
    else hole.lineTo(x, y)
  }
  shape.holes.push(hole)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel * 0.7,
    bevelSize: bevel * 0.6,
    bevelSegments: 3,
    curveSegments: 128,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

/* Spoke: sharp tip on the ⌀160 circle, half-width 3 on the ⌀64 circle,
   half-width 1 at the hub, root closed with an arc tucked into the hub. */
function buildSpokeGeometry(depth: number, bevel: number): THREE.ExtrudeGeometry {
  const tipR = SPEC.rimInnerR
  const rootR = SPEC.hubR - 0.6 // sink into hub
  const yBulge = Math.sqrt(SPEC.bulgeR ** 2 - SPEC.spokeHalfWBulge ** 2)
  const xRoot = SPEC.spokeHalfWHub
  const yRoot = Math.sqrt(rootR ** 2 - xRoot ** 2)

  const s = new THREE.Shape()
  s.moveTo(0, tipR)
  s.lineTo(SPEC.spokeHalfWBulge, yBulge)
  s.lineTo(xRoot, yRoot)
  const aR = Math.atan2(yRoot, xRoot)
  const aL = Math.atan2(yRoot, -xRoot)
  s.absarc(0, 0, rootR, aR, aL, false)
  s.lineTo(-SPEC.spokeHalfWBulge, yBulge)
  s.closePath()

  const g = new THREE.ExtrudeGeometry(s, {
    depth: depth * 0.82,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.75,
    bevelSegments: 4,
    curveSegments: 24,
  })
  g.translate(0, 0, (-depth * 0.82) / 2)
  return g
}

function buildHubGeometry(depth: number, bevel: number): THREE.ExtrudeGeometry {
  const shape = new THREE.Shape()
  shape.absarc(0, 0, SPEC.hubR, 0, Math.PI * 2, false)
  const g = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel * 0.9,
    bevelSegments: 4,
    curveSegments: 64,
  })
  g.translate(0, 0, -depth / 2)
  return g
}

/* Decorative radial flutes on both hub faces (classic metal-emblem look). */
function buildFluteGeometry(depth: number): THREE.BufferGeometry {
  const n = 40
  const inner = 5.4
  const outer = SPEC.hubR - 1.2
  const h = 1.15
  const geos: THREE.BufferGeometry[] = []
  const halfAng = (Math.PI / n) * 0.72
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2
    const shape = new THREE.Shape()
    shape.moveTo(inner * Math.cos(a - halfAng * 2.2), inner * Math.sin(a - halfAng * 2.2))
    shape.lineTo(outer * Math.cos(a - halfAng), outer * Math.sin(a - halfAng))
    shape.lineTo(outer * Math.cos(a + halfAng), outer * Math.sin(a + halfAng))
    shape.lineTo(inner * Math.cos(a + halfAng * 2.2), inner * Math.sin(a + halfAng * 2.2))
    shape.closePath()
    const g = new THREE.ExtrudeGeometry(shape, { depth: h, bevelEnabled: false })
    const front = g.clone()
    front.translate(0, 0, depth / 2 + 0.55)
    const back = g.clone()
    back.translate(0, 0, -depth / 2 - 0.55 - h)
    geos.push(front, back)
    g.dispose()
  }
  return mergeGeometries(geos)
}

/* ------------------------------------------------- dimension overlay -- *
 * Port of the source build's makeLabel/makeTag + buildDims(): dashed
 * construction circles, the 15° wedge, leader lines and chip labels as
 * canvas sprites. Restyled for the kiosk — cream/gold rounded chip with
 * navy text (the source's dark chip vanishes against the sunset plate). */

function roundedRectPath(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  r: number,
): void {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

/**
 * A dimension chip whose text can be repainted while the assembly runs, so the
 * numbers roll up and the symbols type on.
 *
 * The canvas is measured and sized from the FULL text and never resized. The
 * sprite's scale is derived from that fixed canvas, so a half-typed chip keeps
 * the geometry of the finished one — sizing per frame would make the chip
 * visibly grow and jitter as characters land.
 *
 * `userData.draw(str)` repaints; `userData.units` is the parsed count-up/type-on
 * script; `userData.lastText` is the repaint cache.
 */
function makeDimTag(text: string): THREE.Sprite {
  const fs = 46
  const pad = 18
  const font = `600 ${fs}px Poppins, 'Segoe UI', sans-serif`
  const c = document.createElement('canvas')
  const ctx = c.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  ctx.font = font
  const tw = Math.ceil(ctx.measureText(text).width)
  c.width = tw + pad * 2
  c.height = Math.round(fs + pad * 1.3)
  const tex = new THREE.CanvasTexture(c)

  const draw = (s: string): void => {
    ctx.clearRect(0, 0, c.width, c.height)
    ctx.font = font // resizing/clearing the canvas resets context state
    roundedRectPath(ctx, 2, 2, c.width - 4, c.height - 4, 16)
    ctx.fillStyle = 'rgba(255, 247, 229, 0.95)' // cream chip
    ctx.fill()
    ctx.lineWidth = 3
    ctx.strokeStyle = '#d9a514' // gold border
    ctx.stroke()
    ctx.fillStyle = '#06038d' // navy text (chakra colour)
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText(s, c.width / 2, c.height / 2 + 2)
    tex.needsUpdate = true
  }
  draw(text)

  const sp = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true, opacity: 1 }),
  )
  sp.renderOrder = 10
  const h = 9
  sp.scale.set((h * c.width) / c.height, h, 1)
  sp.userData['units'] = parseTagUnits(text)
  sp.userData['draw'] = draw
  sp.userData['lastText'] = text
  return sp
}

/** The dimGroup — parent to the wheel group so callouts rotate WITH it. */
function buildDimGroup(): THREE.Group {
  const group = new THREE.Group()
  group.name = 'Dimensions'
  const z = DEPTH / 2 + 5
  const D2R = Math.PI / 180

  // Which assembly beat this callout belongs to (see chakraAssembly BEAT):
  // 1 = hub, 2 = spokes, 3 = rim. Every line forms with the part it measures.
  let beat = 1
  /** Chips per beat, so the timeline can stagger them within their window. */
  const tagCounts: Record<number, number> = {}

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
  function circle(r: number, dashed: boolean, a0 = 0, a1 = Math.PI * 2, cx = 0, cy = 0): void {
    const pts: THREE.Vector3[] = []
    const n = Math.max(16, Math.round((96 * (a1 - a0)) / (Math.PI * 2)))
    for (let i = 0; i <= n; i++) {
      const a = a0 + ((a1 - a0) * i) / n
      pts.push(new THREE.Vector3(cx + r * Math.cos(a), cy + r * Math.sin(a), z))
    }
    line(pts, dashed)
  }
  function seg(x1: number, y1: number, x2: number, y2: number, dashed = false): void {
    line([new THREE.Vector3(x1, y1, z), new THREE.Vector3(x2, y2, z)], dashed)
  }
  function tag(text: string, x: number, y: number): void {
    const t = makeDimTag(text)
    t.position.set(x, y, z + 2)
    t.userData['beat'] = beat
    t.userData['seq'] = tagCounts[beat] ?? 0
    tagCounts[beat] = (tagCounts[beat] ?? 0) + 1
    group.add(t)
  }

  // ---- HUB beat: the ⌀32 circle is struck as the hub itself appears.
  beat = 1
  circle(SPEC.hubR, true) // ⌀32
  seg(0, -SPEC.hubR, 0, -25)
  tag('⌀32 hub', 0, -33)

  // ---- SPOKES beat: the ⌀64 bulge circle forms as the spokes sweep out.
  beat = 2
  circle(SPEC.bulgeR, true) // ⌀64
  seg(-27.7, -16, -40, -23)
  tag('⌀64', -50, -29)

  // ---- RIM beat: the two ring circles form as the rim seats onto the tips.
  beat = 3
  circle(SPEC.outerR, false) // ⌀185
  circle(SPEC.rimInnerR, true) // ⌀160
  seg(0, SPEC.outerR, 0, 99)
  tag('⌀185', 0, 106)
  seg(69.3, 40, 80, 46.5)
  tag('⌀160', 90, 52)

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

  group.userData['tagCounts'] = tagCounts
  return group
}

function disposeDimGroup(group: THREE.Group): void {
  group.traverse((o) => {
    if (o instanceof THREE.Line) {
      o.geometry.dispose()
      ;(o.material as THREE.Material).dispose()
    } else if (o instanceof THREE.Sprite) {
      o.material.map?.dispose()
      o.material.dispose()
    }
  })
}

/* ----------------------------------------------------- tiranga flag -- *
 * Port of the source build's "See chakra in flag": official construction
 * (IS 1 / Flag Code) — ratio 2:3, three equal bands, chakra ⌀185 = 92.5% of
 * the 200-unit white band on the 900×600 sheet. Cloth is a Verlet particle
 * sim pinned at the hoist. */

const FLAG_COLORS = { saffron: '#FF671F', white: '#FFFFFF', green: '#046A38', navy: '#06038D' }
const CLOTH = { w: 180, h: 120, sx: 40, sy: 26 } as const
const WIND_STRENGTH = 1.0 // source params.wind
const FLAG_ANIM_MS = 3200 // full-timeline duration, scaled by remaining distance
/* Pole: source used length 202 (base on a visible floor). The kiosk hero slot
   crops like the static flag-pole.png — pole runs off the bottom edge, base
   never visible — so the pole is lengthened downward. */
const POLE_X = -92
const POLE_TOP = 84
const POLE_LEN = 520
/* ONE PERSISTENT FULL-STAGE CANVAS for all three tabs (user 2026-07-20:
   the chakra must never disappear across pill switches, and its light must
   fill the WHOLE screen — no clipping, no edge feathering). The canvas is
   exactly the 1920×1080 stage, so the god-ray light simply ends at the
   screen like any real light would. Every camera below is re-derived so
   each tab's framing lands on the SAME stage pixels as always:
     Values wheel  stage (964.4, 626.4) r 360.4
     Design wheel  stage (957.3, 627.9) r 313.4
     Flag opening  stage (962.6, 702.0) r 339.8
   Derivation: canvas centre stage (960, 540); px/unit s = 1080/(2·tan20°·z);
   camera+target share xy (axis through them), a world point (x,y) lands at
   canvasCentre + ((x−tx)·s, −(y−ty)·s). Tab switches TWEEN between these. */
const WHEEL_CAM = new THREE.Vector3(12.88, 25.16, 380.8)
const WHEEL_TGT = new THREE.Vector3(12.88, 25.16, 0)
/* Design framing: pulled back so the callout ring (~1.28× rim) clears the
   stats card. */
const DIMS_CAM = new THREE.Vector3(14.8, 28.94, 437.9)
const DIMS_TGT = new THREE.Vector3(14.8, 28.94, 0)
/* Flag HOME: the docking timeline's wheel-side framing (also the initial
   camera if a scene is created directly in flag mode). ~95% of the Values
   wheel, seated a touch lower — the shrink-to-dock owns it from there. */
const FLAG_CAM_HOME = new THREE.Vector3(-0.71, 44.1, 403.9)
const FLAG_TGT_HOME = new THREE.Vector3(-0.71, 44.1, 0)
/* DOCK: same apparent flag size/stage position as ever — s preserved at
   2.759 px/unit (z 537.7), target shifted for the full-stage centre. */
const FLAG_CAM_DOCK = new THREE.Vector3(41.05, 73.2, 537.7)
const FLAG_TGT_DOCK = new THREE.Vector3(-18.95, 45.2, 0)
const CHAKRA_HOME_POS = new THREE.Vector3(0, 0, 0)
const GLOW_COLOR = new THREE.Color(1.0, 0.82, 0.45)

const S = (t: number) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t)) // smoothstep
const easeInOutCubic = (t: number) => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2)

/** Draw the flat printed chakra (official contour) onto the flag canvas. */
function drawChakra2D(ctx: CanvasRenderingContext2D, cx: number, cy: number, R: number): void {
  const s = R / SPEC.outerR
  ctx.save()
  ctx.translate(cx, cy)
  ctx.scale(s, s)
  // rim disc
  ctx.fillStyle = FLAG_COLORS.navy
  ctx.beginPath()
  ctx.arc(0, 0, SPEC.outerR, 0, Math.PI * 2)
  ctx.fill()
  // reopen the middle with the scalloped inner contour (bumps stay navy)
  ctx.fillStyle = FLAG_COLORS.white
  ctx.beginPath()
  for (let i = 0; i <= 720; i++) {
    const a = (i / 720) * Math.PI * 2
    const r = innerContourRadius(a)
    const x = r * Math.cos(a)
    const y = r * Math.sin(a)
    if (i === 0) ctx.moveTo(x, y)
    else ctx.lineTo(x, y)
  }
  ctx.fill()
  // 24 spokes
  ctx.fillStyle = FLAG_COLORS.navy
  const yb = Math.sqrt(SPEC.bulgeR ** 2 - SPEC.spokeHalfWBulge ** 2)
  const yh = Math.sqrt(SPEC.hubR ** 2 - SPEC.spokeHalfWHub ** 2)
  const pts: [number, number][] = [
    [0, -SPEC.rimInnerR],
    [SPEC.spokeHalfWBulge, -yb],
    [SPEC.spokeHalfWHub, -yh],
    [-SPEC.spokeHalfWHub, -yh],
    [-SPEC.spokeHalfWBulge, -yb],
  ]
  for (let k = 0; k < 24; k++) {
    const a = (k * Math.PI) / 12
    const c = Math.cos(a)
    const sn = Math.sin(a)
    ctx.beginPath()
    pts.forEach(([x, y], i) => {
      const rx = x * c - y * sn
      const ry = x * sn + y * c
      if (i === 0) ctx.moveTo(rx, ry)
      else ctx.lineTo(rx, ry)
    })
    ctx.closePath()
    ctx.fill()
  }
  // hub
  ctx.beginPath()
  ctx.arc(0, 0, SPEC.hubR, 0, Math.PI * 2)
  ctx.fill()
  ctx.restore()
}

/** Canvas tricolor: three equal bands + the printed chakra at 92.5% of the band. */
function makeFlagTexture(): THREE.CanvasTexture {
  const W = 1536
  const H = 1024
  const band = H / 3
  const c = document.createElement('canvas')
  c.width = W
  c.height = H
  const ctx = c.getContext('2d')
  if (ctx === null) throw new Error('2D canvas unavailable')
  ctx.fillStyle = FLAG_COLORS.saffron
  ctx.fillRect(0, 0, W, band)
  ctx.fillStyle = FLAG_COLORS.white
  ctx.fillRect(0, band, W, band)
  ctx.fillStyle = FLAG_COLORS.green
  ctx.fillRect(0, band * 2, W, band)
  drawChakra2D(ctx, W / 2, H / 2, (0.925 * band) / 2) // ⌀185 on a 200 band
  const tex = new THREE.CanvasTexture(c)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  return tex
}

/* ------------------------------------------------------------------ */

interface SceneHandle {
  canvas: HTMLCanvasElement
  setSelected(spoke: number | null): void
  setSpin(on: boolean): void
  setDims(on: boolean): void
  setMode(mode: 'wheel' | 'flag'): void
  startRoll(): void
  finishRoll(): void
  dispose(): void
}

interface SceneCallbacks {
  onSpokeTap(spoke: number): void
  onBackgroundTap(): void
  isInteractive(): boolean
  onRollFrame(xPx: number): void
  onRollDone(): void
}

function createChakraScene(
  width: number,
  height: number,
  initialMode: 'wheel' | 'flag',
  cbs: SceneCallbacks,
  entranceRoll: boolean,
): SceneHandle {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true })
  // Full-stage canvas: cap dpr at 1.5 to bound the per-frame cost (the kiosk
  // panel is dpr 1 and unaffected; only hi-dpi dev machines trade a little
  // supersampling for headroom).
  renderer.setPixelRatio(Math.min(window.devicePixelRatio, 1.5))
  renderer.setSize(width, height)
  renderer.toneMapping = THREE.ACESFilmicToneMapping
  // Matched against figma-refs/chakra-values.png: lit faces read rich
  // cobalt, shadow faces deep navy.
  renderer.toneMappingExposure = 1.28
  renderer.shadowMap.enabled = true
  renderer.shadowMap.type = THREE.PCFSoftShadowMap

  const scene = new THREE.Scene() // background stays transparent (alpha)

  const camera = new THREE.PerspectiveCamera(40, width / height, 0.5, 2000)
  const camTarget = new THREE.Vector3()
  // A flag-mode mount starts at the flag timeline's chakra-side endpoint so
  // the docking animation's camP0 (current camera) is already framed right.
  camera.position.copy(initialMode === 'flag' ? FLAG_CAM_HOME : WHEEL_CAM)
  camTarget.copy(initialMode === 'flag' ? FLAG_TGT_HOME : WHEEL_TGT)
  camera.lookAt(camTarget)

  // Soft studio environment gives the navy a subtle sheen… (kept LOW so
  // the body colour stays the flag navy, not studio-brightened blue)
  //
  // Starts at intensity 0. RoomEnvironment is a COOL probe, and the body colour
  // is a bright cobalt (0x1236b0), so any studio contribution before the warm
  // sunset env lands renders the wheel light blue — visible as a one-frame
  // colour pop on every cold mount, because building the real env from
  // bg-sunset.png is async and its PMREM pass costs a few frames. Held at 0,
  // the wheel is lit only by the warm rig below and reads navy immediately;
  // the loader raises this to its authored value once the real env is ready,
  // so the change is a gain in sheen rather than a shift in hue.
  const pmrem = new THREE.PMREMGenerator(renderer)
  const envTex = pmrem.fromScene(new RoomEnvironment(), 0.04).texture
  scene.environment = envTex
  scene.environmentIntensity = 0

  // Studio rig read straight off the plate (classic 4-point, podcast-style):
  // the plate's SUN is low and BEHIND-RIGHT → the hottest light is a back
  // RIM that burns the wheel's right edges; the bright right sky is the soft
  // KEY (spot with falloff so the flat face still grades); the dark-cloud
  // left side gets a cool FILL that keeps shade readable without flattening;
  // the mirror-bright floor justifies a warm KICKER up into the bottom rim;
  // a second faint rim separates the left edge from the dark clouds.
  const hemi = new THREE.HemisphereLight(0xffd9a8, 0x4a2f16, 0.45)
  scene.add(hemi)
  // Backlit scene: the front face is lit only by soft sky bounce, so the
  // key stays modest.
  const key = new THREE.SpotLight(0xffe0b2, 700, 1400, 0.9, 1, 1)
  key.position.set(210, 300, 260)
  key.target.position.set(14, 3, 0)
  scene.add(key, key.target)
  // THE sun — DIRECTLY BEHIND the wheel (the plate composites the wheel
  // right over the sun's glow), low and a touch right. It wraps the whole
  // silhouette in a hot rim (bottom-right burns hottest) and casts the
  // LIVE shadow: spokes streaming TOWARD the viewer across the ground,
  // exactly what a low sun behind the subject does. (Raised a few degrees
  // above the visual sun so the shadow lands on a renderable plane.)
  const rimSun = new THREE.DirectionalLight(0xffa14d, 4.5)
  rimSun.position.set(78, 37, -270) // same spot as the measured sun core
  rimSun.castShadow = true
  rimSun.shadow.mapSize.set(1024, 1024)
  rimSun.shadow.camera.left = -130
  rimSun.shadow.camera.right = 130
  rimSun.shadow.camera.top = 130
  rimSun.shadow.camera.bottom = -130
  rimSun.shadow.camera.near = 60
  rimSun.shadow.camera.far = 800
  rimSun.shadow.bias = -0.0004
  rimSun.shadow.normalBias = 0.6
  rimSun.shadow.radius = 8
  scene.add(rimSun)
  const rimGraze = new THREE.DirectionalLight(0xff9a45, 1.5) // secondary edge graze
  rimGraze.position.set(230, -20, -130)
  scene.add(rimGraze)
  const rimSky = new THREE.DirectionalLight(0xffc9a0, 1.1) // sky glow rim, behind-left-top
  rimSky.position.set(-220, 160, -200)
  scene.add(rimSky)
  const fill = new THREE.DirectionalLight(0x9db3d9, 0.5) // cool lift from the dark-cloud side
  fill.position.set(-260, 60, 200)
  scene.add(fill)
  const kicker = new THREE.PointLight(0xffb768, 1.4, 420, 1.5) // floor bounce up into the rim
  kicker.position.set(20, -125, 140)
  scene.add(kicker)

  // Shadow catcher: an invisible ground plane at the wheel's bottom tangent
  // — only the cast shadow renders, compositing onto the background plate.
  // Contact shadow per the reference: a soft dark pool on the ground under
  // the wheel, offset slightly away from the key light. Baked radial
  // gradient (not a realtime shadow map) — identical look, zero cost on
  // the kiosk iGPU, and it foreshortens naturally with the camera.
  const shadowCanvas = document.createElement('canvas')
  shadowCanvas.width = 256
  shadowCanvas.height = 128
  const sctx = shadowCanvas.getContext('2d')!
  sctx.translate(128, 64)
  sctx.scale(1, 0.5)
  const sgrad = sctx.createRadialGradient(0, 0, 10, 0, 0, 120)
  sgrad.addColorStop(0, 'rgba(24, 12, 4, 0.4)') // softer base — the live shadow layers on top
  sgrad.addColorStop(0.55, 'rgba(24, 12, 4, 0.2)')
  sgrad.addColorStop(1, 'rgba(24, 12, 4, 0)')
  sctx.fillStyle = sgrad
  sctx.fillRect(-128, -128, 256, 256)
  const shadowTex = new THREE.CanvasTexture(shadowCanvas)
  shadowTex.colorSpace = THREE.SRGBColorSpace
  const contactShadow = new THREE.Mesh(
    new THREE.PlaneGeometry(340, 150),
    new THREE.MeshBasicMaterial({ map: shadowTex, transparent: true, depthWrite: false }),
  )
  contactShadow.rotation.x = -Math.PI / 2
  // sun directly behind → the pool stretches toward the viewer
  contactShadow.position.set(-10, -90.5, 42)
  scene.add(contactShadow)

  // Live shadow catcher: only the sun's cast shadow renders on it — the
  // spoke pattern streams toward the camera and turns with the wheel,
  // layered over the soft baked pool above.
  const liveCatcher = new THREE.Mesh(
    new THREE.PlaneGeometry(760, 560),
    new THREE.ShadowMaterial({ opacity: 0.26 }),
  )
  liveCatcher.rotation.x = -Math.PI / 2
  liveCatcher.position.set(14, -91, 80)
  liveCatcher.receiveShadow = true
  scene.add(liveCatcher)

  // NO ground shadows while the chakra is forming (user 2026-07-20): the
  // in-flight spokes cast a jagged blob onto the water that reads as a
  // glitch. Both shadow layers hold at 0 whenever an assembly timeline is
  // running (buildP < 1) and ease back in over SHADOW_FADE_MS once the
  // wheel settles. Values/Flag never run an assembly, so they keep their
  // shadows from the first frame.
  const LIVE_SHADOW_OPACITY = 0.26
  const SHADOW_FADE_MS = 600
  let shadowFadeStart = -1e9 // "settled long ago" — fully visible by default

  /* ------------------------- volumetric light (true object occlusion) -- */
  // The way 3D packages do it, shadow-map accelerated: for every pixel a
  // ray marches through the AIR in front of the camera and asks at each
  // step "can this point see the sun?" against the sun's shadow map. Air
  // the wheel shades stays dark; air in the spoke gaps glows — real 3D
  // crepuscular rays with no screen-space smearing (and none of its
  // sparkle artifacts). Colour written with zero alpha composites
  // additively over the CSS plate.
  // Depth pre-pass of the solid scene: each ray STOPS at the first surface,
  // so lit air behind the wheel never paints over it. FULL device res and
  // NEAREST filtering — RGBA-packed depth must never be interpolated
  // (blended packed bytes decode to garbage and ring the silhouette with
  // a jagged fringe).
  const depthDpr = Math.min(window.devicePixelRatio, 2)
  const depthRT = new THREE.WebGLRenderTarget(
    Math.floor(width * depthDpr),
    Math.floor(height * depthDpr),
  )
  depthRT.texture.minFilter = THREE.NearestFilter
  depthRT.texture.magFilter = THREE.NearestFilter
  const depthMat = new THREE.MeshDepthMaterial({ depthPacking: THREE.RGBADepthPacking })
  const rayScene = new THREE.Scene()
  const rayCam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1)
  const rayMat = new THREE.ShaderMaterial({
    uniforms: {
      shadowMap: { value: null },
      shadowMatrix: { value: new THREE.Matrix4() },
      tDepth: { value: depthRT.texture },
      invProj: { value: new THREE.Matrix4() },
      invView: { value: new THREE.Matrix4() },
      camPos: { value: new THREE.Vector3() },
      sunDir: { value: new THREE.Vector3() }, // toward the sun
      // Trimmed from 0.4 when the canvas went full-stage: the same strength
      // over 2.5× the area over-exposed the frame (virtue panel washed out).
      strength: { value: 0.33 },
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D shadowMap;
      uniform sampler2D tDepth;
      uniform mat4 shadowMatrix;
      uniform mat4 invProj;
      uniform mat4 invView;
      uniform vec3 camPos;
      uniform vec3 sunDir;
      uniform float strength;
      // march segment = ray ∩ sphere around the wheel's air volume
      const vec3 VOL_C = vec3(14.0, 3.0, 0.0);
      const float VOL_R = 460.0; // covers the stage corners in EVERY framing
                                 // (the pulled-back dock camera included)
      const int STEPS = 20;
      // three.js RGBA depth packing (shadow + depth maps are RGBA-packed)
      const float UnpackDownscale = 255.0 / 256.0;
      const vec3 PackFactors = vec3(16777216.0, 65536.0, 256.0);
      const vec4 UnpackFactors = UnpackDownscale / vec4(PackFactors, 1.0);
      float unpackRGBAToDepth(const in vec4 v) { return dot(v, UnpackFactors); }
      void main() {
        vec4 ndc = vec4(vUv * 2.0 - 1.0, 1.0, 1.0);
        vec4 vp = invProj * ndc;
        vp /= vp.w;
        vec3 rayDir = normalize((invView * vec4(vp.xyz, 0.0)).xyz);
        vec3 oc = camPos - VOL_C;
        float b = dot(oc, rayDir);
        float c = dot(oc, oc) - VOL_R * VOL_R;
        float disc = b * b - c;
        if (disc < 0.0) discard;
        float sq = sqrt(disc);
        float t0 = max(0.0, -b - sq);
        float t1 = -b + sq;
        // stop at the first solid surface: reconstruct the depth-buffer hit
        float dScene = unpackRGBAToDepth(texture2D(tDepth, vUv));
        if (dScene < 0.9999) {
          vec4 sn = vec4(vUv * 2.0 - 1.0, dScene * 2.0 - 1.0, 1.0);
          vec4 sv = invProj * sn;
          sv /= sv.w;
          vec3 sw = (invView * vec4(sv.xyz, 1.0)).xyz;
          t1 = min(t1, length(sw - camPos));
        }
        if (t1 <= t0) discard;
        float stepLen = (t1 - t0) / float(STEPS);
        // per-pixel jitter hides the step count as grain
        float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        float acc = 0.0;
        for (int i = 0; i < STEPS; i++) {
          vec3 p = camPos + rayDir * (t0 + (float(i) + jitter) * stepLen);
          vec4 sc = shadowMatrix * vec4(p, 1.0);
          vec3 s = sc.xyz / sc.w;
          float lit = 1.0;
          if (s.x > 0.0 && s.x < 1.0 && s.y > 0.0 && s.y < 1.0 && s.z < 1.0) {
            float d = unpackRGBAToDepth(texture2D(shadowMap, s.xy));
            lit = d + 0.004 > s.z ? 1.0 : 0.0;
          }
          acc += lit;
        }
        acc /= float(STEPS);
        // forward scattering: shafts bloom when looking toward the sun
        float phase = pow(max(dot(rayDir, sunDir), 0.0), 7.0);
        // No edge dissolve: the canvas IS the screen — light runs to the
        // very edge (a fade printed a visible border frame; user 2026-07-21).
        // No path/occlusion attenuation either — the user's approved frame
        // (2026-07-21) is the plain field: soft glow wrapping the wheel.
        vec3 col = vec3(1.0, 0.78, 0.45) * acc * phase * strength;
        gl_FragColor = vec4(col, 0.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    blending: THREE.NoBlending, // renders alone into rayRT
  })
  rayScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), rayMat))

  // Stage 2 — visible BEAMS: with the sun dead-behind and the camera in
  // front we look straight down the light columns, so the physical glow
  // foreshortens into a corona. The film/game trick: radially stretch the
  // (correct, wheel-masked) volumetric light field away from the sun's
  // screen point — the gap glow elongates into rays. Rendered additively
  // with zero alpha so it also spills over the CSS plate.
  // Field resolution: at the old ~303px the silhouette stair-stepped along
  // the radial spokes (the radial smear can't blur across an edge parallel
  // to it). Bumped to ~512 (capped — 910px froze the iGPU at 20 samples/
  // px) so the edge is finer; the 5-tap blur below keeps it soft.
  const rayFieldMax = 512
  const rayAspect = width / height
  const rayFieldW = rayAspect >= 1 ? rayFieldMax : Math.round(rayFieldMax * rayAspect)
  const rayFieldH = rayAspect >= 1 ? Math.round(rayFieldMax / rayAspect) : rayFieldMax
  const rayRT = new THREE.WebGLRenderTarget(rayFieldW, rayFieldH)
  /* The beam origin is PINNED to the background plate's baked sun. The
     plate is a fixed image — it never moves with the 3D camera — so a real
     sun must not either (user 2026-07-21: the source was sliding around on
     tab switches because it was re-projected through each tab's camera).
     World (78,37,-286) seen from the values framing = stage (1105, 514). */
  const SUN_UV = new THREE.Vector2(1105 / 1920, 1 - 514 / 1080)
  const streakScene = new THREE.Scene()
  const streakMat = new THREE.ShaderMaterial({
    uniforms: {
      tRay: { value: rayRT.texture },
      sunUv: { value: new THREE.Vector2(0.5, 0.5) },
      texel: { value: new THREE.Vector2(1 / rayFieldW, 1 / rayFieldH) },
      boost: { value: 1.05 }, // soft organic streaks — no procedural fan
    },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }
    `,
    fragmentShader: /* glsl */ `
      varying vec2 vUv;
      uniform sampler2D tRay;
      uniform vec2 sunUv;
      uniform vec2 texel;
      uniform float boost;
      void main() {
        const int SAMPLES = 48;
        vec2 delta = (vUv - sunUv) * (0.95 / float(SAMPLES));
        float jitter = fract(sin(dot(vUv, vec2(12.9898, 78.233))) * 43758.5453);
        vec2 uv = vUv - delta * jitter;
        vec3 acc = vec3(0.0);
        float w = 1.0;
        for (int i = 0; i < SAMPLES; i++) {
          uv -= delta;
          acc += texture2D(tRay, uv).rgb * w;
          w *= 0.972;
        }
        // decayed SUM (not average): pixels far from bright sources get
        // almost nothing, so beams stay local instead of hazing the canvas
        vec3 streak = acc * 0.05;
        // fill glow = a 5-tap blur of the field, so the silhouette edge is
        // soft (a single tap paints the field's blocky edge onto the frame)
        vec2 b = texel * 1.5;
        vec3 base = texture2D(tRay, vUv).rgb * 0.4
          + texture2D(tRay, vUv + vec2(b.x, b.y)).rgb * 0.15
          + texture2D(tRay, vUv + vec2(-b.x, b.y)).rgb * 0.15
          + texture2D(tRay, vUv + vec2(b.x, -b.y)).rgb * 0.15
          + texture2D(tRay, vUv + vec2(-b.x, -b.y)).rgb * 0.15;
        // NO procedural ray fan and NO occlusion damping — the user's
        // approved frame (2026-07-21) is the plain organic composite: soft
        // streaks from real geometry only (spokes, waving cloth), the glow
        // wrapping the wheel freely.
        gl_FragColor = vec4(base * 0.55 + streak * boost, 0.0);
      }
    `,
    depthTest: false,
    depthWrite: false,
    transparent: true,
    blending: THREE.CustomBlending,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    blendSrcAlpha: THREE.ZeroFactor,
    blendDstAlpha: THREE.OneFactor,
  })
  streakScene.add(new THREE.Mesh(new THREE.PlaneGeometry(2, 2), streakMat))

  const _invProj = new THREE.Matrix4()
  function renderGodRays(): void {
    const sm = rimSun.shadow.map
    if (sm === null) return // first frame: shadow map not rendered yet
    // depth pre-pass: solid geometry only (ground planes are see-through fx;
    // the dock's gold flash is LIGHT, not an occluder — with rays now live in
    // flag mode it must not stamp its quad into the depth buffer)
    const prevContact = contactShadow.visible
    const prevCatcher = liveCatcher.visible
    const prevDims = dimGroup?.visible ?? false
    const prevFlash = flash?.visible ?? false
    contactShadow.visible = false
    liveCatcher.visible = false
    if (dimGroup) dimGroup.visible = false
    if (flash) flash.visible = false
    const prevShadowAuto = renderer.shadowMap.autoUpdate
    renderer.shadowMap.autoUpdate = false
    renderer.setRenderTarget(depthRT)
    // clear to WHITE: packed depth 1 = "no surface" (black decodes as a
    // surface at the near plane, which discards every ray)
    renderer.setClearColor(0xffffff, 1)
    renderer.clear()
    scene.overrideMaterial = depthMat
    renderer.render(scene, camera)
    scene.overrideMaterial = null
    renderer.setClearColor(0x000000, 0) // restore the transparent canvas clear
    renderer.setRenderTarget(null)
    renderer.shadowMap.autoUpdate = prevShadowAuto
    contactShadow.visible = prevContact
    liveCatcher.visible = prevCatcher
    if (dimGroup) dimGroup.visible = prevDims
    if (flash) flash.visible = prevFlash
    rayMat.uniforms['shadowMap']!.value = sm.texture
    ;(rayMat.uniforms['shadowMatrix']!.value as THREE.Matrix4).copy(rimSun.shadow.matrix)
    ;(rayMat.uniforms['invProj']!.value as THREE.Matrix4).copy(
      _invProj.copy(camera.projectionMatrix).invert(),
    )
    ;(rayMat.uniforms['invView']!.value as THREE.Matrix4).copy(camera.matrixWorld)
    ;(rayMat.uniforms['camPos']!.value as THREE.Vector3).copy(camera.position)
    ;(rayMat.uniforms['sunDir']!.value as THREE.Vector3).copy(rimSun.position).normalize()
    // stage 1: physical volumetric field → rayRT
    renderer.setRenderTarget(rayRT)
    renderer.clear()
    renderer.render(rayScene, rayCam)
    renderer.setRenderTarget(null)
    // stage 2: radial beam stretch, composited over the frame. The origin
    // is the plate's sun — constant on every tab and through every camera
    // move, exactly like the real sun in the fixed background.
    ;(streakMat.uniforms['sunUv']!.value as THREE.Vector2).copy(SUN_UV)
    renderer.autoClear = false
    renderer.render(streakScene, rayCam)
    renderer.autoClear = true
  }

  // Swap the studio env for one built from the ACTUAL sunset plate — the
  // wheel then reflects/absorbs the same warm sky and dark sea it sits in.
  //
  // This is also what switches environment lighting ON: intensity is held at 0
  // above so the cool studio probe can never tint the wheel light blue before
  // this lands. Do not raise the initial value without re-checking that pop.
  // Environment texture: always the still (assets/3-ashok-chakra/background/
  // bg.png) even when the DOM background plays bg.mp4 — three.js needs a
  // sampleable image, and the two share one folder by convention.
  new THREE.TextureLoader().load('assets/3-ashok-chakra/background/bg.png', (t) => {
    t.mapping = THREE.EquirectangularReflectionMapping
    t.colorSpace = THREE.SRGBColorSpace
    scene.environment = pmrem.fromEquirectangular(t).texture
    scene.environmentIntensity = 0.5
    t.dispose()
  })

  // Baked contact shading (per-vertex AO): real renders read as real mostly
  // because of the darkening where parts meet — spoke roots into the hub,
  // spoke tips under the rim, the scalloped inner rim edge. Cheap, baked
  // once, multiplied into the base colour via vertexColors.
  const smoothstep = (a: number, b: number, x: number): number => {
    const t = Math.max(0, Math.min(1, (x - a) / (b - a)))
    return t * t * (3 - 2 * t)
  }
  const bakeRadialAO = (geo: THREE.BufferGeometry, ao: (r: number) => number): void => {
    const pos = geo.attributes.position as THREE.BufferAttribute
    const colors = new Float32Array(pos.count * 3)
    for (let i = 0; i < pos.count; i++) {
      const v = ao(Math.hypot(pos.getX(i), pos.getY(i)))
      colors[i * 3] = colors[i * 3 + 1] = colors[i * 3 + 2] = v
    }
    geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  }

  // Painted-enamel body over metal: clearcoat carries the sun's sheen while
  // the base stays the design render's cobalt (print-spec #06038D reads
  // near-black under any physically plausible light).
  const material = new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(0x1236b0),
    metalness: 0.25,
    roughness: 0.42,
    clearcoat: 0.9,
    clearcoatRoughness: 0.28,
    vertexColors: true,
  })

  // lean group (fixed pose) → chakra group (spins about its axle)
  const lean = new THREE.Group()
  lean.rotation.set(LEAN_X, LEAN_Y, 0)
  // Match the Figma render's placement inside the 910 box: the wheel rides
  // high (bottom tangent ≈ stage y 955, on the ground-shadow strip) and a
  // few px right of the box centre.
  lean.position.set(14, 3, 0)
  scene.add(lean)
  const chakra = new THREE.Group()
  lean.add(chakra)

  const rimGeo = buildRimGeometry(DEPTH, BEVEL)
  // rim: the scalloped inner edge sits in shade, the outer face is open
  bakeRadialAO(rimGeo, (r) => 0.68 + 0.32 * smoothstep(77, 89, r))
  const rim = new THREE.Mesh(rimGeo, material)
  rim.name = 'Rim'
  const hubGeo = buildHubGeometry(DEPTH * 1.05, BEVEL)
  // hub: darkens toward its edge where all 24 spoke roots crowd in
  bakeRadialAO(hubGeo, (r) => 0.95 - 0.3 * smoothstep(10, 16, r))
  const hub = new THREE.Mesh(hubGeo, material)
  hub.name = 'Hub'
  const bossGeo = new THREE.CapsuleGeometry(4.4, DEPTH * 1.15, 8, 32)
  bossGeo.rotateX(Math.PI / 2)
  bakeRadialAO(bossGeo, () => 0.92)
  const boss = new THREE.Mesh(bossGeo, material)
  boss.name = 'Centre boss'
  const fluteGeo = buildFluteGeometry(DEPTH * 1.05)
  bakeRadialAO(fluteGeo, (r) => 0.9 - 0.25 * smoothstep(10, 16, r))
  const flutes = new THREE.Mesh(fluteGeo, material)
  flutes.name = 'Hub flutes'

  const spokeGeo = buildSpokeGeometry(DEPTH, BEVEL * 0.9)
  // spokes: shaded at the root junction, brightest along the bulge, tucked
  // into shade again where the tip meets the rim
  bakeRadialAO(
    spokeGeo,
    (r) => (0.6 + 0.4 * smoothstep(15, 32, r)) * (1 - 0.22 * smoothstep(62, 80, r)),
  )
  const spokes: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>[] = []
  for (let i = 0; i < SPEC.spokeCount; i++) {
    const m = new THREE.Mesh(spokeGeo, material.clone())
    m.rotation.z = -i * SPOKE_STEP // spoke 1 points up, clockwise
    m.name = `Spoke ${i + 1}`
    m.userData = { spoke: i + 1 }
    m.castShadow = true
    spokes.push(m)
    chakra.add(m)
  }
  for (const part of [rim, hub, boss, flutes]) part.castShadow = true
  chakra.add(rim, hub, boss, flutes)

  // Assembly starts from nothing; setDims(true) drives them back in. Values and
  // Flag call applyAssemblyTimeline(1) via finishAssembly() on their first frame,
  // which restores full scale, so this cannot leak into those tabs.
  rim.visible = false
  hub.scale.setScalar(MIN_SCALE)
  boss.scale.setScalar(MIN_SCALE)
  flutes.scale.setScalar(MIN_SCALE)
  for (const s of spokes) s.scale.y = MIN_SCALE

  /* ------------------------------------------------ selection state -- */
  let selected: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial> | null = null
  let halo: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial> | null = null
  let spinOn = true
  let selectedIdx: number | null = null // 0-based; the loop eases this spoke to 12 o'clock
  let dimsOn = false
  let dimGroup: THREE.Group | null = null
  /** Callout fade 0..1 — live tab switches fade the dims in/out (300ms). */
  let dimsFade = 0

  /* ------------------------------------------------ camera tweening -- */
  // The scene is PERSISTENT across the section's tabs — pill switches move
  // the camera between framings live instead of remounting, so the wheel
  // never blinks (user 2026-07-20). Inactive while the flag timeline owns
  // the camera.
  let bootDone = false // first frame rendered — before that, snaps are free
  let camTween: {
    c0: THREE.Vector3
    c1: THREE.Vector3
    g0: THREE.Vector3
    g1: THREE.Vector3
    start: number
    dur: number
  } | null = null

  function tweenCamera(toCam: THREE.Vector3, toTgt: THREE.Vector3, dur = 550): void {
    if (!bootDone) {
      camera.position.copy(toCam)
      camTarget.copy(toTgt)
      camera.lookAt(camTarget)
      return
    }
    camTween = {
      c0: camera.position.clone(),
      c1: toCam.clone(),
      g0: camTarget.clone(),
      g1: toTgt.clone(),
      start: performance.now(),
      dur,
    }
  }

  /* ------------------------------------------------ assembly state -- */
  // buildP === 1 means "no sequence running" — the resting pose. Values and
  // Flag never start one, so they sit at 1 for the whole of their lifetime.
  let buildP = 1
  let buildT0 = 0
  let assemblyRefs: AssemblyRefs | null = null
  let buildPaused = false
  const RAY_STRENGTH_BASE = 0.33 // matches rayMat's authored uniform

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
      restTgt: DIMS_TGT,
      restLean: { x: LEAN_X, y: LEAN_Y, posY: 3 },
      dimGroup,
    }
  }

  function startAssembly(): void {
    assemblyRefs = makeAssemblyRefs() // dimGroup may have only just been created
    buildPaused = false
    buildT0 = performance.now()
    buildP = 0
    applyAssemblyTimeline(0, assemblyRefs)
  }

  /** Jump straight to the settled pose. p=1 yields EXACTLY the resting dims view. */
  function finishAssembly(): void {
    assemblyRefs ??= makeAssemblyRefs()
    buildP = 1
    applyAssemblyTimeline(1, assemblyRefs)
  }

  /* --------------------------------------------- rolling entrance -- */
  // Section intro (wheel mode only): wait UPRIGHT off-stage until the parent
  // says go (background ready), roll in, rock to rest, then lean into the
  // 3/4 hero pose. doneAt < 0 while the roll owns the wheel — the idle
  // turntable, drag/picking and the god-rays all wait for it.
  const roll =
    entranceRoll && initialMode === 'wheel'
      ? { started: false, t0: 0, doneAt: -1, leanDone: false }
      : null
  // Screen radius of the ⌀185 rim at the resting camera — the no-slip ratio
  // between box travel (px) and axle spin (rad).
  const rollRadiusPx =
    (SPEC.outerR * height) / (2 * Math.tan(THREE.MathUtils.degToRad(20)) * WHEEL_CAM.z)

  /** One remaining-travel number poses BOTH the box and the axle. */
  function applyRollPose(remainPx: number): void {
    chakra.rotation.z = remainPx / rollRadiusPx
    cbs.onRollFrame(-remainPx)
  }

  function startRoll(): void {
    if (roll === null || roll.started) return
    roll.started = true
    roll.t0 = performance.now()
  }

  /** Natural landing: home the box + axle, hand over — the lean-in and the
   * god-ray reignite then play out over the following frames. */
  function landRoll(): void {
    if (roll === null || roll.doneAt >= 0) return
    roll.doneAt = performance.now()
    applyRollPose(0)
    lastInteraction = roll.doneAt // rest a beat before the idle turntable
    cbs.onRollDone()
  }

  /** Parent skip: snap the WHOLE entrance (travel + lean) to its end. Once
   * the roll has landed naturally this is a no-op — the entrance prop flips
   * to 'none' right after onRollDone, and that must not cut the lean-in. */
  function finishRoll(): void {
    if (roll === null || roll.doneAt >= 0) return
    landRoll()
    roll.leanDone = true
    lean.rotation.set(LEAN_X, LEAN_Y, 0)
  }


  /* ------------------------------------------------- flag-mode state -- */
  let modeState: 'wheel' | 'flag' = 'wheel'
  let flagGroup: THREE.Group | null = null
  let clothMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial> | null = null
  let clothPos: THREE.Vector3[] = []
  let clothOld: THREE.Vector3[] = []
  /** [a, b, rest, weight] — weight <1 = soft constraint (bend resistance). */
  let clothCon: [number, number, number, number][] = []
  let bakedCloth: THREE.Vector3[] | null = null // calm mid-wave reference pose
  let flash: THREE.Sprite | null = null // gold flash masking the stamp moment
  /* Master timeline: flagP 0 = chakra mode … 1 = in-flag. All transition state
     derives deterministically from flagP — time-based, frame-rate independent. */
  let flagAnim: {
    from: number
    to: number
    t0: number
    dur: number
    camP0: THREE.Vector3
    camP1: THREE.Vector3
    tgtP0: THREE.Vector3
    tgtP1: THREE.Vector3
  } | null = null
  let flagP = 0
  let windFactor = 1
  let rotStart = 0
  let dockZSafe = 40
  const chakraDock = { pos: new THREE.Vector3(0, 22, 24), scale: 0.2 } // ⌀185→⌀37 on the 40u band
  const flagDisposables: { dispose(): void }[] = []

  function removeHalo() {
    if (!halo) return
    halo.material.dispose() // geometry is shared with the spoke — keep it
    chakra.remove(halo)
    halo = null
  }
  function addHalo(mesh: THREE.Mesh) {
    removeHalo()
    halo = new THREE.Mesh(
      mesh.geometry,
      new THREE.MeshBasicMaterial({
        color: 0xffc84a,
        transparent: true,
        opacity: 0.25,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    )
    halo.scale.set(1.045, 1.045, 1.6)
    halo.rotation.copy(mesh.rotation)
    halo.position.copy(mesh.position)
    halo.renderOrder = 5
    chakra.add(halo)
  }
  function setEmissive(mesh: THREE.Mesh<THREE.BufferGeometry, THREE.MeshStandardMaterial>, on: boolean) {
    if (on) {
      mesh.material.emissive = HIGHLIGHT.clone()
      mesh.material.emissiveIntensity = 0.55
    } else {
      mesh.material.emissive = new THREE.Color(0x000000)
      mesh.material.emissiveIntensity = 0
    }
  }

  function setSelected(spoke: number | null) {
    if (selected) setEmissive(selected, false)
    selected = null
    removeHalo()
    selectedIdx = null
    if (spoke === null) return
    const mesh = spokes[(spoke - 1 + SPEC.spokeCount) % SPEC.spokeCount]
    if (!mesh) return
    selected = mesh
    setEmissive(mesh, true)
    addHalo(mesh)
    // The loop eases the wheel so this spoke points up: z → i·step, re-homed
    // to the nearest turn every frame so it still works after a user drag.
    selectedIdx = spoke - 1
  }

  function setDims(on: boolean) {
    if (on === dimsOn && bootDone) return
    dimsOn = on
    if (on && dimGroup === null) {
      dimGroup = buildDimGroup()
      // Callouts fade in/out on live switches — mark every material
      // transparent once so the loop can drive their opacity.
      dimGroup.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m !== undefined) {
          m.transparent = true
          if (bootDone) m.opacity = 0 // live switch: fade up from nothing
        }
      })
      if (bootDone) {
        dimsFade = 0
        dimGroup.visible = false
      } else {
        dimsFade = 1 // boot-into-dims: the assembly sequence owns the entrance
      }
      chakra.add(dimGroup) // parented to the wheel — callouts rotate with it
    }
    // Reframe so the callout ring clears the canvas edge-feather and the
    // stats card. Live switches GLIDE (persistent scene — the wheel must
    // never blink); flag mode owns the camera outright — never fight it.
    if (modeState !== 'flag' && flagAnim === null) {
      tweenCamera(on ? DIMS_CAM : WHEEL_CAM, on ? DIMS_TGT : WHEEL_TGT)
    }
    // The build-from-nothing assembly entrance only plays when a scene is
    // CREATED into dims (dev scrub / direct mounts) — live pill switches
    // keep the finished wheel and fade the callouts instead.
    if (on && !bootDone && modeState !== 'flag') startAssembly()
    // (No per-framing edge dissolve anymore — the canvas is the full stage,
    // so the light legitimately runs to the screen edge on every tab.)
  }

  /* -------------------------------------------------- flag building -- */

  function writeClothGeometry(): void {
    if (clothMesh === null) return
    const attr = clothMesh.geometry.attributes.position as THREE.BufferAttribute
    for (let i = 0; i < clothPos.length; i++) attr.setXYZ(i, clothPos[i].x, clothPos[i].y, clothPos[i].z)
    attr.needsUpdate = true
    clothMesh.geometry.computeVertexNormals()
  }

  const _d = new THREE.Vector3()
  function simulateCloth(t: number, writeGeom = true): void {
    const dt2 = (1 / 60) ** 2
    const damp = 0.985
    const W = 62 * WIND_STRENGTH * windFactor
    for (let i = 0; i < clothPos.length; i++) {
      const col = i % (CLOTH.sx + 1)
      if (col === 0) continue // pinned at the hoist
      const p = clothPos[i]
      const o = clothOld[i]
      const ax = W * (0.85 + 0.45 * Math.sin(t * 1.6 + p.y * 0.05 + p.x * 0.02))
      // gravity scales with the breeze so a still flag holds its pose
      // instead of drooping like a curtain
      const ay = -14 * windFactor + W * 0.12 * Math.sin(t * 1.1 + p.x * 0.06)
      const az = W * (0.55 * Math.sin(t * 2.1 + p.x * 0.08 + p.y * 0.04) + 0.25 * Math.sin(t * 3.3 + p.y * 0.09))
      const nx = p.x + (p.x - o.x) * damp + ax * dt2
      const ny = p.y + (p.y - o.y) * damp + ay * dt2
      const nz = p.z + (p.z - o.z) * damp + az * dt2
      o.copy(p)
      p.set(nx, ny, nz)
    }
    for (let k = 0; k < 3; k++) {
      for (const [a, b, rest, w] of clothCon) {
        const pa = clothPos[a]
        const pb = clothPos[b]
        _d.subVectors(pb, pa)
        const len = _d.length() || 1e-6
        const diff = ((len - rest) / len) * 0.5 * w
        const pinA = a % (CLOTH.sx + 1) === 0
        const pinB = b % (CLOTH.sx + 1) === 0
        if (!pinA) pa.addScaledVector(_d, diff * (pinB ? 2 : 1))
        if (!pinB) pb.addScaledVector(_d, -diff * (pinA ? 2 : 1))
      }
    }
    if (writeGeom) writeClothGeometry()
  }

  function buildFlag(): void {
    if (flagGroup !== null) return
    flagGroup = new THREE.Group()
    flagGroup.name = 'Tiranga'

    const steel = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.85, roughness: 0.35 })
    const poleGeo = new THREE.CylinderGeometry(1.7, 2.2, POLE_LEN, 24)
    const pole = new THREE.Mesh(poleGeo, steel)
    pole.position.set(POLE_X, POLE_TOP - POLE_LEN / 2, 0)
    // The flag must CAST shadows: the volumetric pass only shows visible
    // shafts where something blocks the sun — without casters the flag tab's
    // light is a featureless haze that vanishes against the bright plate
    // (user 2026-07-20). With these, beams fan around the Tiranga.
    pole.castShadow = true
    const finialGeo = new THREE.SphereGeometry(4, 24, 16)
    const finialMat = new THREE.MeshStandardMaterial({ color: 0xd8b043, metalness: 0.9, roughness: 0.3 })
    const finial = new THREE.Mesh(finialGeo, finialMat)
    finial.position.set(POLE_X, 88, 0)
    finial.castShadow = true
    const baseGeo = new THREE.CylinderGeometry(7, 9, 5, 24)
    const base = new THREE.Mesh(baseGeo, steel)
    base.position.set(POLE_X, POLE_TOP - POLE_LEN + 2.5, 0)

    const geo = new THREE.PlaneGeometry(CLOTH.w, CLOTH.h, CLOTH.sx, CLOTH.sy)
    const flagTex = makeFlagTexture()
    const clothMat = new THREE.MeshStandardMaterial({
      map: flagTex,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    })
    clothMesh = new THREE.Mesh(geo, clothMat)
    clothMesh.position.y = 22 // hang just below the finial
    clothMesh.name = 'Flag cloth'
    clothMesh.castShadow = true // the waving cloth carves the sun into beams

    const p = geo.attributes.position as THREE.BufferAttribute
    clothPos = []
    clothOld = []
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i)
      clothPos.push(v)
      clothOld.push(v.clone())
    }
    // constraints: structural + shear + soft BEND (skip-one) resistance.
    // Without bend constraints a gust can fold the free corner back through
    // itself — self-intersecting polygons render as a torn patch (user
    // 2026-07-20 screenshot, saffron fly corner). The skip-one constraints
    // resist sharp creases at 35% strength so the cloth still billows.
    clothCon = []
    const idx = (r: number, c2: number) => r * (CLOTH.sx + 1) + c2
    const rx = CLOTH.w / CLOTH.sx
    const ry = CLOTH.h / CLOTH.sy
    const rd = Math.hypot(rx, ry)
    const BEND = 0.35
    for (let r = 0; r <= CLOTH.sy; r++) {
      for (let c2 = 0; c2 <= CLOTH.sx; c2++) {
        if (c2 < CLOTH.sx) clothCon.push([idx(r, c2), idx(r, c2 + 1), rx, 1])
        if (r < CLOTH.sy) clothCon.push([idx(r, c2), idx(r + 1, c2), ry, 1])
        if (c2 < CLOTH.sx && r < CLOTH.sy) {
          clothCon.push([idx(r, c2), idx(r + 1, c2 + 1), rd, 1])
          clothCon.push([idx(r, c2 + 1), idx(r + 1, c2), rd, 1])
        }
        if (c2 < CLOTH.sx - 1) clothCon.push([idx(r, c2), idx(r, c2 + 2), rx * 2, BEND])
        if (r < CLOTH.sy - 1) clothCon.push([idx(r, c2), idx(r + 2, c2), ry * 2, BEND])
      }
    }
    // pre-warm the sim into a natural mid-wave pose: the flag is shown frozen
    // in this pose during the whole chakra animation — never a falling curtain
    const savedWF = windFactor
    windFactor = 1
    for (let i = 0; i < 420; i++) simulateCloth(i / 60, false)
    simulateCloth(7, true)
    windFactor = savedWF
    bakedCloth = clothPos.map((v) => v.clone()) // the calm reference pose

    // gold flash sprite that masks the stamp moment
    const fc = document.createElement('canvas')
    fc.width = fc.height = 256
    const fctx = fc.getContext('2d')
    if (fctx !== null) {
      const grad = fctx.createRadialGradient(128, 128, 0, 128, 128, 128)
      grad.addColorStop(0, 'rgba(255,228,150,1)')
      grad.addColorStop(0.35, 'rgba(255,196,84,0.55)')
      grad.addColorStop(1, 'rgba(255,196,84,0)')
      fctx.fillStyle = grad
      fctx.fillRect(0, 0, 256, 256)
    }
    const flashTex = new THREE.CanvasTexture(fc)
    const flashMat = new THREE.SpriteMaterial({
      map: flashTex,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
    flash = new THREE.Sprite(flashMat)
    flash.position.set(0, 22, 27)
    flash.renderOrder = 20

    flagDisposables.push(poleGeo, finialGeo, baseGeo, geo, steel, finialMat, clothMat, flagTex, flashMat, flashTex)
    flagGroup.add(pole, finial, base, clothMesh, flash)
    flagGroup.visible = false
    scene.add(flagGroup)
  }

  /* --------------------------------------------- flag master timeline -- */

  function setFlagOpacity(a: number): void {
    if (flagGroup === null) return
    flagGroup.traverse((o) => {
      const m = (o as THREE.Mesh).material as THREE.Material | undefined
      if (m === undefined || o === flash) return // flash drives its own opacity
      m.opacity = a
      m.transparent = a < 0.999
    })
  }

  function setChakraGlow(g: number, alpha: number): void {
    chakra.traverse((o) => {
      if (dimGroup !== null && (o === dimGroup || o.parent === dimGroup)) return // dims are hidden in flag mode
      const m = (o as THREE.Mesh).material as THREE.MeshStandardMaterial | undefined
      if (m === undefined) return
      if (m.emissive !== undefined) {
        m.emissive.copy(GLOW_COLOR)
        m.emissiveIntensity = 2.4 * g
      }
      m.opacity = alpha
      m.transparent = (o as unknown as THREE.Sprite).isSprite === true ? true : alpha < 0.999
    })
  }

  function applyFlagTimeline(p: number): void {
    if (flagGroup === null) return
    const sub = (a: number, b: number) => S((p - a) / (b - a))
    // World-align the wheel as the timeline opens (and back on reverse):
    // the kiosk lean pose eases out over p 0..0.14 instead of snapping —
    // with the persistent scene the switch is watched live.
    const lw = 1 - sub(0, 0.14)
    lean.position.set(14 * lw, 3 * lw, 0)
    lean.rotation.set(LEAN_X * lw, LEAN_Y * lw, 0)
    /* No-overlap choreography — the chakra and the full-size flag never share
       the stage:
         phase 1 (0.00–0.50)  chakra shrinks IN PLACE while the camera pulls back
         phase 2 (0.48–0.62)  flag fades in behind the now-small chakra (locked pose)
         phase 3 (0.52–0.85)  small chakra glides onto the printed chakra
         phase 4 (0.66–1.00)  glow builds, chakra melts in, light sinks into print */
    flagGroup.visible = p > 0.48
    setFlagOpacity(sub(0.48, 0.62))
    const fs = easeInOutCubic(sub(0.12, 0.5)) // shrink first…
    const f = easeInOutCubic(sub(0.52, 0.85)) // …then drift straight in
    // x/y head for the print; z stays on a plane IN FRONT of the whole cloth
    // and only sinks onto the print at the end, inside the glow
    const lift = easeInOutCubic(sub(0.12, 0.5))
    const sink = easeInOutCubic(sub(0.84, 0.96))
    chakra.position.set(
      CHAKRA_HOME_POS.x + (chakraDock.pos.x - CHAKRA_HOME_POS.x) * f,
      CHAKRA_HOME_POS.y + (chakraDock.pos.y - CHAKRA_HOME_POS.y) * f,
      CHAKRA_HOME_POS.z + (dockZSafe - CHAKRA_HOME_POS.z) * lift + (chakraDock.pos.z - dockZSafe) * sink,
    )
    const s = 1 + (chakraDock.scale - 1) * fs
    const flat = 1 - 0.97 * sub(0.6, 0.82) // 3D → 2D
    chakra.scale.set(s, s, s * flat)
    chakra.rotation.z = rotStart * (1 - easeInOutCubic(sub(0.12, 0.6)))
    /* glow-out: the shrinking chakra turns into golden light, fades away
       INSIDE the light, then the light itself sinks into the printed chakra */
    const glow = sub(0.66, 0.9) // light builds as it lands
    const fadeOut = sub(0.84, 0.94) // chakra melts away inside the glow
    setChakraGlow(glow, 1 - fadeOut)
    chakra.visible = p < 0.95
    if (flash !== null) {
      flash.material.opacity = 0.92 * glow * (1 - sub(0.93, 1))
      flash.scale.setScalar((20 + 62 * glow) * (1 - 0.55 * sub(0.93, 1)))
      flash.position.copy(chakra.position) // halo rides the chakra in
      flash.position.z = chakra.position.z + 3 // just in front — no parallax offset
    }
  }

  function setMode(mode: 'wheel' | 'flag'): void {
    if (mode === modeState) return
    modeState = mode
    const v = mode === 'flag'
    // flag mode gates drag/picking (like the source) — kill any live gesture
    activePointer = null
    dragging = false
    spinVel = 0
    setSelected(null)
    if (dimGroup !== null && v) {
      // Callouts never show in flag mode; leaving flag lets the loop's fade
      // bring them back if the destination tab is Design.
      dimGroup.visible = false
      dimsFade = 0
      dimGroup.traverse((o) => {
        const m = (o as THREE.Mesh).material as THREE.Material | undefined
        if (m !== undefined) m.opacity = 0
      })
    }
    camTween = null // the flag timeline owns the camera from here
    if (v) {
      buildFlag()
      // every entry starts from the same calm baked pose — never a wild mid-wave
      if (bakedCloth !== null) {
        for (let i = 0; i < clothPos.length; i++) {
          clothPos[i].copy(bakedCloth[i])
          clothOld[i].copy(bakedCloth[i]) // zero velocity
        }
        writeClothGeometry()
      }
      // land exactly where the printed chakra sits in the frozen pose
      const ci = Math.round(CLOTH.sy / 2) * (CLOTH.sx + 1) + Math.round(CLOTH.sx / 2)
      chakraDock.pos.set(clothPos[ci].x, clothPos[ci].y + 22, clothPos[ci].z + 4)
      // travel plane: clear of the cloth's billow ONLY around the landing
      // zone (docked wheel radius 18.5 + margin). Clearing the WHOLE cloth's
      // deepest billow — often a far corner — parked the wheel well in front
      // of the print, and the off-axis dock camera turned that depth gap
      // into a visible x-offset at the merge (user 2026-07-20).
      const centre = clothPos[ci]!
      let maxZ = Number.NEGATIVE_INFINITY
      for (const vp of clothPos) {
        if (Math.abs(vp.x - centre.x) <= 28 && Math.abs(vp.y - centre.y) <= 28 && vp.z > maxZ)
          maxZ = vp.z
      }
      dockZSafe = maxZ + 6
      windFactor = 0 // hold the flag still during the docking animation
      // normalize spin to the shortest rotation back to upright
      chakra.rotation.z = chakra.rotation.z % (Math.PI * 2)
      if (chakra.rotation.z > Math.PI) chakra.rotation.z -= Math.PI * 2
      if (chakra.rotation.z < -Math.PI) chakra.rotation.z += Math.PI * 2
      rotStart = chakra.rotation.z
    }
    flagAnim = {
      from: flagP,
      to: v ? 1 : 0,
      t0: performance.now(),
      dur: Math.max(1, FLAG_ANIM_MS * Math.abs((v ? 1 : 0) - flagP)),
      // camera endpoints keyed to the timeline (P0 = chakra side, P1 = flag
      // side) so the camera finishes moving BEFORE the drift/merge begins.
      // Reverse returns straight to the CURRENT tab's wheel framing — the
      // persistent scene must land exactly where restoreWheelPose settles.
      camP0: v ? camera.position.clone() : (dimsOn ? DIMS_CAM : WHEEL_CAM).clone(),
      camP1: v ? FLAG_CAM_DOCK.clone() : camera.position.clone(),
      tgtP0: v ? camTarget.clone() : (dimsOn ? DIMS_TGT : WHEEL_TGT).clone(),
      tgtP1: v ? FLAG_TGT_DOCK.clone() : camTarget.clone(),
    }
  }

  /** Reverse timeline finished — put the wheel back on its kiosk pedestal.
   * (The reverse camera lerp already ends on these values — see camP0.) */
  function restoreWheelPose(): void {
    lean.position.set(14, 3, 0)
    lean.rotation.set(LEAN_X, LEAN_Y, 0)
    camera.position.copy(dimsOn ? DIMS_CAM : WHEEL_CAM)
    camTarget.copy(dimsOn ? DIMS_TGT : WHEEL_TGT)
    camera.lookAt(camTarget)
    if (dimGroup !== null) dimGroup.visible = dimsOn
  }

  /* --------------------------------------------- picking + dragging -- */
  const raycaster = new THREE.Raycaster()
  const pointer = new THREE.Vector2()
  let downAt = 0
  let downXY: [number, number] = [0, 0]
  let activePointer: number | null = null
  let dragging = false
  let lastX = 0
  let spinVel = 0 // rad/frame flick inertia
  let lastInteraction = Number.NEGATIVE_INFINITY // idle spin runs from mount
  const flick: { t: number; rot: number }[] = [] // recent drag samples → release velocity

  function raycast(ev: PointerEvent): THREE.Object3D | null {
    const rect = renderer.domElement.getBoundingClientRect() // Stage-scale aware
    pointer.x = ((ev.clientX - rect.left) / rect.width) * 2 - 1
    pointer.y = -((ev.clientY - rect.top) / rect.height) * 2 + 1
    raycaster.setFromCamera(pointer, camera)
    const hit = raycaster.intersectObjects<THREE.Object3D>([rim, hub, boss, ...spokes], false)
    return hit.length > 0 ? (hit[0]?.object ?? null) : null
  }

  const onPointerDown = (e: PointerEvent) => {
    // Mid-roll: the first touch snaps the wheel home and nothing else.
    // (The parent's skip overlay usually catches this first — belt and braces.)
    if (roll !== null && roll.doneAt < 0) {
      finishRoll()
      return
    }
    // Mid-build: the first touch dismisses the sequence and nothing else.
    if (buildP < 1) {
      finishAssembly()
      return
    }
    if (modeState === 'flag' || flagAnim !== null) return // flag mode: no drag, no picking
    if (activePointer !== null) return // first finger owns the gesture
    activePointer = e.pointerId
    downAt = performance.now()
    downXY = [e.clientX, e.clientY]
    lastX = e.clientX
    dragging = false
    spinVel = 0 // grabbing the wheel stops it
    lastInteraction = downAt
    flick.length = 0
    flick.push({ t: downAt, rot: chakra.rotation.z })
    try {
      renderer.domElement.setPointerCapture(e.pointerId)
    } catch {
      /* pointer already gone — tap handling still works uncaptured */
    }
  }
  const onPointerMove = (e: PointerEvent) => {
    if (buildP < 1) return
    if (e.pointerId !== activePointer) return
    const now = performance.now()
    lastInteraction = now
    if (!dragging) {
      if (Math.hypot(e.clientX - downXY[0], e.clientY - downXY[1]) <= TAP_SLOP_PX) return
      dragging = true // committed: this gesture spins the axle, not selects
    }
    const width = renderer.domElement.getBoundingClientRect().width || 1
    chakra.rotation.z -= ((e.clientX - lastX) / width) * DRAG_ROT // drag right = clockwise
    lastX = e.clientX
    flick.push({ t: now, rot: chakra.rotation.z })
    while (flick.length > 2 && now - flick[0].t > 140) flick.shift()
  }
  const onPointerUp = (e: PointerEvent) => {
    if (buildP < 1) return
    if (e.pointerId !== activePointer) return
    activePointer = null
    const now = performance.now()
    lastInteraction = now
    if (dragging) {
      dragging = false
      const oldest = flick[0]
      if (oldest !== undefined && now - oldest.t > 25) {
        const v = ((chakra.rotation.z - oldest.rot) / (now - oldest.t)) * (1000 / 60)
        spinVel = Math.max(-MAX_FLING, Math.min(MAX_FLING, v))
      }
      return
    }
    if (!cbs.isInteractive()) return
    if (now - downAt > 350) return // long press, not a tap
    const hit = raycast(e)
    const spoke = hit?.userData?.spoke as number | undefined
    if (spoke !== undefined) cbs.onSpokeTap(spoke)
    else if (hit === null) cbs.onBackgroundTap()
  }
  const onPointerCancel = (e: PointerEvent) => {
    if (e.pointerId !== activePointer) return
    activePointer = null
    dragging = false
    lastInteraction = performance.now()
  }
  renderer.domElement.addEventListener('pointerdown', onPointerDown)
  renderer.domElement.addEventListener('pointermove', onPointerMove)
  renderer.domElement.addEventListener('pointerup', onPointerUp)
  renderer.domElement.addEventListener('pointercancel', onPointerCancel)

  /* ----------------------------------------------------- main loop -- */
  renderer.setAnimationLoop(() => {
    const now = performance.now()
    if (modeState === 'wheel' && buildP < 1 && !buildPaused && assemblyRefs !== null) {
      buildP = clamp01((now - buildT0) / ASSEMBLY_MS)
      applyAssemblyTimeline(buildP, assemblyRefs)
    }

    // Rolling entrance: box translation and axle spin from ONE number.
    const rolling = roll !== null && roll.doneAt < 0
    if (roll !== null && rolling && roll.started) {
      const p = clamp01((now - roll.t0) / ROLL_MS)
      applyRollPose(ROLL_TRAVEL_PX * (1 - rollEase(p)))
      if (p >= 1) landRoll()
    }
    // …then the landed wheel turns from its upright rolling pose into the
    // 3/4 hero lean while the chrome rises around it.
    if (roll !== null && roll.doneAt >= 0 && !roll.leanDone) {
      const k = clamp01((now - roll.doneAt) / ROLL_LEAN_MS)
      const e = easeInOutCubic(k)
      lean.rotation.y = LEAN_Y * e
      lean.rotation.x = LEAN_X * e
      if (k >= 1) roll.leanDone = true
    }

    // Live camera glide between tab framings (persistent scene). The flag
    // timeline drives the camera itself — setMode cancels any tween.
    if (camTween !== null) {
      const k = clamp01((now - camTween.start) / camTween.dur)
      const e = easeInOutCubic(k)
      camera.position.lerpVectors(camTween.c0, camTween.c1, e)
      camTarget.lerpVectors(camTween.g0, camTween.g1, e)
      camera.lookAt(camTarget)
      if (k >= 1) camTween = null
    }

    // Dims callouts fade in/out on live switches (the build-from-nothing
    // assembly stays reserved for scenes CREATED into dims).
    if (dimGroup !== null && buildP >= 1) {
      const target = dimsOn && modeState !== 'flag' ? 1 : 0
      if (dimsFade !== target) {
        const step = 16.7 / 300 // ~300ms at 60fps; time-based enough for a fade
        dimsFade = clamp01(dimsFade + (target > dimsFade ? step : -step))
        const fade = dimsFade
        dimGroup.traverse((o) => {
          const m = (o as THREE.Mesh).material as THREE.Material | undefined
          if (m !== undefined) m.opacity = fade
        })
        dimGroup.visible = fade > 0
      }
    }

    // Ground shadows: invisible while forming, 600ms ease-in once settled.
    if (buildP < 1) shadowFadeStart = now
    const shadowRamp = clamp01((now - shadowFadeStart) / SHADOW_FADE_MS)
    liveCatcher.material.opacity = LIVE_SHADOW_OPACITY * shadowRamp
    liveCatcher.visible = shadowRamp > 0
    contactShadow.material.opacity = shadowRamp
    contactShadow.visible = shadowRamp > 0
    if (modeState === 'wheel' && flagAnim === null && !dragging && !rolling) {
      // Rest pose: selected spoke at 12 o'clock beats dims-upright beats idle.
      if (buildP >= 1) {
        const goal = selectedIdx !== null ? selectedIdx * SPOKE_STEP : dimsOn ? 0 : null
        if (Math.abs(spinVel) > MIN_FLING) {
          chakra.rotation.z += spinVel // flick inertia
          spinVel *= INERTIA_DAMP
          if (goal !== null) {
            // Blend: momentum carries, the ease reels it back in as it decays.
            const target = nearestTurn(goal, chakra.rotation.z)
            chakra.rotation.z += (target - chakra.rotation.z) * 0.05
          }
        } else if (goal !== null) {
          spinVel = 0
          const target = nearestTurn(goal, chakra.rotation.z)
          chakra.rotation.z += (target - chakra.rotation.z) * (selectedIdx !== null ? 0.07 : 0.08)
        } else if (spinOn && now - lastInteraction > IDLE_RESUME_MS) {
          chakra.rotation.z -= IDLE_SPIN
        }
      }
    }
    // cloth is FROZEN during the chakra animation; after landing the breeze
    // ramps in gently and the flag starts to wave — for as long as the tab
    // is open (the sim stops with the rAF loop when the tab unmounts)
    if (flagGroup !== null && flagGroup.visible && modeState === 'flag' && flagAnim === null) {
      windFactor = Math.min(1, windFactor + 0.006)
      simulateCloth(now / 1000)
    }
    if (flagAnim !== null) {
      const k = Math.min(1, (now - flagAnim.t0) / flagAnim.dur)
      flagP = flagAnim.from + (flagAnim.to - flagAnim.from) * k
      applyFlagTimeline(flagP)
      // camera completes within p 0.05–0.5 — static during the drift and merge
      const ck = easeInOutCubic(S((flagP - 0.05) / 0.45))
      camera.position.lerpVectors(flagAnim.camP0, flagAnim.camP1, ck)
      camTarget.lerpVectors(flagAnim.tgtP0, flagAnim.tgtP1, ck)
      camera.lookAt(camTarget)
      if (k >= 1) {
        flagAnim = null
        applyFlagTimeline(flagP) // re-apply once to zero the flash
        if (modeState === 'wheel') restoreWheelPose()
      }
    }
    if (selected) {
      const t = now / 1000
      selected.material.emissiveIntensity = 0.55 + 0.35 * Math.sin(t * 5)
      if (halo) {
        halo.material.opacity = 0.16 + 0.13 * Math.sin(t * 5)
        halo.rotation.copy(selected.rotation)
      }
    }
    bootDone = true
    renderer.render(scene, camera)
    // Sun shafts on EVERY tab (user 2026-07-20: the light fills the screen
    // in all three sections) — in flag mode the depth pre-pass stops rays at
    // the cloth, so the Tiranga reads backlit by the same sun. Held OFF only
    // while the rolling entrance displaces the box (the shafts' sun would
    // sit off the plate's real sun), then reignited over ROLL_RAY_MS.
    if (buildP >= BEAT.standUp[0] && !rolling) {
      // Rays bloom through the spokes as the wheel rises into the light.
      const ramp = easeInOutCubic(beatP(buildP, [BEAT.standUp[0], 1] as const))
      const rollLight = roll === null ? 1 : S((now - roll.doneAt) / ROLL_RAY_MS)
      rayMat.uniforms['strength']!.value = RAY_STRENGTH_BASE * ramp * rollLight
      renderGodRays()
    }
  })

  function dispose() {
    renderer.setAnimationLoop(null)
    renderer.domElement.removeEventListener('pointerdown', onPointerDown)
    renderer.domElement.removeEventListener('pointermove', onPointerMove)
    renderer.domElement.removeEventListener('pointerup', onPointerUp)
    renderer.domElement.removeEventListener('pointercancel', onPointerCancel)
    removeHalo()
    if (dimGroup !== null) {
      disposeDimGroup(dimGroup)
      chakra.remove(dimGroup)
      dimGroup = null
    }
    rim.geometry.dispose()
    hub.geometry.dispose()
    boss.geometry.dispose()
    flutes.geometry.dispose()
    spokeGeo.dispose()
    spokes.forEach((s) => s.material.dispose())
    material.dispose()
    rayMat.dispose()
    depthRT.dispose()
    depthMat.dispose()
    rayRT.dispose()
    streakMat.dispose()
    // flag resources (only allocated if flag mode was ever entered)
    if (flagGroup !== null) {
      scene.remove(flagGroup)
      flagGroup = null
      clothMesh = null
      flash = null
      bakedCloth = null
      clothPos = []
      clothOld = []
      clothCon = []
    }
    for (const r of flagDisposables) r.dispose()
    flagDisposables.length = 0
    envTex.dispose()
    pmrem.dispose()
    renderer.dispose()
    // Dev hooks close over this scene graph — drop them so a disposed scene
    // isn't retained (and a stale scrub can't drive freed resources).
    if (import.meta.env.DEV) {
      const dbg = window as unknown as {
        __chakraScrub?: (v: number) => void
        __chakraPlay?: () => void
        __chakraRollScrub?: (v: number) => void
        __chakraFlagScrub?: (v: number) => void
        __chakraWheelScreen?: () => { cx: number; cy: number; r: number }
      }
      delete dbg.__chakraScrub
      delete dbg.__chakraPlay
      delete dbg.__chakraRollScrub
      delete dbg.__chakraFlagScrub
      delete dbg.__chakraWheelScreen
    }
  }

  // Parts are constructed hidden (above), so every scene must be put back at its
  // resting scale here. UNCONDITIONAL on purpose — flag mode needs it too: the
  // docking sequence scales the `chakra` GROUP, but the meshes inside it would
  // still be at MIN_SCALE, so gating this on mode ships an invisible wheel
  // through the whole Chakra-in-Flag animation.
  // Design is unaffected: setDims(true) runs after this and re-hides the parts
  // via applyAssemblyTimeline(0) before the sequence plays.
  // Must precede setMode('flag') below: applyAssemblyTimeline(1) restores the
  // resting LEAN pose, which flag mode then deliberately zeroes to world-align
  // the wheel for docking. Reversing the order would dock a tilted wheel.
  finishAssembly()

  // Rolling entrance: pose the wheel at its off-stage start BEFORE the first
  // frame — creation happens mid-hold, and a single resting-pose frame would
  // flash the wheel at centre before the roll owns it. Upright: a wheel can
  // only roll with its plane vertical; the hero lean returns after landing.
  if (roll !== null) {
    applyRollPose(ROLL_TRAVEL_PX)
    lean.rotation.set(0, 0, 0)
  }

  // A scene created directly in flag mode plays the docking animation from
  // the top on mount (re-entering the tab remounts → replays).
  if (initialMode === 'flag') {
    // finishAssembly() ran applyAssemblyTimeline(1), which also owns the camera
    // and leaves it at DIMS_CAM. setMode('flag') captures the current camera as
    // the docking timeline's start endpoint, so it must be re-seeded first or
    // the Flag tab opens on the Design tab's framing.
    camera.position.copy(FLAG_CAM_HOME)
    camTarget.copy(FLAG_TGT_HOME)
    camera.lookAt(camTarget)
    setMode('flag')
  }

  // Dev-only: freeze the sequence at an exact progress so beats can be
  // screenshotted deterministically. Stripped from production builds.
  //
  // It must genuinely PAUSE. Seeking by back-dating buildT0 lets the render
  // loop keep advancing, so every "frozen" screenshot silently shows a later
  // frame — which makes the whole visual gate useless. Hence buildPaused.
  if (import.meta.env.DEV) {
    const dbg = window as unknown as {
      __chakraScrub?: (v: number) => void
      __chakraPlay?: () => void
      __chakraRollScrub?: (v: number) => void
      __chakraFlagScrub?: (v: number) => void
      __chakraWheelScreen?: () => { cx: number; cy: number; r: number }
    }
    dbg.__chakraScrub = (v) => {
      assemblyRefs ??= makeAssemblyRefs()
      buildPaused = true
      buildP = clamp01(v)
      applyAssemblyTimeline(buildP, assemblyRefs)
    }
    dbg.__chakraPlay = () => {
      buildPaused = false
      buildT0 = performance.now() - buildP * ASSEMBLY_MS
    }
    // Project the wheel's centre + apparent radius to canvas px — used to
    // measure the tab-handoff glide endpoints exactly (no screenshot guessing).
    dbg.__chakraWheelScreen = () => {
      const c = new THREE.Vector3()
      lean.getWorldPosition(c)
      const top = c.clone().add(new THREE.Vector3(0, SPEC.outerR, 0))
      const pc = c.project(camera)
      const pt = top.project(camera)
      return {
        cx: ((pc.x + 1) / 2) * width,
        cy: ((1 - pc.y) / 2) * height,
        r: (Math.abs(pc.y - pt.y) / 2) * height,
      }
    }
    // Freeze the flag docking timeline at progress v and render one frame —
    // camera reproduced from the same HOME→DOCK lerp the live loop drives.
    dbg.__chakraFlagScrub = (v) => {
      if (flagGroup === null) return
      flagAnim = null
      flagP = clamp01(v)
      applyFlagTimeline(flagP)
      const ck = easeInOutCubic(S((flagP - 0.05) / 0.45))
      camera.position.lerpVectors(FLAG_CAM_HOME, FLAG_CAM_DOCK, ck)
      camTarget.lerpVectors(FLAG_TGT_HOME, FLAG_TGT_DOCK, ck)
      camera.lookAt(camTarget)
      renderer.render(scene, camera)
    }
    // Freeze the rolling entrance at progress v and render one frame — works
    // even where rAF is suspended (headless preview panes). Travel frames are
    // upright; v >= 1 shows the landed wheel in its restored hero lean.
    dbg.__chakraRollScrub = (v) => {
      const p = clamp01(v)
      const remain = ROLL_TRAVEL_PX * (1 - rollEase(p))
      chakra.rotation.z = remain / rollRadiusPx
      if (p >= 1) lean.rotation.set(LEAN_X, LEAN_Y, 0)
      else lean.rotation.set(0, 0, 0)
      cbs.onRollFrame(-remain)
      renderer.render(scene, camera)
    }
  }

  return {
    canvas: renderer.domElement,
    setSelected,
    setSpin: (on) => {
      spinOn = on
    },
    setDims,
    setMode,
    startRoll,
    finishRoll,
    dispose,
  }
}

/* ------------------------------------------------------------------ */

export default function Chakra3D({
  size = 910,
  width,
  height,
  mode = 'wheel',
  selectedSpoke = null,
  spin = true,
  dims = false,
  interactive = true,
  entrance = 'none',
  onRollFrame,
  onRollDone,
  onSpokeTap,
  onBackgroundTap,
  className,
  style,
}: Chakra3DProps) {
  const hostRef = useRef<HTMLDivElement | null>(null)
  const sceneRef = useRef<SceneHandle | null>(null)
  const w = width ?? size
  const h = height ?? size

  // Live prop mirrors so the imperative scene always sees current values.
  const liveRef = useRef({ mode, selectedSpoke, spin, dims, interactive, entrance, onRollFrame, onRollDone, onSpokeTap, onBackgroundTap })
  liveRef.current = { mode, selectedSpoke, spin, dims, interactive, entrance, onRollFrame, onRollDone, onSpokeTap, onBackgroundTap }

  useEffect(() => {
    const host = hostRef.current
    if (host === null) return
    const handle = createChakraScene(
      w,
      h,
      liveRef.current.mode,
      {
        onSpokeTap: (s) => liveRef.current.onSpokeTap?.(s),
        onBackgroundTap: () => liveRef.current.onBackgroundTap?.(),
        isInteractive: () => liveRef.current.interactive,
        onRollFrame: (x) => liveRef.current.onRollFrame?.(x),
        onRollDone: () => liveRef.current.onRollDone?.(),
      },
      // Read at creation: a skip that lands before the (cold) chunk does
      // means the late scene simply mounts at rest, no roll.
      liveRef.current.entrance !== 'none',
    )
    // Chunk landed while the parent was already in 'roll' (or StrictMode
    // recreated the scene mid-roll): start the timeline right away.
    if (liveRef.current.entrance === 'roll') handle.startRoll()
    handle.canvas.style.width = '100%'
    handle.canvas.style.height = '100%'
    handle.canvas.style.touchAction = 'none'
    host.appendChild(handle.canvas)
    sceneRef.current = handle
    // Re-apply state that may have been set before (re)creation.
    handle.setSelected(liveRef.current.selectedSpoke ?? null)
    handle.setSpin(liveRef.current.spin)
    handle.setDims(liveRef.current.dims)
    return () => {
      sceneRef.current = null
      handle.dispose()
      handle.canvas.remove()
    }
  }, [w, h])

  useEffect(() => {
    sceneRef.current?.setMode(mode)
  }, [mode])

  useEffect(() => {
    sceneRef.current?.setSelected(selectedSpoke ?? null)
  }, [selectedSpoke])

  useEffect(() => {
    sceneRef.current?.setSpin(spin)
  }, [spin])

  useEffect(() => {
    sceneRef.current?.setDims(dims)
  }, [dims])

  // 'hold' → 'roll' starts the timeline (parent saw the background land);
  // anything → 'none' mid-roll is the parent's skip and snaps the wheel
  // home. After a natural finish the snap is a no-op (guards on doneAt).
  useEffect(() => {
    if (entrance === 'roll') sceneRef.current?.startRoll()
    else if (entrance === 'none') sceneRef.current?.finishRoll()
  }, [entrance])

  return (
    <div
      ref={hostRef}
      className={className}
      style={{ width: w, height: h, ...style }}
      aria-label={
        mode === 'flag'
          ? 'The Tiranga — the Ashoka Chakra shrinks and locks into the waving flag'
          : 'Interactive Ashoka Chakra — tap a spoke or drag to spin'
      }
    />
  )
}
