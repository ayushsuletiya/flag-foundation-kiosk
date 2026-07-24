/**
 * KnowMoreScreen — pixel build of Figma frame 795:5495 "History — 1947 · Know
 * More", rendered at 100% opacity (the Figma frame is accidentally at 90%).
 *
 * Route /history/:year/more. Left panel: Know More heading + intro + up to 4
 * gold-chevron bullet rows (Excel "05b · History Know More"); right panel:
 * gallery with a large image and thumbnails that swap it. Top strip: 9-year
 * timeline progress with the active year marked (data-driven — Figma's 7
 * decorative dots become one dot per Excel year), dots tap-jump between eras.
 *
 * Intro fallback: several Know More Description cells still hold the "—
 * (screen not built yet)" placeholder — those years show the year's Main
 * Slide Copy instead, so the panel never renders an em-dash stub.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BlurTypeText } from '../../components/BlurTypeText.tsx'
import { BackButton } from '../../components/BackButton.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { useHistoryYearAssets } from './historyAssets.ts'
import { ChakraMark, FallbackBackdrop } from './HistoryFallback.tsx'
import { VideoLoop } from '../../components/VideoLoop.tsx'
import { DEFAULT_HISTORY_YEAR } from './YearMainScreen.tsx'
import './KnowMoreScreen.css'

const TRACK_LEFT = 100
const TRACK_WIDTH = 932

/** Gold double-chevron bullet lead (Figma 873:91, ~21px, rebuilt per row). */
function DoubleChevronIcon({ size = 21 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 21 21" fill="none" aria-hidden="true">
      <path d="M3 2.5 11 10.5 3 18.5" stroke="#DCA32E" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
      <path d="M10.5 2.5 18.5 10.5 10.5 18.5" stroke="#DCA32E" strokeWidth={3.4} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

/** Dark placeholder tile shown where a gallery image is not yet delivered. */
function PlaceholderTile({ chakraSize }: { chakraSize: number }) {
  return (
    <span className="hk-placeholder-tile">
      <ChakraMark size={chakraSize} color="#8FA0D6" style={{ opacity: 0.3 }} />
    </span>
  )
}

export function KnowMoreScreen() {
  const navigate = useNavigate()
  const { year: yearParam } = useParams()
  const { content } = useContent()

  const years = content?.historyYears ?? []
  const row =
    years.find((y) => y.year === yearParam) ??
    years.find((y) => y.year === DEFAULT_HISTORY_YEAR) ??
    years[0] ??
    null
  const knowMore = content?.historyKnowMore.find((k) => k.year === row?.year) ?? null

  const assets = useHistoryYearAssets(row?.year ?? null)

  const [selected, setSelected] = useState(0)
  useEffect(() => {
    setSelected(0) // year switch resets the gallery
  }, [row?.year])

  if (row === null) {
    return <div className="hk-screen" />
  }

  const heading = knowMore?.heading ?? row.slideTitle
  const rawDescription = knowMore?.description ?? null
  const intro =
    rawDescription !== null && !rawDescription.trimStart().startsWith('—')
      ? rawDescription
      : row.mainCopy
  const bullets = knowMore?.bullets ?? []

  const activeIndex = Math.max(0, years.findIndex((y) => y.year === row.year))
  const lastIndex = Math.max(1, years.length - 1)
  const dotCenter = (i: number) => TRACK_LEFT + (TRACK_WIDTH * i) / lastIndex

  const gallery = assets.gallery
  const largeImage = gallery[Math.min(selected, Math.max(0, gallery.length - 1))] ?? null
  const placeholderThumbs = Math.max(0, 3 - gallery.length)

  return (
    <div className="hk-screen">
      {/* Backdrop: year photo blurred under the dark scrim, or navy fallback */}
      <div className="hk-bg-layer" key={row.year}>
        {!assets.ready ? null : assets.backgrounds.length > 0 ? (
          <img className="hk-bg-img" src={assets.backgrounds[0]} alt="" />
        ) : assets.backgroundVideo !== null ? (
          <VideoLoop src={assets.backgroundVideo} className="hk-bg-img" />
        ) : (
          <FallbackBackdrop />
        )}
      </div>
      <div className="hk-scrim" />

      {/* Timeline progress strip — one node per Excel year, active enlarged */}
      <div className="hk-strip">
        <span className="hk-strip-track" />
        {years.map((y, i) => (
          <button
            key={y.year}
            type="button"
            aria-label={y.year}
            className="hk-strip-hit"
            style={{ left: dotCenter(i) - 15 }}
            onClick={() => {
              if (i !== activeIndex) navigate(`/history/${y.year}/more`, { replace: true })
            }}
          >
            <span
              className={
                i === activeIndex
                  ? 'hk-strip-dot hk-strip-dot-active'
                  : i < activeIndex
                    ? 'hk-strip-dot'
                    : 'hk-strip-dot hk-strip-dot-future'
              }
            />
          </button>
        ))}
        <span className="hk-strip-year" style={{ left: dotCenter(activeIndex) + 12 }}>
          {row.year}
        </span>
      </div>

      {/* Top-right nav (audit geometry) */}
      <BackButton
        onClick={() => navigate(`/history/${row.year}`)}
        style={{ position: 'absolute', left: 1356, top: 36 }}
      />
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      {/* Left column — heading, intro, facts box */}
      <div className="hk-left" key={`left-${row.year}`}>
        <h1 className="hk-heading">
          <BlurTypeText text={heading} delay={80} stagger={22} budget={560} />
        </h1>
        <p className="hk-intro">{intro}</p>
      </div>
      <div className="hk-facts">
        {bullets.map((text) => (
          <div key={text} className="hk-fact-row">
            <span className="hk-fact-icon">
              <DoubleChevronIcon />
            </span>
            <p className="hk-fact-text">{text}</p>
          </div>
        ))}
      </div>

      {/* Divider */}
      <span className="hk-divider" />

      {/* Right column — gallery */}
      <h2 className="hk-gallery-heading">Gallery</h2>
      <div className="hk-gallery-large">
        {largeImage !== null ? (
          // NO blur-fill here on purpose: the large frame is DYNAMIC — it
          // hugs whatever size the photo resolves to (user 2026-07-23). A
          // fill would force it to the full slot and draw a fixed box.
          <img
            key={largeImage}
            src={largeImage}
            alt=""
            className={
              largeImage.includes('/flag/')
                ? 'hk-gallery-large-img hk-gallery-large-img--flag'
                : 'hk-gallery-large-img'
            }
          />
        ) : (
          <PlaceholderTile chakraSize={260} />
        )}
      </div>
      <div className="hk-thumbs">
        {gallery.map((src, i) => (
          <button
            key={src}
            type="button"
            className={i === selected ? 'hk-thumb hk-thumb-selected' : 'hk-thumb'}
            onClick={() => setSelected(i)}
          >
            <img
              src={src}
              alt=""
              className={
                src.includes('/flag/') ? 'hk-thumb-img hk-thumb-img--flag' : 'hk-thumb-img'
              }
            />
            {i === selected && <span className="hk-thumb-scrim" />}
          </button>
        ))}
        {Array.from({ length: placeholderThumbs }, (_, i) => (
          <PlaceholderTile key={`ph-${i}`} chakraSize={90} />
        ))}
      </div>
    </div>
  )
}
