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
  /** Wall-clock safety net for the fade (see fade()). */
  timer: number | null
}

const tracks = new Map<string, Track>()
let current: string | null = null
let armed = false
let pending: { key: string; src: string; vol: number } | null = null
// The one active intro cue (History rewind). Tracked so it can be stopped when
// the visitor leaves the section — a long cue that plays on must never bleed
// over the next category's bed (and a StrictMode double-fire can't stack two).
let activeCue: HTMLAudioElement | null = null
/** How far the section bed is pulled down while an intro cue plays over it. */
const CUE_DUCK = 0.12

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

/** Cancel any in-flight ramp for this track (both the frame loop and its net). */
function clearFade(t: Track): void {
  if (t.raf !== null) {
    cancelAnimationFrame(t.raf)
    t.raf = null
  }
  if (t.timer !== null) {
    clearTimeout(t.timer)
    t.timer = null
  }
}

/** Snap to the ramp's END state. Reaching 0 also PAUSES — that's what actually
 *  stops an outgoing category bed. */
function finalize(t: Track, to: number): void {
  t.audio.volume = Math.max(0, Math.min(1, to))
  if (to <= 0.001) t.audio.pause()
}

function fade(t: Track, to: number, ms: number): void {
  // Own the ramp inline so t.raf ALWAYS points at the live frame. (rampEl keeps
  // its next-frame id in a local, so t.raf would go stale after frame 1 and a
  // later fade() couldn't cancel this one — two ramps then fight over the same
  // <audio>.volume and the fade-out's pause() silences a bed we're fading in.
  // That was the "category doesn't change / beds overlap" bug.)
  clearFade(t)
  const from = t.audio.volume
  const t0 = performance.now()
  const step = (now: number): void => {
    const p = Math.min(1, (now - t0) / ms)
    t.audio.volume = Math.max(0, Math.min(1, from + (to - from) * p))
    if (p < 1) {
      t.raf = requestAnimationFrame(step)
    } else {
      clearFade(t)
      finalize(t, to)
    }
  }
  t.raf = requestAnimationFrame(step)
  // Wall-clock SAFETY NET. requestAnimationFrame is throttled to ~0 whenever the
  // window is backgrounded, minimised or fully occluded, so an rAF-only ramp can
  // stall mid-fade and NEVER reach its pause() — leaving the old category's bed
  // looping under the new one for as long as the app runs. This guarantees the
  // end state (and the pause) even if not a single frame ever fires.
  t.timer = window.setTimeout(() => {
    clearFade(t)
    finalize(t, to)
  }, ms + 120)
}

