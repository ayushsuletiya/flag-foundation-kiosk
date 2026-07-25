/**
 * sectionAudio — the kiosk's per-zone background score. One looping bed per
 * category (home / monumental / history / chakra / symbols), crossfaded as the
 * visitor moves between sections, plus a one-shot intro cue (used by the History
 * rewind, which ducks the section bed while it plays).
 *
 * Browsers block audio autoplay until a gesture, so the first bed is deferred
 * until armAudio() runs on the first touch (a visitor always taps to begin);
 * later crossfades ride the navigation taps that trigger them.
 */

interface Track {
  audio: HTMLAudioElement
  target: number
  raf: number | null
}

const tracks = new Map<string, Track>()
let current: string | null = null
let armed = false
let pending: { key: string; src: string; vol: number } | null = null

function rampEl(el: HTMLAudioElement, to: number, ms: number, onEnd?: () => void): number {
  const from = el.volume
  const t0 = performance.now()
  let raf = 0
  const step = (now: number) => {
    const p = Math.min(1, (now - t0) / ms)
    el.volume = Math.max(0, Math.min(1, from + (to - from) * p))
    if (p < 1) {
      raf = requestAnimationFrame(step)
    } else if (onEnd) {
      onEnd()
    }
  }
  raf = requestAnimationFrame(step)
  return raf
}

function fade(t: Track, to: number, ms: number): void {
  if (t.raf !== null) cancelAnimationFrame(t.raf)
  t.raf = rampEl(t.audio, to, ms, () => {
    t.raf = null
    if (to <= 0.001) t.audio.pause()
  })
}

function ensureTrack(key: string, src: string): Track {
  let t = tracks.get(key)
  if (t === undefined) {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0
    audio.preload = 'auto'
    t = { audio, target: 0, raf: null }
    tracks.set(key, t)
  }
  return t
}

/** Crossfade the background score to `key`. No-op while already there. */
export function setSection(key: string, src: string, vol = 0.16): void {
  if (key === current) return
  if (!armed) {
    pending = { key, src, vol }
    return
  }
  if (current !== null) {
    const prev = tracks.get(current)
    if (prev !== undefined) fade(prev, 0, 1000)
  }
  current = key
  const t = ensureTrack(key, src)
  t.target = vol
  void t.audio.play().then(() => fade(t, vol, 1000)).catch(() => {})
}

/** Play a one-shot cue (e.g. the History rewind), ducking the section bed until
 *  it ends. Silently no-ops if audio isn't armed yet. */
export function playCue(src: string, vol = 0.32): void {
  if (!armed) return
  const cur = current !== null ? (tracks.get(current) ?? null) : null
  if (cur !== null) fade(cur, cur.target * 0.12, 600)
  const cue = new Audio(src)
  cue.volume = 0
  cue.onended = () => {
    if (cur !== null) fade(cur, cur.target, 1600)
  }
  void cue.play().then(() => rampEl(cue, vol, 700)).catch(() => {
    if (cur !== null) fade(cur, cur.target, 800)
  })
}

// ---- secondary layer: the per-symbol soundscape that sits UNDER the section
// score (e.g. a jungle/river bed while a symbol is on screen). One at a time,
// crossfaded as the symbol changes; null clears it. ------------------------
let layerKey: string | null = null
let pendingLayer: { key: string; src: string; vol: number } | null = null

export function setLayer(key: string | null, src?: string, vol = 0.14): void {
  if (!armed) {
    pendingLayer = key !== null && src !== undefined ? { key, src, vol } : null
    return
  }
  if (key === layerKey) return
  if (layerKey !== null) {
    const prev = tracks.get(`layer:${layerKey}`)
    if (prev !== undefined) fade(prev, 0, 800)
  }
  layerKey = key
  if (key === null || src === undefined) return
  const t = ensureTrack(`layer:${key}`, src)
  t.target = vol
  void t.audio.play().then(() => fade(t, vol, 800)).catch(() => {})
}

/** Unlock audio + start any pending section bed / layer. Call on first gesture. */
export function armAudio(): void {
  if (armed) return
  armed = true
  if (pending !== null) {
    const p = pending
    pending = null
    setSection(p.key, p.src, p.vol)
  }
  if (pendingLayer !== null) {
    const p = pendingLayer
    pendingLayer = null
    setLayer(p.key, p.src, p.vol)
  }
}
