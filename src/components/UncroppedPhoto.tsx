/**
 * UncroppedPhoto — ONE rule for every content photograph in the app:
 * the photo is NEVER cropped, and the frame HUGS its real shape.
 *
 *   1. never crop the subject — `object-fit: cover` in a fixed slot beheaded
 *      portraits of historical figures and cut the tops off flagpoles
 *      (user 2026-07-23: "historical figures should not cut");
 *   2. never draw a box around it — the frame sizes to the photo instead of
 *      the slot, so a portrait gets a tall narrow frame and a landscape a
 *      wide one (user 2026-07-23: "the shape of image was dynamic").
 *
 * The photo scales down to fit the slot it is given and keeps its aspect;
 * the wrapper only centres it. Put the visual frame (border, radius,
 * shadow) on the IMAGE via `imgClassName` — never on the slot, or the box
 * comes back.
 *
 * NOT for backgrounds: full-bleed plates (screen backgrounds, blurred
 * backdrops) are meant to cover and keep `object-fit: cover`.
 */
import type { CSSProperties } from 'react'
import './UncroppedPhoto.css'

export interface UncroppedPhotoProps {
  src: string
  alt?: string
  /**
   * Fill the slot with a blurred copy of the same photo behind the sharp
   * one. For UNIFORM tiles — a list/grid of same-size cards, where ragged
   * hugging frames would look broken (user 2026-07-23: the map list keeps
   * its consistent box). Leave off wherever the frame should hug.
   */
  fill?: boolean
  /** Extra class on the centring wrapper. */
  className?: string
  style?: CSSProperties
  /** Frame styling (border / radius / shadow) — belongs on the image. */
  imgClassName?: string
  onError?: () => void
}

export function UncroppedPhoto({
  src,
  alt = '',
  fill = false,
  className,
  style,
  imgClassName,
  onError,
}: UncroppedPhotoProps) {
  return (
    <span className={className ? `ucp ${className}` : 'ucp'} style={style}>
      {fill && (
        // Same file as the sharp copy, so the browser decodes it once.
        <img src={src} alt="" aria-hidden="true" draggable={false} className="ucp-fill" />
      )}
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