function ensureTrack(key: string, src: string): Track {
  let t = tracks.get(key)
  if (t === undefined) {
    const audio = new Audio(src)
    audio.loop = true
    audio.volume = 0
    audio.preload = 'auto'
    t = { audio, target: 0, raf: null, timer: null }
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
  stopCue() // leaving the section ends its intro cue so it can't bleed over
  if (current !== null) {
    const prev = tracks.get(current)
    if (prev !== undefined) fade(prev, 0, 1000)
  }
  current = key
  const t = ensureTrack(key, src)
  t.target = vol
  // Only fade IN once play() resolves IF this is still the section — a slow
  // decode that lands after the visitor already moved on must not bring the
  // old bed back up over the new one. And if an intro cue started ducking the
  // bed while play() was still resolving, come up only to the DUCKED level:
  // otherwise this late fade-in un-ducks the bed and you get the cue and the
  // score both at full — two pieces of music at once.
  void t.audio
    .play()
    .then(() => {
      if (current !== key) return
      fade(t, activeCue !== null ? vol * CUE_DUCK : vol, 1000)
    })
    .catch(() => {})
}

/** Stop the active intro cue (if any) and un-hook it so its onended can't later
 *  revive a bed. A paused cue never fires onended, so the duck-restore is left
 *  to whoever changes the section next. */
function stopCue(): void {
  if (activeCue !== null) {
    activeCue.onended = null
    activeCue.pause()
    activeCue = null
  }
}

/** Play a one-shot cue (e.g. the History rewind), ducking the section bed until
 *  it ends. Silently no-ops if audio isn't armed yet. Only ONE cue at a time —
 *  a new cue (or a section change via stopCue) supersedes the previous. */
export function playCue(src: string, vol = 0.32): void {
  if (!armed) return
  stopCue() // never stack cues (also collapses a StrictMode double-fire to one)
  const bedKey = current
  const cur = bedKey !== null ? (tracks.get(bedKey) ?? null) : null
  if (cur !== null) fade(cur, cur.target * CUE_DUCK, 600)
  const cue = new Audio(src)
  activeCue = cue
  cue.volume = 0
  // Restore the bed only if this is still the live cue AND still the same
  // section — never un-duck a bed the visitor has already left.
  const restore = () => {
    if (activeCue === cue) activeCue = null
    if (cur !== null && current === bedKey) fade(cur, cur.target, 1600)
  }
  cue.onended = restore
  void cue.play().then(() => rampEl(cue, vol, 700)).catch(restore)
}

// ---- secondary layer: the per-symbol soundscape that sits UNDER the section
// score (e.g. a jungle/river bed while a symbol is on screen). One at a time,
// crossfaded as the symbol changes. ----------------------------------------
//
// Ownership tokens: the National Symbols carousel and its /symbols/:slug detail
// page are BOTH mounted at once during the page cross-dissolve (App.tsx keeps a
// stack of live pages). When they show the same symbol, the entering screen's
// claim no-ops (key already playing) and the LEAVING screen's cleanup would,
// naively, null the layer last — silencing the screen you just landed on. So a
// claim returns a monotonic id; a release only clears if it STILL owns the
// layer (a newer claim supersedes a stale cleanup).
let layerKey: string | null = null
let layerSeq = 0
let layerOwner = 0
let pendingLayer: { key: string; src: string; vol: number; owner: number } | null = null

function applyLayer(key: string | null, src?: string, vol = 0.14): void {
  if (key === layerKey) return
  if (layerKey !== null) {
    const prev = tracks.get(`layer:${layerKey}`)
    if (prev !== undefined) fade(prev, 0, 800)
  }
  layerKey = key
  if (key === null || src === undefined) return
  const t = ensureTrack(`layer:${key}`, src)
  t.target = vol
  // As in setSection: don't fade a layer in if the symbol already changed while
  // play() was resolving.
  void t.audio.play().then(() => { if (layerKey === key) fade(t, vol, 800) }).catch(() => {})
}

/** Claim the per-symbol layer for `key`. Returns a token to pass to
 *  releaseLayer() on cleanup. Latest claim wins (crossfades on key change). */
export function claimLayer(key: string, src: string, vol = 0.14): number {
  const id = ++layerSeq
  layerOwner = id
  if (!armed) {
    pendingLayer = { key, src, vol, owner: id }
    return id
  }
  applyLayer(key, src, vol)
  return id
}

/** Release a claim. No-ops unless this token is the current owner, so a stale
 *  cleanup (from a page still fading out) can't kill a newer screen's layer. */
export function releaseLayer(id: number): void {
  if (id === 0 || id !== layerOwner) return
  layerOwner = 0
  if (pendingLayer !== null && pendingLayer.owner === id) pendingLayer = null
  applyLayer(null)
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
    if (p.owner === layerOwner) applyLayer(p.key, p.src, p.vol)
  }
}

// A hidden document must never keep playing. Without this, a SECOND tab left on
// the Home screen (or an old tab from a previous run) keeps its bed looping
// forever in the background — you navigate to History in the tab you're looking
// at and still hear the home music, which no amount of crossfade logic in THIS
// tab can stop. Pausing on hide also means a minimised/occluded window goes
// quiet instead of bleeding under the one you're using. The kiosk itself runs
// fullscreen and never hides, so this is inert in production.
function handleVisibility(): void {
  if (document.hidden) {
    tracks.forEach((t) => {
      clearFade(t)
      t.audio.pause()
    })
    if (activeCue !== null) activeCue.pause()
    return
  }
  if (!armed) return
  // Back in view — bring the CURRENT bed (and layer/cue) back, respecting a duck.
  if (current !== null) {
    const t = tracks.get(current)
    if (t !== undefined) {
      const to = activeCue !== null ? t.target * CUE_DUCK : t.target
      void t.audio.play().then(() => fade(t, to, 400)).catch(() => {})
    }
  }
  if (layerKey !== null) {
    const l = tracks.get(`layer:${layerKey}`)
    if (l !== undefined) void l.audio.play().then(() => fade(l, l.target, 400)).catch(() => {})
  }
  if (activeCue !== null) void activeCue.play().catch(() => {})
}
document.addEventListener('visibilitychange', handleVisibility)

// DEV ONLY — hot-reload hygiene. This module keeps its state (tracks/current/
// armed) in module-level singletons. When Vite hot-replaces the file, the NEW
// module starts empty while the OLD module's <audio> elements keep looping,
// now unreachable by any code: you hear a stale category bed under everything
// and nothing can stop it. Tear the old ones down as the module is replaced.
if (import.meta.hot) {
  import.meta.hot.dispose(() => {
    document.removeEventListener('visibilitychange', handleVisibility)
    stopCue()
    tracks.forEach((t) => {
      clearFade(t)
      t.audio.pause()
      t.audio.src = ''
    })
    tracks.clear()
  })
}
