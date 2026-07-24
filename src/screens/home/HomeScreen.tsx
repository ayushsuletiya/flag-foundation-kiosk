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
const SWASH_SVG = `${SHARED.icons}/title-swash.svg`
const LOGO_PNG = HOME.logo

export function HomeScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const homeTiles = content?.homeTiles ?? []

  return (
    <div className="home-screen">
      {/* Full-bleed background video (poster until the mp4 is delivered) */}
      <div className="home-bg">
        <DynamicBackground base={HOME.background} />
      </div>
      <div className="home-scrim" />

      {/* Title lockup */}
      <h1 className="home-title">
        <span className="home-title-script">The </span>
        Flag Foundation
      </h1>
      <img className="home-swash" src={SWASH_SVG} alt="" draggable={false} />
      <div className="home-of-india">of india</div>

      {/* Category tiles */}
      {HOME_TILES.map((tile, i) => (
        <button
          key={tile.route}
          type="button"
          className="home-tile"
          style={{ left: tile.left, width: tile.width }}
          onClick={() => navigate(tile.route)}
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
