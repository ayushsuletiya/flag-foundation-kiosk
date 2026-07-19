/**
 * SymbolDetailScreen — pixel build of Figma frame 795:3849
 * "National Symbols — Tiger (detail card)". Route /symbols/:slug.
 *
 * Everything textual is live from Excel: title stack = identity category +
 * symbol, gold headline = symbolism heading, the 4 stat cards = parsed
 * "Label: Value" milestones, and the right "Did You Know?" card cycles that
 * symbol's rows from "03b · NS Carousel". Chevrons switch to the prev/next
 * symbol (replace-navigation so Back still returns to the carousel).
 *
 * Glass recipe note: the Figma export lost the card fills (rgba(0,0,0,0));
 * the dark navy glass used here was sampled from the frame render — a
 * subtle blue-tinted fill, lighter toward the top, with a thin light border.
 */
import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BackButton } from '../../components/BackButton.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { PaginationDots } from '../../components/PaginationDots.tsx'
import { SymbolVisual } from './SymbolVisual.tsx'
import { useSymbolMedia } from './symbolsMedia.ts'
import { DynamicBackground } from '../../components/DynamicBackground.tsx'
import { SYMBOLS, SHARED } from '../../assets/paths.ts'
import {
  fitFontSize,
  isNumericMilestone,
  parseMilestone,
  symbolShortName,
  symbolSlug,
} from './symbolsData.ts'
import './SymbolDetailScreen.css'

const CARD_AUTO_ADVANCE_MS = 7000

/** The 4 milestone slots at audited Figma geometry (wide/small/small/wide). */
const STAT_SLOTS = [
  { left: 103, top: 451, width: 509, height: 102 },
  { left: 103, top: 578, width: 232, height: 122 },
  { left: 356, top: 578, width: 256, height: 122 },
  { left: 103, top: 725, width: 509, height: 100 },
] as const

/** Gold circle chevron (audit: 45px visual, ≥80px hit area). */
function ChevronButton({
  direction,
  centerX,
  centerY,
  onClick,
  label,
}: {
  direction: 'left' | 'right'
  centerX: number
  centerY: number
  onClick: () => void
  label: string
}) {
  return (
    <button
      type="button"
      aria-label={label}
      className="syd-chevron-hit"
      style={{ left: centerX - 45, top: centerY - 45 }}
      onClick={onClick}
    >
      <span className="syd-chevron">
        {/* Exact Figma asset (795:3898) — cream→tan circle, chevron cut out;
            the right button is the mirrored copy, as in the design. */}
        <img
          src={`${SHARED.icons}/chevron-gold.svg`}
          alt=""
          width={45}
          height={45}
          style={direction === 'right' ? { transform: 'scaleX(-1)' } : undefined}
        />
      </span>
    </button>
  )
}

