/**
 * MonumentalHeader — the "Monumental Flags" script wordmark.
 *
 * Audit (node 795:7722, identical on intro + map frames): at (79,65),
 * width 726. "Monumental " Poppins SemiBold 65.889px + "Flags" Parisienne
 * Regular 87.89px, both line-height 1.226, gradient-clipped text
 * linear-gradient(93.286deg, #FFFBEB 0.42%, #F7C590 102.43%)
 * (= var(--title-gradient)).
 */
export function MonumentalHeader() {
  return (
    <h1
      style={{
        position: 'absolute',
        left: 79,
        top: 65,
        width: 726,
        fontFamily: 'var(--font-ui)',
        fontWeight: 600,
        fontSize: 65.889,
        lineHeight: 1.226,
        background: 'var(--title-gradient)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        whiteSpace: 'nowrap',
      }}
    >
      Monumental{' '}
      <span
        style={{
          fontFamily: 'var(--font-script)',
          fontWeight: 400,
          fontSize: 87.89,
        }}
      >
        Flags
      </span>
    </h1>
  )
}
