/**
 * RewindIntro — "going into the past" entrance for History of Tiranga.
 *
 * Plays when the visitor ENTERS the section from outside (home tile / Quick
 * Access): the 1947 scene arrives soft-focus with a giant year numeral, the
 * film rewinds — every year's real archival background streaking past with
 * accelerating cuts — then brakes and sharpens on 1857, where the story
 * begins. In-section hops (year pills, back from Know More) never replay it.
 *
 * The surface is a lazy-loaded WebGL shader quad (rewindGL.ts); the numeral
 * is DOM on top (crisp text, real fonts). One rAF timeline drives both —
 * time-based, so frame drops skip ahead instead of slowing down. ANY touch
 * skips straight to the end (museum visitors never wait twice), and every
 * failure path (no WebGL, missing textures) calls onDone immediately — the
 * kiosk must never dead-end behind an intro.
 */
import { useEffect, useRef, useState } from 'react'
import { HISTORY_BASE } from '../../assets/paths.ts'
import { probeImageCached } from '../../assets/probe.ts'
import type { RewindGL } from './rewindGL.ts'
import './RewindIntro.css'

/** Cut durations while rewinding (ms) — accelerate, then a long brake. */
function cutDurations(cuts: number): number[] {
  const out: number[] = []
  for (let i = 0; i < cuts; i++) {
    if (i === cuts - 1) {
      out.push(1050) // the brake into the oldest year
    } else {
      // 640ms easing down to ~240ms as the rewind picks up speed
      const t = cuts <= 2 ? 1 : i / (cuts - 2)
      out.push(Math.round(640 - 400 * Math.min(1, t * 1.35)))
    }
  }
  return out
}

const ARRIVE_MS = 1100 // soft-focus 1947 + numeral beat
const SETTLE_MS = 750 // sharpen + numeral pulse on the oldest year
const FADE_MS = 480 // overlay handoff to the live screen

export interface RewindIntroProps {
  /** Years ascending (Excel order, e.g. 1857..1947). */
  years: string[]
  onDone: () => void
}

export function RewindIntro({ years, onDone }: RewindIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  // Rewind order: newest → oldest.
  const rewindYears = useRef([...years].reverse()).current
  const [numeral, setNumeral] = useState(rewindYears[0] ?? '')
  const [fading, setFading] = useState(false)
  const skipRef = useRef<() => void>(() => {})

  useEffect(() => {
    let alive = true
    let raf = 0
    let gl: RewindGL | null = null
    let fadeTimer: number | undefined
    let watchdog: number | undefined

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      cancelAnimationFrame(raf)
      setFading(true)
      fadeTimer = window.setTimeout(() => {
        gl?.dispose()
        gl = null
        onDone()
      }, FADE_MS)
    }
    // Expose for the skip handler (bound in JSX below).
    skipRef.current = finish

    void (async () => {
      const urls = rewindYears.map((y) => `${HISTORY_BASE}/${y}/background/bg-1.png`)
      const present = await Promise.all(urls.map(probeImageCached))
      const usable = urls.filter((_, i) => present[i])
      const usableYears = rewindYears.filter((_, i) => present[i])
      if (!alive) return
      if (usable.length < 2) {
        finish() // nothing to rewind through — hand straight over
        return
      }

      let surface: RewindGL
      try {
        const { createRewindGL } = await import('./rewindGL.ts')
        surface = await createRewindGL(canvasRef.current!, usable)
      } catch {
        if (alive) finish() // no WebGL / texture failure → skip the intro
        return
      }
      if (!alive) {
        surface.dispose()
        return
      }
      gl = surface

      const cuts = usable.length - 1
      const durations = cutDurations(cuts)
      const rewindTotal = durations.reduce((a, b) => a + b, 0)
      const total = ARRIVE_MS + rewindTotal + SETTLE_MS
      const start = performance.now()
      let numeralShown = usableYears[0]!

      // Watchdog: rAF is fully suspended on hidden pages — if the intro's
      // frames can never run, force the handoff on wall-clock time so the
      // kiosk (or a backgrounded dev tab) never hangs behind the overlay.
      watchdog = window.setTimeout(() => finish(), total + FADE_MS + 1500)

      const tick = () => {
        if (doneRef.current || gl === null) return
        const now = performance.now()
        const t = now - start
        const time = t / 1000

        let state
        if (t < ARRIVE_MS) {
          // Soft-focus arrival on the newest year.
          const p = t / ARRIVE_MS
          state = {
            from: 0,
            to: 0,
            progress: 0,
            speed: 0,
            blur: 1.5 - 0.7 * p,
            flash: 0,
            time,
          }
        } else if (t < ARRIVE_MS + rewindTotal) {
          // The rewind — find the active cut.
          let acc = ARRIVE_MS
          let cut = 0
          while (cut < cuts - 1 && t >= acc + durations[cut]!) {
            acc += durations[cut]!
            cut++
          }
          const local = Math.min(1, (t - acc) / durations[cut]!)
          const overall = (t - ARRIVE_MS) / rewindTotal
          // Speed envelope: ramp up over the first third, brake in the last cut.
          const ramp = Math.min(1, overall / 0.33)
          const brake = cut === cuts - 1 ? 1 - local * local : 1
          const speed = ramp * brake
          // Numeral follows the incoming year at each cut midpoint.
          const shown = local < 0.5 ? usableYears[cut]! : usableYears[cut + 1]!
          if (shown !== numeralShown) {
            numeralShown = shown
            setNumeral(shown)
          }
          state = {
            from: cut,
            to: cut + 1,
            progress: local,
            speed,
            blur: 0.8 * (1 - overall * 0.6),
            flash: Math.max(0, 1 - local * 3) * Math.min(1, speed + 0.3),
            time,
          }
        } else {
          // Brake complete — sharpen onto the oldest year.
          const p = Math.min(1, (t - ARRIVE_MS - rewindTotal) / SETTLE_MS)
          state = {
            from: cuts,
            to: cuts,
            progress: 0,
            speed: 0,
            blur: 0.3 * (1 - p),
            flash: 0,
            time,
          }
        }

        gl.setState(state)
        gl.render()

        if (t >= total) {
          finish()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      raf = requestAnimationFrame(tick)
    })()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      if (fadeTimer !== undefined) window.clearTimeout(fadeTimer)
      if (watchdog !== undefined) window.clearTimeout(watchdog)
      gl?.dispose()
      gl = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- one-shot intro
  }, [])

  return (
    <div
      ref={rootRef}
      className={fading ? 'rw-intro rw-intro--fading' : 'rw-intro'}
      onPointerDown={() => skipRef.current()}
    >
      <canvas ref={canvasRef} className="rw-canvas" width={1920} height={1080} />
      <div className="rw-scrim" />
      <span key={numeral} className="rw-year" aria-hidden="true">
        {numeral}
      </span>
    </div>
  )
}
