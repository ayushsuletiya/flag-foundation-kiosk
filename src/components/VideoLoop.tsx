/**
 * VideoLoop — muted autoplay looping <video> for background media
 * (home bg, India map loop). Falls back to the poster image (or a black
 * fill) if the video source fails to load, so a missing asset never
 * leaves a broken-media glyph on the kiosk.
 */
import { useEffect, useState, type CSSProperties } from 'react'

export interface VideoLoopProps {
  src: string
  poster?: string
  objectFit?: CSSProperties['objectFit']
  className?: string
  style?: CSSProperties
}

export function VideoLoop({ src, poster, objectFit = 'cover', className, style }: VideoLoopProps) {
  const [failed, setFailed] = useState(false)

  // A new source deserves a fresh attempt.
  useEffect(() => {
    setFailed(false)
  }, [src])

  const fillStyle: CSSProperties = {
    width: '100%',
    height: '100%',
    objectFit,
    ...style,
  }

  if (failed) {
    return poster !== undefined ? (
      <img src={poster} alt="" className={className} style={fillStyle} />
    ) : (
      <div className={className} style={{ ...fillStyle, background: '#000000' }} />
    )
  }

  return (
    <video
      src={src}
      poster={poster}
      muted
      autoPlay
      loop
      playsInline
      preload="auto"
      disablePictureInPicture
      onError={() => setFailed(true)}
      className={className}
      style={fillStyle}
    />
  )
}
