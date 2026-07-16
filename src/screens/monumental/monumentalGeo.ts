/**
 * monumentalGeo — map-space plumbing for the Monumental Flags section.
 *
 * One normalized coordinate space rules everything: x/y in 0–1 relative to
 * the India map box. Three data sources share it (verified: identical
 * normalized bboxes for the same state across files):
 *  - assets/map/states/active/_layout.json — extruded "glow" PNG placement
 *  - assets/map/states/hit/_layout.json    — state silhouette SVGs (tap map)
 *  - src/data/geo/districts.json           — one marker position per
 *    (state, district) pair from Excel tab 04
 *
 * All three JSONs are imported ?raw and parsed here (bundled — no runtime
 * fetch, so the packaged Electron build works under file://).
 *
 * MAP_BOX comes from the frame audit of 795:7983/795:7400: the India map
 * occupies (881,90)–(1846,984) on the 1920×1080 stage.
 */
import activeLayoutRaw from '../../../assets/map/states/active/_layout.json?raw'
import hitLayoutRaw from '../../../assets/map/states/hit/_layout.json?raw'
import districtsRaw from '../../data/geo/districts.json?raw'

// ---------------------------------------------------------------------------
// Map box (stage px) + terrain backdrop calibration
// ---------------------------------------------------------------------------

/** On-stage bounds of the India map cluster (audit: inset ≈ x881,y90 → 1846,984). */
export const MAP_BOX = { left: 881, top: 90, width: 965, height: 894 } as const

export const mapX = (nx: number): number => MAP_BOX.left + nx * MAP_BOX.width
export const mapY = (ny: number): number => MAP_BOX.top + ny * MAP_BOX.height

/**
 * Terrain still placement for the map screen backdrop.
 *
 * assets/map/terrain-still.png (4096×2286) is the INTRO frame's whole-
 * subcontinent artwork; the map screen's Figma background is the same
 * artwork zoomed so India sits under the political map on the right.
 * These values scale/translate the still so its India lands under MAP_BOX
 * (anchors: Kutch west tip / Arunachal east tip for x, Kashmir top /
 * Kanyakumari for y — measured in the still, solved against the hit-space
 * extremes). The user-provided india-map-loop.mp4 replaces this at 1:1
 * full-bleed when it arrives.
 */
/* User-provided glowing render (2026-07-16) — composed so India sits under
   the map box at near-full-bleed. Placement solved from the render's bright
   outline bbox (x 0.4656 w 0.4906 / y 0.0898 h 0.8176) → map box (881,90,
   965×894). Old Figma still kept at assets/map/terrain-still.png. */
export const TERRAIN_STILL = 'assets/map/terrain-render.png'
export const TERRAIN_NATURAL = { width: 1920, height: 1080 } as const
export const TERRAIN_PLACEMENT = {
  left: -35,
  top: -8,
  width: 1967,
  height: 1093,
} as const

// ---------------------------------------------------------------------------
// Layout JSON shapes
// ---------------------------------------------------------------------------

export interface ActiveStateEntry {
  file: string
  canonical: string
  /** Normalized bbox (0–1) of the state node within the map box. */
  x: number
  y: number
  w: number
  h: number
  nodePx: { x: number; y: number; w: number; h: number }
  /** Exported PNG pixel size (includes shadow bleed right/bottom). */
  pngPx: { w: number; h: number; expectedAt2x: [number, number] }
}

export interface HitStateEntry {
  file: string
  canonical: string
  x: number
  y: number
  w: number
  h: number
  nodePx: { x: number; y: number; w: number; h: number }
}

interface ActiveLayout {
  source: { groupBoxPx: { w: number; h: number } }
  states: ActiveStateEntry[]
}

interface HitLayout {
  states: HitStateEntry[]
}

interface DistrictsFile {
  districts: { state: string; district: string; x: number; y: number }[]
}

const activeLayout = JSON.parse(activeLayoutRaw) as ActiveLayout
const hitLayout = JSON.parse(hitLayoutRaw) as HitLayout
const districtsFile = JSON.parse(districtsRaw) as DistrictsFile

/** Figma px size of the active-PNG group — pngPx/2 is sized in THIS space. */
export const ACTIVE_GROUP_BOX = activeLayout.source.groupBoxPx

/** Scale factors from active-group px → on-stage map px. */
export const ACTIVE_SCALE_X = MAP_BOX.width / ACTIVE_GROUP_BOX.w
export const ACTIVE_SCALE_Y = MAP_BOX.height / ACTIVE_GROUP_BOX.h

// ---------------------------------------------------------------------------
// canonical slug → CANONICAL_STATES display name
// ---------------------------------------------------------------------------

const DNH = 'Dadra & Nagar Haveli and Daman & Diu'

