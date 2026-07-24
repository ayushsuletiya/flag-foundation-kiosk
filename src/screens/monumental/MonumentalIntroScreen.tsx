/**
 * MonumentalIntroScreen — Figma frame 795:7678 "Flag Installations — intro".
 *
 * Route /monumental. Plays assets/1-monumental-flags/intro/intro.mp4 ONCE
 * full-bleed, then auto-navigates to /monumental/map. The mp4 is
 * user-provided and may not exist yet:
 *  - <video> onEnded → navigate (the delivered file "just works");
 *  - onError (missing/broken file) → the Figma terrain still shows with a
 *    subtle "Loading map…" shimmer where the "5 Sec. Animation Video"
 *    placeholder sat (center, top 402), and we auto-advance after 1.2s.
 * Tap anywhere skips immediately.
 *
 * Layer stack per audit: terrain still/video → rgba(0,0,0,0.75) scrim →
 * gradient A (orange→blue vertical) → gradient B (left brown vignette) →
 * wordmark + Home/Quick Access nav. The 0.75 scrim is Figma's grade for the
 * STILL; while the real video plays we ease it to 0.35 so the delivered
 * animation stays visible (audit risk #4 decision).
 */
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { HomeButton } from '../../components/HomeButton.tsx'
import { QuickAccessPill } from '../../components/QuickAccessPill.tsx'
import { MonumentalHeader } from './MonumentalHeader.tsx'
import { MONUMENTAL } from '../../assets/paths.ts'
import './monumental.css'

const INTRO_VIDEO = MONUMENTAL.introVideo
const INTRO_POSTER = MONUMENTAL.introPoster
const FALLBACK_ADVANCE_MS = 1200
/** Hard ceiling for the whole intro, comfortably past the intended ~5s clip. A
 * video that neither ends nor errors (muted-autoplay silently rejected, a decode
 * stall, or an over-long/looping file) must not strand the visitor here until
 * the 120s idle reset drags them home. */
const MAX_INTRO_MS = 8000

export function MonumentalIntroScreen() {
  const navigate = useNavigate()
  const doneRef = useRef(false)
  const [videoFailed, setVideoFailed] = useState(false)
  const [videoPlaying, setVideoPlaying] = useState(false)

  const goToMap = () => {
    if (doneRef.current) return
    doneRef.current = true
    navigate('/monumental/map', { replace: true })
  }

  // Missing video → shimmer still, advance after 1.2s.
  useEffect(() => {
    if (!videoFailed) return
    const timer = setTimeout(goToMap, FALLBACK_ADVANCE_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [videoFailed])

  // Hard ceiling armed on mount: covers the cases the video events never
  // report (autoplay reject / stall / over-long file). goToMap is idempotent,
  // so a normal onEnded before this fires makes it a no-op.
  useEffect(() => {
    const timer = setTimeout(goToMap, MAX_INTRO_MS)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  return (
    <div
      style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}
      onPointerDown={goToMap} // tap anywhere skips
    >
      {/* Terrain still — poster under the video and the fallback visual */}
      <img
        src={INTRO_POSTER}
        alt=""
        draggable={false}
        style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' }}
      />

      {!videoFailed && (
        <video
          src={INTRO_VIDEO}
          muted
          autoPlay
          playsInline
          preload="auto"
          disablePictureInPicture
          onPlaying={() => setVideoPlaying(true)}
          onEnded={goToMap}
          onError={() => setVideoFailed(true)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
          }}
        />
      )}

      {/* Black scrim (Figma 0.75 over the still; lighter over live video) */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          background: videoPlaying ? 'rgba(0, 0, 0, 0.35)' : 'rgba(0, 0, 0, 0.75)',
          transition: 'background 0.5s ease',
        }}
      />
      {/* BG / base gradient A — warm top → deep-blue bottom */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--map-tint-gradient)' }} />
      {/* BG / base gradient B — left brown vignette */}
      <div style={{ position: 'absolute', inset: 0, background: 'var(--map-edge-gradient)' }} />

      {/* Center slot: Figma's "5 Sec. Animation Video" placeholder becomes a
          quiet loading shimmer until the real mp4 exists */}
      {videoFailed && (
        <div
          className="mon-shimmer-text"
          style={{
            position: 'absolute',
            left: 0,
            right: 0,
            top: 470,
            textAlign: 'center',
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: 44,
            letterSpacing: 2,
          }}
        >
          Loading map…
        </div>
      )}

      <MonumentalHeader />
      <HomeButton
        onClick={() => navigate('/')}
        style={{ position: 'absolute', left: 1491, top: 36 }}
      />
      <QuickAccessPill style={{ position: 'absolute', left: 1626, top: 36 }} />
    </div>
  )
}
