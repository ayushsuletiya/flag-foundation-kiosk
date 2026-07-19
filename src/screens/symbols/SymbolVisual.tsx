/**
 * SymbolVisual — one symbol's artwork slot on the National Symbols screens.
 *
 * mode "live"  → PngSequencePlayer on the turntable pattern
 *                assets/4-national-symbols/turntables/<slug>/f_{frame}.png (25fps loop),
 *                poster static.png. Today only statics exist, so the player
 *                falls back to the poster; dropping numbered frames later
 *                makes it play with zero code changes (count is probed).
 * mode "still" → plain <img static.png> (dimmed side cards — no player cost).
 *
 * Symbols without any media get the styled placeholder tile (build spec §1).
 */
import type { CSSProperties } from 'react'
import { PngSequencePlayer } from '../../components/PngSequencePlayer.tsx'
import { useSymbolMedia } from './symbolsMedia.ts'

const SEQUENCE_FPS = 25

export interface SymbolVisualProps {
  slug: string
  /** Short display name for the placeholder tile (e.g. "LOTUS"). */
  name: string
  width: number
  height: number
  /** "live" plays the turntable; "still" renders only the static poster. */
  mode?: 'live' | 'still'
  fit?: 'cover' | 'contain'
  style?: CSSProperties
}

/** Quiet navy tile with a gold ring monogram — symbols without media yet. */
function PlaceholderTile({ name, style }: { name: string; style?: CSSProperties }) {
  const initial = name.trim().charAt(0) || '?'
  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: '6%',
        background: 'radial-gradient(120% 90% at 50% 32%, #142650 0%, #081128 68%, #050b1c 100%)',
        ...style,
      }}
    >
      <div
        style={{
          width: '52%',
          aspectRatio: '1',
          borderRadius: '50%',
          border: '1.5px solid rgba(246, 213, 104, 0.5)',
          boxShadow: 'inset 0 0 24px rgba(246, 213, 104, 0.12)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-ui)',
            fontWeight: 600,
            fontSize: '4.4em',
            lineHeight: 1,
            background: 'var(--gold-gradient)',
            backgroundClip: 'text',
            WebkitBackgroundClip: 'text',
            color: 'transparent',
          }}
        >
          {initial}
        </span>
      </div>
      <span
        style={{
          fontFamily: 'var(--font-ui)',
          fontWeight: 400,
          fontSize: '1.05em',
          letterSpacing: '0.18em',
          color: 'rgba(255, 255, 255, 0.72)',
          textAlign: 'center',
          padding: '0 8%',
        }}
      >
        {name}
      </span>
    </div>
  )
}

export function SymbolVisual({
  slug,
  name,
  width,
  height,
  mode = 'live',
  fit = 'cover',
  style,
}: SymbolVisualProps) {
  const media = useSymbolMedia(slug)

  // Probe in flight — hold an empty slot (no flash of the wrong fallback).
  if (!media.ready) return <div style={{ width, height, ...style }} />

  if (!media.hasStatic && media.frameCount === 0) {
    return (
      <div style={{ width, height, ...style }}>
        <PlaceholderTile name={name} />
      </div>
    )
  }

  if (mode === 'still' && media.hasStatic) {
    return (
      <img
        src={media.staticUrl}
        alt=""
        width={width}
        height={height}
        style={{ objectFit: fit, ...style }}
      />
    )
  }

  return (
    <PngSequencePlayer
      srcPattern={media.srcPattern}
      frameCount={Math.max(1, media.frameCount)}
      fps={SEQUENCE_FPS}
      loop
      poster={media.hasStatic ? media.staticUrl : undefined}
      width={width}
      height={height}
      fit={fit}
      style={style}
    />
  )
}
