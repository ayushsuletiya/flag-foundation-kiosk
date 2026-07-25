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
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BlurTypeText } from '../../components/BlurTypeText.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { previousPathname } from '../../app/navTrace.ts'
import { useHistoryYearAssets, type HistoryYearAssets } from './historyAssets.ts'
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
  const spanRef = useRef<HTMLSpanElement | null>(null)
  const fromRef = useRef(targetNum)

  // Drive the odometer by writing textContent DIRECTLY on the node each frame —
  // NOT setState. During an era jump the WebGL warp runs its own rAF; a
  // per-frame React re-render of the whole screen would fight it on the main
  // thread and make both stutter. A layout effect keeps the first frame in sync
  // (no flash of the final year before the spin) (user 2026-07-25: warp jerk).
  useLayoutEffect(() => {
    const el = spanRef.current
    const from = fromRef.current
    fromRef.current = targetNum
    if (el === null) return
    if (from === targetNum || Number.isNaN(targetNum)) {
      el.textContent = String(targetNum)
      return
    }
    el.classList.add('hy-year-spin')
    el.textContent = String(from)
    const dur = Math.min(1200, Math.max(500, Math.abs(targetNum - from) * 16))
    let t0 = 0
    let raf = 0
    const tick = (now: number) => {
      if (t0 === 0) t0 = now // start the clock on the first PAINTED frame
      const p = Math.min(1, (now - t0) / dur)
      const eased = 1 - Math.pow(1 - p, 3) // easeOutCubic — fast, then settles
      el.textContent = String(Math.round(from + (targetNum - from) * eased))
      if (p < 1) {
        raf = requestAnimationFrame(tick)
      } else {
        el.textContent = String(targetNum)
        el.classList.remove('hy-year-spin')
      }
    }
    raf = requestAnimationFrame(tick)
    return () => {
      cancelAnimationFrame(raf)
      el.classList.remove('hy-year-spin')
    }
  }, [targetNum])

  return (
    <span ref={spanRef} className="hy-year">
      {targetNum}
    </span>
  )
}

/** One era's background media, tagged with its year — the unit both the
 * incoming (bgShown) and the held outgoing (bgHold) backdrop render from. */
type BgFrame = { year: string; assets: HistoryYearAssets }

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

  // Background + WebGL "fast-forward through time" warp, coordinated so the EFFECT
  // LEADS THE PHOTO. The DOM <img> decodes faster than the WebGL warp uploads its
  // textures, so if we swapped the backdrop to the new era on `ready` the new
  // photo would pop in BEFORE the warp — the exact bug the user hit. Instead the
  // OLD backdrop stays on screen (bgShown) while the warp plays over it; the new
  // photo is swapped in MID-WARP (onReveal), hidden under the opaque pass, so it
  // is only ever uncovered by the warp's own tail dissolve — never before it.
  const [bgShown, setBgShown] = useState<BgFrame | null>(null)
  const [bgFade, setBgFade] = useState(true)
  const [warp, setWarp] = useState<{ from: string; to: string; id: number } | null>(null)
  const displayedRef = useRef<BgFrame | null>(null) // the frame actually on screen
  const pendingRef = useRef<BgFrame | null>(null) // the new era waiting for reveal
  const targetYearRef = useRef<string | null>(null) // era we've already begun showing
  const warpIdRef = useRef(0)
  useEffect(() => {
    if (row === null || !assets.ready) return
    // Already began showing/warping to this era (repeat effect run, gallery
    // second-pass, or a warp still in flight) — don't restart it.
    if (targetYearRef.current === row.year) return
    targetYearRef.current = row.year
    const next: BgFrame = { year: row.year, assets }
    const from = displayedRef.current?.assets.backgrounds[0] ?? null
    const to = assets.backgrounds[0] ?? null
    // Warp only when we can stretch one STILL into another. First paint, a video
    // era, or a bg-less era just shows the new backdrop directly (fade in).
    if (displayedRef.current === null || from === null || to === null) {
      displayedRef.current = next
      setBgFade(true)
      setBgShown(next)
      return
    }
    // Keep the OLD backdrop on screen; the warp will reveal the new one.
    pendingRef.current = next
    warpIdRef.current += 1
    setWarp({ from, to, id: warpIdRef.current })
  }, [assets, row])

  // Uncover the new backdrop mid-warp (called by WarpTransition just before its
  // tail dissolve): swap it in at FULL opacity (no fade) while the opaque pass
  // still covers it, so the dissolve lands straight onto the crisp new photo.
  const revealPending = () => {
    const p = pendingRef.current
    if (p === null) return
    pendingRef.current = null
    displayedRef.current = p
    setBgFade(false)
    setBgShown(p)
  }

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
      {/* Backdrop — era video, photo(s), or honest fallback, under tint + scrim.
          Holds the OLD era through a jump; the warp swaps in the new one mid-pass
          (revealPending) at full opacity, so the photo never precedes the effect.
          `hy-bg-instant` = no fade for that under-the-warp swap; otherwise fades. */}
      <div
        className={bgFade ? 'hy-bg-layer' : 'hy-bg-layer hy-bg-instant'}
        key={bgShown?.year ?? 'pending'}
      >
        {bgShown === null ? null : bgShown.assets.backgroundVideo !== null ? (
          <VideoLoop src={bgShown.assets.backgroundVideo} poster={bgShown.assets.backgrounds[0]} />
        ) : bgShown.assets.backgrounds.length > 0 ? (
          <BackgroundLoop images={bgShown.assets.backgrounds} />
        ) : (
          <FallbackBackdrop />
        )}
      </div>

      {/* Fast-forward warp — a WebGL directional time-stretch from the old era to
          the new one, laid over the bg for one shot then dropped (user 2026-07-25).
          It reveals the new backdrop just before its tail dissolve (onReveal). */}
      {warp !== null && (
        <WarpTransition
          key={warp.id}
          fromUrl={warp.from}
          toUrl={warp.to}
          onReveal={revealPending}
          onDone={() => {
            revealPending() // safety: show the new bg even if the warp degraded to a cut
            setWarp(null)
          }}
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
          {/* Flag sourced from bgShown (like the backdrop) so it holds the
              outgoing year's flag through the probe instead of blinking out. */}
          {bgShown !== null && bgShown.assets.yearFlag !== null ? (
            <img className="hy-year-flag" key={bgShown.year} src={bgShown.assets.yearFlag} alt="" />
          ) : bgShown !== null ? (
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
