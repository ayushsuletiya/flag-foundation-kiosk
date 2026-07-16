/**
 * PaginationDots — carousel page indicator.
 *
 * Audit (National Symbols carousel, 620,764 47x8): 8px circles at 13px pitch
 * (5px gap); inactive #FFFFFF, active the signature gold gradient. Counts are
 * content-driven, so this renders live state rather than the flattened Figma PNG.
 */
import type { CSSProperties } from 'react'

export interface PaginationDotsProps {
  count: number
  activeIndex: number
  /** Dot diameter, px (default 8 per audit). */
  size?: number
  /** Gap between dots, px (default 5 per audit). */
  gap?: number
  inactiveColor?: string
  /**
   * When provided, dots become tappable (44px-ish invisible hit area via
   * negative margins — visual geometry is unchanged).
   */
  onSelect?: (index: number) => void
  className?: string
  style?: CSSProperties
}

export function PaginationDots({
  count,
  activeIndex,
  size = 8,
  gap = 5,
  inactiveColor = '#FFFFFF',
  onSelect,
  className,
  style,
}: PaginationDotsProps) {
  if (count <= 0) return null
  // Touch padding: generous vertically; horizontally exactly half the gap so
  // neighboring hit areas tile edge-to-edge without overlapping (overlap
  // would steal clicks for the next dot — topmost sibling wins hit-testing).
  const hitPadY = 14
  const hitPadX = gap / 2
  return (
    <div
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap, ...style }}
    >
      {Array.from({ length: count }, (_, i) => {
        const dotStyle: CSSProperties = {
          width: size,
          height: size,
          borderRadius: '50%',
          background: i === activeIndex ? 'var(--gold-gradient)' : inactiveColor,
        }
        if (onSelect === undefined) return <span key={i} style={dotStyle} />
        return (
          <button
            key={i}
            type="button"
            aria-label={`Go to item ${i + 1}`}
            onClick={() => onSelect(i)}
            style={{
              // Margin box stays `size` wide so flex gap/pitch is unchanged,
              // while the padding box gives a larger touch target.
              width: size + hitPadX * 2,
              height: size + hitPadY * 2,
              margin: `${-hitPadY}px ${-hitPadX}px`,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span style={dotStyle} />
          </button>
        )
      })}
    </div>
  )
}
