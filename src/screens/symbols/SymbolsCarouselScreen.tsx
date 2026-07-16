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
import { useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { PaginationDots } from '../../components/PaginationDots.tsx'
import { SymbolVisual } from './SymbolVisual.tsx'
import { fitFontSize, symbolShortName, symbolSlug, symbolSubtitle } from './symbolsData.ts'
import './SymbolsCarouselScreen.css'

const SWIPE_THRESHOLD_PX = 60
const HOLD_TO_ORBIT_MS = 260
const ORBIT_SPIN_DEG_PER_S = 14
const SETTLE_MS = 750

/**
 * Orbit pose for a card while the ring is lifted (press-and-hold).
 * theta 0 = front of the podium. Ellipse ~460x230 around the center slot,
 * back cards higher, smaller, dimmer — a floating ring of 3D cards.
 */
function orbitPose(ringIndex: number, count: number, spinDeg: number) {
  const theta = (((ringIndex * 360) / count + spinDeg) * Math.PI) / 180
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  return {
    transform: `translate3d(${(s * 460).toFixed(1)}px, ${(30 + (1 - c) * 26).toFixed(1)}px, ${((c - 1) * 230).toFixed(1)}px) rotateY(${(-s * 35).toFixed(1)}deg) scale(${(0.6 + 0.16 * (c + 1)).toFixed(3)})`,
    opacity: 0.5 + 0.25 * (c + 1),
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

  // ---- press-and-hold orbit mode -----------------------------------
  // 'rest' = Figma slot poses · 'orbit' = full ring floats around the
  // podium (slow auto-spin + drag-to-spin) · 'settle' = gliding home.
  const [mode, setMode] = useState<'rest' | 'orbit' | 'settle'>('rest')
  const [spin, setSpin] = useState(0)
  const [glowSlug, setGlowSlug] = useState<string | null>(null)
  const spinRef = useRef(0)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const rafRef = useRef(0)
  const lastT = useRef(0)
  const dragLastX = useRef<number | null>(null)
  const suppressClick = useRef(false)

  useEffect(() => {
    if (mode !== 'orbit') return
    lastT.current = performance.now()
    const tick = (t: number) => {
      const dt = Math.min(0.05, (t - lastT.current) / 1000)
      lastT.current = t
      spinRef.current += ORBIT_SPIN_DEG_PER_S * dt
      setSpin(spinRef.current)
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(rafRef.current)
  }, [mode])

  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current)
      if (settleTimer.current !== null) clearTimeout(settleTimer.current)
      cancelAnimationFrame(rafRef.current)
    },
    [],
  )

  const engageOrbit = () => {
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
    setMode('settle')
    if (settleTimer.current !== null) clearTimeout(settleTimer.current)
    settleTimer.current = setTimeout(() => {
      setMode('rest')
      suppressClick.current = false
    }, SETTLE_MS)
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
    <div className="sy-screen">
      {/* Baked stage (navy + mandala + podium), pre-flipped to match the
          render; design cover-crops region x=217..2094 of the 2113px source. */}
      <img className="sy-stage-bg" src="assets/images/symbols/stage-intro.png" alt="" />

      <h1 className="sy-header">National Symbols of India</h1>

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
          swipeStartX.current = e.clientX
          dragLastX.current = e.clientX
          const card = (e.target as HTMLElement).closest<HTMLElement>('.sy-card3d')
          setGlowSlug(card?.dataset.slug ?? null)
          if (holdTimer.current !== null) clearTimeout(holdTimer.current)
          holdTimer.current = setTimeout(engageOrbit, HOLD_TO_ORBIT_MS)
        }}
        onPointerMove={(e) => {
          if (mode !== 'orbit') return
          // drag spins the floating ring
          if (dragLastX.current !== null) {
            spinRef.current += (e.clientX - dragLastX.current) * 0.25
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
          const pose = mode === 'orbit' ? orbitPose(ringIndex, count, spin) : undefined
          return (
            <button
              key={slug}
              type="button"
              className={glowSlug === slug ? 'sy-card3d sy-card-glow' : 'sy-card3d'}
              data-slot={Math.abs(off) > 2 ? (off < 0 ? -2 : 2) : off}
              data-slug={slug}
              aria-label={isCenter ? shortName : `Show ${symbolShortName(s)}`}
              tabIndex={isCenter ? -1 : 0}
              style={pose}
              onClick={() => {
                if (mode === 'rest' && off !== 0) rotate(off < 0 ? -1 : 1)
              }}
            >
              <div className="sy-card-media">
                <SymbolVisual
                  slug={slug}
                  name={symbolShortName(s)}
                  width={379}
                  height={472}
                  mode={isCenter ? 'live' : 'still'}
                  fit="contain"
                />
              </div>
              <span className="sy-card-dim" />
            </button>
          )
        })}
      </div>

      {/* Pagination dots on the podium face — count is Excel-driven. */}
      <PaginationDots
        count={count}
        activeIndex={activeIndex}
        onSelect={(i) => setSelected(i)}
        className="sy-dots"
      />

      {/* Right text column — name, category, Know More (all Excel-driven). */}
      <div key={activeSlug} className="sy-info">
        <p className="sy-name" style={{ fontSize: nameFontSize }}>
          {shortName}
        </p>
        <p className="sy-subtitle">{symbolSubtitle(active)}</p>
        <button
          type="button"
          className="sy-know-more"
          onClick={() => navigate(`/symbols/${activeSlug}`)}
        >
          Know More
        </button>
      </div>
    </div>
  )
}
