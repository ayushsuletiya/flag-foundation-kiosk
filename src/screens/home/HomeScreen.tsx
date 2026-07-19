/**
 * HomeScreen — pixel-perfect build of Figma frame 795:4086 "🏠 Home — Landing".
 *
 * Landing/attract screen: brand lockup + app title over a full-bleed sunset
 * flag scene with 4 large touch tiles routing to the category sections.
 * All coordinates are literal Figma pixels inside the 1920x1080 <Stage>.
 *
 * Background is a looping video (assets/video/home-bg.mp4 — user-provided,
 * may not exist yet); <VideoLoop> shows the poster until/unless it loads.
 * The 13px backdrop blur from Figma is intentionally NOT reproduced live
 * (kiosk GPU) — it must be baked into the delivered video.
 *
 * Tile labels are live from the Excel "01 · Home Menu" tab (rows sorted by
 * order 1-4 map to routes in TILES order); Figma strings are the fallback
 * so the screen never renders empty while content loads.
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { VideoLoop } from '../../components/VideoLoop.tsx'
import { SymbolVisual } from '../symbols/SymbolVisual.tsx'
import { symbolShortName, symbolSlug } from '../symbols/symbolsData.ts'
import {
  EXIT_GLOW_MS,
  EXIT_MORPH_MS,
  EXIT_MORPH_START,
  EXIT_SLIDE_MS,
  EXIT_TOTAL_MS,
  HANDOFF,
  type SymbolsEntryState,
} from '../symbols/transitionContract.ts'
import './HomeScreen.css'

// Runtime asset URLs, relative so they resolve under vite dev (/assets/…
// served from the project root) and under file:// in the packaged build
// (assets/ copied next to dist/index.html by the vite build config).
const BG_VIDEO = 'assets/video/home-bg.mp4'
const BG_POSTER = 'assets/images/home/bg-poster.png'
const WAVE_SVG = 'assets/icons/wave.svg'
const SWASH_SVG = 'assets/icons/title-swash.svg'
const LOGO_PNG = 'assets/images/home/logo-nju.png'

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
    image: 'assets/images/home/card-monumental.png',
    left: 72,
    width: 294.104,
    photo: { left: '-1.2%', top: '-1.03%', width: '102.28%', height: '143.77%' },
    labelWidth: 228.981,
    fallbackLabel: 'Monumental Flags',
  },
  {
    route: '/history',
    image: 'assets/images/home/card-history.png',
    left: 420.77,
    width: 294.104,
    photo: { left: '0%', top: '0%', width: '100%', height: '138.07%' },
    labelWidth: 152.304,
    fallbackLabel: 'History\nof Tiranga',
  },
  {
    route: '/chakra',
    image: 'assets/images/home/card-chakra.png',
    left: 769.54,
    width: 293.054,
    photo: { left: '-35.82%', top: '0%', width: '171.98%', height: '100%' },
    labelWidth: 235.283,
    fallbackLabel: 'Ashok\nChakra',
  },
  {
    route: '/symbols',
    image: 'assets/images/home/card-symbols.png',
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

  // ---- Symbols exit cinematic (spec 2026-07-19) ---------------------
  // One rAF master clock; every beat below derives from exitT in render.
  // Completion-gated (exitDone) so StrictMode's double-mount restarts the
  // clock instead of freezing it (CLAUDE.md gotcha).
  const [exitSeed, setExitSeed] = useState<{ slug: string; name: string } | null>(null)
  const [exitT, setExitT] = useState(0)
  const exitDone = useRef(false)
  const exitRaf = useRef<number | null>(null)
  const exiting = exitSeed !== null

  const beginSymbolsExit = () => {
    if (exiting) return
    const ids = content?.symbolIdentities ?? []
    if (ids.length === 0) {
      navigate('/symbols') // content not ready — plain navigation
      return
    }
    const pick = ids[Math.floor(Math.random() * ids.length)]!
    setExitSeed({ slug: symbolSlug(pick.symbol), name: symbolShortName(pick) })
  }

  useEffect(() => {
    if (exitSeed === null || exitDone.current) return
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = now - start
      setExitT(t)
      if (t < EXIT_TOTAL_MS) {
        exitRaf.current = requestAnimationFrame(tick)
      } else {
        exitRaf.current = null
        exitDone.current = true
        const state: SymbolsEntryState = { seed: exitSeed.slug, cinematic: true }
        navigate('/symbols', { state })
      }
    }
    exitRaf.current = requestAnimationFrame(tick)
    return () => {
      if (exitRaf.current !== null) {
        cancelAnimationFrame(exitRaf.current)
        exitRaf.current = null
      }
    }
  }, [exitSeed]) // eslint-disable-line react-hooks/exhaustive-deps

  // Kiosk rule: any touch mid-cinematic skips it.
  const skipExit = () => {
    if (exitSeed === null || exitDone.current) return
    exitDone.current = true
    if (exitRaf.current !== null) {
      cancelAnimationFrame(exitRaf.current)
      exitRaf.current = null
    }
    const state: SymbolsEntryState = { seed: exitSeed.slug, cinematic: false }
    navigate('/symbols', { state })
  }

  // ---- beat values (all pure functions of exitT) --------------------
  const clamp01 = (v: number) => Math.max(0, Math.min(1, v))
  const easeOut = (v: number) => 1 - Math.pow(1 - v, 3)
  const easeInOut = (v: number) => (v < 0.5 ? 4 * v * v * v : 1 - Math.pow(-2 * v + 2, 3) / 2)
  const veilP = clamp01((exitT - 250) / 600)
  const chromeFade = 1 - clamp01(exitT / 500)
  const glowP = easeOut(clamp01((exitT - EXIT_SLIDE_MS) / EXIT_GLOW_MS))
  const morphP = easeInOut(clamp01((exitT - EXIT_MORPH_START) / EXIT_MORPH_MS))
  const lerp = (a: number, b: number) => a + (b - a) * morphP
  // Home tile rect of the symbols card → HANDOFF rect on the stage.
  const morphRect = {
    left: lerp(1123.9, HANDOFF.left),
    top: lerp(553, HANDOFF.top),
    width: lerp(294.104, HANDOFF.width),
    height: lerp(403.343, HANDOFF.height),
    radius: lerp(49.61, HANDOFF.radius),
  }
  const glowOpacity = glowP * (1 - 0.6 * morphP)

  return (
    <div className="home-screen" onPointerDown={exiting ? skipExit : undefined}>
      {/* Full-bleed background video (poster until the mp4 is delivered) */}
      <div className="home-bg">
        <VideoLoop src={BG_VIDEO} poster={BG_POSTER} />
      </div>
      <div className="home-scrim" />

      {/* Title lockup — fades first during the exit cinematic */}
      <h1 className="home-title" style={exiting ? { opacity: chromeFade } : undefined}>
        <span className="home-title-script">The </span>
        Flag Foundation
      </h1>
      <img
        className="home-swash"
        src={SWASH_SVG}
        alt=""
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />
      <div className="home-of-india" style={exiting ? { opacity: chromeFade } : undefined}>
        of india
      </div>

      {/* Category tiles */}
      {TILES.map((tile, i) => {
        const isSymbols = tile.route === '/symbols'
        // Non-symbols tiles slide LEFT off-stage, staggered by column.
        const slideP = exiting ? easeOut(Math.max(0, Math.min(1, (exitT - i * 90) / (EXIT_SLIDE_MS - 100)))) : 0
        const slideStyle =
          exiting && !isSymbols
            ? {
                transform: `translateX(${(-(tile.left + tile.width + 80) * slideP).toFixed(1)}px)`,
                opacity: 1 - slideP,
                pointerEvents: 'none' as const,
              }
            : exiting
              ? { visibility: 'hidden' as const } // symbols tile: the morph element takes over
              : undefined
        return (
          <button
            key={tile.route}
            type="button"
            className="home-tile"
            style={{ left: tile.left, width: tile.width, ...slideStyle }}
            onClick={() => {
              if (exiting) return
              if (isSymbols) beginSymbolsExit()
              else navigate(tile.route)
            }}
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
      <img
        className="home-wave"
        src={WAVE_SVG}
        alt=""
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />
      {/* NJU logo lockup — topmost chrome layer */}
      <img
        className="home-logo"
        src={LOGO_PNG}
        alt="The Naveen Jindal Universe"
        draggable={false}
        style={exiting ? { opacity: chromeFade } : undefined}
      />

      {/* ---- Exit cinematic layers (above everything) ---------------- */}
      {exiting && <div className="home-exit-veil" style={{ opacity: veilP }} />}
      {exiting && exitSeed !== null && (
        <div
          className="home-morph"
          style={{
            left: morphRect.left,
            top: morphRect.top,
            width: morphRect.width,
            height: morphRect.height,
            borderRadius: morphRect.radius,
            boxShadow: `0 0 ${(24 + 66 * glowOpacity).toFixed(0)}px ${(4 + 14 * glowOpacity).toFixed(0)}px rgba(255, 196, 84, ${(0.55 * glowOpacity).toFixed(3)}), 0 0 0 2.5px rgba(255, 226, 150, ${(0.9 * glowOpacity).toFixed(3)})`,
          }}
        >
          {/* Old face: the home tile's photo/scrim/label, fading out */}
          <div className="home-morph-old" style={{ opacity: 1 - morphP }}>
            <img
              className="home-tile-photo"
              src={TILES[3]!.image}
              alt=""
              draggable={false}
              style={{ ...TILES[3]!.photo }}
            />
            <div className="home-tile-scrim home-tile-scrim--solid" />
            <span className="home-tile-label" style={{ width: TILES[3]!.labelWidth }}>
              {designedLabel(homeTiles[3]?.label, TILES[3]!.fallbackLabel)}
            </span>
          </div>
          {/* New face: the seeded glass symbol card, fading in. Rendered at
              final 379x472 and scaled so SymbolVisual never re-lays-out. */}
          <div
            className="home-morph-card"
            style={{
              opacity: morphP,
              transform: `scale(${(morphRect.width / HANDOFF.width).toFixed(4)}, ${(morphRect.height / HANDOFF.height).toFixed(4)})`,
            }}
          >
            <SymbolVisual
              slug={exitSeed.slug}
              name={exitSeed.name}
              width={HANDOFF.width}
              height={HANDOFF.height}
              mode="still"
              fit="contain"
            />
          </div>
        </div>
      )}
    </div>
  )
}
