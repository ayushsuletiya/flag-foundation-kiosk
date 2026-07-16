/**
 * HistoryFallback — honest placeholders for years whose photography has not
 * been delivered yet (no fake historical photos, per the build spec).
 *
 * ChakraMark: pure-SVG 24-spoke Ashok Chakra, used as a subtle watermark.
 * FallbackBackdrop: dark-navy gradient + faint chakra, drop-in replacement
 * for the full-bleed era photo (main screen) and know-more backdrop.
 */
import type { CSSProperties } from 'react'

export interface ChakraMarkProps {
  size: number
  color?: string
  style?: CSSProperties
}

const SPOKES = Array.from({ length: 24 }, (_, i) => i * 15)

export function ChakraMark({ size, color = '#5A6FB5', style }: ChakraMarkProps) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      style={style}
      aria-hidden="true"
    >
      <circle cx={50} cy={50} r={47} stroke={color} strokeWidth={2.6} />
      <circle cx={50} cy={50} r={5.4} fill={color} />
      {SPOKES.map((angle) => (
        <line
          key={angle}
          x1={50}
          y1={44}
          x2={50}
          y2={4.6}
          stroke={color}
          strokeWidth={1.5}
          transform={`rotate(${angle} 50 50)`}
        />
      ))}
    </svg>
  )
}

/** Full-bleed dark-navy backdrop with a subtle chakra watermark, right side. */
export function FallbackBackdrop() {
  return (
    <div
      style={{
        position: 'absolute',
        inset: 0,
        background: 'linear-gradient(160deg, #182A5C 0%, #101B3E 55%, #081026 100%)',
        overflow: 'hidden',
      }}
    >
      <ChakraMark
        size={920}
        color="#5A6FB5"
        style={{ position: 'absolute', right: -150, top: 100, opacity: 0.12 }}
      />
      <ChakraMark
        size={340}
        color="#5A6FB5"
        style={{ position: 'absolute', left: 640, bottom: -90, opacity: 0.07 }}
      />
    </div>
  )
}
