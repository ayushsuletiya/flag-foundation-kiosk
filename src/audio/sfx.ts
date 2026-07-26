/**
 * sfx — tiny synthesized UI sound effects (Web Audio). No files, no network:
 * each sound is a short, warm oscillator envelope, so they're instant and
 * weightless on the kiosk. Kept subtle and premium — felt taps, not beeps.
 *
 * The AudioContext is created lazily and resumed on first use; since every sound
 * fires from a user gesture (a tap), that same gesture unlocks audio.
 */

let ctx: AudioContext | null = null
let master: GainNode | null = null

function ensure(): AudioContext | null {
  if (typeof window === 'undefined') return null
  if (ctx === null) {
    const AC =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (AC === undefined) return null
    ctx = new AC()
    master = ctx.createGain()
    master.gain.value = 0.22 // whole UI-sfx bus — subtle, sits just over the ambience bed
    master.connect(ctx.destination)
  }
  if (ctx.state === 'suspended') void ctx.resume()
  return ctx
}

interface ToneOpts {
  freq: number
  /** optional glide target by end of the tone */
  to?: number
  type?: OscillatorType
  dur?: number
  gain?: number
  /** lowpass cutoff (Hz) for warmth */
  filter?: number
  /** start offset (s) for layering */
  delay?: number
}

function tone(o: ToneOpts): void {
  const c = ensure()
  if (c === null || master === null) return
  const t0 = c.currentTime + (o.delay ?? 0)
  const dur = o.dur ?? 0.12
  const osc = c.createOscillator()
  osc.type = o.type ?? 'sine'
  osc.frequency.setValueAtTime(o.freq, t0)
  if (o.to !== undefined) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.to), t0 + dur)
  const g = c.createGain()
  const peak = o.gain ?? 0.5
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(peak, t0 + 0.008) // fast soft attack
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur) // quick decay = "felt" tap
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = o.filter ?? 1400
  osc.connect(lp).connect(g).connect(master)
  osc.start(t0)
  osc.stop(t0 + dur + 0.02)
}

/** A short filtered-noise "whoosh" — a soft cloth/water sweep for the slider. */
function whoosh(dur: number, gain: number): void {
  const c = ensure()
  if (c === null || master === null) return
  const t0 = c.currentTime
  const len = Math.floor(c.sampleRate * (dur + 0.05))
  const buf = c.createBuffer(1, len, c.sampleRate)
  const data = buf.getChannelData(0)
  for (let i = 0; i < len; i += 1) data[i] = Math.random() * 2 - 1
  const src = c.createBufferSource()
  src.buffer = buf
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.7
  bp.frequency.setValueAtTime(300, t0)
  bp.frequency.exponentialRampToValueAtTime(1150, t0 + dur * 0.5) // rise …
  bp.frequency.exponentialRampToValueAtTime(280, t0 + dur) // … and fall = a soft wave
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.35)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur)
  src.connect(bp).connect(g).connect(master)
  src.start(t0)
  src.stop(t0 + dur + 0.03)
}

// ---------------------------------------------------------------------------
// Rewind counter — the "going back in time" sound for the History intro
// (RewindIntro). Three synced elements, driven frame-by-frame off the intro's
// own rAF timeline so the ticks land ON the year numerals:
//   • a per-year mechanical TICK (fires on each year change),
//   • a low reverse WHIR bed whose body opens with the roll speed (fills the
//     gaps at full speed; near-silent at rest), and
//   • a warm THUD when the counter brakes onto the oldest year.
// Everything routes through the shared UI-sfx `master`, so it stays subtle and
// balanced against the intro music. Tune loudness via REWIND_GAIN.
// ---------------------------------------------------------------------------
const REWIND_GAIN = 1.0 // overall counter level (relative to the UI-sfx bus)

/** A single odometer tick: a crisp high-passed transient (+ a touch of body). */
function rewindTick(c: AudioContext, dest: AudioNode, speed: number): void {
  const t0 = c.currentTime
  const len = Math.floor(c.sampleRate * 0.02)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i += 1) d[i] = (Math.random() * 2 - 1) * (1 - i / len) // decaying transient
  const src = c.createBufferSource()
  src.buffer = buf
  const hp = c.createBiquadFilter()
  hp.type = 'highpass'
  hp.frequency.value = 1500
  const g = c.createGain()
  const peak = (0.3 + 0.22 * speed) * REWIND_GAIN // discrete when slow, denser chatter at speed
  g.gain.setValueAtTime(peak, t0)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.03)
  src.connect(hp).connect(g).connect(dest)
  src.start(t0)
  src.stop(t0 + 0.05)
}

/** Arrival thud — warm low "set down" as the reel brakes onto the oldest year. */
function rewindThud(c: AudioContext, dest: AudioNode): void {
  const t0 = c.currentTime
  const o = c.createOscillator()
  o.type = 'sine'
  o.frequency.setValueAtTime(150, t0)
  o.frequency.exponentialRampToValueAtTime(68, t0 + 0.28)
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 700
  const g = c.createGain()
  g.gain.setValueAtTime(0.0001, t0)
  g.gain.exponentialRampToValueAtTime(0.55 * REWIND_GAIN, t0 + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.42)
  o.connect(lp).connect(g).connect(dest)
  o.start(t0)
  o.stop(t0 + 0.46)
}

