/**
 * symbolsMedia — runtime discovery of per-symbol media under
 * assets/4-national-symbols/symbols/<slug>/:
 *
 *   turntable/f_0001.png …  → PNG-sequence turntable (25fps loop)
 *   turntable/static.png    → poster / fallback still
 *   did-you-know/1.png …    → Did You Know card photos (any count; the card
 *                             cycles them alongside its facts)
 *
 * Media is user-dropped loose files (not bundled), so the app probes with
 * Image() loads exactly like historyAssets. The frame count is discovered
 * (exponential grow + binary search), so dropping numbered frames next to
 * static.png makes the turntable play with ZERO code changes. Today only
 * static.png files exist → frameCount 0 → the player shows the poster.
 * Results are memoised for the app lifetime — kiosk assets are immutable
 * at runtime.
 */
import { useEffect, useState } from 'react'
import { SYMBOLS } from '../../assets/paths.ts'

export const SYMBOL_BASE = SYMBOLS.symbols
// A realistic ceiling for a turntable loop — the shipped sequences are ~107
// frames. A lower cap bounds the worst case if a client drops an oversized
// sequence (each 460x818 frame is ~1.5MB decoded).
const MAX_FRAMES = 240
const MAX_DYK_IMAGES = 12

export interface SymbolMedia {
  /** False while probes are in flight — render nothing (no flash of fallback). */
  ready: boolean
  /** Numbered turntable frames found; 0 = none yet (poster only). */
  frameCount: number
  hasStatic: boolean
  staticUrl: string
  /** PngSequencePlayer pattern, e.g. "…/symbols/tiger/turntable/f_{frame}.png". */
  srcPattern: string
  /** did-you-know/1.png… in order; [] when the folder is empty/absent. */
  dykImages: string[]
}

function staticUrlFor(slug: string): string {
  return `${SYMBOL_BASE}/${slug}/turntable/static.png`
}

function patternFor(slug: string): string {
  return `${SYMBOL_BASE}/${slug}/turntable/f_{frame}.png`
}

function frameUrl(slug: string, frame: number): string {
  return `${SYMBOL_BASE}/${slug}/turntable/f_${String(frame).padStart(4, '0')}.png`
}

/** Resolves true when the browser can decode the URL as an image (404 = false). */
function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

function dykUrl(slug: string, n: number): string {
  return `${SYMBOL_BASE}/${slug}/did-you-know/${n}.png`
}

/** Contiguous 1.png, 2.png… prefix of the did-you-know folder (any count). */
async function discoverDyk(slug: string): Promise<string[]> {
  const urls = Array.from({ length: MAX_DYK_IMAGES }, (_, i) => dykUrl(slug, i + 1))
  const found = await Promise.all(urls.map(probe))
  const images: string[] = []
  for (let i = 0; i < urls.length; i++) {
    if (!found[i]) break
    images.push(urls[i]!)
  }
  return images
}

async function discover(
  slug: string,
): Promise<{ frameCount: number; hasStatic: boolean; dykImages: string[] }> {
  const [hasStatic, hasFirst, dykImages] = await Promise.all([
    probe(staticUrlFor(slug)),
    probe(frameUrl(slug, 1)),
    discoverDyk(slug),
  ])
  if (!hasFirst) return { frameCount: 0, hasStatic, dykImages }

  // Exponential grow to bracket the last frame, then binary search inside.
  let lo = 1 // highest frame known to exist
  let hi = 2 // lowest frame known missing (once the loop exits)
  while (hi <= MAX_FRAMES && (await probe(frameUrl(slug, hi)))) {
    lo = hi
    hi *= 2
  }
  if (hi > MAX_FRAMES) return { frameCount: MAX_FRAMES, hasStatic, dykImages }
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (await probe(frameUrl(slug, mid))) lo = mid
    else hi = mid
  }
  return { frameCount: lo, hasStatic, dykImages }
}

type Discovered = { frameCount: number; hasStatic: boolean; dykImages: string[] }

const mediaCache = new Map<string, Promise<Discovered>>()

function discoverCached(slug: string): Promise<Discovered> {
  let hit = mediaCache.get(slug)
  if (hit === undefined) {
    hit = discover(slug)
    mediaCache.set(slug, hit)
  }
  return hit
}

/* ------------------------------------------------------------------ */
/* Podium grounding                                                    */
/* ------------------------------------------------------------------ */

/** Symbols that physically STAND — they sit on the podium (visible bottom
 * pinned to the podium top). Everything else (dolphin, river, lotus, rupee,
 * anthem, song, calendar, lion capital) keeps floating (user decision
 * 2026-07-20: "animals and tree and flag on podium, rest can float"). */
const GROUNDED_SLUGS = new Set([
  'tiger',
  'peacock',
  'indian-elephant',
  'indian-banyan',
  'flag',
])

export function isGroundedSymbol(slug: string): boolean {
  return GROUNDED_SLUGS.has(slug)
}

interface AlphaBounds {
  naturalWidth: number
  naturalHeight: number
  /** Fraction of natural height where visible ink starts / ends (0..1). */
  topFrac: number
  bottomFrac: number
}

const boundsCache = new Map<string, Promise<AlphaBounds | null>>()

