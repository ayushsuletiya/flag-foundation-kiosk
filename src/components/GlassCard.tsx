/**
 * GlassCard — frosted glass panel (Figma GLASS effect approximation).
 *
 * The surface recipes live in styles/tokens.css (.glass / .glass--*):
 * backdrop-filter blur(4px) saturate(165%), exact Figma tint + white
 * 12%→4% falloff gradient, rim stroke, inset top highlight, soft drop.
 * Ground truth: plugin extraction of the GLASS effect params (blur 4,
 * refraction .8, depth 20, light -45° @ .8, dispersion .5).
 *
 * PERF: backdrop-filter is panel-scale only — never mount a GlassCard
 * inside another glass surface without passing blur={0}.
 */
import type { CSSProperties, ReactNode } from 'react'

export type GlassVariant = 'warm' | 'navy' | 'clear'

export interface GlassCardProps {
  children?: ReactNode
  /** Corner radius, px. Figma band is 14-16 (symbol detail cards 20). */
  radius?: number
  /**
   * Backdrop blur override, px. Omit for the variant default (Figma 4px).
   * 0 disables the filter (use inside another glass surface).
   */
  blur?: number
  /** Tint variant: warm (History/Monumental, default), navy (Symbols), clear. */
  variant?: GlassVariant
  className?: string
  style?: CSSProperties
}

export function GlassCard({
  children,
  radius = 16,
  blur,
  variant = 'warm',
  className,
  style,
}: GlassCardProps) {
  const backdrop =
    blur === undefined ? undefined : blur > 0 ? `blur(${blur}px) saturate(165%)` : 'none'
  const cls = ['glass', variant !== 'warm' ? `glass--${variant}` : null, className]
    .filter(Boolean)
    .join(' ')
  return (
    <div
      className={cls}
      style={{
        borderRadius: radius,
        ...(backdrop !== undefined
          ? { backdropFilter: backdrop, WebkitBackdropFilter: backdrop }
          : null),
        ...style,
      }}
    >
      {children}
    </div>
  )
}
