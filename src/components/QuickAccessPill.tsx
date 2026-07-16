/**
 * QuickAccessPill — shared nav pill, top-right of every category screen.
 *
 * Audit (identical on 8+ frames, e.g. node 795:4289 at 1626,36):
 * 253x86, radius 60, bg #FFDFC4, stroke 2px inside rimGrad
 * (linear-gradient(180deg,#FFF8DB,#E7B87A) — painted via the
 * padding-box/border-box background trick, since border-image
 * can't follow a border-radius), label Poppins SemiBold 28.114px #171001.
 *
 * Default behavior: opens the global Quick Access overlay (context from
 * QuickAccessProvider) — pass onClick only to override that.
 */
import type { CSSProperties } from 'react'
import { useQuickAccess } from './QuickAccessOverlay.tsx'

export interface QuickAccessPillProps {
  label?: string
  onClick?: () => void
  className?: string
  style?: CSSProperties
}

export function QuickAccessPill({
  label = 'Quick Access',
  onClick,
  className,
  style,
}: QuickAccessPillProps) {
  const quickAccess = useQuickAccess()
  return (
    <button
      type="button"
      onClick={onClick ?? quickAccess.open}
      className={className}
      style={{
        width: 253,
        height: 86,
        borderRadius: 'var(--radius-quick-access)',
        background:
          'linear-gradient(var(--quick-access-bg), var(--quick-access-bg)) padding-box, var(--rim-gradient) border-box',
        border: '2px solid transparent',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontFamily: 'var(--font-ui)',
        fontWeight: 600,
        fontSize: 28.114,
        color: 'var(--quick-access-text)',
        cursor: 'pointer',
        ...style,
      }}
    >
      {label}
    </button>
  )
}
