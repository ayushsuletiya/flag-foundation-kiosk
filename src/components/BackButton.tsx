/**
 * BackButton — glass-brown nav capsule with circled left-arrow.
 *
 * Audit (e.g. at 1351,38 on detail screens): same capsule as HomeButton —
 * 125x86, radius 140, bg rgba(79,48,23,0.42), border 1px solid #FFFFFF —
 * with a circled back arrow ~48.6px (fi_93634 — placeholder inline SVG for now).
 */
import type { CSSProperties } from 'react'
import { CircledArrowLeftIcon } from './icons.tsx'

export interface BackButtonProps {
  onClick?: () => void
  className?: string
  style?: CSSProperties
}

export function BackButton({ onClick, className, style }: BackButtonProps) {
  return (
    <button
      type="button"
      aria-label="Back"
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
      <CircledArrowLeftIcon size={48.6} color="#FFFFFF" />
    </button>
  )
}