const SLUG_TO_STATE: Record<string, string> = {
  'andaman-nicobar': 'Andaman & Nicobar Islands',
  'andhra-pradesh': 'Andhra Pradesh',
  'arunachal-pradesh': 'Arunachal Pradesh',
  assam: 'Assam',
  bihar: 'Bihar',
  chhattisgarh: 'Chhattisgarh',
  // fragment-49x / fragment-36x trio — tiny coastal shapes, identified by
  // geography (see hit/_layout.json notes); all belong to the merged UT.
  'dadra-and-nagar-haveli': DNH,
  daman: DNH,
  diu: DNH,
  delhi: 'Delhi',
  goa: 'Goa',
  gujarat: 'Gujarat',
  haryana: 'Haryana',
  'himachal-pradesh': 'Himachal Pradesh',
  'jammu-and-kashmir': 'Jammu & Kashmir',
  jharkhand: 'Jharkhand',
  karnataka: 'Karnataka',
  kerala: 'Kerala',
  ladakh: 'Ladakh',
  lakshadweep: 'Lakshadweep',
  'madhya-pradesh': 'Madhya Pradesh',
  maharashtra: 'Maharashtra',
  manipur: 'Manipur',
  meghalaya: 'Meghalaya',
  mizoram: 'Mizoram',
  nagaland: 'Nagaland',
  odisha: 'Odisha',
  puducherry: 'Puducherry',
  punjab: 'Punjab',
  rajasthan: 'Rajasthan',
  sikkim: 'Sikkim',
  'tamil-nadu': 'Tamil Nadu',
  telangana: 'Telangana',
  tripura: 'Tripura',
  'uttar-pradesh': 'Uttar Pradesh',
  uttarakhand: 'Uttarakhand',
  'west-bengal': 'West Bengal',
}

/** "odisha", "lakshadweep (inferred: …)" → display name, or null for junk fragments. */
function stateForCanonical(canonical: string): string | null {
  const slug = canonical.split(' ')[0] ?? ''
  return SLUG_TO_STATE[slug] ?? null
}

// ---------------------------------------------------------------------------
// Grouped lookups
// ---------------------------------------------------------------------------

function groupByState<T extends { canonical: string }>(entries: T[]): Map<string, T[]> {
  const map = new Map<string, T[]>()
  for (const entry of entries) {
    const state = stateForCanonical(entry.canonical)
    if (state === null) continue // unknown-fragment sliver
    const list = map.get(state)
    if (list) list.push(entry)
    else map.set(state, [entry])
  }
  return map
}

/** Extruded/glow PNG entries per state (DNH maps to 3 tiny fragments). */
export const activeEntriesByState: ReadonlyMap<string, ActiveStateEntry[]> = groupByState(
  activeLayout.states,
)

/** Hit-silhouette SVG entries per state. */
export const hitEntriesByState: ReadonlyMap<string, HitStateEntry[]> = groupByState(
  hitLayout.states,
)

export interface DistrictPoint {
  state: string
  district: string
  /** Normalized 0–1 within MAP_BOX. */
  x: number
  y: number
}

/**
 * Marker positions per state, deduped by coordinates — tab 04 spells some
 * districts two ways ("Lahaul and Spiti"/"Lahul Spiti", "Bengaluru Urban"/
 * "Bengaluru") that share one position; coordinate dedupe collapses them to
 * a single marker (see geo-report.json dataNotes).
 */
export const districtsByState: ReadonlyMap<string, DistrictPoint[]> = (() => {
  const map = new Map<string, DistrictPoint[]>()
  for (const d of districtsFile.districts) {
    const list = map.get(d.state) ?? []
    if (!list.some((p) => Math.abs(p.x - d.x) < 1e-4 && Math.abs(p.y - d.y) < 1e-4)) {
      list.push(d)
    }
    map.set(d.state, list)
  }
  return map
})()

/**
 * Normalized union bbox for a state — anchor for the map tooltip chip.
 * Prefers the active-PNG geometry; falls back to district markers for
 * states with no map shape (Chandigarh).
 */
export function stateBounds(
  state: string,
): { x: number; y: number; w: number; h: number } | null {
  const entries = activeEntriesByState.get(state)
  if (entries !== undefined && entries.length > 0) {
    let x0 = Infinity
    let y0 = Infinity
    let x1 = -Infinity
    let y1 = -Infinity
    for (const e of entries) {
      x0 = Math.min(x0, e.x)
      y0 = Math.min(y0, e.y)
      x1 = Math.max(x1, e.x + e.w)
      y1 = Math.max(y1, e.y + e.h)
    }
    return { x: x0, y: y0, w: x1 - x0, h: y1 - y0 }
  }
  const points = districtsByState.get(state)
  if (points === undefined || points.length === 0) return null
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of points) {
    x0 = Math.min(x0, p.x)
    y0 = Math.min(y0, p.y)
    x1 = Math.max(x1, p.x)
    y1 = Math.max(y1, p.y)
  }
  // Give a point-cluster a nominal box so the tooltip offset math holds.
  return { x: x0 - 0.01, y: y0 - 0.01, w: x1 - x0 + 0.02, h: y1 - y0 + 0.02 }
}

// ---------------------------------------------------------------------------
// Session memory — survive map → detail → back without a store
// ---------------------------------------------------------------------------

let lastSelectedState = 'Odisha' // Figma sample state is the cold-start default

export function getLastSelectedState(): string {
  return lastSelectedState
}

export function setLastSelectedState(state: string): void {
  lastSelectedState = state
}
