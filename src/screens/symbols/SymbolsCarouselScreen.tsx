/**
 * SymbolsCarouselScreen — pixel build of Figma frame 795:3822
 * "National Symbols — Tiger (intro)".
 *
 * The frame is MIRRORED in Figma; this build follows the rendered design
 * (podium left-of-center) using the un-mirrored audit coordinates and the
 * pre-flipped stage-intro.png. The 3-card podium carousel rotates through
 * ALL symbols from Excel "03 · NS Identity" (not just the three with
 * artwork); the center card plays the symbol's PNG-sequence turntable
 * (statics only today), and Know More opens /symbols/:slug.
 */
import { useMemo, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { PaginationDots } from '../../components/PaginationDots.tsx'
import { SymbolVisual } from './SymbolVisual.tsx'
import { fitFontSize, symbolShortName, symbolSlug, symbolSubtitle } from './symbolsData.ts'
import './SymbolsCarouselScreen.css'

const SWIPE_THRESHOLD_PX = 60

export function SymbolsCarouselScreen() {
  const navigate = useNavigate()
  const { content } = useContent()
  const identities = content?.symbolIdentities ?? []
  const count = identities.length

  // Figma opens on the tiger; fall back to the first Excel row.
  const [selected, setSelected] = useState<number | null>(null)
  const defaultIndex = useMemo(() => {
    const i = identities.findIndex((s) => symbolSlug(s.symbol) === 'tiger')
    return i >= 0 ? i : 0
  }, [identities])
  const activeIndex = count > 0 ? (selected ?? defaultIndex) % count : 0

  const swipeStartX = useRef<number | null>(null)

  if (count === 0) {
    // Content still loading (or empty workbook) — hold the stage only.
    return (
      <div className="sy-screen">
        <img className="sy-stage-bg" src="assets/images/symbols/stage-intro.png" alt="" />
      </div>
    )
  }

  const active = identities[activeIndex]!
  const prev = identities[(activeIndex + count - 1) % count]!
  const next = identities[(activeIndex + 1) % count]!
  const activeSlug = symbolSlug(active.symbol)
  const shortName = symbolShortName(active)
  const nameFontSize = fitFontSize(shortName, 96.716, 660)

  const rotate = (dir: 1 | -1) => {
    setSelected((activeIndex + dir + count) % count)
  }

  return (
    <div className="sy-screen">
      {/* Baked stage (navy + mandala + podium), pre-flipped to match the
          render; design cover-crops region x=217..2094 of the 2113px source. */}
      <img className="sy-stage-bg" src="assets/images/symbols/stage-intro.png" alt="" />

      <h1 className="sy-header">National Symbols of India</h1>

      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      {/* Carousel — swipe anywhere over the podium, or tap a side card.
          dragstart is suppressed: a mouse swipe starting on a card <img>
          would otherwise begin a native image drag, firing pointercancel
          and eating the pointerup that completes the gesture. */}
      <div
        className="sy-carousel"
        onDragStart={(e) => e.preventDefault()}
        onPointerDown={(e) => {
          swipeStartX.current = e.clientX
        }}
        onPointerUp={(e) => {
          const start = swipeStartX.current
          swipeStartX.current = null
          if (start === null) return
          const dx = e.clientX - start
          if (dx <= -SWIPE_THRESHOLD_PX) rotate(1)
          else if (dx >= SWIPE_THRESHOLD_PX) rotate(-1)
        }}
      >
        <button
          type="button"
          className="sy-card sy-card-side sy-card-left"
          aria-label={`Show ${symbolShortName(prev)}`}
          onClick={() => rotate(-1)}
        >
          <div key={symbolSlug(prev.symbol)} className="sy-card-media">
            <SymbolVisual
              slug={symbolSlug(prev.symbol)}
              name={symbolShortName(prev)}
              width={241}
              height={372}
              mode="still"
            />
          </div>
          <span className="sy-card-dim" />
        </button>

        <div className="sy-card sy-card-center">
          <div key={activeSlug} className="sy-card-media">
            <SymbolVisual
              slug={activeSlug}
              name={shortName}
              width={379}
              height={472}
              mode="live"
              fit="contain"
            />
          </div>
        </div>

        <button
          type="button"
          className="sy-card sy-card-side sy-card-right"
          aria-label={`Show ${symbolShortName(next)}`}
          onClick={() => rotate(1)}
        >
          <div key={symbolSlug(next.symbol)} className="sy-card-media">
            <SymbolVisual
              slug={symbolSlug(next.symbol)}
              name={symbolShortName(next)}
              width={241}
              height={372}
              mode="still"
            />
          </div>
          <span className="sy-card-dim" />
        </button>
      </div>

      {/* Pagination dots on the podium face — count is Excel-driven. */}
      <PaginationDots
        count={count}
        activeIndex={activeIndex}
        onSelect={(i) => setSelected(i)}
        className="sy-dots"
      />

      {/* Right text column — name, category, Know More (all Excel-driven). */}
      <div key={activeSlug} className="sy-info">
        <p className="sy-name" style={{ fontSize: nameFontSize }}>
          {shortName}
        </p>
        <p className="sy-subtitle">{symbolSubtitle(active)}</p>
        <button
          type="button"
          className="sy-know-more"
          onClick={() => navigate(`/symbols/${activeSlug}`)}
        >
          Know More
        </button>
      </div>
    </div>
  )
}
