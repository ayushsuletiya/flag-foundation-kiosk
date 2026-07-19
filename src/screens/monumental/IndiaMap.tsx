/**
 * IndiaMap — the right-hand map cluster of the Map Explorer screen
 * (Figma 795:7983 / 795:7400).
 *
 * Layers (inside MAP_BOX at 881,90 965×894):
 *  1. State silhouettes — the 36 hit SVGs from …map/states/hit/
 *     reassembled into ONE inline <svg> (white outlines stand in for the
 *     user-provided political overlay raster; the same paths are the tap
 *     targets). SVG texts are bundled via import.meta.glob(?raw) so the
 *     packaged file:// build needs no fetch.
 *  2. Selected state's extruded/glow PNG(s) from …map/states/active/
 *     (placement rule from _layout.json: PNG top-left at the node box
 *     top-left, rendered at half the PNG's pixel size in group px —
 *     shadow bleed overhangs right/bottom naturally).
 *  3. Flag markers — one per (state, district); the selected state's
 *     markers play the waving-flag PNG sequence full-opacity with a glow
 *     dot at the pole base, other states' markers show the static frame
 *     dimmed. The pole base (x≈10.5/62 of the marker box) anchors at the
 *     district position, matching Figma's glow-dot placement.
 *  4. Tooltip chip — gradient speech bubble named after the selected
 *     state; square corner bottom-right points at the state (offset rule
 *     reproduces Figma's Odisha chip at 1263,423 exactly).
 */
import { useEffect, useMemo, useState } from 'react'
import { PngSequencePlayer } from '../../components/PngSequencePlayer.tsx'
import { MONUMENTAL } from '../../assets/paths.ts'
import {
  ACTIVE_SCALE_X,
  ACTIVE_SCALE_Y,
  MAP_BOX,
  activeEntriesByState,
  districtsByState,
  hitEntriesByState,
  mapX,
  mapY,
  stateBounds,
  type DistrictPoint,
} from './monumentalGeo.ts'

// ---------------------------------------------------------------------------
// Hit SVG parsing (once, at module scope)
// ---------------------------------------------------------------------------

const hitSvgRaw = import.meta.glob('../../../assets/1-monumental-flags/map/states/hit/*.svg', {
  query: '?raw',
  import: 'default',
  eager: true,
}) as Record<string, string>

interface StateShape {
  state: string
  /** Path d strings in the file's own viewBox space. */
  paths: string[]
  /** viewBox width/height (integer-rounded node size). */
  vbW: number
  vbH: number
  /** Normalized bbox within the map. */
  x: number
  y: number
  w: number
  h: number
}

/**
 * Extract silhouette paths from one exported state SVG. Figma's export
 * wraps the clean silhouette in a <mask> (the visible path is a stroke
 * expansion); files without masks (island groups, plain shapes) carry the
 * silhouettes as direct paths.
 */
function parseShapePaths(svgText: string): { paths: string[]; vbW: number; vbH: number } | null {
  const doc = new DOMParser().parseFromString(svgText, 'image/svg+xml')
  const root = doc.querySelector('svg')
  if (root === null) return null
  const viewBox = (root.getAttribute('viewBox') ?? '').split(/\s+/).map(Number)
  const vbW = viewBox[2] ?? 0
  const vbH = viewBox[3] ?? 0
  if (!(vbW > 0) || !(vbH > 0)) return null
  const maskPaths = Array.from(doc.querySelectorAll('mask path'))
  const paths = (maskPaths.length > 0 ? maskPaths : Array.from(doc.querySelectorAll('path')))
    .map((p) => p.getAttribute('d'))
    .filter((d): d is string => d !== null && d.length > 0)
  return paths.length > 0 ? { paths, vbW, vbH } : null
}

const STATE_SHAPES: StateShape[] = (() => {
  const shapes: StateShape[] = []
  for (const [state, entries] of hitEntriesByState) {
    for (const entry of entries) {
      const raw = Object.entries(hitSvgRaw).find(([path]) => path.endsWith(`/${entry.file}`))?.[1]
      if (raw === undefined) continue
      const parsed = parseShapePaths(raw)
      if (parsed === null) continue
      shapes.push({ state, ...parsed, x: entry.x, y: entry.y, w: entry.w, h: entry.h })
    }
  }
  return shapes
})()

