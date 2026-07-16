/**
 * TabPills — Values / Design / Chakra in Flag style tab row.
 *
 * Audit (Ashok Chakra explorer, nodes 795:5977-5986 etc.):
 * pills h61, radius 29, 22px gap, labels Poppins Light 26.774px,
 * widths content-driven (Values 222 / Design 204 / Chakra in Flag 276 → ~48px pads).
 * Active: gold gradient 90deg #F6D568 → #DCA32E 50.96% → #EFC453,
 *         border 0.849px solid #FFF8DB, black label.
 * Inactive: bg #AB7544, border 1px solid #FFFFFF, white label.
 */
import type { CSSProperties } from 'react'

export interface TabPillDef {
  id: string
  label: string
  /** Explicit pill width in stage px (Figma audit); content-driven if omitted. */
  width?: number
}

export interface TabPillsProps {
  tabs: readonly TabPillDef[]
  activeId: string
  onChange?: (id: string) => void
  className?: string
  style?: CSSProperties
}

const PILL_BASE: CSSProperties = {
  height: 61,
  borderRadius: 29,
  padding: '0 48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'var(--font-ui)',
  fontWeight: 300,
  fontSize: 26.774,
  whiteSpace: 'nowrap',
  cursor: 'pointer',
}

export function TabPills({ tabs, activeId, onChange, className, style }: TabPillsProps) {
  return (
    <div
      role="tablist"
      className={className}
      style={{ display: 'flex', alignItems: 'center', gap: 22, ...style }}
    >
      {tabs.map((tab) => {
        const active = tab.id === activeId
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange?.(tab.id)}
            style={{
              ...PILL_BASE,
              ...(tab.width !== undefined ? { width: tab.width, padding: 0 } : null),
              ...(active
                ? {
                    background: 'var(--gold-gradient)',
                    border: '0.849px solid var(--cream-border)',
                    color: '#000000',
                  }
                : {
                    background: 'var(--tab-pill-inactive-bg)',
                    border: '1px solid #FFFFFF',
                    color: '#FFFFFF',
                  }),
            }}
          >
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}
