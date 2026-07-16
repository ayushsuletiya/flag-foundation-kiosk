/**
 * HomeButton — glass-brown nav capsule with house icon.
 *
 * Audit (nodes 795:7704 etc., at 1491,36 on 8+ frames):
 * 125x86 capsule, radius 140, bg rgba(79,48,23,0.42), border 1px solid #FFFFFF,
 * house icon 50.458x50.458 centered (fi_2549900 — placeholder inline SVG for now).
 */
import type { CSSProperties } from 'react'
import { HouseIcon } from './icons.tsx'

export interface HomeButtonProps {
  onClick?: () => void
  className?: string
  style?: CSSProperties
}

export function HomeButton({ onClick, className, style }: HomeButtonProps) {
  return (
    <button
      type="button"
      aria-label="Home"
      onClick={onClick}
      className={className ? `glass-nav ${className}` : 'glass-nav'}
      style={{
        width: 125,
        height: 86,
        borderRadius: 'var(--radius-nav-circle)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        ...style,
      }}
    >
      <HouseIcon size={50.458} color="#FFFFFF" />
    </button>
  )
}
