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
  // Chars are inline-blocks, which would happily wrap MID-word on multi-line
  // headings — group them into nowrap word spans so line breaks only happen
  // at real spaces (each word tracks its chars' global indices for the
  // stagger timing).
  const words: { char: string; index: number }[][] = [[]]
  chars.forEach((ch, i) => {
    if (ch === ' ') {
      if (words[words.length - 1]!.length > 0) words.push([])
    } else {
      words[words.length - 1]!.push({ char: ch, index: i })
    }
  })

  useLayoutEffect(() => {
    const root = rootRef.current
    if (!root) return
    root.style.fontSize = ''
    if (fitWidth) {
      const w = root.offsetWidth
      if (w > fitWidth) root.style.fontSize = `${Math.floor((fitWidth / w) * 1000) / 10}%`
    }
    const spans = Array.from(root.querySelectorAll<HTMLElement>('.btt-char'))
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
      {words.map((word, w) => (
        // Space lives BETWEEN word spans (wrap point + no line-start indent).
        <span key={w} style={{ display: 'contents' }} aria-hidden="true">
          {w > 0 && ' '}
          <span className="btt-word">
            {word.map(({ char, index }) => (
              <span
                key={index}
                className="btt-char"
                style={{ animationDelay: `${delay + index * step}ms` }}
              >
                {char}
              </span>
            ))}
          </span>
        </span>
      ))}
    </span>
  )
}
