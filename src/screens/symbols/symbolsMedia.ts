/**
 * symbolsMedia — runtime discovery of per-symbol turntable media under
 * assets/4-national-symbols/turntables/<slug>/:
 *
 *   f_0001.png … f_NNNN.png → PNG-sequence turntable (25fps loop)
 *   static.png              → poster / fallback still
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

export const SYMBOL_SEQUENCE_BASE = SYMBOLS.turntables
const MAX_FRAMES = 1024

export interface SymbolMedia {
  /** False while probes are in flight — render nothing (no flash of fallback). */
  ready: boolean
  /** Numbered turntable frames found; 0 = none yet (poster only). */
  frameCount: number
  hasStatic: boolean
  staticUrl: string
  /** PngSequencePlayer pattern, e.g. "…/turntables/tiger/f_{frame}.png". */
  srcPattern: string
}

function staticUrlFor(slug: string): string {
  return `${SYMBOL_SEQUENCE_BASE}/${slug}/static.png`
}

function patternFor(slug: string): string {
  return `${SYMBOL_SEQUENCE_BASE}/${slug}/f_{frame}.png`
}

function frameUrl(slug: string, frame: number): string {
  return `${SYMBOL_SEQUENCE_BASE}/${slug}/f_${String(frame).padStart(4, '0')}.png`
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

async function discover(slug: string): Promise<{ frameCount: number; hasStatic: boolean }> {
  const [hasStatic, hasFirst] = await Promise.all([
    probe(staticUrlFor(slug)),
    probe(frameUrl(slug, 1)),
  ])
  if (!hasFirst) return { frameCount: 0, hasStatic }

  // Exponential grow to bracket the last frame, then binary search inside.
  let lo = 1 // highest frame known to exist
  let hi = 2 // lowest frame known missing (once the loop exits)
  while (hi <= MAX_FRAMES && (await probe(frameUrl(slug, hi)))) {
    lo = hi
    hi *= 2
  }
  if (hi > MAX_FRAMES) return { frameCount: MAX_FRAMES, hasStatic }
  while (lo + 1 < hi) {
    const mid = (lo + hi) >> 1
    if (await probe(frameUrl(slug, mid))) lo = mid
    else hi = mid
  }
  return { frameCount: lo, hasStatic }
}

const mediaCache = new Map<string, Promise<{ frameCount: number; hasStatic: boolean }>>()

function discoverCached(slug: string): Promise<{ frameCount: number; hasStatic: boolean }> {
  let hit = mediaCache.get(slug)
  if (hit === undefined) {
    hit = discover(slug)
    mediaCache.set(slug, hit)
  }
  return hit
}

/** Live media facts for one symbol slug. */
export function useSymbolMedia(slug: string): SymbolMedia {
  const [state, setState] = useState<{ slug: string; frameCount: number; hasStatic: boolean } | null>(
    null,
  )

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
  }
}
