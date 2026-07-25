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
import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BlurTypeText } from '../../components/BlurTypeText.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { previousPathname } from '../../app/navTrace.ts'
import { useHistoryYearAssets } from './historyAssets.ts'
import { ChakraMark, FallbackBackdrop } from './HistoryFallback.tsx'
import { RewindIntro } from './RewindIntro.tsx'
import { WarpTransition } from './WarpTransition.tsx'
import { VideoLoop } from '../../components/VideoLoop.tsx'
import './YearMainScreen.css'

/** The story starts at the beginning: the rewind intro lands on 1857 and the
 * section stays there (user decision 2026-07-20 — was 1947). */
export const DEFAULT_HISTORY_YEAR = '1857'

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

/**
 * Big year that COUNTS to the new year (odometer-style) instead of a blur
 * reveal — a "spin through time" as the visitor jumps eras (user 2026-07-25).
 * Persists across year switches so it can animate FROM the old value; a bigger
 * era jump spins longer, and the digits blur while spinning, snapping crisp on
 * landing.
 */
function YearCounter({ target }: { target: string }) {
  const targetNum = Number.parseInt(target, 10)
  const [display, setDisplay] = useState(targetNum)
  const [spinning, setSpinning] = useState(false)
  const fromRef = useRef(targetNum)

  useEffect(() => {
    const from = fromRef.current
    fromRef.current = targetNum
    if (from === targetNum || Number.isNaN(targetNum)) return
    setSpinning(true)
    const dur = Math.min(1200, Math.max(500, Math.abs(targetNum - from) * 16))
    const t0 = performance.now()
    let raf = 0
    const tick = (now: number) => {
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic — fast, then settles
      setDisplay(Math.round(from + (targetNum - from) * eased))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        setDisplay(targetNum)
        setSpinning(false)
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [targetNum])

  return <span className={spinning ? 'hy-year hy-year-spin' : 'hy-year'}>{display}</span>
}

export function YearMainScreen() {
  const navigate = useNavigate()
  const { year: yearParam } = useParams()
  const { content } = useContent()

  // Rewind intro: only on SECTION ENTRY from outside (home tile / Quick
  // Access land on plain /history) — never on in-section hops (year pills
  // navigate to /history/:year, Know More returns carry the year param).
  const [introActive, setIntroActive] = useState(
    () => yearParam === undefined && !(previousPathname() ?? '').startsWith('/history'),
  )

  const years = content?.historyYears ?? []
  const row =
    years.find((y) => y.year === yearParam) ??
    years.find((y) => y.year === DEFAULT_HISTORY_YEAR) ??
    years[0] ??
    null

  const assets = useHistoryYearAssets(row?.year ?? null)

  // WebGL "fast-forward through the timeline" warp: when the primary background
  // resolves to a NEW era, play a one-shot directional time-stretch from the old
  // bg to the new one (WarpTransition → warpGL). Triggered off the resolved bg
  // url (not the year param) so both textures are known/cached before it runs;
  // video-bg years give a null url and simply skip the warp.
  const bgUrl = assets.ready ? (assets.backgrounds[0] ?? null) : null
  const [warp, setWarp] = useState<{ from: string; to: string; id: number } | null>(null)
  const prevBgRef = useRef<string | null>(null)
  const warpIdRef = useRef(0)
  useEffect(() => {
    const prev = prevBgRef.current
    if (bgUrl !== null && prev !== null && prev !== bgUrl) {
      warpIdRef.current += 1
      setWarp({ from: prev, to: bgUrl, id: warpIdRef.current })
    }
    if (bgUrl !== null) prevBgRef.current = bgUrl
  }, [bgUrl])

  if (row === null) {
    // Content still loading (or empty workbook) — hold a dark frame.
    return <div className="hy-screen" />
  }

  if (introActive) {
    return (
      <div className="hy-screen">
        <RewindIntro
          years={years.map((y) => y.year)}
          onDone={() => setIntroActive(false)}
        />
      </div>
    )
  }

  return (
    <div className="hy-screen">
      {/* Background: era video, photo(s), or honest fallback, under tint + scrim. */}
      <div className="hy-bg-layer" key={row.year}>
        {!assets.ready ? null : assets.backgroundVideo !== null ? (
          <VideoLoop src={assets.backgroundVideo} poster={assets.backgrounds[0]} />
        ) : assets.backgrounds.length > 0 ? (
          <BackgroundLoop images={assets.backgrounds} />
        ) : (
          <FallbackBackdrop />
        )}
      </div>

      {/* Fast-forward warp — a WebGL directional time-stretch from the old era to
          the new one, laid over the bg for one shot then dropped (user 2026-07-25). */}
      {warp !== null && (
        <WarpTransition
          key={warp.id}
          fromUrl={warp.from}
          toUrl={warp.to}
          onDone={() => setWarp(null)}
        />
      )}

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
      {/* No remount key: the YearCounter must PERSIST across year switches so it
          can spin from the old value. Title + flag re-key on the year to re-enter. */}
      <div className="hy-hero">
        <div className="hy-year-row">
          <YearCounter target={row.year} />
          {assets.yearFlag !== null ? (
            <img className="hy-year-flag" key={row.year} src={assets.yearFlag} alt="" />
          ) : assets.ready ? (
            <span className="hy-year-flag hy-year-flag-ph">
              <ChakraMark size={64} color="#D8C287" style={{ opacity: 0.35 }} />
            </span>
          ) : null}
        </div>
        <div className="hy-text-stack">
          <p className="hy-title" key={row.year}>
            <BlurTypeText text={row.slideTitle} delay={300} stagger={24} budget={520} />
          </p>
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
