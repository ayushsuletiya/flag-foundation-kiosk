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
    // Parisienne swashes overflow the line box; background-clip:text only
    // paints inside the border box, so grow the paint box with padding and
    // pull it back with equal negative margins (same trick as .hy-header) —
    // otherwise the script 'g' descender renders transparent (clipped).
    <h1
      style={{
        position: 'absolute',
        left: 79,
        top: 65,
        padding: '45px 60px',
        margin: '-45px -60px',
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
