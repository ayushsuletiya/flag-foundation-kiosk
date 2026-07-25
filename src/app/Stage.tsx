/**
 * Stage — the fixed 1920x1080 Figma coordinate system.
 *
 * Every screen positions children in literal Figma pixels inside this surface.
 * The stage is CSS-transform scaled to fit the real window (letterboxed on
 * mismatched aspect ratios, black bars from #root's background), so dev on a
 * laptop previews correctly. On the kiosk panel (exactly 1920x1080) the scale
 * factor computes to 1 and the transform is identity — true 1:1 pixels.
 */
import { useEffect, useState, type CSSProperties, type ReactNode } from 'react'

export const STAGE_WIDTH = 1920
export const STAGE_HEIGHT = 1080

interface StageFit {
  scale: number
  /** Letterbox offsets in window px, rounded for crisp pixel alignment. */
  left: number
  top: number
}

function computeFit(): StageFit {
  const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT)
  return {
    scale,
    left: Math.round((window.innerWidth - STAGE_WIDTH * scale) / 2),
    top: Math.round((window.innerHeight - STAGE_HEIGHT * scale) / 2),
  }
}

export function Stage({ children }: { children: ReactNode }) {
  const [fit, setFit] = useState<StageFit>(computeFit)

  useEffect(() => {
    const onResize = () => setFit(computeFit())
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [])

  const style: CSSProperties = {
    position: 'absolute',
    left: fit.left,
    top: fit.top,
    width: STAGE_WIDTH,
    height: STAGE_HEIGHT,
    transform: fit.scale === 1 ? undefined : `scale(${fit.scale})`,
    transformOrigin: 'top left',
    overflow: 'hidden',
    // Warm-dark, NOT #000 — this shows in any gap between a screen leaving and
    // the next painting (e.g. the home tap hand-off). Pure black here read as a
    // black flash on every navigation (user 2026-07-25).
    background: '#2a1a0e',
  }

  return <div style={style}>{children}</div>
}
