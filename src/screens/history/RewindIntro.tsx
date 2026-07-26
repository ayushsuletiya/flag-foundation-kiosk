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
import { HISTORY_BASE, SHARED } from '../../assets/paths.ts'
import { probeImageCached } from '../../assets/probe.ts'
import { playCue } from '../../audio/sectionAudio.ts'
import { startRewindSound, type RewindSound } from '../../audio/sfx.ts'
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

/** Odometer numeral: each digit is its own span, keyed by slot+glyph, so a
 * change rolls just that digit. At full rewind speed the ones column spins
 * into a blur (CSS adds motion blur from --rw-speed); braking into the
 * landing year it decelerates like a slot machine. */
function OdometerYear({ value, landed }: { value: string; landed: boolean }) {
  return (
    <span className={landed ? 'rw-year rw-year--landed' : 'rw-year'} aria-hidden="true">
      {value.split('').map((digit, slot) => (
        <span key={`${slot}-${digit}`} className="rw-digit">
          {digit}
        </span>
      ))}
    </span>
  )
}

export function RewindIntro({ years, onDone }: RewindIntroProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const rootRef = useRef<HTMLDivElement>(null)
  const doneRef = useRef(false)
  // Rewind order: newest → oldest.
  const rewindYears = useRef([...years].reverse()).current
  const [numeral, setNumeral] = useState(rewindYears[0] ?? '')
  const [landed, setLanded] = useState(false)
  const [fading, setFading] = useState(false)
  const skipRef = useRef<() => void>(() => {})

  // The cinematic "rewind through time" cue plays over the intro, ducking the
  // History section bed until it ends (user 2026-07-25: history intro = its own music).
  useEffect(() => {
    playCue(SHARED.scoreHistoryIntro)
  }, [])

  useEffect(() => {
    let alive = true
    let raf = 0
    let gl: RewindGL | null = null
    let rewindSnd: RewindSound | null = null
    let fadeTimer: number | undefined
    let watchdog: number | undefined

    const finish = () => {
      if (doneRef.current) return
      doneRef.current = true
      cancelAnimationFrame(raf)
      rewindSnd?.end()
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
      // Match what the year screens actually render: prefer bg-1.png, fall back
      // to a single bg.png. (A bg.mp4-only year has no still to texture, so it
      // simply isn't part of the rewind — the year still plays its video live.)
      const resolved = await Promise.all(
        rewindYears.map(async (y) => {
          const dir = `${HISTORY_BASE}/${y}/background`
          if (await probeImageCached(`${dir}/bg-1.png`)) return `${dir}/bg-1.png`
          if (await probeImageCached(`${dir}/bg.png`)) return `${dir}/bg.png`
          return null
        }),
      )
      const usable = resolved.filter((u): u is string => u !== null)
      const usableYears = rewindYears.filter((_, i) => resolved[i] !== null)
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
      const yearNums = usableYears.map((y) => parseInt(y, 10))
      let landedShown = false

      // Watchdog: rAF is fully suspended on hidden pages — if the intro's
      // frames can never run, force the handoff on wall-clock time so the
      // kiosk (or a backgrounded dev tab) never hangs behind the overlay.
      watchdog = window.setTimeout(() => finish(), total + FADE_MS + 1500)

      const showYear = (value: string) => {
        if (value !== numeralShown) {
          numeralShown = value
          setNumeral(value)
        }
      }
      const setCssVars = (speed: number) => {
        rootRef.current?.style.setProperty('--rw-speed', speed.toFixed(3))
      }

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
          setCssVars(0)
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
          // COUNTER: the numeral rolls through EVERY year between the cut's
          // endpoints — decelerating on the brake cut so the digits land
          // like a slot machine instead of jumping 1947→1941→…
          const yFrom = yearNums[cut]!
          const yTo = yearNums[cut + 1]!
          const ease = cut === cuts - 1 ? 1 - (1 - local) * (1 - local) : local
          const yr = Math.round(yFrom + (yTo - yFrom) * ease)
          showYear(String(yr))
          rewindSnd?.frame(yr, speed) // tick lands on each year as the counter rolls back
          state = {
            from: cut,
            to: cut + 1,
            progress: local,
            speed,
            blur: 0.8 * (1 - overall * 0.6),
            flash: Math.max(0, 1 - local * 3) * Math.min(1, speed + 0.3),
            time,
          }
          setCssVars(speed)
        } else {
          // Brake complete — sharpen onto the oldest year with a warm bloom.
          const p = Math.min(1, (t - ARRIVE_MS - rewindTotal) / SETTLE_MS)
          showYear(usableYears[cuts]!)
          if (!landedShown) {
            landedShown = true
            setLanded(true)
            rewindSnd?.land() // spin down + arrival thud on the oldest year
          }
          state = {
            from: cuts,
            to: cuts,
            progress: 0,
            speed: 0,
            blur: 0.3 * (1 - p),
            flash: 0.75 * (1 - p) * (1 - p),
            time,
          }
          setCssVars(0)
        }

        gl.setState(state)
        gl.render()

        if (t >= total) {
          finish()
          return
        }
        raf = requestAnimationFrame(tick)
      }
      rewindSnd = startRewindSound() // counter ticks + reverse whir, synced to the timeline
      raf = requestAnimationFrame(tick)
    })()

    return () => {
      alive = false
      cancelAnimationFrame(raf)
      rewindSnd?.end()
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
      <div className="rw-bar rw-bar--top" />
      <div className="rw-bar rw-bar--bottom" />
      <OdometerYear value={numeral} landed={landed} />
    </div>
  )
}
