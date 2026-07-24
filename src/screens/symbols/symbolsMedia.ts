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
const MAX_FRAMES = 1024
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

/**
 * Vertical offset (px) that drops a grounded symbol's VISIBLE bottom edge
 * onto the podium top. The artwork renders `object-fit: contain` inside a
 * box at `boxTop` with size `boxW`x`boxH`; transparent padding differs per
 * artwork, so the alpha bbox of static.png decides where the feet really
 * are. Returns 0 while measuring, for floating symbols, and for slugs
 * without art.
 */
export function useGroundedOffset(
  slug: string,
  enabled: boolean,
  boxTop: number,
  boxW: number,
  boxH: number,
  podiumY: number,
): number {
  const [offset, setOffset] = useState(0)

  useEffect(() => {
    setOffset(0)
    if (!enabled || !GROUNDED_SLUGS.has(slug)) return
    let alive = true
    // Measure what is actually ON SCREEN — the TURNTABLE FRAME, not the
    // poster. Every grounded slug ships both, and for the tiger and the
    // peacock the poster is a different render (1122x1402, tighter padding)
    // than the frames (460x818): grounding off the poster dropped them ~40px
    // when the playing frames needed ~90-120, so they stood in mid-air above
    // the podium (user 2026-07-24, peacock screenshot). static.png stays as
    // the fallback for any slug that has no frames. The silhouette bottom is
    // constant across a turntable (≤2.2px over 107 frames), so frame 1 is a
    // valid stand-in for the whole loop.
    const measure = measureAlphaBounds(frameUrl(slug, 1)).then(
      (b) => b ?? measureAlphaBounds(staticUrlFor(slug)),
    )
    void measure.then((bounds) => {
      if (!alive || bounds === null) return
      const scale = Math.min(boxW / bounds.naturalWidth, boxH / bounds.naturalHeight)
      const renderedH = bounds.naturalHeight * scale
      const offsetY = (boxH - renderedH) / 2 // contain letterbox
      const visibleBottom = boxTop + offsetY + bounds.bottomFrac * renderedH
      const dy = podiumY - visibleBottom
      // Sanity clamp — a wild bbox (bad art) must never fling the subject.
      // 160 used to clip the banyan (its true drop is 161), so the ceiling is
      // 200: still far short of anything that could look like a glitch.
      setOffset(Math.max(-120, Math.min(200, dy)))
    })
    return () => {
      alive = false
    }
  }, [slug, enabled, boxTop, boxW, boxH, podiumY])

  return offset
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
