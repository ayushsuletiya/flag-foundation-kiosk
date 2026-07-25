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
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { DynamicBackground } from '../../components/DynamicBackground.tsx'
import { HOME, SHARED } from '../../assets/paths.ts'
import { HOME_TILES, designedLabel } from './homeTiles.ts'
import './HomeScreen.css'

// Runtime asset URLs come from src/assets/paths.ts (relative so they resolve
// served from the project root) and under file:// in the packaged build
// (assets/ copied next to dist/index.html by the vite build config).
const WAVE_SVG = `${SHARED.icons}/wave.svg`
const TITLE_LOCKUP_SVG = HOME.titleLockup
const LOGO_PNG = HOME.logo

export function HomeScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const homeTiles = content?.homeTiles ?? []

  // Navigate INSTANTLY on tap — snappy, and no fade-to-nothing that would flash
  // the stage behind the home (user 2026-07-25). The tile's :active press gives
  // tactile feedback during the touch-hold; the destination owns its own
  // entrance and paints its warm base on the same commit (no black cut).
  const goToSection = (route: string) => navigate(route)

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
      {HOME_TILES.map((tile, i) => (
        <button
          key={tile.route}
          type="button"
          className="home-tile"
          style={{ left: tile.left, width: tile.width }}
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
      ))}

      {/* Cream wave sits above title/tiles; exported pre-clipped to frame (0,0) */}
      <img className="home-wave" src={WAVE_SVG} alt="" draggable={false} />
      {/* NJU logo lockup — topmost layer */}
      <img className="home-logo" src={LOGO_PNG} alt="The Naveen Jindal Universe" draggable={false} />
    </div>
  )
}
