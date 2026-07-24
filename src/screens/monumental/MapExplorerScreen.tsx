/**
 * MapExplorerScreen — Figma 795:7983 (map + states list) with the in-place
 * expanded tile variant from 795:7400.
 *
 * Route /monumental/map. Left: Select State filter row + scrollable list of
 * the selected state's installations (Excel tab 04) with the gold custom
 * scroll rail on the LEFT (audit: chevrons at x51, track at x63, tiles at
 * x129). Tapping a row expands it in place into the 435×415 gold card
 * (photo + Know More → detail route); one expanded at a time. Right: the
 * India map cluster (IndiaMap). Select State opens the modal overlay;
 * per user decision the selection only applies on CONTINUE.
 *
 * Background: assets/1-monumental-flags/map/background/bg.mp4 (may not exist)
 * full-bleed; until it lands, the terrain still is positioned via the
 * calibrated TERRAIN_PLACEMENT so India sits under the map box.
 */
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import type { Installation } from '../../data/schema.ts'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { ScrollList } from '../../components/ScrollList.tsx'
import { MonumentalHeader } from './MonumentalHeader.tsx'
import { IndiaMap } from './IndiaMap.tsx'
import { SelectStateOverlay } from './SelectStateOverlay.tsx'
import {
  TERRAIN_PLACEMENT,
  TERRAIN_STILL,
  getLastSelectedState,
  setLastSelectedState,
} from './monumentalGeo.ts'
import { MONUMENTAL, installationPhoto } from '../../assets/paths.ts'
import { useFlagObjectPosition } from '../../assets/imageFocus.ts'
import './monumental.css'

const INDIA_LOOP_VIDEO = `${MONUMENTAL.mapBackground}/bg.mp4`

// ---------------------------------------------------------------------------
// Backdrop — looping map video with calibrated-still fallback
// ---------------------------------------------------------------------------

