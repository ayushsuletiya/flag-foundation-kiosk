/**
 * QuickAccessOverlay — Figma 795:6446 "Quick Access — Overlay", global.
 *
 * Summonable from every screen via the Quick Access pill: scrim
 * rgba(5,10,23,0.74) (tap to close) over a 1600×650 panel at (160,215),
 * r70, bg rgba(53,33,17,0.46), 1.5px rgba(212,173,97,0.55) border. Title
 * Poppins 600 46 #F5D173 + subtitle, then the 4 category photo tiles
 * (280×384, r47.231, 3.736px #FFF8DB border — scaled instances of the home
 * category cards, so the home card assets/crops are reused) and a 56px gold
 * close circle at (1652,254).
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
  type CSSProperties,
  type ReactNode,
} from 'react'
import { useNavigate } from 'react-router-dom'
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
// Tiles — photos + crops shared with the home screen category cards
// (audit: fractional 47.231 radius / 3.736 border prove a scaled instance)
// ---------------------------------------------------------------------------

interface QuickTile {
  route: string
  label: string
  image: string
  /** Figma image-fill crop, % of the card box (same values as HomeScreen). */
  photo: CSSProperties
  /** National Symbols card: scrim ends solid #5E3809 (masks baked text). */
  solidScrim?: boolean
}

const TILES: readonly QuickTile[] = [
  {
    route: '/symbols',
    label: 'National Symbols\nof India',
    image: 'assets/images/home/card-symbols.png',
    photo: { left: '-7.6%', top: '-24.62%', width: '115.37%', height: '149.38%' },
    solidScrim: true,
  },
  {
    route: '/monumental',
    label: 'Flag Foundation\nInstallations',
    image: 'assets/images/home/card-monumental.png',
    photo: { left: '-1.2%', top: '-1.03%', width: '102.28%', height: '143.77%' },
  },
  {
    route: '/history',
    label: 'History\nof Tiranga',
    image: 'assets/images/home/card-history.png',
    photo: { left: '0%', top: '0%', width: '100%', height: '138.07%' },
  },
  {
    route: '/chakra',
    label: 'Explore\nAshok Chakra',
    image: 'assets/images/home/card-chakra.png',
    photo: { left: '-35.82%', top: '0%', width: '171.98%', height: '100%' },
  },
]

const TILE_X = [267, 636, 1005, 1374] as const

// ---------------------------------------------------------------------------
// Overlay
// ---------------------------------------------------------------------------

function QuickAccessOverlay({ onClose }: { onClose: () => void }) {
  const navigate = useNavigate()

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
        {TILES.map((tile, i) => (
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
              left: (TILE_X[i] ?? 267) - 160,
              top: 185,
              width: 280,
              height: 384,
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
                left: 0,
                right: 0,
                bottom: 37,
                textAlign: 'center',
                whiteSpace: 'pre-line',
                fontFamily: 'var(--font-ui)',
                fontWeight: 600,
                fontSize: 26,
                lineHeight: 1.226,
                color: '#FFFFFF',
              }}
            >
              {tile.label}
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
