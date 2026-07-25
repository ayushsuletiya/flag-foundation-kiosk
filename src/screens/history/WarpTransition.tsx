/**
 * WarpTransition — plays the one-shot WebGL "fast-forward through the timeline"
 * pass (warpGL) on a canvas laid over the year background, then calls onDone so
 * the parent can drop it. Lazy-imports the three.js chunk; if WebGL or a
 * texture fails it just calls onDone immediately (the new bg is already painted
 * underneath, so the jump degrades to a clean cut).
 */
import { useEffect, useRef } from 'react'
import type { WarpGL } from './warpGL.ts'

const WARP_MS = 1050

export function WarpTransition({
  fromUrl,
  toUrl,
  onReveal,
  onDone,
}: {
  fromUrl: string
  toUrl: string
  /** Fired once, late in the pass (just before the tail dissolve), so the parent
   * can swap the DOM backdrop to the NEW era UNDER the still-opaque warp — the
   * dissolve then lands straight on it and the photo never precedes the effect. */
  onReveal?: () => void
  onDone: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone
  const onRevealRef = useRef(onReveal)
  onRevealRef.current = onReveal

  useEffect(() => {
    let alive = true
    let gl: WarpGL | null = null
    let raf = 0
    const finish = () => {
      if (!alive) return
      alive = false
      onDoneRef.current()
    }
    void import('./warpGL.ts')
      .then(({ createWarpGL }) => {
        if (!alive || canvasRef.current === null) return null
        return createWarpGL(canvasRef.current, fromUrl, toUrl)
      })
      .then((made) => {
        if (made === null || made === undefined) {
          finish()
          return
        }
        if (!alive) {
          made.dispose()
          return
        }
        gl = made
        let t0 = 0
        let revealed = false
        const loop = (now: number) => {
          if (t0 === 0) t0 = now // clock starts on the first PAINTED frame
          const elapsed = now - t0
          const p = Math.min(1, elapsed / WARP_MS)
          // Accelerate in, brake out — a smooth cinematic bell (0→peak→0).
          const bell = Math.sin(Math.PI * p)
          const speed = bell * bell // eased shoulders — gentler start/land
          const flash = Math.pow(bell, 3) * 0.85 // a brief warm bloom at the cut
          // Crossfade the two eras through the fast middle of the pass.
          const progress = p < 0.22 ? 0 : p > 0.78 ? 1 : (p - 0.22) / 0.56
          gl!.render(progress, speed, flash, elapsed / 1000)
          // Late in the pass — crossfade already on the new era, warp still fully
          // opaque — tell the parent to swap the DOM backdrop to the new photo
          // underneath us, so the coming dissolve reveals IT (not the old bg) and
          // the photo never appears before the effect.
          if (!revealed && p >= 0.62) {
            revealed = true
            onRevealRef.current?.()
          }
          // Dissolve the canvas into the crisp DOM background over the tail so
          // the soft (720p) / vignetted / grainy final frame doesn't SNAP off
          // when we unmount (user 2026-07-25: flicker at the end). The new bg is
          // painted underneath by now (revealed just above), so fading to it is
          // seamless.
          const c = canvasRef.current
          if (c !== null) c.style.opacity = p < 0.82 ? '1' : String(Math.max(0, (1 - p) / 0.18))
          if (p < 1 && alive) raf = requestAnimationFrame(loop)
          else finish()
        }
        raf = requestAnimationFrame(loop)
      })
      .catch(finish)
    return () => {
      alive = false
      cancelAnimationFrame(raf)
      gl?.dispose()
    }
  }, [fromUrl, toUrl])

  return (
    <canvas ref={canvasRef} className="hy-warp-canvas" width={1920} height={1080} aria-hidden="true" />
  )
}
