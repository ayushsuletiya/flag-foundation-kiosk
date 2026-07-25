/**
 * historyAssets — runtime discovery of per-year media under
 * assets/2-history-of-tiranga/<year>/{background,flag,gallery}/.
 *
 * Media is user-dropped loose files (not bundled), so the app cannot import
 * or list them; instead we probe a fixed candidate set:
 *   background/bg.mp4          → main-screen background video (wins)
 *   background/bg-1..bg-5.png  → background image (2+ = crossfade)
 *   flag/year-flag.png         → small flag beside the year numeral (preferred)
 *   flag/flag.png              → alternate flag artwork name
 *   gallery/gallery-1..24.png  → Know More gallery images (thumbs scroll)
 * Local files only — the offline kiosk never fetches media from the web;
 * missing files render the styled placeholder until the client drops them in.
 *
 * A failed probe is just a 404/onerror — silent, cheap, and works identically
 * under vite dev (HTTP) and the packaged Electron build (file://).
 */
import { useEffect, useMemo, useState } from 'react'

import { HISTORY_BASE } from '../../assets/paths.ts'
import { probeImageCached, probeVideoCached } from '../../assets/probe.ts'

const BG_CANDIDATES = 5
/** Gallery is flexible — drop gallery-1..gallery-24.png, thumbs scroll. */
const GALLERY_CANDIDATES = 24

export interface HistoryYearAssets {
  /** False while probes are still in flight (render nothing bg-wise yet). */
  ready: boolean
  /** background/bg.mp4 when present — wins over the image backgrounds. */
  backgroundVideo: string | null
  /** Background images that actually exist, in bg-1..bg-N order (or bg.png). */
  backgrounds: string[]
  /** Small flag for the year hero (year-flag.png > flag.png > Excel URL). */
  yearFlag: string | null
  /** Know More gallery images; falls back to the official flag; may be []. */
  gallery: string[]
}

async function probeAll(urls: string[]): Promise<string[]> {
  const flags = await Promise.all(urls.map(probeImageCached))
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
      backgroundVideo: `${dir}/background/bg.mp4`,
      backgroundSingle: `${dir}/background/bg.png`,
      backgrounds: Array.from(
        { length: BG_CANDIDATES },
        (_, i) => `${dir}/background/bg-${i + 1}.png`,
      ),
      flags: [`${dir}/flag/year-flag.png`, `${dir}/flag/flag.png`],
      gallery: Array.from(
        { length: GALLERY_CANDIDATES },
        (_, i) => `${dir}/gallery/gallery-${i + 1}.png`,
      ),
    }
  }, [year])

  useEffect(() => {
    if (candidates === null) return
    let alive = true
    void (async () => {
      // Critical path for the MAIN screen (background + flag): the era-jump warp
      // and the backdrop CANNOT wait on the 24 gallery probes — each one fully
      // LOADS an image (probe.ts), so gating `ready` on them held the warp back
      // by up to seconds (user 2026-07-25: "delay to start the animation").
      // The gallery is only needed on Know More, so it resolves OFF this path
      // and is merged in a second publish.
      const [hasVideo, hasSingle, backgrounds, flags] = await Promise.all([
        probeVideoCached(candidates.backgroundVideo),
        probeImageCached(candidates.backgroundSingle),
        probeAll(candidates.backgrounds),
        probeAll(candidates.flags),
      ])
      if (!alive) return
      if (backgrounds.length === 0 && hasSingle) backgrounds.push(candidates.backgroundSingle)
      // The year's official flag artwork LEADS the gallery (flag.png >
      // year-flag), photos follow — so every era opens on its flag.
      const officialFirst = [...flags].sort(
        (a, b) => Number(a.endsWith('/year-flag.png')) - Number(b.endsWith('/year-flag.png')),
      )
      const officialGallery = officialFirst.slice(0, 1)
      const base: HistoryYearAssets = {
        ready: true,
        backgroundVideo: hasVideo ? candidates.backgroundVideo : null,
        backgrounds,
        yearFlag: flags[0] ?? null,
        gallery: officialGallery,
      }
      setState({ key, assets: base })
      // Second pass — the Know More gallery, merged in once its probes settle.
      const gallery = await probeAll(candidates.gallery)
      if (!alive) return
      setState({ key, assets: { ...base, gallery: [...officialGallery, ...gallery] } })
    })()
    return () => {
      alive = false
    }
  }, [candidates, key])

  if (state !== null && state.key === key) return state.assets
  return { ready: false, backgroundVideo: null, backgrounds: [], yearFlag: null, gallery: [] }
}
