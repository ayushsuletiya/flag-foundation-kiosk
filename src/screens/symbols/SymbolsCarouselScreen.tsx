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
const TURN_MS = 480

// Category intro — "the trail": one continuous cinematic motion. Every
// tile rides the SAME orbital ellipse; the whole trail sweeps 1¼ turns
// around the podium while decelerating (ease-out), the ellipse expanding
// from a tight swirl to full size. Tiles materialize one behind another
// (stagger tuned to the early angular speed, so they appear to stream in
// at the ellipse's left edge) and the sweep ends with every tile exactly
// on its ring pose — then the normal settle glides them into the slots.
const INTRO_TOTAL_MS = 3200
const INTRO_ENTRY_TURNS_DEG = 450 // 1¼ revolutions; ends at spin 0
const INTRO_STAGGER_MS = 55 // ≈ ring step / early angular speed
const INTRO_APPEAR_MS = 340

/**
 * Continuous pose along the carousel TRACK — the curve the rest slots sit
 * on. u = 0 is the center slot, ±1 the sides, ±2 the hidden entry/exit
 * poses (values MUST match the data-slot CSS so a finished turn lands
 * exactly on the slot poses). Rotating the carousel slides every card
 * ALONG this track, so a swap never sends two cards through each other.
 */
const TRACK_KEYPOSES = [
  { u: -2, x: -700, y: 130, z: -420, ry: 52, s: 0.75, o: 0, dim: 0.36 },
  { u: -1, x: -381, y: 99, z: -140, ry: 36, s: 0.857, o: 1, dim: 0.36 },
  { u: 0, x: 0, y: 0, z: 0, ry: 0, s: 1, o: 1, dim: 0 },
  { u: 1, x: 381, y: 99, z: -140, ry: -36, s: 0.857, o: 1, dim: 0.36 },
  { u: 2, x: 700, y: 130, z: -420, ry: -52, s: 0.75, o: 0, dim: 0.36 },
] as const

function trackPose(u: number) {
  const cu = Math.max(-2, Math.min(2, u))
  const i = Math.max(0, Math.min(3, Math.floor(cu + 2)))
  const a = TRACK_KEYPOSES[i]!
  const b = TRACK_KEYPOSES[i + 1]!
  const f = (cu - a.u) / (b.u - a.u)
  const l = (p: number, q: number) => p + (q - p) * f
  return {
    transform: `translate3d(${l(a.x, b.x).toFixed(1)}px, ${l(a.y, b.y).toFixed(1)}px, ${l(a.z, b.z).toFixed(1)}px) rotateY(${l(a.ry, b.ry).toFixed(1)}deg) scale(${l(a.s, b.s).toFixed(3)})`,
    opacity: l(a.o, b.o),
    dim: l(a.dim, b.dim),
    zIndex: Math.round(120 - Math.abs(cu) * 30),
  }
}

/**
 * Orbit pose for a card while the ring is lifted (press-and-hold).
 * theta 0 = front of the podium. Ellipse ~460x230 around the center slot,
 * back cards higher, smaller, dimmer — a floating ring of 3D cards.
 */
