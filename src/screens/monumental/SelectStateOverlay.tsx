/**
 * SelectStateOverlay — Figma frame 821:2 "Select State — Overlay", plus the
 * CONTINUE confirm step from the older 795:8343 flow (user decision:
 * selection only highlights; nothing applies until Continue).
 *
 * Geometry per audit: full scrim (Figma: rgba(10,5,3,0.78) + 9px backdrop
 * blur — rendered as a deeper plain scrim, see perf note on the element);
 * panel 1660×920 at (130,80) r28 bg rgba(19,13,5,0.96) border 1.2px
 * #FFF8DB shadow 0 18px 48px rgba(0,0,0,0.5). Title (186,132) Poppins Bold
 * 44 gradient text; subtitle (186,196) Poppins 20 white55 — both counts
 * computed live from the Excel. Close 64px circle at (1650,128). Divider
 * (186,248) 1548×1 white12. Grid: 6 cols × 6 rows of 239×88 chips, origin
 * (186,300), pitch 261/106. Selected chip = gold gradient + glow + #211405
 * text. States with zero installations render disabled.
 *
 * Scrim tap / ✕ dismiss WITHOUT applying; CONTINUE applies + closes.
 */
import { useState } from 'react'
import { CANONICAL_STATES } from '../../data/schema.ts'
import './monumental.css'

export interface SelectStateOverlayProps {
  /** State selected on the map screen when the overlay opened. */
  currentState: string
  /** Installation count per state (0 ⇒ disabled chip). */
  countByState: ReadonlyMap<string, number>
  totalInstallations: number
  onContinue: (state: string) => void
  onClose: () => void
}

export function SelectStateOverlay({
  currentState,
  countByState,
  totalInstallations,
  onContinue,
  onClose,
}: SelectStateOverlayProps) {
  const [picked, setPicked] = useState(currentState)

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 60 }}>
      {/* Backdrop — user-provided glowing India render (assets/map/select-state-bg.png) */}
      <img
        src="assets/map/select-state-bg.png"
        alt=""
        style={{
          position: 'absolute',
          inset: 0,
          width: '100%',
          height: '100%',
          objectFit: 'cover',
        }}
      />
      {/* Scrim — tap to dismiss without applying; kept light so the glowing
          map render reads through (perf guard: plain scrim, no backdrop blur) */}
      <button
        type="button"
        aria-label="Close"
        className="mon-overlay-scrim"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(10, 5, 3, 0.55)',
          cursor: 'pointer',
        }}
      />

      {/* Panel */}
      <div
        className="mon-overlay-panel"
        style={{
          position: 'absolute',
          left: 130,
          top: 80,
          width: 1660,
          height: 920,
          borderRadius: 28,
          background: 'var(--modal-panel-bg)',
          border: '1.2px solid var(--cream-border)',
          boxShadow: 'var(--modal-panel-shadow)',
        }}
      >
        <h2
          style={{
            position: 'absolute',
            left: 56,
            top: 52,
            fontFamily: 'var(--font-ui)',
            fontWeight: 700,
            fontSize: 44,
            background: 'linear-gradient(95.18deg, #FFFBEB 0.42%, #F7C590 102.43%)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          Select State
        </h2>
        <p
          style={{
            position: 'absolute',
            left: 56,
            top: 116,
            fontFamily: 'var(--font-ui)',
            fontWeight: 400,
            fontSize: 20,
            color: 'rgba(255, 255, 255, 0.55)',
          }}
        >
          {CANONICAL_STATES.length} States &amp; Union Territories · {totalInstallations} monumental
          flags
        </p>

        {/* Close */}
        <button
          type="button"
          aria-label="Close"
          className="mon-pressable"
          onClick={onClose}
          style={{
            position: 'absolute',
            left: 1520,
            top: 48,
            width: 64,
            height: 64,
            borderRadius: 32,
            background: 'rgba(255, 255, 255, 0.10)',
            border: '1px solid rgba(255, 255, 255, 0.35)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width={24} height={24} viewBox="0 0 24 24" aria-hidden="true">
            <path
              d="M5 5 19 19M19 5 5 19"
              stroke="#FFFFFF"
              strokeWidth={2}
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Divider */}
        <div
          style={{
            position: 'absolute',
            left: 56,
            top: 168,
            width: 1548,
            height: 1,
            background: 'rgba(255, 255, 255, 0.12)',
          }}
        />

        {/* 6×6 chip grid — origin (56,220) panel-local = (186,300) stage */}
        {CANONICAL_STATES.map((state, i) => {
          const col = i % 6
          const row = Math.floor(i / 6)
          const selected = state === picked
          const disabled = (countByState.get(state) ?? 0) === 0
          return (
            <button
              key={state}
              type="button"
              disabled={disabled}
              className={disabled ? undefined : 'mon-pressable'}
              onClick={() => setPicked(state)}
              style={{
                position: 'absolute',
                left: 56 + col * 261,
                top: 220 + row * 106,
                width: 239,
                height: 88,
                borderRadius: 15.7,
                background: selected ? 'var(--gold-gradient)' : 'var(--glass-navy-tint)',
                border: '0.78px solid var(--cream-border)',
                boxShadow: selected ? 'var(--gold-glow)' : undefined,
                display: 'flex',
                alignItems: 'center',
                textAlign: 'left',
                padding: '0 18px',
                fontFamily: 'var(--font-ui)',
                fontWeight: 400,
                fontSize: 17,
                lineHeight: 1.25,
                color: selected ? '#211405' : '#FFFFFF',
                opacity: disabled ? 0.35 : 1,
                cursor: disabled ? 'default' : 'pointer',
                transition: 'background 0.15s ease, color 0.15s ease, box-shadow 0.15s ease',
              }}
            >
              <span style={{ maxWidth: 203 }}>{state}</span>
            </button>
          )
        })}

        {/* CONTINUE — confirm step carried over from 795:8343 */}
        <button
          type="button"
          className="mon-pressable"
          onClick={() => onContinue(picked)}
          style={{
            position: 'absolute',
            left: 830 - 130,
            top: 846,
            width: 260,
            height: 60,
            borderRadius: 30,
            background: 'var(--gold-gradient)',
            border: '1px solid var(--cream-border)',
            boxShadow: 'var(--gold-glow)',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: 24,
            letterSpacing: 2,
            color: '#211405',
            cursor: 'pointer',
          }}
        >
          CONTINUE
        </button>
      </div>
    </div>
  )
}