export interface RewindSound {
  /** Call every frame with the currently-shown year and the 0..1 roll speed. */
  frame: (year: number, speed: number) => void
  /** The reel brakes onto the oldest year — spin down + arrival thud. */
  land: () => void
  /** Tear down (skip or unmount). */
  end: () => void
}

/** Start the rewind counter. Returns a no-op controller if Web Audio is
 *  unavailable, so the intro never depends on it. */
export function startRewindSound(): RewindSound {
  const c = ensure()
  if (c === null || master === null) return { frame: () => {}, land: () => {}, end: () => {} }

  const bus = c.createGain()
  bus.gain.value = 1
  bus.connect(master)

  // Continuous reverse whir: a low saw through a bandpass; gain/tone track speed.
  const whir = c.createOscillator()
  whir.type = 'sawtooth'
  whir.frequency.value = 60
  const bp = c.createBiquadFilter()
  bp.type = 'bandpass'
  bp.Q.value = 0.8
  bp.frequency.value = 200
  const whirGain = c.createGain()
  whirGain.gain.value = 0.0001
  whir.connect(bp).connect(whirGain).connect(bus)
  whir.start()

  let lastYear = Number.NaN
  let lastTick = 0
  let dead = false

  const frame = (year: number, speed: number): void => {
    if (dead) return
    const now = c.currentTime
    whirGain.gain.setTargetAtTime(0.13 * speed * REWIND_GAIN, now, 0.05) // silent at rest, opens with speed
    bp.frequency.setTargetAtTime(180 + 520 * speed, now, 0.05)
    whir.frequency.setTargetAtTime(58 + 26 * speed, now, 0.08)
    // Tick on each year change, gated so full speed is a mechanical whir, not a
    // digital buzz; the braking ticks (>100ms apart) stay crisp and discrete.
    if (year !== lastYear) {
      lastYear = year
      if (now - lastTick >= 0.026) {
        lastTick = now
        rewindTick(c, bus, speed)
      }
    }
  }

  const land = (): void => {
    if (dead) return
    whirGain.gain.setTargetAtTime(0.0001, c.currentTime, 0.12) // spin down
    rewindThud(c, bus)
  }

  const end = (): void => {
    if (dead) return
    dead = true
    const now = c.currentTime
    whirGain.gain.setTargetAtTime(0.0001, now, 0.1)
    try {
      whir.stop(now + 0.5)
    } catch {
      /* already stopped */
    }
    window.setTimeout(() => {
      try {
        bus.disconnect()
      } catch {
        /* already gone */
      }
    }, 700)
  }

  return { frame, land, end }
}

// ---------------------------------------------------------------------------
// Ashok Chakra section sound design.
//   • playSpokeChime — a warm, per-virtue PITCHED chime as a spoke is selected
//     (the wheel is a <canvas>, so the delegated UiSounds listener never fires
//     for spoke taps — this is the "spokes are silent" fix). Each spoke maps to
//     a pentatonic degree so the 24-spoke wheel reads like a soft instrument,
//     not 24 identical beeps.
//   • startWheelRoll — the entrance: a low rolling rumble whose body tracks the
//     roll speed, landing on a settle thud (same per-frame controller shape as
//     startRewindSound; driven off the intro's onRollFrame/onRollDone).
//   • playDock — a low airy whoosh as the wheel sails into / out of the flag.
// ---------------------------------------------------------------------------

/** Two octaves of a major-pentatonic ladder (semitones) — always consonant. */
const CHAKRA_PENTATONIC = [0, 2, 4, 7, 9, 12, 14, 16, 19, 21, 24]

/** Selecting a spoke: a rounded two-partial bell, pitched by spoke index across
 *  a pentatonic ladder so the note rises as you move around the wheel. The
 *  ladder has fewer degrees than the 24 spokes, so nearby spokes may share a
 *  pitch — the intent is an ascending, always-consonant feel, not 24 unique notes. */
export function playSpokeChime(index: number, count: number): void {
  const span = Math.max(1, count - 1)
  const pos = Math.min(1, Math.max(0, index / span))
  const st = CHAKRA_PENTATONIC[Math.round(pos * (CHAKRA_PENTATONIC.length - 1))] ?? 0
  const freq = 262 * Math.pow(2, st / 12) // C4 base, up to ~2 octaves
  tone({ freq, type: 'sine', dur: 0.5, gain: 0.34, filter: 2600 }) // fundamental, bell decay
  tone({ freq: freq * 1.5, type: 'sine', dur: 0.32, gain: 0.11, filter: 3200, delay: 0.012 }) // a fifth of shimmer
}

/** Wheel dock/undock (Flag tab): an airy whoosh + a soft settle/lift. */
export function playDock(into: boolean): void {
  whoosh(0.7, 0.24)
  if (into) tone({ freq: 150, to: 90, type: 'sine', dur: 0.5, gain: 0.3, filter: 700, delay: 0.3 })
  else tone({ freq: 120, to: 210, type: 'sine', dur: 0.3, gain: 0.22, filter: 1000, delay: 0.1 })
}

