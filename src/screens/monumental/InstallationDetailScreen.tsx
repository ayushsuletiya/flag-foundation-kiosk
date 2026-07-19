/**
 * InstallationDetailScreen — Figma 795:3768 "Flag Installations — Detail".
 *
 * Route /monumental/detail/:rowId (rowId = Excel tab 04 "#" column).
 * Full-bleed copy of the site photo blurred (CSS filter on the <img>, not a
 * backdrop-filter — audit perf note) + rgba(0,0,0,0.71) darkening +
 * rgba(66,37,6,0.19) brown tint. Left: Poppins Bold 52 title + the sharp
 * photo card (81,245 930×686.6 r41.75, 2.32px white border). Right rail
 * past the 5×512 gradient divider: STATE / FLAG HEIGHT / SITE stat rows
 * (gold Figma-exported icons, #FFEDC5 uppercase labels, white Inter Bold
 * values; the height value is the 49.292px gold-gradient-clipped number).
 * Nav: Back (1356,36) → map, Home, Quick Access.
 */
import { useEffect, useMemo, useState } from 'react'
import { Navigate, useNavigate, useParams } from 'react-router-dom'
import { useContent } from '../../data/ContentContext.tsx'
import { BackButton } from '../../components/BackButton.tsx'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { TERRAIN_STILL } from './monumentalGeo.ts'
import { MONUMENTAL, SHARED, installationPhoto } from '../../assets/paths.ts'
import './monumental.css'

const LABEL_STYLE = {
  fontFamily: 'var(--font-numeral)',
  fontWeight: 600,
  fontSize: 22.592,
  letterSpacing: 1.8074,
  textTransform: 'uppercase',
  color: 'var(--gold-cream)',
} as const

const VALUE_STYLE = {
  fontFamily: 'var(--font-numeral)',
  fontWeight: 700,
  fontSize: 36.969,
  color: '#FFFFFF',
  width: 498,
  lineHeight: 1.18,
} as const

function StatIcon({ src, size = 90.385, boxTop }: { src: string; size?: number; boxTop: number }) {
  // All rows share the 90.385px icon slot; the site glyph is a loose 69px
  // vector in Figma and gets centered into the same slot (audit fix #8).
  const inset = (90.385 - size) / 2
  return (
    <img
      src={src}
      alt=""
      draggable={false}
      style={{ position: 'absolute', left: 1188 + inset, top: boxTop + inset, width: size, height: size }}
    />
  )
}

export function InstallationDetailScreen() {
  const navigate = useNavigate()
  const { rowId } = useParams()
  const { content } = useContent()
  const [photoFailed, setPhotoFailed] = useState(false)

  const row = useMemo(() => {
    const id = Number(rowId)
    return content?.installations.find((r) => r.id === id) ?? null
  }, [content, rowId])

  useEffect(() => {
    setPhotoFailed(false)
  }, [row?.id])

  // Content loaded but the id is unknown → never dead-end the kiosk.
  if (content !== null && row === null) {
    return <Navigate to="/monumental/map" replace />
  }

  const photo = row !== null && !photoFailed ? installationPhoto(row.id) : TERRAIN_STILL
  const stateValue =
    row === null ? '' : row.district !== null ? `${row.state}, ${row.district}` : row.state

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0F0A04' }}>
      {/* Blurred oversized photo backdrop (audit: -46,-156 2004×1336) */}
      <img
        src={photo}
        alt=""
        draggable={false}
        onError={() => setPhotoFailed(true)}
        style={{
          position: 'absolute',
          left: -46,
          top: -156,
          width: 2004,
          height: 1336,
          maxWidth: 'none',
          objectFit: 'cover',
          filter: 'blur(27.15px)',
        }}
      />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(0, 0, 0, 0.71)' }} />
      <div style={{ position: 'absolute', inset: 0, background: 'rgba(66, 37, 6, 0.19)' }} />

      {/* Title */}
      <h1
        style={{
          position: 'absolute',
          left: 81,
          top: 112,
          maxWidth: 1240,
          fontFamily: 'var(--font-ui)',
          fontWeight: 700,
          fontSize: 52,
          color: '#FFFFFF',
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {row?.location ?? ''}
      </h1>

      {/* Photo card */}
      <div
        style={{
          position: 'absolute',
          left: 81,
          top: 245,
          width: 930.097,
          height: 686.555,
          borderRadius: 41.75,
          border: '2.319px solid #FFFFFF',
          overflow: 'hidden',
          background: 'linear-gradient(160deg, #7A5223 0%, #3E2708 100%)',
        }}
      >
        {row !== null && !photoFailed ? (
          <img
            src={installationPhoto(row.id)}
            alt=""
            draggable={false}
            onError={() => setPhotoFailed(true)}
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        ) : (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <img
              src={`${MONUMENTAL.flagMarker}/static.png`}
              alt=""
              draggable={false}
              style={{ height: 420, opacity: 0.85 }}
            />
          </div>
        )}
      </div>

      {/* Vertical gradient divider */}
      <div
        style={{
          position: 'absolute',
          left: 1107,
          top: 349,
          width: 5,
          height: 512,
          background:
            'linear-gradient(180deg, rgba(115,115,115,0) 1.054%, #FFFFFF 48.755%, rgba(115,115,115,0) 100%)',
        }}
      />

      {/* Stat rows */}
      <StatIcon src={`${SHARED.icons}/icon-location-pin.svg`} boxTop={378} />
      <div style={{ position: 'absolute', left: 1296.85, top: 386.2, ...LABEL_STYLE }}>State</div>
      <div style={{ position: 'absolute', left: 1296.85, top: 421.1, ...VALUE_STYLE }}>
        {stateValue}
      </div>

      <StatIcon src={`${SHARED.icons}/icon-flag-height.svg`} boxTop={542.31} />
      <div style={{ position: 'absolute', left: 1296.85, top: 550.5, ...LABEL_STYLE }}>
        Flag Height
      </div>
      <div
        style={{
          position: 'absolute',
          left: 1296.85,
          top: 581,
          fontFamily: 'var(--font-numeral)',
          fontWeight: 700,
          fontSize: 49.292,
          background: 'var(--gold-gradient)',
          backgroundClip: 'text',
          WebkitBackgroundClip: 'text',
          color: 'transparent',
          whiteSpace: 'nowrap',
        }}
      >
        {row !== null && row.heightFt !== null ? `${row.heightFt} ft` : '—'}
      </div>

      <StatIcon src={`${SHARED.icons}/icon-site.svg`} size={69} boxTop={706.7} />
      <div style={{ position: 'absolute', left: 1296.85, top: 714.8, ...LABEL_STYLE }}>Site</div>
      <div style={{ position: 'absolute', left: 1296.85, top: 749.7, ...VALUE_STYLE }}>
        {row?.landmark ?? row?.location ?? ''}
      </div>

      {/* Nav */}
      <BackButton
        onClick={() => navigate('/monumental/map')}
        style={{ position: 'absolute', left: 1356, top: 36 }}
      />
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />
    </div>
  )
}
