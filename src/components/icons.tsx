/**
 * Inline SVG icons — PLACEHOLDER GEOMETRY for Phase 1.
 *
 * The Figma originals are raster Flaticon glyphs (house = fi_2549900 "9-Home",
 * back arrow = fi_93634 circled left-arrow, chevrons = mingcute:up-fill).
 * Phase 2+ swaps these paths for the exact SVG exports from Figma; sizes and
 * stroke color contracts stay identical so no call sites change.
 */
import type { CSSProperties } from 'react'

export interface IconProps {
  size?: number
  color?: string
  style?: CSSProperties
}

/** Outline house (Home button). Figma glyph box: 50.458x50.458. */
export function HouseIcon({ size = 50.458, color = '#FFFFFF', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <path
        d="M6.5 22.5 24 8l17.5 14.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M11 20.5V39a1.5 1.5 0 0 0 1.5 1.5h23A1.5 1.5 0 0 0 37 39V20.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M19.5 40.5V29a1 1 0 0 1 1-1h7a1 1 0 0 1 1 1v11.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Circled left-arrow (Back button). Figma glyph box: ~48.6x48.6. */
export function CircledArrowLeftIcon({ size = 48.6, color = '#FFFFFF', style }: IconProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 48 48"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <circle cx={24} cy={24} r={21.5} stroke={color} strokeWidth={3} />
      <path
        d="M32 24H17m6.5-6.5L17 24l6.5 6.5"
        stroke={color}
        strokeWidth={3}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

/** Filled up-chevron (scrollbar pagers, mingcute:up-fill style). Point down via scaleY(-1). */
export function ChevronUpIcon({ size = 33, color = '#FFF8DB', style }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={style} aria-hidden="true">
      <path
        d="M10.94 7.94a1.5 1.5 0 0 1 2.12 0l6.5 6.5a1.5 1.5 0 1 1-2.12 2.12L12 11.12l-5.44 5.44a1.5 1.5 0 0 1-2.12-2.12l6.5-6.5Z"
        fill={color}
      />
    </svg>
  )
}
