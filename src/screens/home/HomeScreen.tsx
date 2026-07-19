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
import './HomeScreen.css'

// Runtime asset URLs come from src/assets/paths.ts (relative so they resolve
// served from the project root) and under file:// in the packaged build
// (assets/ copied next to dist/index.html by the vite build config).
const WAVE_SVG = `${SHARED.icons}/wave.svg`
const SWASH_SVG = `${SHARED.icons}/title-swash.svg`
const LOGO_PNG = HOME.logo

/**
 * Placement of the photo inside the card, as CSS percentages of the card
 * box — literal values from the Figma image-fill crop (get_design_context
 * on 795:4086). Every photo fully covers its card, so the Figma layers
 * hidden underneath (warm gradients, 20%-opacity texture, chakra sky
 * plate) are not reproduced.
 */
interface PhotoBox {
  left: string
  top: string
  width: string
  height: string
}

interface TileSpec {
  route: string
  /** Original Figma fill image (uncropped source, not a pre-baked crop). */
  image: string
  /** Figma frame x of the card. */
  left: number
  /** Card width (Ashok Chakra is 293.054, others 294.104). */
  width: number
  /** Figma image-fill crop for this card. */
  photo: PhotoBox
  /** Label text-box width from Figma (labels wrap inside it). */
  labelWidth: number
  /**
   * Figma label string — fallback until the Excel row arrives. '\n' marks
   * Figma's hard line breaks (rendered via white-space: pre-line); soft
   * wrapping alone cannot reproduce them ("History of" fits 152px, but the
   * design breaks after "History").
   */
  fallbackLabel: string
  /** National Symbols card: scrim ends in solid #5E3809. */
  solidScrim?: boolean
}

/** The 4 tiles in Home-Menu order (Excel rows 1-4 map onto this order). */
const TILES: readonly TileSpec[] = [
  {
    route: '/monumental',
    image: `${HOME.cards}/card-monumental.png`,
    left: 72,
    width: 294.104,
    photo: { left: '-1.2%', top: '-1.03%', width: '102.28%', height: '143.77%' },
    labelWidth: 228.981,
    fallbackLabel: 'Monumental Flags',
  },
  {
    route: '/history',
    image: `${HOME.cards}/card-history.png`,
    left: 420.77,
    width: 294.104,
    photo: { left: '0%', top: '0%', width: '100%', height: '138.07%' },
    labelWidth: 152.304,
    fallbackLabel: 'History\nof Tiranga',
  },
  {
    route: '/chakra',
    image: `${HOME.cards}/card-chakra.png`,
    left: 769.54,
    width: 293.054,
    photo: { left: '-35.82%', top: '0%', width: '171.98%', height: '100%' },
    labelWidth: 235.283,
    fallbackLabel: 'Ashok\nChakra',
  },
  {
    route: '/symbols',
    image: `${HOME.cards}/card-symbols.png`,
    left: 1123.9,
    width: 294.104,
    photo: { left: '-7.6%', top: '-24.62%', width: '115.37%', height: '149.38%' },
    labelWidth: 256.291,
    fallbackLabel: 'National Symbols of India',
    solidScrim: true,
  },
]

/**
 * Excel labels are plain strings; when one matches the designed label
 * (ignoring line breaks), render the designed version so Figma's hard
 * line breaks are preserved. Diverging Excel copy soft-wraps as-is.
 */
function designedLabel(excelLabel: string | undefined, fallback: string): string {
  if (excelLabel === undefined) return fallback
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  return norm(excelLabel) === norm(fallback) ? fallback : excelLabel
}

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
      {TILES.map((tile, i) => (
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
