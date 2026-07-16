/**
 * Phase 1 placeholder screens — SHELL ONLY, replaced in Phases 2-6.
 *
 * Purpose: prove the router + Excel wiring end-to-end. Every category screen
 * shows its live row-count from useContent(), so editing data/content.xlsx
 * and saving visibly updates the running app on any route.
 *
 * They deliberately exercise the shared nav components (QuickAccessPill,
 * HomeButton, BackButton, GlassCard) at their audited Figma coordinates.
 */
import type { CSSProperties, ReactNode } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../data/ContentContext.tsx'
import type { ContentStore } from '../data/schema.ts'
import { BackButton } from '../components/BackButton.tsx'
import { GlassCard } from '../components/GlassCard.tsx'
import { HomeButton } from '../components/HomeButton.tsx'
import { QuickAccessPill } from '../components/QuickAccessPill.tsx'

interface CategoryDef {
  path: string
  label: string
  unit: string
  count: (content: ContentStore) => number
}

/** The 4 kiosk categories, in home-menu order. */
const CATEGORIES: readonly CategoryDef[] = [
  {
    path: '/monumental',
    label: 'Monumental Flags',
    unit: 'installations',
    count: (c) => c.installations.length,
  },
  {
    path: '/history',
    label: 'History of the Tiranga',
    unit: 'history years',
    count: (c) => c.historyYears.length,
  },
  {
    path: '/chakra',
    label: 'Ashok Chakra',
    unit: 'virtues',
    count: (c) => c.chakra.virtues.length,
  },
  {
    path: '/symbols',
    label: 'National Symbols',
    unit: 'symbols',
    count: (c) => c.symbolIdentities.length,
  },
]

const SCREEN_BG: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'var(--home-scrim-gradient), #1E1405',
}

const TITLE_GRADIENT_TEXT: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 600,
  fontSize: 65.889,
  lineHeight: 1.226,
  background: 'var(--title-gradient)',
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  color: 'transparent',
}

/** Shared top-right nav cluster at audited Figma coordinates. */
function NavCluster({ back }: { back: boolean }) {
  const navigate = useNavigate()
  return (
    <>
      {back && (
        <BackButton
          onClick={() => navigate(-1)}
          style={{ position: 'absolute', left: 1351, top: 38 }}
        />
      )}
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />
    </>
  )
}

function ContentStatusLine() {
  const { content, validation, loading, error } = useContent()
  return (
    <p
      style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 300,
        fontSize: 20,
        color: 'var(--cream-border)',
        opacity: 0.75,
      }}
    >
      {loading && 'Loading data/content.xlsx…'}
      {!loading && error !== null && `Content file unreachable: ${error}`}
      {!loading &&
        error === null &&
        content !== null &&
        `content.xlsx parsed ${new Date(content.loadedAt).toLocaleTimeString()}` +
          (validation !== null
            ? ` · ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`
            : '')}
    </p>
  )
}

// ---------------------------------------------------------------------------
// Home
// ---------------------------------------------------------------------------
export function HomePlaceholder() {
  const navigate = useNavigate()
  const { content } = useContent()

  return (
    <div style={SCREEN_BG}>
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />

      <div
        style={{
          position: 'absolute',
          inset: 0,
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 48,
        }}
      >
        <div style={{ textAlign: 'center' }}>
          <h1
            style={{
              fontFamily: 'var(--font-headline)',
              fontWeight: 400,
              fontSize: 72,
              color: 'var(--cream-border)',
            }}
          >
            Flag Foundation of India
          </h1>
          <p
            style={{
              fontFamily: 'var(--font-script)',
              fontSize: 44,
              color: '#F7C590',
            }}
          >
            Phase 1 shell — placeholder home
          </p>
        </div>

        <div style={{ display: 'flex', gap: 32 }}>
          {CATEGORIES.map((cat) => (
            <GlassCard key={cat.path} radius={24} style={{ width: 330, height: 220 }}>
              <button
                type="button"
                onClick={() => navigate(cat.path)}
                style={{
                  width: '100%',
                  height: '100%',
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 12,
                  cursor: 'pointer',
                }}
              >
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 600,
                    fontSize: 27.332,
                    color: '#FFFFFF',
                    textAlign: 'center',
                    padding: '0 16px',
                  }}
                >
                  {cat.label}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-numeral)',
                    fontWeight: 700,
                    fontSize: 40,
                    background: 'var(--gold-gradient)',
                    backgroundClip: 'text',
                    WebkitBackgroundClip: 'text',
                    color: 'transparent',
                  }}
                >
                  {content !== null ? cat.count(content) : '—'}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-ui)',
                    fontWeight: 300,
                    fontSize: 18,
                    color: 'var(--gold-cream)',
                    textTransform: 'uppercase',
                    letterSpacing: 1,
                  }}
                >
                  {cat.unit}
                </span>
              </button>
            </GlassCard>
          ))}
        </div>

        <ContentStatusLine />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Category placeholder (one layout, four routes)