function MapBackdrop() {
  const [videoFailed, setVideoFailed] = useState(false)
  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#04070E' }}>
      {/* Calibrated terrain still — always underneath, the video covers it
          once (if ever) the user-provided loop arrives. */}
      <img
        src={TERRAIN_STILL}
        alt=""
        draggable={false}
        style={{
          position: 'absolute',
          left: TERRAIN_PLACEMENT.left,
          top: TERRAIN_PLACEMENT.top,
          width: TERRAIN_PLACEMENT.width,
          height: TERRAIN_PLACEMENT.height,
          maxWidth: 'none',
        }}
      />
      {!videoFailed && (
        <video
          src={INDIA_LOOP_VIDEO}
          muted
          autoPlay
          loop
          playsInline
          preload="auto"
          disablePictureInPicture
          onError={() => setVideoFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Installation tile — collapsed row ⇄ expanded gold card (795:7400)
// ---------------------------------------------------------------------------

const TILE_W = 435.49
const TILE_H = 96.51
// CARD_H (and the photo/button offsets below) leave room for a 2-line title —
// row.location can wrap (e.g. "KISS Foundation Campus, Bhubaneswar"), and the
// Figma source (795:7400) only proved a single-line case ("Jindal Steel Plant").
const CARD_H = 447

function HeightBadge({ heightFt, dark }: { heightFt: number | null; dark: boolean }) {
  if (heightFt === null) return null
  const color = dark ? '#512312' : '#FFFFFF'
  return (
    <span style={{ display: 'flex', alignItems: 'baseline', whiteSpace: 'nowrap' }}>
      <span
        style={{
          fontFamily: 'var(--font-numeral)',
          fontWeight: 800,
          fontSize: 31.615,
          letterSpacing: -2.213,
          color,
        }}
      >
        {heightFt}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-numeral)',
          fontWeight: 700,
          fontSize: 17.655,
          color,
          marginLeft: 3,
        }}
      >
        FT
      </span>
    </span>
  )
}

function InstallationTile({
  row,
  expanded,
  glowSuppressed,
  onToggle,
  onKnowMore,
}: {
  row: Installation
  expanded: boolean
  /** True while the untethered first-row glow patch is painting this tile's
   *  glow outside the clipped scroll viewport — the tile must then drop its
   *  own box-shadow, or the two glows stack below the viewport's top clip
   *  line and the brightness step reads as a hard "clipped" edge. */
  glowSuppressed: boolean
  onToggle: () => void
  onKnowMore: () => void
}) {
  const [photoFailed, setPhotoFailed] = useState(false)
  useEffect(() => {
    setPhotoFailed(false)
  }, [row.id])
  // Keep the flag inside the 345x250 cover-crop (portrait photos would
  // otherwise behead the pole — the flag is almost always in the top half).
  // The card FILLS edge to edge like the original design: letterboxing it
  // put visible bands around the photo (user 2026-07-23).
  const photoPosition = useFlagObjectPosition(
    expanded && !photoFailed ? installationPhoto(row.id) : null,
    345 / 250.27,
  )

  return (
    // Shadow lives on this outer box; a child with `overflow: hidden` clips
    // its own box-shadow in every browser, so the glow can't sit on the same
    // element that clips the tile's two layers to the rounded corners.
    <div
      className="mon-tile"
      style={{
        position: 'relative',
        width: TILE_W,
        height: expanded ? CARD_H : TILE_H,
        flexShrink: 0,
        borderRadius: 'var(--radius-card)',
        boxShadow: expanded && !glowSuppressed ? 'var(--gold-glow)' : undefined,
        cursor: 'pointer',
      }}
      onClick={onToggle}
    >
      <div
        className="mon-tile-fill"
        style={{
          position: 'absolute',
          inset: 0,
          borderRadius: 'var(--radius-card)',
          border: '0.785px solid var(--cream-border)',
          background: expanded ? 'var(--gold-gradient)' : 'var(--glass-navy-tint)',
          backdropFilter: expanded ? undefined : 'var(--glass-filter-sm)',
          WebkitBackdropFilter: expanded ? undefined : 'var(--glass-filter-sm)',
          overflow: 'hidden',
        }}
      >
        {/* Collapsed layer: name + height */}
        <div
          className="mon-tile-layer"
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            width: TILE_W,
            height: TILE_H,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            padding: '0 24px 0 37px',
            opacity: expanded ? 0 : 1,
            pointerEvents: 'none',
          }}
        >
          <span
            style={{
              fontFamily: 'var(--font-ui)',
              fontWeight: 400,
              fontSize: 23.54,
              lineHeight: 1.15,
              color: '#FFFFFF',
              maxWidth: 250,
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {row.location}
          </span>
          <HeightBadge heightFt={row.heightFt} dark={false} />
        </div>

        {/* Expanded layer: title + photo + Know More (Figma 795:7400) */}
        <div
          className="mon-tile-layer"
          style={{
            position: 'absolute',
            inset: 0,
            opacity: expanded ? 1 : 0,
            pointerEvents: expanded ? 'auto' : 'none',
          }}
        >
          <div
            style={{
              position: 'absolute',
              left: 38,
              top: 27,
              width: 360,
              fontFamily: 'var(--font-ui)',
              fontWeight: 600,
              fontSize: 29.232,
              lineHeight: 1.1,
              color: '#512312',
              display: '-webkit-box',
              WebkitLineClamp: 2,
              WebkitBoxOrient: 'vertical',
              overflow: 'hidden',
            }}
          >
            {row.location}
          </div>
          <div
            style={{
              position: 'absolute',
              left: 29,
              top: 108,
              width: 345,
              height: 250.27,
              borderRadius: 19.795,
              border: '1.414px solid #FFFFFF',
              overflow: 'hidden',
              background: 'linear-gradient(160deg, #7A5223 0%, #3E2708 100%)',
            }}
          >
            {!photoFailed ? (
              <img
                src={installationPhoto(row.id)}
                alt=""
                draggable={false}
                onError={() => setPhotoFailed(true)}
                style={{
                  width: '100%',
                  height: '100%',
                  objectFit: 'cover',
                  objectPosition: photoPosition,
                }}
              />
            ) : (
              <div
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                <img
                  src={`${MONUMENTAL.flagMarker}/static.png`}
                  alt=""
                  draggable={false}
                  style={{ height: 170, opacity: 0.8 }}
                />
              </div>
            )}
          </div>
          <button
            type="button"
            className="mon-pressable"
            onClick={(e) => {
              e.stopPropagation()
              onKnowMore()
            }}
            style={{
              position: 'absolute',
              left: 29,
              top: 378,
              width: 180.77,
              height: 42.26,
              borderRadius: 'var(--radius-know-more)',
              background: 'linear-gradient(90deg, #FFFDE0 0%, #FFF5C3 100%)',
              fontFamily: 'var(--font-ui)',
              fontWeight: 500,
              fontSize: 22.982,
              color: '#572F16',
              cursor: 'pointer',
            }}
          >
            Know More
          </button>
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Screen
// ---------------------------------------------------------------------------

export function MapExplorerScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const [selectedState, setSelectedState] = useState(getLastSelectedState)
  const [overlayOpen, setOverlayOpen] = useState(false)
  const [expandedId, setExpandedId] = useState<number | null>(null)
  const [listScrollTop, setListScrollTop] = useState(0)
  const listKeyRef = useRef(0)

  const installations = useMemo(
    () => (content?.installations ?? []).filter((r) => r.state === selectedState),
    [content, selectedState],
  )

  const countByState = useMemo(() => {
    const map = new Map<string, number>()
    for (const r of content?.installations ?? []) {
      map.set(r.state, (map.get(r.state) ?? 0) + 1)
    }
    return map
  }, [content])

  const statesWithInstallations = useMemo(
    () => new Set(countByState.keys()),
    [countByState],
  )

  // First row starts expanded (Figma 795:7400 shows the top tile open).
  useEffect(() => {
    setExpandedId(installations[0]?.id ?? null)
  }, [installations])

  const applyState = (state: string) => {
    setSelectedState(state)
    setLastSelectedState(state)
    listKeyRef.current += 1 // remount ScrollList → scroll back to top
  }

  // The cold-start default ('Odisha') is a guess baked into monumentalGeo. If
  // the client's content.xlsx has no installations for the current state, fall
  // back to the first state that does — otherwise the map opens on an empty
  // list, zero markers, and a gold chip, looking broken.
  useEffect(() => {
    if (content === null || countByState.size === 0) return
    if ((countByState.get(selectedState) ?? 0) === 0) {
      const first = [...countByState.keys()][0]
      if (first !== undefined) applyState(first)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, countByState, selectedState])

  // While true, the untethered patch after the list is the SOLE source of the
  // first tile's glow (the in-list tile suppresses its own box-shadow). The
  // two must never paint together: the tile's copy is clipped at the scroll
  // viewport's top edge, so the overlap region below that edge doubles in
  // brightness and the step reads as a hard clip line under the filter chips.
  const firstRowGlowPatchActive =
    expandedId != null && expandedId === installations[0]?.id && listScrollTop <= 1

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <MapBackdrop />
      {/* Scrims per audit: vertical tint + left legibility */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--map-tint-gradient)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'var(--map-edge-gradient)' }} />

      <IndiaMap
        selectedState={selectedState}
        onSelectState={applyState}
        statesWithInstallations={statesWithInstallations}
      />

      <MonumentalHeader />
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      {/* Filter row — Select State dropdown pill + selected-state gold chip */}
      <button
        type="button"
        className="mon-pressable"
        onClick={() => setOverlayOpen(true)}
        style={{
          position: 'absolute',
          left: 125,
          top: 239,
          width: 184.4,
          height: 47.86,
          borderRadius: 'var(--radius-pill-filter)',
          background: '#2C2406',
          border: '1px solid #FFFFFF',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 18px 0 20px',
          fontFamily: 'var(--font-ui)',
          fontWeight: 300,
          fontSize: 21.009,
          color: '#FFFFFF',
          cursor: 'pointer',
          whiteSpace: 'nowrap',
        }}
      >
        Select State
        <svg width={20} height={20} viewBox="0 0 20 20" aria-hidden="true">
          <path
            d="M4 7.5 10 13.5 16 7.5"
            stroke="#FFFFFF"
            strokeWidth={2}
            fill="none"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>
      <div
        style={{
          position: 'absolute',
          left: 330,
          top: 239,
          width: 233.83,
          height: 47.86,
          borderRadius: 'var(--radius-pill-filter)',
          background: 'var(--gold-gradient)',
          border: '0.666px solid var(--cream-border)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          fontFamily: 'var(--font-ui)',
          fontWeight: 300,
          fontSize: 21.009,
          color: '#000000',
          whiteSpace: 'nowrap',
        }}
      >
        {selectedState}
      </div>

      {/* Installations list — gold scroll rail on the LEFT (audit x51/x63).
          `overscan` gives the scroll viewport's clip boundary room on every
          side so the expanded card's box-shadow glow (~52px reach) can fade
          out naturally instead of hard-cutting at the viewport edge — a
          scrolling axis can never be `overflow: visible`, so without this
          the glow gets clipped no matter which element it's drawn on. Tile
          and rail screen positions are unaffected, only the invisible clip
          margin grows. `top` overscan stays 0: the Select State pill sits
          just 25px above this list, nowhere near the ~52px the glow needs,
          and any bigger clip margin here would mean the (necessarily
          interactive) scroll viewport starts swallowing that pill's clicks.
          The unclippable top-of-list case (only the very first row, only
          at rest scroll) is instead handled by the untethered glow patch
          rendered after this list — see the comment there. */}
      <ScrollList
        key={listKeyRef.current}
        width={543.49}
        height={768}
        railSide="left"
        trackWidth={10}
        trackGap={45}
        overscan={{ top: 0, right: 70, bottom: 70, left: 70 }}
        onScrollTopChange={setListScrollTop}
        style={{ position: 'absolute', left: 51, top: 312 }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: 23.5, paddingBottom: 24 }}>
          {installations.map((row) => (
            <InstallationTile
              key={row.id}
              row={row}
              expanded={expandedId === row.id}
              glowSuppressed={firstRowGlowPatchActive && row.id === installations[0]?.id}
              onToggle={() => setExpandedId((cur) => (cur === row.id ? null : row.id))}
              onKnowMore={() => navigate(`/monumental/detail/${row.id}`)}
            />
          ))}
          {installations.length === 0 && (
            <div
              style={{
                width: TILE_W,
                padding: '32px 37px',
                borderRadius: 'var(--radius-card)',
                border: '0.785px solid var(--cream-border)',
                background: 'var(--glass-navy-tint)',
                fontFamily: 'var(--font-ui)',
                fontWeight: 300,
                fontSize: 22,
                color: '#FFFFFF',
              }}
            >
              No installations recorded for {selectedState} yet.
            </div>
          )}
        </div>
      </ScrollList>

      {/* First-row glow patch — the only tile whose expanded glow needs to
          bleed past the list's own top edge (every other tile has an opaque
          sibling row above it that already occludes the bleed naturally).
          The scroll viewport can't give that edge real breathing room
          without covering the Select State pill's clickable area, so this
          renders the tile's ONLY glow (the tile suppresses its own — see
          firstRowGlowPatchActive) as a `pointer-events: none` layer outside
          the clipped list entirely — clicks always fall through to
          whatever's really there. Only shown at rest scroll (the list
          isn't scrolled), since that's the one moment the first tile's top
          actually sits at this fixed y. */}
      {firstRowGlowPatchActive && (
        <div
          style={{
            position: 'absolute',
            left: 129,
            top: 312,
            width: TILE_W,
            height: CARD_H,
            borderRadius: 'var(--radius-card)',
            boxShadow: 'var(--gold-glow)',
            pointerEvents: 'none',
          }}
        />
      )}

      {overlayOpen && (
        <SelectStateOverlay
          currentState={selectedState}
          countByState={countByState}
          onContinue={(state) => {
            applyState(state)
            setOverlayOpen(false)
          }}
          onClose={() => setOverlayOpen(false)}
        />
      )}
    </div>
  )
}
