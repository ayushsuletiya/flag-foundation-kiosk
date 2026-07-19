/**
 * PngSequencePlayer — canvas player for numbered PNG frame sequences
 * (flag markers, symbol turntables: <folder>/f_0001.png… numbered frames).
 *
 * All frames are preloaded as HTMLImageElements, then drawn to a <canvas>
 * on a requestAnimationFrame clock locked to `fps`. Degrades gracefully:
 *  - while loading, the poster shows underneath;
 *  - individual missing frames are skipped (nearest earlier frame stays up);
 *  - if the whole sequence is missing, the poster (or a quiet placeholder)
 *    renders instead — no crash, no broken images.
 */
import { useEffect, useRef, useState, type CSSProperties } from 'react'

export interface PngSequencePlayerProps {
  /**
   * Frame URL pattern; `{frame}` is replaced with the zero-padded frame
   * number, e.g. "…/turntables/tiger/f_{frame}.png" → f_0001.png.
   */
  srcPattern: string
  frameCount: number
  fps?: number
  loop?: boolean
  /** Number of the first frame in the files (default 1 → f_0001). */
  startFrame?: number
  /** Zero-pad width of the frame number (default 4 → 0001). */
  padWidth?: number
  poster?: string
  width: number
  height: number
  playing?: boolean
  /**
   * How frames (and the poster) map onto the width×height box:
   * 'stretch' (default, original behavior), 'cover' (center-crop), or
   * 'contain' (letterbox on the transparent canvas).
   */
  fit?: 'stretch' | 'cover' | 'contain'
  className?: string
  style?: CSSProperties
}

type LoadStatus = 'loading' | 'ready' | 'failed'

function frameUrl(pattern: string, frame: number, padWidth: number): string {
  return pattern.replace('{frame}', String(frame).padStart(padWidth, '0'))
}

export function PngSequencePlayer({
  srcPattern,
  frameCount,
  fps = 30,
  loop = true,
  startFrame = 1,
  padWidth = 4,
  poster,
  width,
  height,
  playing = true,
  fit = 'stretch',
  className,
  style,
}: PngSequencePlayerProps) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const framesRef = useRef<(HTMLImageElement | null)[]>([])
  const [status, setStatus] = useState<LoadStatus>('loading')

  // Preload every frame; first successful load flips to 'ready',
  // all-failed flips to 'failed'.
  useEffect(() => {
    let cancelled = false
    const frames: (HTMLImageElement | null)[] = new Array<HTMLImageElement | null>(
      Math.max(0, frameCount),
    ).fill(null)
    framesRef.current = frames
    setStatus('loading')

    if (frameCount <= 0) {
      setStatus('failed')
      return
    }

    let settled = 0
    let loaded = 0
    const onSettle = () => {
      settled += 1
      if (settled === frameCount && loaded === 0) setStatus('failed')
    }

    for (let i = 0; i < frameCount; i++) {
      const img = new Image()
      img.onload = () => {
        if (cancelled) return
        frames[i] = img
        loaded += 1
        if (loaded === 1) setStatus('ready')
        onSettle()
      }
      img.onerror = () => {
        if (cancelled) return
        onSettle()
      }
      img.src = frameUrl(srcPattern, startFrame + i, padWidth)
    }

    return () => {
      cancelled = true
      framesRef.current = []
    }
  }, [srcPattern, frameCount, startFrame, padWidth])

  // rAF draw clock.
  useEffect(() => {
    if (status !== 'ready') return
    const canvas = canvasRef.current
    if (canvas === null) return
    const ctx = canvas.getContext('2d')
    if (ctx === null) return

    /** Draw frame `idx`, falling back to the nearest earlier loaded frame. */
    const draw = (idx: number): void => {
      let img: HTMLImageElement | null = null
      for (let k = idx; k >= 0 && img === null; k--) {
        img = framesRef.current[k] ?? null
      }
      if (img === null) return
      ctx.clearRect(0, 0, width, height)
      if (fit === 'stretch') {
        ctx.drawImage(img, 0, 0, width, height)
      } else if (fit === 'cover') {
        // Center-crop the source so the box is filled without distortion.
        const scale = Math.max(width / img.naturalWidth, height / img.naturalHeight)
        const sw = width / scale
        const sh = height / scale
        ctx.drawImage(
          img,
          (img.naturalWidth - sw) / 2,
          (img.naturalHeight - sh) / 2,
          sw,
          sh,
          0,
          0,
          width,
          height,
        )
      } else {
        // 'contain' — letterbox on the transparent canvas.
        const scale = Math.min(width / img.naturalWidth, height / img.naturalHeight)
        const dw = img.naturalWidth * scale
        const dh = img.naturalHeight * scale
        ctx.drawImage(img, (width - dw) / 2, (height - dh) / 2, dw, dh)
      }
    }

    if (!playing) {
      draw(0)
      return
    }

    let raf = 0
    let startTime: number | null = null
    let lastDrawn = -1
    const step = (t: number) => {
      if (startTime === null) startTime = t
      const elapsed = (t - startTime) / 1000
      let idx = Math.floor(elapsed * fps)
      idx = loop ? idx % frameCount : Math.min(idx, frameCount - 1)
      if (idx !== lastDrawn) {
        draw(idx)
        lastDrawn = idx
      }
      if (!loop && idx >= frameCount - 1) return // hold last frame
      raf = requestAnimationFrame(step)
    }
    raf = requestAnimationFrame(step)
    return () => cancelAnimationFrame(raf)
  }, [status, playing, fps, loop, frameCount, width, height, fit])

  const boxStyle: CSSProperties = { position: 'relative', width, height, ...style }
  const posterFit = fit === 'stretch' ? 'fill' : fit

  if (status === 'failed') {
    return poster !== undefined ? (
      <img
        src={poster}
        alt=""
        width={width}
        height={height}
        className={className}
        style={{ objectFit: posterFit, ...style }}
      />
    ) : (
      <div className={className} style={{ ...boxStyle, background: 'rgba(255, 255, 255, 0.05)' }} />
    )
  }

  return (
    <div className={className} style={boxStyle}>
      {poster !== undefined && status === 'loading' && (
        <img
          src={poster}
          alt=""
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: posterFit,
          }}
        />
      )}
      <canvas ref={canvasRef} width={width} height={height} style={{ position: 'absolute', inset: 0 }} />
    </div>
  )
}