export function SymbolDetailScreen() {
  const navigate = useNavigate()
  const { slug } = useParams()
  const { content } = useContent()

  const identities = content?.symbolIdentities ?? []
  const count = identities.length
  const foundIndex = identities.findIndex((s) => symbolSlug(s.symbol) === slug)
  const index = foundIndex >= 0 ? foundIndex : 0
  const identity = count > 0 ? identities[index]! : null

  const cards = useMemo(() => {
    if (content === null || identity === null) return []
    return content.symbolCarouselCards
      .filter((c) => c.symbol === identity.symbol)
      .sort((a, b) => a.cardNumber - b.cardNumber)
  }, [content, identity])

  const [cardIndex, setCardIndex] = useState(0)
  useEffect(() => setCardIndex(0), [slug])

  // Gentle auto-advance; restarts whenever the user picks a dot.
  useEffect(() => {
    if (cards.length < 2) return
    const timer = setInterval(
      () => setCardIndex((i) => (i + 1) % cards.length),
      CARD_AUTO_ADVANCE_MS,
    )
    return () => clearInterval(timer)
  }, [cards.length, cardIndex, slug])

  const activeSlug = identity !== null ? symbolSlug(identity.symbol) : ''
  const media = useSymbolMedia(activeSlug !== '' ? activeSlug : 'none')
  /** Real artwork (static or frames) → mock subject frame; else placeholder box. */
  const hasArt = media.ready && (media.hasStatic || media.frameCount > 0)

  if (identity === null) {
    // Content still loading — hold the stage.
    return (
      <div className="syd-screen">
        <div className="syd-stage-bg" style={{ overflow: 'hidden' }}>
          <DynamicBackground base={SYMBOLS.detailBackground} />
        </div>
        <div className="syd-scrim" />
      </div>
    )
  }

  const card = cards[Math.min(cardIndex, Math.max(0, cards.length - 1))] ?? null
  const milestones = identity.milestones.map(parseMilestone)

  // Did You Know photo: symbols/<slug>/did-you-know/ images cycle with the
  // fact pages (image count and fact count are independent — modulo pairs
  // them for any mix of 1..N facts and 1..M photos). No photos → the
  // symbol's static cutout. Drop-in flexible, no code changes.
  const cardImage =
    media.dykImages.length > 0
      ? media.dykImages[cardIndex % media.dykImages.length]!
      : media.ready && media.hasStatic
        ? media.staticUrl
        : null

  // Chevrons page through this symbol's fact cards (NOT other symbols —
  // symbol switching happens on the carousel screen only).
  const goToCard = (dir: 1 | -1) => {
    if (cards.length < 2) return
    setCardIndex((i) => (i + dir + cards.length) % cards.length)
  }

  return (
    <div className="syd-screen">
      {/* Baked stage (podium included) + radial scrim recreated in CSS. */}
      <div className="syd-stage-bg" style={{ overflow: 'hidden' }}>
          <DynamicBackground base={SYMBOLS.detailBackground} />
        </div>
      <div className="syd-scrim" />

      {/* Giant decorative quote — live glyph, Port Lligat Slab 613.33px. */}
      <span className="syd-quote" aria-hidden="true">
        “
      </span>

      <div key={activeSlug} className="syd-fade">
        {/* Title stack, centered on x=965. */}
        <p className="syd-kicker">{identity.category}</p>
        <p className="syd-title">{identity.symbol}</p>

        {/* Gold symbolism headline. */}
        <p className="syd-headline">{identity.symbolismHeading}</p>

        {/* Stat cards — Excel milestones parsed as "Label: Value". */}
        {milestones.slice(0, STAT_SLOTS.length).map((m, i) => {
          const slot = STAT_SLOTS[i]!
          const gold = isNumericMilestone(m.value)
          const base = gold ? 50 : m.value.length <= 16 ? 35 : 30
          const fontSize = fitFontSize(m.value, base, slot.width - 56)
          return (
            <div
              key={`${m.label}-${i}`}
              className="syd-stat"
              style={{ left: slot.left, top: slot.top, width: slot.width, height: slot.height }}
            >
              {m.label !== '' && <span className="syd-stat-label">{m.label}</span>}
              <span
                className={gold ? 'syd-stat-value syd-stat-gold' : 'syd-stat-value syd-stat-cream'}
                style={{ fontSize }}
              >
                {m.value}
              </span>
            </div>
          )
        })}

        {/* Pedestal glow + turntable on the baked podium. Artwork PNGs carry
            transparent padding (tiger ≈8.1% top / 7.9% bottom), so the mock's
            subject frame (solved from the 795:3849 render: visible tiger
            y258→685, paws ON the podium) is larger than the visible subject:
            407x509 with bottom y=725.5. Placeholder tiles have no padding, so
            they keep the podium-top footprint (352x439, bottom y=692). */}
        <div className="syd-glow" />
        <div
          className="syd-subject"
          style={hasArt ? { left: 771.5, top: 216.5 } : { left: 784, top: 253 }}
        >
          <SymbolVisual
            slug={activeSlug}
            name={symbolShortName(identity)}
            width={hasArt ? 407 : 352}
            height={hasArt ? 509 : 439}
            mode="live"
            fit="contain"
          />
        </div>

        {/* Did You Know? carousel card. */}
        <div className="syd-dyk">
          {card !== null && (
            <div key={card.cardNumber} className="syd-dyk-content">
              {/* Fixed UI label per Figma — only the photo + fact cycle */}
              <p className="syd-dyk-heading">Did You Know?</p>
              <div className="syd-dyk-photo">
                {cardImage !== null ? (
                  <img src={cardImage} alt="" />
                ) : (
                  <SymbolVisual
                    slug={activeSlug}
                    name={symbolShortName(identity)}
                    width={454}
                    height={285}
                    mode="still"
                  />
                )}
              </div>
              <p className="syd-dyk-body">{card.bodyText}</p>
            </div>
          )}
          <PaginationDots
            count={cards.length}
            activeIndex={Math.min(cardIndex, Math.max(0, cards.length - 1))}
            onSelect={setCardIndex}
            inactiveColor="rgba(255, 255, 255, 0.45)"
            className="syd-dyk-dots"
          />
        </div>
      </div>

      {/* Chevrons flanking the card page the Did You Know facts (audit 1290/1825, y552). */}
      <ChevronButton
        direction="left"
        centerX={1312.5}
        centerY={574.5}
        onClick={() => goToCard(-1)}
        label="Previous fact"
      />
      <ChevronButton
        direction="right"
        centerX={1847.5}
        centerY={574.5}
        onClick={() => goToCard(1)}
        label="Next fact"
      />

      {/* Top-right nav. */}
      <BackButton
        onClick={() => navigate('/symbols')}
        style={{ position: 'absolute', left: 1351, top: 38 }}
      />
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />
    </div>
  )
}
