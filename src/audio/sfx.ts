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
