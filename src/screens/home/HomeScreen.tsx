/**
 * HomeScreen — pixel-perfect build of Figma frame 795:4086 "🏠 Home — Landing".
 *
 * Landing/attract screen: brand lockup + app title over a full-bleed sunset
 * flag scene with 4 large touch tiles routing to the category sections.
 * All coordinates are literal Figma pixels inside the 1920x1080 <Stage>.
 *
 * Background is a looping video (assets/0-home/background/bg.mp4 — user-provided,
 * may not exist yet); <DynamicBackground> resolves bg.mp4 / bg.png / poster.
 * The 13px backdrop blur from Figma is intentionally NOT reproduced live
 * (kiosk GPU) — it must be baked into the delivered video.
 *
 * Tile labels are live from the Excel "01 · Home Menu" tab (rows sorted by
 * order 1-4 map to routes in TILES order); Figma strings are the fallback
 * so the screen never renders empty while content loads.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { DynamicBackground } from '../../components/DynamicBackground.tsx'
import { HOME, SHARED } from '../../assets/paths.ts'
import { useImagesReady } from '../../assets/useImagesReady.ts'
import { areImagesDecoded } from '../../assets/preload.ts'
import { warmChakra } from '../../app/warmChakra.ts'
import { HOME_TILES, designedLabel } from './homeTiles.ts'
import './HomeScreen.css'

// Runtime asset URLs come from src/assets/paths.ts (relative so they resolve
// served from the project root) and under file:// in the packaged build
// (assets/ copied next to dist/index.html by the vite build config).
const WAVE_SVG = `${SHARED.icons}/wave.svg`
const TITLE_LOCKUP_SVG = HOME.titleLockup
const LOGO_PNG = HOME.logo

/** In-animation: per-tile stagger + the run itself (must match HomeScreen.css). */
const TILE_IN_STAGGER_MS = 90
const TILE_IN_MS = 460

export function HomeScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const homeTiles = content?.homeTiles ?? []

  // Nothing shows until every card photo is DECODED, so the tiles animate in
  // over finished artwork instead of the visitor watching four photos pop in
  // one by one (user 2026-07-26). Missing files resolve as ready, so an
  // undelivered asset can never hold the screen back.
  const tilePhotos = useMemo(() => HOME_TILES.map((t) => t.image), [])
  const tilesReady = useImagesReady(tilePhotos)
  // Was the artwork ALREADY decoded when this mount started? If so the visitor
  // is coming BACK to the home screen, so the tiles are painted instantly and
  // the entrance is skipped — replaying the stagger on every return looked like
  // the photos were loading again (user 2026-07-26). The entrance is for the
  // cold first paint, where the decode genuinely has to happen.
  const warmMount = useRef(areImagesDecoded(tilePhotos)).current

  // Once the entrance has finished we drop the animation entirely: a
  // `forwards`-filled animation keeps ownership of `transform` and would
  // otherwise dead-lock the .home-tile:active press-in feedback.
  const [settled, setSettled] = useState(warmMount)
  useEffect(() => {
    if (!tilesReady || settled) return
    const t = window.setTimeout(
      () => setSettled(true),
      TILE_IN_MS + TILE_IN_STAGGER_MS * HOME_TILES.length,
    )
    return () => window.clearTimeout(t)
  }, [tilesReady, settled])

  // The tapped tile lifts away while the others recede — the out-animation
  // rides ON TOP of the existing cross-dissolve (App.tsx keeps this page
  // painted for 300ms), so the background never blinks and we are NOT
  // re-adding the banned home-leave fade that exposed the empty stage.
  const [leavingTo, setLeavingTo] = useState<string | null>(null)

  const goToSection = (route: string) => {
    setLeavingTo(route)
    // Navigate on the SAME tap — still instant (user 2026-07-25); the exit
    // animation plays during the dissolve rather than delaying it.
    navigate(route)
  }

  return (
    <div className="home-screen">
      {/* Full-bleed background video (poster until the mp4 is delivered) */}
      <div className="home-bg">
        <DynamicBackground base={HOME.background} />
      </div>
      <div className="home-scrim" />

      {/* Title lockup — single client-supplied SVG (headline + script + swash) */}
      <img
        className="home-title-lockup"
        src={TITLE_LOCKUP_SVG}
        alt="The Spirit of India"
        draggable={false}
      />

      {/* Category tiles */}
      {HOME_TILES.map((tile, i) => {
        const state =
          leavingTo !== null
            ? leavingTo === tile.route
              ? ' home-tile--picked'
              : ' home-tile--recede'
            : settled
              ? ' home-tile--settled'
              : tilesReady
                ? ' home-tile--in'
                : ''
        return (
        <button
          key={tile.route}
          type="button"
          className={`home-tile${state}`}
          style={{ left: tile.left, width: tile.width, '--tile-i': i } as CSSProperties}
          // Chakra carries a ~575kB three.js chunk: start warming it while the
          // finger is still DOWN, a beat before navigate() runs.
          onPointerDown={tile.route === '/chakra' ? warmChakra : undefined}
          onClick={() => goToSection(tile.route)}
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
      <img className="home-wave" src={WAVE_SVG} alt="" draggable={false} />
      {/* NJU logo lockup — topmost layer */}
      <img className="home-logo" src={LOGO_PNG} alt="The Naveen Jindal Universe" draggable={false} />
    </div>
  )
}
