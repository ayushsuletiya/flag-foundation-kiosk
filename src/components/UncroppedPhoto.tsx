/**
 * UncroppedPhoto — ONE rule for every content photograph in the app:
 *
 *   1. never crop the subject — `object-fit: cover` in a fixed slot beheaded
 *      portraits of historical figures and cut the tops off flagpoles
 *      (user 2026-07-23: "historical figures should not cut");
 *   2. never show bare plate around it — the empty area is filled with a
 *      blurred, zoomed copy of the SAME photo, so the slot still reads full.
 *
 * Drop it inside any positioned box (it fills it, absolutely). Give that box
 * `overflow: hidden` if it has rounded corners.
 *
 * NOT for backgrounds: full-bleed plates (screen backgrounds, blurred
 * backdrops) are meant to cover and are already scrimmed/blurred — they keep
 * `object-fit: cover`.
 */
import type { CSSProperties } from 'react'
import './UncroppedPhoto.css'

export interface UncroppedPhotoProps {
  src: string
  alt?: string
  /** Blur radius of the fill copy, px. */
  blur?: number
  /** Opacity of the fill copy — lower = subtler backdrop. */
  fillOpacity?: number
  /** Extra class on the wrapper. */
  className?: string
  style?: CSSProperties
  /** Forwarded to the sharp image (e.g. a fade-in animation class). */
  imgClassName?: string
  onError?: () => void
}

export function UncroppedPhoto({
  src,
  alt = '',
  blur = 16,
  fillOpacity = 0.6,
  className,
  style,
  imgClassName,
  onError,
}: UncroppedPhotoProps) {
  return (
    <span className={className ? `ucp ${className}` : 'ucp'} style={style}>
      {/* Same file as the sharp copy, so the browser decodes it once. */}
      <img
        src={src}
        alt=""
        aria-hidden="true"
        draggable={false}
        className="ucp-fill"
        style={{ filter: `blur(${blur}px) saturate(1.15)`, opacity: fillOpacity }}
      />
      <img
        src={src}
        alt={alt}
        draggable={false}
        className={imgClassName ? `ucp-img ${imgClassName}` : 'ucp-img'}
        onError={onError}
      />
    </span>
  )
}
