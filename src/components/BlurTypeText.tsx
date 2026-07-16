/**
 * BlurTypeText — "blur typewriter" text reveal: characters materialize in
 * sequence, each rising and de-blurring into place. Remount the component
 * (key it on the text's identity) to replay.
 *
 * Gradient text stays CONTINUOUS across the word: chars are separate spans
 * (needed for per-char animation), so when the chars carry a background
 * gradient (via CSS on `.btt-char`), the full-text gradient is sliced per
 * character by measuring layout offsets and pinning background-size/position.
 */
import { useLayoutEffect, useRef } from 'react'
import './BlurTypeText.css'

interface BlurTypeTextProps {
  text: string
  /** ms before the first character starts */
  delay?: number
  /** ms between characters */
  stagger?: number
  /** total stagger budget — long strings compress so the reveal never drags */
  budget?: number
  /** measured fit: shrink font so the rendered text never exceeds this width
      (callers' char-count heuristics underestimate wide all-caps names) */
  fitWidth?: number
}

export function BlurTypeText({
  text,
  delay = 0,
  stagger = 48,
  budget = 620,
  fitWidth,
}: BlurTypeTextProps) {
  const rootRef = useRef<HTMLSpanElement>(null)
  const chars = Array.from(text)
  const step = chars.length > 1 ? Math.min(stagger, budget / (chars.length - 1)) : stagger

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.style.fontSize = ''
    if (fitWidth) {
      const w = root.offsetWidth
      if (w > fitWidth) root.style.fontSize = `${Math.floor((fitWidth / w) * 1000) / 10}%`
    }
    const spans = Array.from(root.children) as HTMLElement[]
    const first = spans[0]
    if (!first || getComputedStyle(first).backgroundImage === 'none') return
    // Chars have a gradient: give every span the WHOLE text's gradient,
    // shifted so each shows only its own window — one continuous ramp.
    // (Measured after the fit above so the slices match the final layout.)
    const total = root.offsetWidth
    for (const span of spans) {
      span.style.backgroundSize = `${total}px 100%`
      span.style.backgroundPosition = `${root.offsetLeft - span.offsetLeft}px 0`
    }
  }, [text, fitWidth])

  return (
    <span ref={rootRef} className="btt" aria-label={text}>
      {chars.map((ch, i) => (
        <span
          key={i}
          className="btt-char"
          aria-hidden="true"
          style={{ animationDelay: `${delay + i * step}ms` }}
        >
          {ch === ' ' ? ' ' : ch}
        </span>
      ))}
    </span>
  )
}
