/**
 * QuickAccessOverlay — Figma 795:6446 "Quick Access — Overlay", global.
 *
 * Summonable from every screen via the Quick Access pill: scrim
 * rgba(5,10,23,0.74) (tap to close) over a 1600×650 panel at (160,215),
 * r70, bg rgba(53,33,17,0.46), 1.5px rgba(212,173,97,0.55) border. Title
 * Poppins 600 46 #F5D173 + subtitle, then the 4 category photo tiles
 * (280×384, r47.231, 3.736px #FFF8DB border — scaled instances of the home
 * category cards) and a 56px gold close circle at (1652,254).
 *
 * The tiles ARE the home tiles: same order, same Excel-driven labels, same
 * crops, laid out on the home rhythm at the panel's 0.952 scale (user
 * 2026-07-24). Only the card box is smaller — everything else must match, or
 * a category moves between screens.
 *
 * <QuickAccessProvider> mounts inside the router, renders the overlay above
 * everything, and exposes open() through context — QuickAccessPill falls
 * back to it when no onClick is passed, which wires every existing call
 * site at once.
 */
import {
  createContext,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
import { useContent } from '../data/ContentContext.tsx'
import {
  HOME_TILES,
  HOME_LABEL_LINE,
  HOME_LABEL_SIZE,
  HOME_LABEL_TOP,
  HOME_TILE_GAP,
  HOME_TILE_H,
  HOME_TILE_W,
  designedLabel,
} from '../screens/home/homeTiles.ts'
import './QuickAccessOverlay.css'

// ---------------------------------------------------------------------------
// Context
// ---------------------------------------------------------------------------

interface QuickAccessContextValue {
  open: () => void
}

const QuickAccessContext = createContext<QuickAccessContextValue>({ open: () => {} })

/** Open the global Quick Access overlay (no-op outside the provider). */
export function useQuickAccess(): QuickAccessContextValue {
  return useContext(QuickAccessContext)
}

// ---------------------------------------------------------------------------
// Tile layout — the home cards at panel scale
// ---------------------------------------------------------------------------

/* Figma's overlay card (r47.231 / 3.736px border) is a 0.952 instance of the
   home card, so every home metric is reused through this one factor. */
const QA_SCALE = 280 / HOME_TILE_W
const QA_TILE_W = 280
const QA_TILE_H = Math.round(HOME_TILE_H * QA_SCALE) // 384, the Figma value
const QA_GAP = HOME_TILE_GAP * QA_SCALE
/* Same rhythm as home (card + gap), centred in the 1600 panel — the tiles used
   to sit on a wider, unrelated pitch. */
const QA_ROW_W = 4 * QA_TILE_W + 3 * QA_GAP
const QA_ROW_X = (1600 - QA_ROW_W) / 2

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function QuickAccessOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()
  const { content } = useContent()
  const homeTiles = content?.homeTiles ?? []

  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 100 }}>
      {/* Scrim (tap to close) */}
      <button
        type="button"
        aria-label="Close"
        className="qa-scrim"
        onClick={onClose}
        style={{
          position: 'absolute',
          inset: 0,
          background: 'rgba(5, 10, 23, 0.74)',
          cursor: 'pointer',
        }}
      />

      {/* Panel */}
      <div
        className="qa-panel"
        style={{
          position: 'absolute',
          left: 160,
          top: 215,
          width: 1600,
          height: 650,
          borderRadius: 70,
          background: 'rgba(53, 33, 17, 0.46)',
          border: '1.5px solid rgba(212, 173, 97, 0.55)',
        }}
      >
        <h2
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 53,
            textAlign: 'center',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: 46,
            color: '#F5D173',
          }}
        >
          Quick Access
        </h2>
        <p
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 117,
            textAlign: 'center',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: 20,
            color: 'rgba(255, 255, 255, 0.66)',
          }}
        >
          Jump to any category
        </p>

        {/* Close — gold circle, dark ✕ */}
        <button
          type="button"
          aria-label="Close"
          className="qa-pressable"
          onClick={onClose}
          style={{
            position: 'absolute',
            left: 1492,
            top: 39,
            width: 56,
            height: 56,
            borderRadius: 28,
            background: '#E7C078',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            cursor: 'pointer',
          }}
        >
          <svg width={22} height={22} viewBox="0 0 22 22" aria-hidden="true">
            <path
              d="M4.5 4.5 17.5 17.5M17.5 4.5 4.5 17.5"
              stroke="#0D1221"
              strokeWidth={2.4}
              strokeLinecap="round"
            />
          </svg>
        </button>

        {/* Category tiles */}
        {HOME_TILES.map((tile, i) => (
          <button
            key={tile.route}
            type="button"
            className="qa-pressable"
            onClick={() => {
              onClose()
              navigate(tile.route)
            }}
            style={{
              position: 'absolute',
              left: QA_ROW_X + i * (QA_TILE_W + QA_GAP),
              top: 185,
              width: QA_TILE_W,
              height: QA_TILE_H,
              borderRadius: 47.231,
              border: '3.736px solid var(--cream-border)',
              overflow: 'hidden',
              cursor: 'pointer',
            }}
          >
            <img
              src={tile.image}
              alt=""
              draggable={false}
              style={{ position: 'absolute', ...tile.photo }}
            />
            <div
              className={
                tile.solidScrim === true ? 'qa-tile-scrim qa-tile-scrim--solid' : 'qa-tile-scrim'
              }
            />
            <span
              style={{
                position: 'absolute',
                // Home anchors the label from its TOP so 1- and 2-line labels
                // share a first baseline; the same must hold here.
                top: HOME_LABEL_TOP * QA_SCALE,
                left: '50%',
                transform: 'translateX(-50%)',
                width: tile.labelWidth * QA_SCALE,
                textAlign: 'center',
                whiteSpace: 'pre-line',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: HOME_LABEL_SIZE * QA_SCALE,
                lineHeight: HOME_LABEL_LINE,
                color: '#FFFFFF',
              }}
            >
              {designedLabel(homeTiles[i]?.label, tile.fallbackLabel)}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Provider
// ---------------------------------------------------------------------------

export function QuickAccessProvider({ children }: { children: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)
  const value = useMemo<QuickAccessContextValue>(() => ({ open: () => setIsOpen(true) }), [])

  return (
    <QuickAccessContext.Provider value={value}>
      {children}
      {isOpen && <QuickAccessOverlay onClose={() => setIsOpen(false)} />}
    </QuickAccessContext.Provider>
  )
}