// ---------------------------------------------------------------------------
// Flag marker sequence availability (probed once per session)
// ---------------------------------------------------------------------------

const MARKER_SEQ_PATTERN = `${MONUMENTAL.flagMarker}/f_{frame}.png`
const MARKER_STATIC = `${MONUMENTAL.flagMarker}/static.png`
/** Frame budget for the future user-provided sequence; extra files are
 *  ignored, shorter sequences hold their last loaded frame (player skips). */
const MARKER_FRAME_COUNT = 60

let markerSeqKnown: boolean | null = null
const markerSeqProbe = new Promise<boolean>((resolve) => {
  const img = new Image()
  img.onload = () => resolve(true)
  img.onerror = () => resolve(false)
  img.src = MARKER_SEQ_PATTERN.replace('{frame}', '0001')
}).then((ok) => {
  markerSeqKnown = ok
  return ok
})

function useMarkerSequenceAvailable(): boolean {
  const [available, setAvailable] = useState(markerSeqKnown ?? false)
  useEffect(() => {
    let mounted = true
    void markerSeqProbe.then((ok) => {
      if (mounted) setAvailable(ok)
    })
    return () => {
      mounted = false
    }
  }, [])
  return available
}

// ---------------------------------------------------------------------------
// Marker geometry (Figma: 62×117 flag-on-pole, pole base at x≈10.5, glow
// dot 12×12 centered on the pole base)
// ---------------------------------------------------------------------------

const MARKER_W = 62
const MARKER_H = 117
const POLE_X = 10.5

