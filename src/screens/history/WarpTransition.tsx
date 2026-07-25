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
  onDone,
}: {
  fromUrl: string
  toUrl: string
  onDone: () => void
}) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const onDoneRef = useRef(onDone)
  onDoneRef.current = onDone

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
        const t0 = performance.now()
        const loop = (now: number) => {
          const elapsed = now - t0
          const p = Math.min(1, elapsed / WARP_MS)
          // Accelerate in, brake out — a smooth cinematic bell (0→peak→0).
          const bell = Math.sin(Math.PI * p)
          const speed = bell * bell // eased shoulders — gentler start/land
          const flash = Math.pow(bell, 3) * 0.85 // a brief warm bloom at the cut
          // Crossfade the two eras through the fast middle of the pass.
          const progress = p < 0.22 ? 0 : p > 0.78 ? 1 : (p - 0.22) / 0.56
          gl!.render(progress, speed, flash, elapsed / 1000)
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
