/**
 * /dev/content — hidden admin screen (URL-only, no visible navigation to it).
 *
 * Shows the live ValidationReport for data/content.xlsx: per-tab row counts,
 * then every error/warning with sheet + Excel row. Uses ScrollList so the
 * custom gold scrollbar gets exercised with real content (100+ warnings).
 */
import type { CSSProperties } from 'react'
import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../data/ContentContext.tsx'
import type { ContentStore, ValidationIssue } from '../data/schema.ts'
import { BackButton } from '../components/BackButton.tsx'
import { GlassCard } from '../components/GlassCard.tsx'
import { HomeButton } from '../components/HomeButton.tsx'
import { PaginationDots } from '../components/PaginationDots.tsx'
import { ScrollList } from '../components/ScrollList.tsx'
import { TabPills } from '../components/TabPills.tsx'

type Severity = 'error' | 'warning'

interface RowItem {
  severity: Severity
  issue: ValidationIssue
}

const FILTER_TABS = [
  { id: 'all', label: 'All' },
  { id: 'error', label: 'Errors' },
  { id: 'warning', label: 'Warnings' },
] as const

type FilterId = (typeof FILTER_TABS)[number]['id']

const CELL: CSSProperties = {
  fontFamily: 'var(--font-ui)',
  fontWeight: 400,
  fontSize: 18,
  color: '#FFFFFF',
  padding: '10px 16px',
  borderBottom: '1px solid rgba(255, 255, 255, 0.12)',
  verticalAlign: 'top',
  textAlign: 'left',
}

function storeCounts(content: ContentStore): { label: string; value: number }[] {
  return [
    { label: 'home tiles', value: content.homeTiles.length },
    { label: 'symbol identities', value: content.symbolIdentities.length },
    { label: 'carousel cards', value: content.symbolCarouselCards.length },
    { label: 'installations', value: content.installations.length },
    { label: 'history years', value: content.historyYears.length },
    { label: 'know more', value: content.historyKnowMore.length },
    { label: 'flag code', value: content.flagCodeMilestones.length },
    { label: 'chakra rows', value: content.chakra.rows.length },
    { label: 'virtues', value: content.chakra.virtues.length },
    { label: 'sources', value: content.sources.length },
    { label: 'flag facts', value: content.flagFacts.length },
    { label: 'design specs', value: content.flagDesignSpecs.length },
  ]
}

export function DevContentScreen() {
  const navigate = useNavigate()
  const { content, validation, loading, error, reload } = useContent()
  const [filter, setFilter] = useState<FilterId>('all')

  const rows = useMemo<RowItem[]>(() => {
    if (validation === null) return []
    const all: RowItem[] = [
      ...validation.errors.map((issue): RowItem => ({ severity: 'error', issue })),
      ...validation.warnings.map((issue): RowItem => ({ severity: 'warning', issue })),
    ]
    if (filter === 'all') return all
    return all.filter((r) => r.severity === filter)
  }, [validation, filter])

  return (
    <div style={{ position: 'absolute', inset: 0, background: '#10182B' }}>
      <BackButton onClick={() => navigate(-1)} style={{ position: 'absolute', left: 1351, top: 38 }} />
      <HomeButton onClick={() => navigate('/')} style={{ position: 'absolute', left: 1491, top: 36 }} />

      <h1
        style={{
          position: 'absolute',
          left: 80,
          top: 48,
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: 44,
          background: 'var(--title-gradient)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
        }}
      >
        Content validation — data/content.xlsx
      </h1>

      <p
        style={{
          position: 'absolute',
          left: 80,
          top: 118,
          fontFamily: 'var(--font-ui)',
          fontWeight: 300,
          fontSize: 20,
          color: 'var(--cream-border)',
          opacity: 0.8,
        }}
      >
        {loading && 'Loading…'}
        {!loading && error !== null && `Transport error (showing last good content): ${error}`}
        {!loading && error === null && content !== null && `Parsed ${new Date(content.loadedAt).toLocaleString()}`}
        {validation !== null &&
          ` · ${validation.errors.length} error(s) · ${validation.warnings.length} warning(s)`}
      </p>

      <button
        type="button"
        onClick={reload}
        style={{
          position: 'absolute',
          left: 80,
          top: 168,
          padding: '10px 28px',
          borderRadius: 'var(--radius-know-more)',
          background: 'var(--gold-gradient)',
          fontFamily: 'var(--font-ui)',
          fontWeight: 600,
          fontSize: 20,
          color: '#171001',
          cursor: 'pointer',
        }}
      >
        Reload now
      </button>

      {/* Per-tab row counts */}
      {content !== null && (
        <div
          style={{
            position: 'absolute',
            left: 80,
            top: 236,
            width: 1760,
            display: 'flex',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          {storeCounts(content).map((c) => (
            <GlassCard key={c.label} radius={14} blur={0} style={{ padding: '10px 20px' }}>
              <span
                style={{
                  fontFamily: 'var(--font-numeral)',
                  fontWeight: 700,
                  fontSize: 22,
                  color: '#FFFFFF',
                }}
              >
                {c.value}
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-ui)',
                  fontWeight: 300,
                  fontSize: 16,
                  color: 'var(--gold-cream)',
                  marginLeft: 8,
                  textTransform: 'uppercase',
                  letterSpacing: 1,
                }}
              >
                {c.label}
              </span>
            </GlassCard>
          ))}
        </div>
      )}

      <TabPills
        tabs={FILTER_TABS}
        activeId={filter}
        onChange={(id) => setFilter(id as FilterId)}
        style={{ position: 'absolute', left: 80, top: 368 }}
      />
      <PaginationDots
        count={FILTER_TABS.length}
        activeIndex={FILTER_TABS.findIndex((t) => t.id === filter)}
        style={{ position: 'absolute', left: 80, top: 448 }}
      />

      {/* Issue table */}
      <ScrollList width={1760} height={590} style={{ position: 'absolute', left: 80, top: 476 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%' }}>
          <thead>
            <tr>
              <th style={{ ...CELL, color: 'var(--gold-cream)', width: 130 }}>Severity</th>
              <th style={{ ...CELL, color: 'var(--gold-cream)', width: 280 }}>Sheet</th>
              <th style={{ ...CELL, color: 'var(--gold-cream)', width: 90 }}>Row</th>
              <th style={{ ...CELL, color: 'var(--gold-cream)' }}>Message</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 && (
              <tr>
                <td style={CELL} colSpan={4}>
                  {validation === null ? 'No validation report yet.' : 'No issues in this view.'}
                </td>
              </tr>
            )}
            {rows.map((r, i) => (
              <tr key={i}>
                <td
                  style={{
                    ...CELL,
                    color: r.severity === 'error' ? '#FF8484' : '#F6D568',
                    fontWeight: 600,
                  }}
                >
                  {r.severity}
                </td>
                <td style={CELL}>{r.issue.sheet}</td>
                <td style={CELL}>{r.issue.row ?? '—'}</td>
                <td style={CELL}>{r.issue.message}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </ScrollList>
    </div>
  )
}