function FlagMarker({
  point,
  selected,
  animated,
}: {
  point: DistrictPoint
  selected: boolean
  animated: boolean
}) {
  const px = mapX(point.x)
  const py = mapY(point.y)
  const left = px - POLE_X
  const top = py - MARKER_H
  // Only the selected state's markers render — everything else hides
  // completely (user decision 2026-07-16).
  if (!selected) return null
  return (
    <div
      className="mon-marker-in"
      style={{ position: 'absolute', left, top, width: MARKER_W, height: MARKER_H, pointerEvents: 'none' }}
    >
      {/* glow dot under the pole base */}
      <div
        style={{
          position: 'absolute',
          left: POLE_X - 6,
          top: MARKER_H - 6,
          width: 12,
          height: 12,
          borderRadius: '50%',
          background:
            'radial-gradient(circle, rgba(255,255,255,0.95) 0%, rgba(255,246,118,0.55) 45%, rgba(255,246,118,0) 75%)',
          filter: 'blur(1px)',
          transform: 'scale(1.6)',
        }}
      />
      {animated ? (
        <PngSequencePlayer
          srcPattern={MARKER_SEQ_PATTERN}
          frameCount={MARKER_FRAME_COUNT}
          fps={30}
          loop
          poster={MARKER_STATIC}
          width={MARKER_W}
          height={MARKER_H}
          fit="contain"
        />
      ) : (
        <img
          src={MARKER_STATIC}
          alt=""
          draggable={false}
          width={MARKER_W}
          height={MARKER_H}
          style={{ width: MARKER_W, height: MARKER_H, objectFit: 'contain' }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// IndiaMap
// ---------------------------------------------------------------------------

export interface IndiaMapProps {
  selectedState: string
  onSelectState: (state: string) => void
  /** States that actually have installations (markers render only for these). */
  statesWithInstallations: ReadonlySet<string>
}

export function IndiaMap({ selectedState, onSelectState, statesWithInstallations }: IndiaMapProps) {
  const seqAvailable = useMarkerSequenceAvailable()

  const activeEntries = activeEntriesByState.get(selectedState) ?? []

  // All markers, selected state's drawn last (on top), then by latitude so
  // southern flags overlap northern poles naturally.
  const markers = useMemo(() => {
    const all: { point: DistrictPoint; selected: boolean }[] = []
    for (const [state, points] of districtsByState) {
      if (!statesWithInstallations.has(state)) continue
      for (const point of points) all.push({ point, selected: state === selectedState })
    }
    all.sort((a, b) =>
      a.selected === b.selected ? a.point.y - b.point.y : a.selected ? 1 : -1,
    )
    return all
  }, [selectedState, statesWithInstallations])

  // Tooltip chip — offset rule derived from the Odisha sample (Figma
  // 1263,423 for a state box at 1325,533 → right = centerX−37, bottom =
  // stateTop−62), clamped into the map box for northern states.
  const bounds = stateBounds(selectedState)
  const chip =
    bounds === null
      ? null
      : (() => {
          const centerX = mapX(bounds.x + bounds.w / 2)
          const top = mapY(bounds.y)
          return {
            right: centerX - 37,
            top: Math.max(MAP_BOX.top - 40, top - 110),
          }
        })()

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {/* 1 · state silhouettes / tap targets */}
      <svg
        width={MAP_BOX.width}
        height={MAP_BOX.height}
        viewBox={`0 0 ${MAP_BOX.width} ${MAP_BOX.height}`}
        style={{ position: 'absolute', left: MAP_BOX.left, top: MAP_BOX.top, overflow: 'visible' }}
      >
        {STATE_SHAPES.map((shape, i) => (
          <g
            key={`${shape.state}-${i}`}
            className="mon-state-hit"
            transform={`translate(${shape.x * MAP_BOX.width}, ${shape.y * MAP_BOX.height}) scale(${
              (shape.w * MAP_BOX.width) / shape.vbW
            }, ${(shape.h * MAP_BOX.height) / shape.vbH})`}
            onClick={() => onSelectState(shape.state)}
          >
            {shape.paths.map((d, j) => (
              <path
                key={j}
                d={d}
                fill={
                  shape.state === selectedState
                    ? 'rgba(255, 255, 255, 0.10)'
                    : 'transparent'
                }
                /* Unselected states are COMPLETELY invisible (user decision:
                   only the selected state displays) — the render's baked
                   outlines carry the visuals; these paths remain only as
                   invisible tap targets. */
                stroke={
                  shape.state === selectedState
                    ? 'rgba(255, 255, 255, 0.9)'
                    : 'none'
                }
                strokeWidth={shape.state === selectedState ? 1.6 : 0}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
        ))}
      </svg>

      {/* 2 · selected state's extruded glow PNG(s) */}
      {activeEntries.map((entry) => (
        <img
          key={entry.file}
          className="mon-fade-in"
          src={`${MONUMENTAL.mapStates}/active/${entry.file}`}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            left: mapX(entry.x),
            top: mapY(entry.y),
            width: (entry.pngPx.w / 2) * ACTIVE_SCALE_X,
            height: (entry.pngPx.h / 2) * ACTIVE_SCALE_Y,
            pointerEvents: 'none',
          }}
        />
      ))}

      {/* 3 · flag markers */}
      {markers.map(({ point, selected }) => (
        <FlagMarker
          key={`${point.state}|${point.district}`}
          point={point}
          selected={selected}
          animated={seqAvailable}
        />
      ))}

      {/* 4 · state tooltip chip */}
      {chip !== null && (
        <div
          className="mon-fade-in"
          style={{
            position: 'absolute',
            left: chip.right,
            top: chip.top,
            transform: 'translateX(-100%)',
            height: 48,
            padding: '0 33px',
            display: 'flex',
            alignItems: 'center',
            borderRadius: '22.563px 22.563px 0 22.563px',
            background: 'linear-gradient(104.04deg, #FFFFFF 3.02%, #FFEAC1 103.17%)',
            border: '0.661px solid var(--gold-border)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 300,
            fontSize: 20.832,
            color: '#000000',
            whiteSpace: 'nowrap',
            pointerEvents: 'none',
          }}
        >
          {selectedState}
        </div>
      )}
    </div>
  )
}