function orbitPose(
  ringIndex: number,
  count: number,
  spinDeg: number,
  radius = 1,
  scaleMul = 1,
) {
  const theta = (((ringIndex * 360) / count + spinDeg) * Math.PI) / 180
  const s = Math.sin(theta)
  const c = Math.cos(theta)
  const x = s * 440 * radius
  const y = 30 + (1 - c) * 30 * radius
  const z = (c - 1) * 280 * radius
  const ry = -s * 35
  const scale = (0.44 + 0.24 * (c + 1)) * scaleMul
  // Steep scale/opacity falloff toward the back: 14 evenly-spaced cards
  // inevitably bunch at the ellipse's horizontal edges mid-spin — strong
  // depth separation keeps that from reading as a flat pile-up.
  return {
    x,
    y,
    z,
    ry,
    scale,
    transform: `translate3d(${x.toFixed(1)}px, ${y.toFixed(1)}px, ${z.toFixed(1)}px) rotateY(${ry.toFixed(1)}deg) scale(${scale.toFixed(3)})`,
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
  // 'intro' = the continuous trail sweep around the podium · 'rest' =
  // Figma slot poses · 'turn' = cards sliding along the track to new
  // slots · 'orbit' = full ring floats (drag-to-spin) · 'settle' =
  // gliding home.
  const [mode, setMode] = useState<'intro' | 'rest' | 'turn' | 'orbit' | 'settle'>('intro')
  const isIntro = mode === 'intro'
  const [spin, setSpin] = useState(0)
  // Elapsed intro time — the single value the whole trail derives from.
  const [introT, setIntroT] = useState(0)
  // Track offset while turning: cards render at u = off + turnOffset, so
  // the whole row slides along the track and eases into the new slots.
  const [turnOffset, setTurnOffset] = useState(0)
  const [glowSlug, setGlowSlug] = useState<string | null>(null)
  const spinRef = useRef(0)
  const turnRef = useRef(0)
  const turnRaf = useRef<number | null>(null)
  const holdTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const settleTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const introRaf = useRef<number | null>(null)
  const introDone = useRef(false)
  const dragLastX = useRef<number | null>(null)
  const suppressClick = useRef(false)

  useEffect(
    () => () => {
      if (holdTimer.current !== null) clearTimeout(holdTimer.current)
      if (settleTimer.current !== null) clearTimeout(settleTimer.current)
      if (turnRaf.current !== null) cancelAnimationFrame(turnRaf.current)
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

  // Intro timeline: a single elapsed-time rAF machine (not chained
  // timeouts) so a hidden window pauses the intro instead of finishing it
  // invisibly. All per-card motion derives from introT in render — one
  // clock, one continuous sweep, zero phase seams.
  // Gated on COMPLETION (introDone), never on start, and the effect cancels
  // its own frame: StrictMode's dev double-mount cancels run 1 and cleanly
  // restarts in run 2 (a start-guard here left the intro frozen mid-fly).
  useEffect(() => {
    if (count === 0 || introDone.current) return
    let start: number | null = null
    const tick = (now: number) => {
      start ??= now
      const t = now - start
      setIntroT(t)
      if (t < INTRO_TOTAL_MS) {
        introRaf.current = requestAnimationFrame(tick)
      } else {
        introRaf.current = null
        introDone.current = true
        settleToRest()
      }
    }
    introRaf.current = requestAnimationFrame(tick)
    return () => {
      if (introRaf.current !== null) {
        cancelAnimationFrame(introRaf.current)
        introRaf.current = null
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [count])

  // Kiosk users won't wait: any touch during the intro fast-forwards it.
  const skipIntro = () => {
    introDone.current = true // don't restart on a later count change
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
    // a lift can start mid-turn — the turn animation must not finish later
    // and yank the orbit back to rest
    if (turnRaf.current !== null) {
      cancelAnimationFrame(turnRaf.current)
      turnRaf.current = null
    }
    turnRef.current = 0
    setTurnOffset(0)
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

  // Trail sweep parameters — every tile's pose derives from the one intro
  // clock: a decelerating 1¼-turn sweep while the ellipse expands to size.
  const introP = Math.min(1, introT / INTRO_TOTAL_MS)
  const introE = 1 - Math.pow(1 - introP, 3)
  const introSpin = -INTRO_ENTRY_TURNS_DEG * (1 - introE)
  const introRadius = 0.55 + 0.45 * introE

  // Rotate by sliding every card ALONG the track (mode 'turn'): the new
  // selection applies immediately, the row starts offset by the step just
  // taken and eases back to 0. Repeat taps mid-turn ACCUMULATE into the
  // offset, so spamming reads as one long fluid flick, and paths never
  // cross — the outgoing and incoming cards stay side by side on the arc.
  const rotateTo = (index: number) => {
    if (count === 0) return
    let step = (((index - activeIndex) % count) + count) % count
    if (step > count / 2) step -= count // shortest signed distance
    if (step === 0) return
    setSelected(((index % count) + count) % count)
    turnRef.current = Math.max(-2.5, Math.min(2.5, turnRef.current + step))
    setTurnOffset(turnRef.current)
    setMode('turn')
    if (turnRaf.current !== null) cancelAnimationFrame(turnRaf.current)
    const from = turnRef.current
    let t0: number | null = null
    const tick = (now: number) => {
      t0 ??= now
      const p = Math.min(1, (now - t0) / TURN_MS)
      const e = 1 - Math.pow(1 - p, 3)
      turnRef.current = from * (1 - e)
      setTurnOffset(turnRef.current)
      if (p < 1) {
        turnRaf.current = requestAnimationFrame(tick)
      } else {
        turnRaf.current = null
        turnRef.current = 0
        setTurnOffset(0)
        setMode('rest')
      }
    }
    turnRaf.current = requestAnimationFrame(tick)
  }

  const rotate = (dir: 1 | -1) => {
    rotateTo(activeIndex + dir)
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
          // Intro: tiles materialize one behind another (smoothstepped) while
          // the whole trail rides the same decelerating sweep — the stagger
          // matches the early angular speed, so each new tile appears where
          // the previous one just was: a stream pouring onto the orbit.
          const appearP = isIntro
            ? Math.min(1, Math.max(0, (introT - ringIndex * INTRO_STAGGER_MS) / INTRO_APPEAR_MS))
            : 1
          const appear = appearP * appearP * (3 - 2 * appearP)
          // 'turn': the whole row slides along the track toward the new slots.
          const turn = mode === 'turn' ? trackPose(off + turnOffset) : undefined
          const pose =
            mode === 'orbit'
              ? orbitPose(ringIndex, count, spin)
              : isIntro
                ? orbitPose(ringIndex, count, introSpin, introRadius, 0.7 + 0.3 * appear)
                : undefined
          const style = turn
            ? ({ transform: turn.transform, opacity: turn.opacity, zIndex: turn.zIndex } as CSSProperties)
            : pose
              ? ({
                  transform: pose.transform,
                  opacity: isIntro ? pose.opacity * appear : pose.opacity,
                  zIndex: pose.zIndex,
                } as CSSProperties)
              : undefined
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
                if ((mode === 'rest' || mode === 'turn') && off !== 0) rotate(off < 0 ? -1 : 1)
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
              <span className="sy-card-dim" style={turn ? { opacity: turn.dim } : undefined} />
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
          onSelect={rotateTo}
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