// ---------------------------------------------------------------------------
function CategoryPlaceholder({
  title,
  children,
}: {
  title: string
  children: ReactNode
}) {
  return (
    <div style={SCREEN_BG}>
      <NavCluster back />

      <h1 style={{ position: 'absolute', left: 95, top: 120, ...TITLE_GRADIENT_TEXT }}>{title}</h1>

      <div
        style={{
          position: 'absolute',
          left: 95,
          top: 300,
          display: 'flex',
          flexDirection: 'column',
          gap: 32,
        }}
      >
        <GlassCard
          radius={16}
          style={{
            width: 900,
            padding: '48px 56px',
            display: 'flex',
            flexDirection: 'column',
            gap: 16,
          }}
        >
          {children}
        </GlassCard>
        <ContentStatusLine />
      </div>
    </div>
  )
}

function CountRow({ value, unit }: { value: number | null; unit: string }) {
  return (
    <div style={{ display: 'flex', alignItems: 'baseline', gap: 20 }}>
      <span
        style={{
          fontFamily: 'var(--font-numeral)',
          fontWeight: 800,
          fontSize: 96,
          letterSpacing: -2.213,
          background: 'var(--gold-gradient)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        {value ?? '—'}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 300,
          fontSize: 28,
          color: 'var(--gold-cream)',
          textTransform: 'uppercase',
          letterSpacing: 1.5,
        }}
      >
        {unit} · live from data/content.xlsx
      </span>
    </div>
  )
}

function SubCounts({ items }: { items: { label: string; value: number | null }[] }) {
  return (
    <p
      style={{
        fontFamily: 'var(--font-ui)',
        fontWeight: 400,
        fontSize: 22,
        color: '#FFFFFF',
        opacity: 0.85,
      }}
    >
      {items.map((it, i) => (
        <span key={it.label}>
          {i > 0 && ' · '}
          {it.value ?? '—'} {it.label}
        </span>
      ))}
    </p>
  )
}

export function MonumentalPlaceholder() {
  const { content } = useContent()
  const states =
    content !== null ? new Set(content.installations.map((i) => i.state)).size : null
  return (
    <CategoryPlaceholder title="Monumental Flags">
      <CountRow value={content !== null ? content.installations.length : null} unit="installations" />
      <SubCounts items={[{ label: 'states / UTs with flags', value: states }]} />
    </CategoryPlaceholder>
  )
}

export function HistoryPlaceholder() {
  const { content } = useContent()
  return (
    <CategoryPlaceholder title="History of the Tiranga">
      <CountRow value={content !== null ? content.historyYears.length : null} unit="history years" />
      <SubCounts
        items={[
          { label: 'know-more panels', value: content !== null ? content.historyKnowMore.length : null },
          { label: 'flag-code milestones', value: content !== null ? content.flagCodeMilestones.length : null },
        ]}
      />
    </CategoryPlaceholder>
  )
}

export function ChakraPlaceholder() {
  const { content } = useContent()
  return (
    <CategoryPlaceholder title="Ashok Chakra">
      <CountRow value={content !== null ? content.chakra.virtues.length : null} unit="spoke virtues" />
      <SubCounts
        items={[{ label: 'reference rows', value: content !== null ? content.chakra.rows.length : null }]}
      />
    </CategoryPlaceholder>
  )
}

export function SymbolsPlaceholder() {
  const { content } = useContent()
  return (
    <CategoryPlaceholder title="National Symbols">
      <CountRow value={content !== null ? content.symbolIdentities.length : null} unit="symbols" />
      <SubCounts
        items={[
          { label: 'carousel cards', value: content !== null ? content.symbolCarouselCards.length : null },
          { label: 'flag facts', value: content !== null ? content.flagFacts.length : null },
        ]}
      />
    </CategoryPlaceholder>
  )
}
