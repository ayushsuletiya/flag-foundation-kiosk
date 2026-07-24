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
import {
  MAX_INSTALLATION_PHOTOS,
  MONUMENTAL,
  SHARED,
  installationPhoto,
} from '../../assets/paths.ts'
import { probeImageCached } from '../../assets/probe.ts'
import { UncroppedPhoto } from '../../components/UncroppedPhoto.tsx'
import './monumental.css'

/** One crossfade layer. The installation is NEVER cropped (a tall flagpole
 * shot lost its flag to the landscape `cover` fit) and the white frame HUGS
 * the photo instead of boxing the slot. */
function CarouselPhoto({ src, visible }: { src: string; visible: boolean }) {
  return (
    <UncroppedPhoto
      src={src}
      imgClassName="inst-photo"
      style={{ opacity: visible ? 1 : 0, transition: 'opacity 700ms ease' }}
    />
  )
}

/** Contiguous installations/<id>/1.jpg, 2.jpg… (any count, carousel-ready). */
function useInstallationPhotos(id: number | null): { ready: boolean; photos: string[] } {
  const [state, setState] = useState<{ id: number; photos: string[] } | null>(null)

  useEffect(() => {
    if (id === null) return
    let alive = true
    void (async () => {
      const urls = Array.from({ length: MAX_INSTALLATION_PHOTOS }, (_, i) =>
        installationPhoto(id, i + 1),
      )
      const found = await Promise.all(urls.map(probeImageCached))
      const photos: string[] = []
      for (let i = 0; i < urls.length; i++) {
        if (found[i] !== true) break
        photos.push(urls[i]!)
      }
      if (alive) setState({ id, photos })
    })()
    return () => {
      alive = false
    }
  }, [id])

  const settled = state !== null && state.id === id
  return { ready: settled, photos: settled ? state.photos : [] }
}

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

  const row = useMemo(() => {
    const id = Number(rowId)
    return content?.installations.find((r) => r.id === id) ?? null
  }, [content, rowId])

  const { ready: photosReady, photos } = useInstallationPhotos(row?.id ?? null)

  // 2+ photos → gentle auto-advancing crossfade with tappable dots.
  const [photoIndex, setPhotoIndex] = useState(0)
  useEffect(() => {
    setPhotoIndex(0)
  }, [row?.id])
  useEffect(() => {
    if (photos.length < 2) return
    const timer = setInterval(() => setPhotoIndex((i) => (i + 1) % photos.length), 3500)
    return () => clearInterval(timer)
  }, [photos.length, photoIndex])

  // Content loaded but the id is unknown → never dead-end the kiosk.
  if (content !== null && row === null) {
    return <Navigate to="/monumental/map" replace />
  }

  const photo = photos[0] ?? TERRAIN_STILL
  const stateValue =
    row === null ? '' : row.district !== null ? `${row.state}, ${row.district}` : row.state

  return (
    <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#0F0A04' }}>
      {/* Blurred oversized photo backdrop (audit: -46,-156 2004×1336) */}
      <img
        src={photo}
        alt=""
        draggable={false}
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

      {/* Photo card — a transparent AREA, not a box: the white frame lives
          on the photo (.inst-photo) so it hugs the real shape. The plate
          returns only for the no-photo placeholder below. */}
      <div
        style={{
          position: 'absolute',
          left: 81,
          top: 245,
          width: 930.097,
          height: 686.555,
        }}
      >
        {photos.length > 0 ? (
          <>
            {/* Stacked crossfade — any photo count; single photo = plain still */}
            {photos.map((src, i) => (
              <CarouselPhoto key={src} src={src} visible={i === photoIndex} />
            ))}
            {photos.length >= 2 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: 24,
                  left: 0,
                  right: 0,
                  display: 'flex',
                  justifyContent: 'center',
                  gap: 12,
                }}
              >
                {photos.map((src, i) => (
                  <button
                    key={src}
                    type="button"
                    aria-label={`Photo ${i + 1}`}
                    onClick={() => setPhotoIndex(i)}
                    style={{
                      width: 13,
                      height: 13,
                      padding: 0,
                      borderRadius: '50%',
                      border: 'none',
                      cursor: 'pointer',
                      background: i === photoIndex ? 'var(--gold-cream, #FFEDC5)' : 'rgba(255, 255, 255, 0.45)',
                      boxShadow: '0 1px 4px rgba(0, 0, 0, 0.5)',
                    }}
                  />
                ))}
              </div>
            )}
          </>
        ) : photosReady ? (
          <div
            style={{
              width: '100%',
              height: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              // The card is transparent now, so the no-photo state carries
              // its own plate + frame.
              borderRadius: 41.75,
              border: '2.319px solid #FFFFFF',
              background: 'linear-gradient(160deg, #7A5223 0%, #3E2708 100%)',
              boxSizing: 'border-box',
            }}
          >
            <img
              src={`${MONUMENTAL.flagMarker}/static.png`}
              alt=""
              draggable={false}
              style={{ height: 420, opacity: 0.85 }}
            />
          </div>
        ) : null}
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
