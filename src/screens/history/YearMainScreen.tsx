/**
 * YearMainScreen — pixel build of Figma frame 795:4273 "History — 1947 · Main".
 *
 * Routes /history and /history/:year (default 1947). Layout anchors are
 * literal Figma pixels on the 1920x1080 Stage; every string is live from the
 * Excel "05 · History Timeline" tab, so text blocks flow inside fixed anchors
 * (audit risk #4) instead of being hard-sized.
 *
 * Background: bg-1..bg-N.png for the year — one image renders static, two or
 * more crossfade every 2.5s; none = dark-navy chakra fallback (no fake
 * photos). Per current Figma: year + flag + title + Read More only — the
 * Main Slide Copy from Excel renders on the Know More screen instead.
 */
import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { useHistoryYearAssets } from './historyAssets.ts'
import { ChakraMark, FallbackBackdrop } from './HistoryFallback.tsx'
import './YearMainScreen.css'

export const DEFAULT_HISTORY_YEAR = '1947'

/** Stacked <img> crossfade — 2.5s hold, 900ms opacity ramp (CSS). */
function BackgroundLoop({ images }: { images: string[] }) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
    if (images.length < 2) return
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % images.length)
    }, 2500)
    return () => clearInterval(timer)
  }, [images])

  return (
    <div className="hy-bg">
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          className="hy-bg-img"
          style={{ opacity: i === active ? 1 : 0 }}
        />
      ))}
    </div>
  )
}

export function YearMainScreen() {
  const navigate = useNavigate()
  const { year: yearParam } = useParams()
  const { content } = useContent()

  const years = content?.historyYears ?? []
  const row =
    years.find((y) => y.year === yearParam) ??
    years.find((y) => y.year === DEFAULT_HISTORY_YEAR) ??
    years[0] ??
    null

  const assets = useHistoryYearAssets(row?.year ?? null)

  if (row === null) {
    // Content still loading (or empty workbook) — hold a dark frame.
    return <div className="hy-screen" />
  }

  return (
    <div className="hy-screen">
      {/* Background: era photo(s) or honest fallback, under tint + left scrim */}
      <div className="hy-bg-layer" key={row.year}>
        {!assets.ready ? null : assets.backgrounds.length > 0 ? (
          <BackgroundLoop images={assets.backgrounds} />
        ) : (
          <FallbackBackdrop />
        )}
      </div>
      <div className="hy-tint" />
      <div className="hy-left-scrim" />

      {/* Header — "History of " Poppins + "Tiranga" Parisienne, gradient clip */}
      <h1 className="hy-header">
        <span className="hy-header-plain">History of </span>
        <span className="hy-header-script">Tiranga</span>
      </h1>

      {/* Top-right nav (audit geometry) */}
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      {/* Left hero column — year, flag, title, Read More (per current Figma:
          no subtitle line, no body copy on Main; copy lives on Know More) */}
      <div className="hy-hero" key={`hero-${row.year}`}>
        <div className="hy-year-row">
          <span className="hy-year">{row.year}</span>
          {assets.yearFlag !== null ? (
            <img className="hy-year-flag" src={assets.yearFlag} alt="" />
          ) : assets.ready ? (
            <span className="hy-year-flag hy-year-flag-ph">
              <ChakraMark size={64} color="#D8C287" style={{ opacity: 0.35 }} />
            </span>
          ) : null}
        </div>
        <div className="hy-text-stack">
          <p className="hy-title">{row.slideTitle}</p>
          <button
            type="button"
            className="hy-read-more"
            onClick={() => navigate(`/history/${row.year}/more`)}
          >
            Read More
          </button>
        </div>
      </div>

      {/* Bottom timeline bar — glass panel, gold track, 9 data-driven pills */}
      <div className="hy-timeline">
        <span className="hy-timeline-label">Timeline</span>
        <span className="hy-track" />
        <span className="hy-track-dot" style={{ left: 150 }} />
        <span className="hy-track-dot" style={{ left: 1716 }} />
        <div className="hy-pills">
          {years.map((y) => (
            <button
              key={y.year}
              type="button"
              className={y.year === row.year ? 'hy-pill hy-pill-active' : 'hy-pill'}
              onClick={() => {
                if (y.year !== row.year) navigate(`/history/${y.year}`, { replace: true })
              }}
            >
              {y.year}
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
