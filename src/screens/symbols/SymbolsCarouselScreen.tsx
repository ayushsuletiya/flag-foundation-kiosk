/**
 * SymbolsCarouselScreen — pixel build of Figma frame 795:3822
 * "National Symbols — Tiger (intro)".
 *
 * The frame is MIRRORED in Figma; this build follows the rendered design
 * (podium left-of-center) using the un-mirrored audit coordinates and the
 * pre-flipped stage-intro.png. The 3-card podium carousel rotates through
 * ALL symbols from Excel "03 · NS Identity" (not just the three with
 * artwork); the center card plays the symbol's PNG-sequence turntable
 * (statics only today), and Know More opens /symbols/:slug.
 */
import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BlurTypeText } from '../../components/BlurTypeText.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { PaginationDots } from '../../components/PaginationDots.tsx'
import { SymbolVisual } from './SymbolVisual.tsx'
import { fitFontSize, symbolShortName, symbolSlug, symbolSubtitle } from './symbolsData.ts'
import './SymbolsCarouselScreen.css'

const SWIPE_THRESHOLD_PX = 60
const HOLD_TO_ORBIT_MS = 260
const SETTLE_MS = 750

// Category intro — "summoned from the podium": cards are born inside the
// podium one by one and spiral out to the floating ring (fly), the full
// ring takes one slow revolution (spin), then settles into the rest slots.
const INTRO_FLY_MS = 800
const INTRO_STAGGER_MS = 90
const INTRO_SPIN_MS = 1500

/**
 * Orbit pose for a card while the ring is lifted (press-and-hold).
 * theta 0 = front of the podium. Ellipse ~460x230 around the center slot,
 * back cards higher, smaller, dimmer — a floating ring of 3D cards.
 */
function orbitPose(ringIndex: number, count: number, spinDeg: number) {
  const theta = (((ringIndex * 360) / count + spinDeg) * Math.PI) / 180
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  // Steep scale/opacity falloff toward the back: 14 evenly-spaced cards
  // inevitably bunch at the ellipse's horizontal edges mid-spin — strong
  // depth separation keeps that from reading as a flat pile-up.
  return {
    transform: `translate3d(${(s * 440).toFixed(1)}px, ${(30 + (1 - c) * 30).toFixed(1)}px, ${((c - 1) * 280).toFixed(1)}px) rotateY(${(-s * 35).toFixed(1)}deg) scale(${(0.44 + 0.24 * (c + 1)).toFixed(3)})`,
    opacity: 0.38 + 0.31 * (c + 1),
    zIndex: Math.round(100 + c * 50),
  } as const
}