export interface WheelRoll {
  /** Call each frame with the roll's 0..1 speed (from onRollFrame delta). */
  frame: (speed: number) => void
  /** The wheel settles home — spin down + a warm arrival thud. */
  land: () => void
  /** Tear down (unmount / intro skip). */
  end: () => void
}

/** Start the entrance rolling rumble. No-op controller if Web Audio is
 *  unavailable, so the intro never depends on it. */
export function startWheelRoll(): WheelRoll {
  const c = ensure()
  if (c === null || master === null) return { frame: () => {}, land: () => {}, end: () => {} }

  const bus = c.createGain()
  bus.gain.value = 1
  bus.connect(master)

  // Rolling rumble: looping noise through a lowpass, cutoff + gain track speed.
  const len = Math.floor(c.sampleRate * 1.0)
  const buf = c.createBuffer(1, len, c.sampleRate)
  const d = buf.getChannelData(0)
  for (let i = 0; i < len; i += 1) d[i] = Math.random() * 2 - 1
  const noise = c.createBufferSource()
  noise.buffer = buf
  noise.loop = true
  const lp = c.createBiquadFilter()
  lp.type = 'lowpass'
  lp.frequency.value = 160
  const noiseGain = c.createGain()
  noiseGain.gain.value = 0.0001
  noise.connect(lp).connect(noiseGain).connect(bus)
  noise.start()

  // A low body tone for weight (the stone-rumble under the tread).
  const sub = c.createOscillator()
  sub.type = 'sine'
  sub.frequency.value = 52
  const subGain = c.createGain()
  subGain.gain.value = 0.0001
  sub.connect(subGain).connect(bus)
  sub.start()

  let dead = false

  const frame = (speed: number): void => {
    if (dead) return
    const now = c.currentTime
    const s = Math.min(1, Math.max(0, speed))
    noiseGain.gain.setTargetAtTime(0.34 * s, now, 0.05) // rumble opens with speed
    lp.frequency.setTargetAtTime(120 + 900 * s, now, 0.05) // brighter grind when faster
    subGain.gain.setTargetAtTime(0.26 * s, now, 0.06)
    sub.frequency.setTargetAtTime(46 + 40 * s, now, 0.08)
  }

  const land = (): void => {
    if (dead) return
    const now = c.currentTime
    noiseGain.gain.setTargetAtTime(0.0001, now, 0.12) // spin down
    subGain.gain.setTargetAtTime(0.0001, now, 0.12)
    rewindThud(c, bus) // warm arrival thud (shared with the rewind land)
  }

  const end = (): void => {
    if (dead) return
    dead = true
    const now = c.currentTime
    noiseGain.gain.setTargetAtTime(0.0001, now, 0.1)
    subGain.gain.setTargetAtTime(0.0001, now, 0.1)
    try {
      noise.stop(now + 0.4)
      sub.stop(now + 0.4)
    } catch {
      /* already stopped */
    }
    window.setTimeout(() => {
      try {
        bus.disconnect()
      } catch {
        /* already gone */
      }
    }, 700)
  }

  return { frame, land, end }
}

export type SfxKind = 'tap' | 'select' | 'home' | 'back' | 'open' | 'wave' | 'place'

/** Play a UI sound. Unknown kinds fall back to a soft tap. */
export function playSfx(kind: string): void {
  switch (kind) {
    case 'tap': // generic press — tiles, pills, cards, dots, chevrons
      tone({ freq: 220, to: 160, type: 'triangle', dur: 0.1, gain: 0.5, filter: 1100 })
      break
    case 'select': // commit — Know More / Read More / Continue
      tone({ freq: 330, type: 'sine', dur: 0.09, gain: 0.38, filter: 1800 })
      tone({ freq: 494, type: 'sine', dur: 0.15, gain: 0.42, filter: 2200, delay: 0.06 })
      break
    case 'home': // return to lobby — warm downward settle
      tone({ freq: 300, to: 200, type: 'sine', dur: 0.18, gain: 0.5, filter: 1200 })
      break
    case 'back': // step back — short downward tick
      tone({ freq: 340, to: 240, type: 'triangle', dur: 0.12, gain: 0.4, filter: 1300 })
      break
    case 'open': // panel opening — airy rise
      tone({ freq: 420, to: 720, type: 'sine', dur: 0.16, gain: 0.34, filter: 2600 })
      break
    case 'wave': // carousel slider — soft cloth/water whoosh
      whoosh(0.5, 0.26)
      break
    case 'place': // map state select — warm low "set down"
      tone({ freq: 180, to: 130, type: 'sine', dur: 0.17, gain: 0.5, filter: 900 })
      tone({ freq: 300, type: 'sine', dur: 0.08, gain: 0.18, filter: 1600, delay: 0.02 })
      break
    default:
      tone({ freq: 220, to: 160, type: 'triangle', dur: 0.1, gain: 0.5, filter: 1100 })
  }
}
