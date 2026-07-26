/**
 * warmAssets — make every section feel instant by paying its first-paint cost
 * BEFORE the visitor taps.
 *
 * Two separate costs are warmed, because fixing only one still shows a gap:
 *
 *  1. THE PROBE. Every `background/` folder is resolved at runtime — each
 *     <DynamicBackground> mount fires 8 probes (bg.mp4 / poster.png / bg.png /
 *     bg-1..5.png) and renders NOTHING until all of them settle. Those probes
 *     are cached by URL, so running them here means `ready` is already true on
 *     the screen's first frame.
 *  2. THE DECODE. Bytes in the HTTP cache still cost a main-thread decode the
 *     first time a 1920x1080 still is painted. preloadImage() does that work
 *     up front (see preload.ts).
 *
 * Everything runs on IDLE, one item at a time, so warming never competes with
 * the screen the visitor is actually looking at — and in priority order, so the
 * likeliest next tap is ready first. It is deliberately BOUNDED to each
 * section's hero art: warming all 1500 images would cost more RAM than it saves
 * (a decoded 1920x1080 frame is ~8MB regardless of file size).
 */
import { CHAKRA, HISTORY_BASE, HOME, MONUMENTAL, SYMBOLS } from './paths.ts'
import { preloadImage } from './preload.ts'
import { probeImageCached, probeVideoCached } from './probe.ts'

/** Run `fn` when the browser is idle (falls back to a timeout). */
function onIdle(fn: () => void): void {
  const ric = (window as unknown as { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number })
    .requestIdleCallback
  if (typeof ric === 'function') ric(fn, { timeout: 2000 })
  else window.setTimeout(fn, 1)
}

/** Await the next idle slot. */
function idle(): Promise<void> {
  return new Promise((resolve) => onIdle(() => resolve()))
}

/**
 * Resolve a background folder exactly like <DynamicBackground> does, then decode
 * the stills it would actually paint. Safe to call repeatedly — every probe and
 * decode is cached.
 */
export async function warmBackground(base: string): Promise<void> {
  const numberedUrls = Array.from({ length: 5 }, (_, i) => `${base}/bg-${i + 1}.png`)
  const [video, poster, single, ...numbered] = await Promise.all([
    probeVideoCached(`${base}/bg.mp4`),
    probeImageCached(`${base}/poster.png`),
    probeImageCached(`${base}/bg.png`),
    ...numberedUrls.map(probeImageCached),
  ])

  const stills: string[] = []
  numberedUrls.forEach((url, i) => {
    if (numbered[i] === true) stills.push(url)
  })
  if (stills.length === 0 && single) stills.push(`${base}/bg.png`)
  // A video background still paints its poster on the first frame.
  if (video && poster) stills.push(`${base}/poster.png`)

  for (const url of stills) {
    await preloadImage(url)
    await idle() // one decode per idle slot — never block the live screen
  }
}

let started = false

/**
 * Warm every section, in the order a visitor is most likely to need it.
 * Idempotent; the first call wins.
 *
 * `firstYear` is the History year the section opens on — passed in rather than
 * imported so this module stays free of screen imports.
 */
export function warmAllSections(firstYear: string | null): void {
  if (started) return
  started = true

  void (async () => {
    // 1. HOME — the screen already on display, and the one every Back returns
    //    to. Its tile photos gate the home entrance, so they come first.
    for (const tile of ['card-monumental', 'card-history', 'card-chakra', 'card-symbols']) {
      await preloadImage(`${HOME.cards}/${tile}.png`)
    }
    await idle()
    await warmBackground(HOME.background)

    // 2. The four category first paints, in tile order.
    await warmBackground(MONUMENTAL.mapBackground)
    if (firstYear !== null) await warmBackground(`${HISTORY_BASE}/${firstYear}/background`)
    await warmBackground(CHAKRA.background)
    await warmBackground(SYMBOLS.carouselBackground)

    // 3. Second-level screens reached from inside a section.
    await warmBackground(MONUMENTAL.selectStateBackground)
    await warmBackground(SYMBOLS.detailBackground)
  })()
}
