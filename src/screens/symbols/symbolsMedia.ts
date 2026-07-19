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