/** Alpha bounding box of the artwork PNG (downscaled scan — one per slug). */
function measureAlphaBounds(url: string): Promise<AlphaBounds | null> {
  const pending = boundsCache.get(url)
  if (pending !== undefined) return pending
  const job = new Promise<AlphaBounds | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.min(128, img.naturalWidth)
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx === null) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, w, h).data
      } catch {
        resolve(null)
        return
      }
      let minY = -1
      let maxY = -1
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          if (data[(y * w + x) * 4 + 3]! > 16) {
            if (minY === -1) minY = y
            maxY = y
            break
          }
        }
      }
      if (minY === -1) {
        resolve(null) // fully transparent?
        return
      }
      resolve({
        naturalWidth: img.naturalWidth,
        naturalHeight: img.naturalHeight,
        topFrac: minY / h,
        bottomFrac: (maxY + 1) / h,
      })
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
  boundsCache.set(url, job)
  return job
}

export interface GroundedTransform {
  /** translateY (px) applied to the subject box. */
  dy: number
  /** Uniform scale, taken about the feet (see originY) so grounding holds. */
  scale: number
  /** transform-origin Y in element-local px — the visible feet row. */
  originY: number
}

const IDENTITY_TRANSFORM: GroundedTransform = { dy: 0, scale: 1, originY: 0 }

interface GroundedOpts {
  boxTop: number
  boxW: number
  boxH: number
  /** Podium contact line (centre of the top ellipse) in stage px. */
  podiumY: number
  /** Every grounded subject is scaled so its VISIBLE height matches this. */
  targetVisibleH: number
  minScale?: number
  maxScale?: number
}

/**
 * Places a grounded symbol on the podium and NORMALISES its on-podium size.
 *
 * Two problems the turntable renders create, both solved here:
 *
 * 1. Grounding — the artwork renders `object-fit: contain` inside a fixed box,
 *    but each PNG carries a different amount of transparent padding, so the
 *    visible feet sit at a different height per symbol. We measure the alpha
 *    bbox of frame 1 (what actually plays — the tiger/peacock posters are a
 *    different, tighter render than their frames) and translate the box so the
 *    visible bottom lands on `podiumY`. static.png is the fallback for slugs
 *    with no frames; the silhouette bottom is ~constant across a turntable
 *    (≤2.2px over 107 frames), so frame 1 stands in for the loop.
 *
 * 2. Scale — the subjects fill wildly different fractions of their frame
 *    (elephant/banyan ~40%, tiger ~68%, flag ~95%). Plain contain made the
 *    small ones look like toys on a big podium and the flag tower. We scale
 *    each so its VISIBLE height equals `targetVisibleH`. The tiger is the
 *    Figma reference (frame 795:3849); pass its visible height as the target
 *    and the tiger renders at scale ~1 while the rest match its presentation.
 *    The scale is taken about the feet row, so grounding is unaffected.
 *
 * Returns the identity transform while measuring, for floating symbols, and
 * for slugs without art.
 */
export function useGroundedTransform(
  slug: string,
  enabled: boolean,
  opts: GroundedOpts,
): GroundedTransform {
  const { boxTop, boxW, boxH, podiumY, targetVisibleH } = opts
  const minScale = opts.minScale ?? 0.5
  const maxScale = opts.maxScale ?? 2.2
  const [transform, setTransform] = useState<GroundedTransform>(IDENTITY_TRANSFORM)

  useEffect(() => {
    setTransform(IDENTITY_TRANSFORM)
    if (!enabled || !GROUNDED_SLUGS.has(slug)) return
    let alive = true
    const measure = measureAlphaBounds(frameUrl(slug, 1)).then(
      (b) => b ?? measureAlphaBounds(staticUrlFor(slug)),
    )
    void measure.then((bounds) => {
      if (!alive || bounds === null) return
      const fit = Math.min(boxW / bounds.naturalWidth, boxH / bounds.naturalHeight)
      const renderedH = bounds.naturalHeight * fit
      const offsetY = (boxH - renderedH) / 2 // contain letterbox
      // Element-local feet row (before any transform); scale pivots here so the
      // feet stay put, so dy is the same whatever the scale is.
      const feetLocal = offsetY + bounds.bottomFrac * renderedH
      const visibleH = (bounds.bottomFrac - bounds.topFrac) * renderedH
      const scale =
        visibleH > 1 ? Math.max(minScale, Math.min(maxScale, targetVisibleH / visibleH)) : 1
      // Sanity clamp — a wild bbox (bad art) must never fling the subject.
      // 160 used to clip the banyan (its true drop is 161), so the ceiling is
      // 200: still far short of anything that could look like a glitch.
      const dy = Math.max(-120, Math.min(200, podiumY - (boxTop + feetLocal)))
      setTransform({ dy, scale, originY: feetLocal })
    })
    return () => {
      alive = false
    }
  }, [slug, enabled, boxTop, boxW, boxH, podiumY, targetVisibleH, minScale, maxScale])

  return transform
}

/** Live media facts for one symbol slug. */
export function useSymbolMedia(slug: string): SymbolMedia {
  const [state, setState] = useState<({ slug: string } & Discovered) | null>(null)

  useEffect(() => {
    let alive = true
    void discoverCached(slug).then((found) => {
      if (alive) setState({ slug, ...found })
    })
    return () => {
      alive = false
    }
  }, [slug])

  const settled = state !== null && state.slug === slug
  return {
    ready: settled,
    frameCount: settled ? state.frameCount : 0,
    hasStatic: settled ? state.hasStatic : false,
    staticUrl: staticUrlFor(slug),
    srcPattern: patternFor(slug),
    dykImages: settled ? state.dykImages : [],
  }
}
