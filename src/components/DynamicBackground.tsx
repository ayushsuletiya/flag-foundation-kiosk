/**
 * DynamicBackground — one drop-in rule for every section background.
 *
 * Given a folder (e.g. assets/3-ashok-chakra/background), resolves in order:
 *   1. bg.mp4              → muted looping video (poster.png under it if present)
 *   2. bg-1..bg-5.png      → static image, or 2.5s crossfade when 2+ exist
 *   3. bg.png              → static image
 *   4. nothing             → the `fallback` node (styled placeholder), never
 *                            a broken-media glyph
 *
 * So the client can drop EITHER a PNG or an MP4 into any background folder of
 * any category and the app just uses it — no code changes, no renames beyond
 * the bg.* convention. Perf guard: at most one background video renders per
 * screen (mp4 wins INSTEAD of the images, never alongside them).
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'
import { probeImageCached, probeVideoCached } from '../assets/probe'
import { VideoLoop } from './VideoLoop'

const NUMBERED_CANDIDATES = 5
const CROSSFADE_HOLD_MS = 2500

export interface DynamicBackgroundSources {
  /** False while probes are in flight — render nothing yet (no flash). */
  ready: boolean
  video: string | null
  poster: string | null
  images: string[]
}

export function useDynamicBackground(base: string): DynamicBackgroundSources {
  const [sources, setSources] = useState<DynamicBackgroundSources>({
    ready: false,
    video: null,
    poster: null,
    images: [],
  })

  useEffect(() => {
    let alive = true
    setSources({ ready: false, video: null, poster: null, images: [] })
    void (async () => {
      const numberedUrls = Array.from(
        { length: NUMBERED_CANDIDATES },
        (_, i) => `${base}/bg-${i + 1}.png`,
      )
      const [video, poster, single, ...numbered] = await Promise.all([
        probeVideoCached(`${base}/bg.mp4`),
        probeImageCached(`${base}/poster.png`),
        probeImageCached(`${base}/bg.png`),
        ...numberedUrls.map(probeImageCached),
      ])
      if (!alive) return
      const images = numberedUrls.filter((_, i) => numbered[i])
      if (images.length === 0 && single) images.push(`${base}/bg.png`)
      setSources({
        ready: true,
        video: video ? `${base}/bg.mp4` : null,
        poster: poster ? `${base}/poster.png` : null,
        images,
      })
    })()
    return () => {
      alive = false
    }
  }, [base])

  return sources
}

/** Stacked <img> crossfade — 2.5s hold, opacity ramp via CSS transition. */
function CrossfadeLoop({
  images,
  objectFit,
}: {
  images: string[]
  objectFit: CSSProperties['objectFit']
}) {
  const [active, setActive] = useState(0)

  useEffect(() => {
    setActive(0)
    if (images.length < 2) return
    const timer = setInterval(() => {
      setActive((i) => (i + 1) % images.length)
    }, CROSSFADE_HOLD_MS)
    return () => clearInterval(timer)
  }, [images])

  return (
    <div style={{ position: 'absolute', inset: 0 }}>
      {images.map((src, i) => (
        <img
          key={src}
          src={src}
          alt=""
          draggable={false}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit,
            opacity: i === active ? 1 : 0,
            transition: 'opacity 900ms ease',
          }}
        />
      ))}
    </div>
  )
}

export interface DynamicBackgroundProps {
  /** Folder holding bg.mp4 / bg.png / bg-N.png (see module comment). */
  base: string
  objectFit?: CSSProperties['objectFit']
  /** Rendered when the folder holds no usable media (after probing). */
  fallback?: ReactNode
  className?: string
  style?: CSSProperties
  /**
   * Fade the resolved media in over 600ms (`.dbg-enter`). Default true — it
   * hides the pop when probing/decoding land after the route transition. Set
   * FALSE when the media is pre-warmed and must paint on the first frame: the
   * fade-from-transparent over a dark base otherwise reads as a black dip on
   * entry (user report: chakra page — its bg is warmed in App.tsx WarmChakra).
   */
  fadeIn?: boolean
}

export function DynamicBackground({
  base,
  objectFit = 'cover',
  fallback = null,
  className,
  style,
  fadeIn = true,
}: DynamicBackgroundProps) {
  const sources = useDynamicBackground(base)

  if (!sources.ready) return null

  // Whatever resolves, ease it in: probing + (on cold visits) media decode
  // land AFTER the route transition has finished, so an unfaded mount reads
  // as the screen "popping" out of black (user report: chakra page). When the
  // media is pre-warmed (fadeIn=false) we skip the fade so it paints instantly.
  const enter = (media: ReactNode) =>
    fadeIn ? (
      <div className="dbg-enter" style={{ position: 'absolute', inset: 0 }}>
        {media}
      </div>
    ) : (
      <div style={{ position: 'absolute', inset: 0 }}>{media}</div>
    )

  if (sources.video !== null) {
    return enter(
      <VideoLoop
        src={sources.video}
        poster={sources.poster ?? sources.images[0]}
        objectFit={objectFit}
        className={className}
        style={style}
      />,
    )
  }
  if (sources.images.length >= 2) {
    return enter(<CrossfadeLoop images={sources.images} objectFit={objectFit} />)
  }
  const only = sources.images[0]
  if (only !== undefined) {
    return enter(
      <img
        src={only}
        alt=""
        draggable={false}
        className={className}
        style={{ width: '100%', height: '100%', objectFit, ...style }}
      />,
    )
  }
  return <>{fallback}</>
}
