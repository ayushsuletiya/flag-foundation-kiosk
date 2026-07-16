/**
 * historyAssets — runtime discovery of per-year media under
 * assets/images/history/<year>/.
 *
 * Media is user-dropped loose files (not bundled), so the app cannot import
 * or list them; instead we probe a fixed candidate set with Image() loads:
 *   bg-1..bg-5.png      → main-screen background (1 = static, 2+ = crossfade)
 *   year-flag.png       → small flag beside the year numeral (preferred)
 *   flag.png            → alternate flag artwork name
 *   gallery-1..6.png    → Know More gallery images
 * Local files only — the offline kiosk never fetches media from the web;
 * missing files render the styled placeholder until the client drops them in.
 *
 * A failed probe is just a 404/onerror — silent, cheap, and works identically
 * under vite dev (HTTP) and the packaged Electron build (file://).
 */
import { useEffect, useMemo, useState } from 'react'

const HISTORY_BASE = 'assets/images/history'

const BG_CANDIDATES = 5
const GALLERY_CANDIDATES = 6

export interface HistoryYearAssets {
  /** False while probes are still in flight (render nothing bg-wise yet). */
  ready: boolean
  /** Backgrounds that actually exist, in bg-1..bg-N order. */
  backgrounds: string[]
  /** Small flag for the year hero (year-flag.png > flag.png > Excel URL). */
  yearFlag: string | null
  /** Know More gallery images; falls back to the official flag; may be []. */
  gallery: string[]
}

/** Probe one URL; resolves true when the browser can decode it as an image. */
function probe(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

/**
 * Probe a candidate list, resolving to the subset that loaded (order kept).
 * Results are memoised per URL for the app's lifetime — kiosk assets are
 * immutable at runtime, so re-probing on every year switch is waste.
 */
const probeCache = new Map<string, Promise<boolean>>()

function probeCached(url: string): Promise<boolean> {
  let hit = probeCache.get(url)
  if (hit === undefined) {
    hit = probe(url)
    probeCache.set(url, hit)
  }
  return hit
}

async function probeAll(urls: string[]): Promise<string[]> {
  const flags = await Promise.all(urls.map(probeCached))
  return urls.filter((_, i) => flags[i] === true)
}

/** All media for one history year, discovered from local files only. */
export function useHistoryYearAssets(year: string | null): HistoryYearAssets {
  const [state, setState] = useState<{ key: string; assets: HistoryYearAssets } | null>(null)

  const key = year ?? ''

  const candidates = useMemo(() => {
    if (year === null) return null
    const dir = `${HISTORY_BASE}/${year}`
    return {
      dir,
      backgrounds: Array.from({ length: BG_CANDIDATES }, (_, i) => `${dir}/bg-${i + 1}.png`),
      flags: [`${dir}/year-flag.png`, `${dir}/flag.png`],
      gallery: Array.from({ length: GALLERY_CANDIDATES }, (_, i) => `${dir}/gallery-${i + 1}.png`)
        // 1947 gallery-2.png is a byte-duplicate of gallery-1.png (Figma image
        // fill dedupe) — showing both would render twin thumbnails.
        .filter((url) => !(year === '1947' && url.endsWith('/gallery-2.png'))),
    }
  }, [year])

  useEffect(() => {
    if (candidates === null) return
    let alive = true
    void (async () => {
      const [backgrounds, flags, gallery] = await Promise.all([
        probeAll(candidates.backgrounds),
        probeAll(candidates.flags),
        probeAll(candidates.gallery),
      ])
      if (!alive) return
      // Official artwork first for the gallery fallback (flag.png > year-flag).
      const officialFirst = [...flags].sort(
        (a, b) => Number(a.endsWith('/year-flag.png')) - Number(b.endsWith('/year-flag.png')),
      )
      setState({
        key,
        assets: {
          ready: true,
          backgrounds,
          yearFlag: flags[0] ?? null,
          gallery: gallery.length > 0 ? gallery : officialFirst.slice(0, 1),
        },
      })
    })()
    return () => {
      alive = false
    }
  }, [candidates, key])

  if (state !== null && state.key === key) return state.assets
  return { ready: false, backgrounds: [], yearFlag: null, gallery: [] }
}