export function SymbolsCarouselScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const identities = content?.symbolIdentities ?? []
  const count = identities.length

  // Figma opens on the tiger; fall back to the first Excel row.
  const [selected, setSelected] = useState<number | null>(null)
  const defaultIndex = useMemo(() => {
    const i = identities.findIndex((s) => symbolSlug(s.symbol) === 'tiger')
    return i >= 0 ? i : 0
  }, [identities])
  const activeIndex = count > 0 ? (selected ?? defaultIndex) % count : 0

  const swipeStartX = useRef<number | null>(null)

  // ---- mode state machine -------------------------------------------
  // 'intro' = cards fly in from the podium · 'intro-spin' = the assembled
  // ring takes one revolution · 'rest' = Figma slot poses · 'orbit' = full
  // ring floats (drag-to-spin) · 'settle' = gliding home.
  const [mode, setMode] = useState<'intro' | 'intro-spin' | 'rest' | 'orbit' | 'settle'>('intro')
  const isIntro = mode === 'intro' || mode === 'intro-spin'
  const [spin, setSpin] = useState(0)
  const [glowSlug, setGlowSlug] = useState<string | null>(null)
  const spinRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introRaf = useRef<number | null>(null)
  const introStarted = useRef(false)
  const dragLastX = useRef<number | null>(null)
  const suppressClick = useRef(false)

  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current)
      if (settleTimer.current !== null) clearTimeout(settleTimer.current)
      if (introRaf.current !== null) cancelAnimationFrame(introRaf.current)
    },
    [],
  )

  const settleToRest = () => {
    setMode('settle')
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      setMode('rest')
      suppressClick.current = false
    }, SETTLE_MS)
  }

  // Intro timeline: fly-in is CSS-staggered per card; after the last card
  // lands, one decelerating revolution, then the ring settles. A single
  // elapsed-time rAF machine (not chained timeouts) so a hidden window
  // pauses the intro instead of finishing it invisibly.
  useEffect(() => {
    if (count === 0 || introStarted.current) return
    introStarted.current = true
    const flyTotal = INTRO_FLY_MS + (count - 1) * INTRO_STAGGER_MS + 200
    let start: number | null = null
    let spinning = false
    const tick = (now: number) => {
      start ??= now
      const t = now - start
      if (t < flyTotal) {
        introRaf.current = requestAnimationFrame(tick)
        return
      }
      if (!spinning) {
        spinning = true
        setMode('intro-spin')
      }
      const p = Math.min(1, (t - flyTotal) / INTRO_SPIN_MS)
      const eased = p < 0.5 ? 4 * p * p * p : 1 - Math.pow(-2 * p + 2, 3) / 2
      spinRef.current = -360 * eased
      setSpin(spinRef.current)
      if (p < 1) {
        introRaf.current = requestAnimationFrame(tick)
      } else {
        introRaf.current = null
        spinRef.current = 0 // -360 ≡ 0: same pose, active card unchanged
        setSpin(0)
        settleToRest()
      }
    }
    introRaf.current = requestAnimationFrame(tick)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Kiosk users won't wait: any touch during the intro fast-forwards it.
  const skipIntro = () => {
    if (introRaf.current !== null) {
      cancelAnimationFrame(introRaf.current)
      introRaf.current = null
    }
    spinRef.current = 0
    setSpin(0)
    suppressClick.current = true
    settleToRest()
  }

  const engageOrbit = () => {
    // fresh lift always opens with the active card front-center
    spinRef.current = 0
    setSpin(0)
    setMode('orbit')
    suppressClick.current = true
  }

  const releaseOrbit = () => {
    if (holdTimer.current !== null) {
      clearTimeout(holdTimer.current)
      holdTimer.current = null
    }
    dragLastX.current = null
    setGlowSlug(null)
    if (mode !== 'orbit') return
    // Drop-to-select: whichever card the drag left nearest the FRONT of the
    // ring becomes the active symbol — the ring settles around it instead of
    // snapping back. No drag (spin≈0) keeps the current symbol.
    if (count > 0) {
      const step = 360 / count
      const k = ((Math.round(-spinRef.current / step) % count) + count) % count
      if (k !== 0) setSelected((activeIndex + k) % count)
    }
    settleToRest()
  }

  if (count === 0) {
    // Content still loading (or empty workbook) — hold the stage only.
    return (
      <div className="sy-screen">
        <img className="sy-stage-bg" src="assets/images/symbols/stage-intro.png" alt="" />
      </div>
    )
  }

  const active = identities[activeIndex]!
  const activeSlug = symbolSlug(active.symbol)
  const shortName = symbolShortName(active)
  const nameFontSize = fitFontSize(shortName, 96.716, 660)

  const rotate = (dir: 1 | -1) => {
    setSelected((activeIndex + dir + count) % count)
  }

  return (
    <div className="sy-screen" onPointerDown={isIntro ? skipIntro : undefined}>
      {/* Baked stage (navy + mandala + podium), pre-flipped to match the
          render; design cover-crops region x=217..2094 of the 2113px source. */}
      <img className="sy-stage-bg" src="assets/images/symbols/stage-intro.png" alt="" />

      {/* Intro veil — the scene opens from black while the stage relaxes
          out of its zoom; unmounts once the fly-in phase ends. */}
      {mode === 'intro' && <div className="sy-veil" />}

      <h1 className="sy-header">
        <BlurTypeText text="National Symbols of India" delay={400} stagger={34} budget={900} />
      </h1>

      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      {/* Carousel — swipe anywhere over the podium, or tap a side card.
          dragstart is suppressed: a mouse swipe starting on a card <img>
          would otherwise begin a native image drag, firing pointercancel
          and eating the pointerup that completes the gesture. */}
      <div
        className="sy-carousel"
        data-mode={mode}
        onDragStart={(e) => e.preventDefault()}
        onClickCapture={(e) => {
          // A hold that lifted the ring must not also fire the tap-to-rotate.
          if (suppressClick.current && mode !== 'rest') {
            e.preventDefault()
            e.stopPropagation()
          }
        }}
        onPointerDown={(e) => {
          if (isIntro) return // the screen-root handler fast-forwards the intro
          swipeStartX.current = e.clientX
          dragLastX.current = e.clientX
          const card = (e.target as HTMLElement).closest<HTMLElement>('.sy-card3d')
          setGlowSlug(card?.dataset.slug ?? null)
          if (holdTimer.current !== null) clearTimeout(holdTimer.current)
          holdTimer.current = setTimeout(engageOrbit, HOLD_TO_ORBIT_MS)
        }}
        onPointerMove={(e) => {
          if (mode !== 'orbit') return
          // the finger is the only thing that spins the floating ring
          if (dragLastX.current !== null) {
            spinRef.current += (e.clientX - dragLastX.current) * 0.25
            setSpin(spinRef.current)
          }
          dragLastX.current = e.clientX
          const card = (e.target as HTMLElement).closest<HTMLElement>('.sy-card3d')
          if (card?.dataset.slug) setGlowSlug(card.dataset.slug)
        }}
        onPointerUp={(e) => {
          const start = swipeStartX.current
          swipeStartX.current = null
          const wasOrbit = mode === 'orbit'
          releaseOrbit()
          if (wasOrbit || start === null) return
          const dx = e.clientX - start
          if (dx <= -SWIPE_THRESHOLD_PX) rotate(1)
          else if (dx >= SWIPE_THRESHOLD_PX) rotate(-1)
        }}
        onPointerLeave={releaseOrbit}
        onPointerCancel={releaseOrbit}
      >
        {/* 3D ring: every card is ONE persistent element (keyed by slug) whose
            slot pose (data-slot -2..2) is pure transform — so rotating the
            carousel GLIDES cards around the arc. Cards beyond ±2 unmount:
            they enter/exit at the invisible ±2 poses. */}
        {identities.map((s, i) => {
          const ringIndex = (((i - activeIndex) % count) + count) % count
          let off = ringIndex
          if (off > count / 2) off -= count
          const lifted = mode !== 'rest'
          // At rest only slots -2..2 exist; while lifted/settling the WHOLE
          // ring is mounted so it can float around the podium and glide home.
          if (!lifted && (Math.abs(off) > 2 || (count <= 2 && off < 0))) return null
          const slug = symbolSlug(s.symbol)
          const isCenter = off === 0
          const pose = mode === 'orbit' || isIntro ? orbitPose(ringIndex, count, spin) : undefined
          // During the intro fly-in the sy-spawn animation drives each card
          // from inside the podium to its ring pose — the target pose rides
          // along as CSS vars, the stagger as a per-card animation delay.
          const style =
            mode === 'intro'
              ? ({
                  ...pose,
                  '--sy-pose': pose!.transform,
                  '--sy-pose-o': String(pose!.opacity),
                  animationDelay: `${ringIndex * INTRO_STAGGER_MS}ms`,
                } as CSSProperties)
              : (pose as CSSProperties | undefined)
          return (
            <button
              key={slug}
              type="button"
              className={glowSlug === slug ? 'sy-card3d sy-card-glow' : 'sy-card3d'}
              data-slot={Math.abs(off) > 2 ? (off < 0 ? -2 : 2) : off}
              data-slug={slug}
              aria-label={isCenter ? shortName : `Show ${symbolShortName(s)}`}
              tabIndex={isCenter ? -1 : 0}
              style={style}
              onClick={() => {
                if (mode === 'rest' && off !== 0) rotate(off < 0 ? -1 : 1)
              }}
            >
              <div className="sy-card-media">
                {/* mode "live" on EVERY card — turntables play in the side
                    thumbnails too (user decision 2026-07-17), not just center */}
                <SymbolVisual
                  slug={slug}
                  name={symbolShortName(s)}
                  width={379}
                  height={472}
                  mode="live"
                  fit="contain"
                />
              </div>
              <span className="sy-card-dim" />
              {/* Center-arrival glow: gold stroke traces the border, bloom
                  settles (CSS animations start when data-slot becomes 0). */}
              <svg className="sy-glow-ring" viewBox="0 0 379 472" aria-hidden="true">
                <rect x="2" y="2" width="375" height="468" rx="58" pathLength="100" />
              </svg>
            </button>
          )
        })}
      </div>

      {/* Pagination dots on the podium face — count is Excel-driven.
          Held back until the intro's ring settles, then fade in. */}
      {!isIntro && (
        <PaginationDots
          count={count}
          activeIndex={activeIndex}
          onSelect={(i) => setSelected(i)}
          className="sy-dots"
        />
      )}

      {/* Right text column — name, category, Know More (all Excel-driven).
          Keyed on the slug so the blur-typewriter replays on every change;
          first mounted as the intro settles so the typing caps the intro. */}
      {!isIntro && (
        <div key={activeSlug} className="sy-info">
        <p className="sy-name" style={{ fontSize: nameFontSize }}>
          <BlurTypeText text={shortName} delay={80} stagger={48} budget={620} fitWidth={660} />
        </p>
        <p className="sy-subtitle">
          <BlurTypeText
            text={symbolSubtitle(active)}
            delay={340}
            stagger={26}
            budget={420}
            fitWidth={660}
          />
        </p>
        <button
          type="button"
          className="sy-know-more"
          onClick={() => navigate(`/symbols/${activeSlug}`)}
        >
          Know More
        </button>
        </div>
      )}
    </div>
  )
}
