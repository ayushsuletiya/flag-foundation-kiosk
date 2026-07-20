/**
 * imageFocus — keeps the tricolor flag inside a cover-cropped photo box.
 *
 * Installation photos come in every aspect ratio; `object-fit: cover` into a
 * landscape card crops the top/bottom of portrait shots, which is exactly
 * where the flag usually is. Instead of a blind center crop, the photo is
 * scanned once (downscaled, off-DOM canvas) for saffron/green flag pixels;
 * their median height becomes the crop focus, so the flag stays in view for
 * ANY drop-in photo — no per-photo config, works under vite HTTP and the
 * packaged file:// build (same-origin, canvas never taints).
 *
 * No flag-like pixels (indoor shots, close-ups) → gentle upper-third bias,
 * which beheads nobody and still favours pole + sky compositions.
 */
import { useEffect, useState } from 'react'

/** Fallback focus while scanning / when no tricolor is found (0..1 of height). */
const DEFAULT_FOCUS = 0.34
/** Flag pixels must cover at least this fraction of the sample to count. */
const MIN_COVERAGE = 0.002
const SAMPLE_W = 96

interface FocusResult {
  /** Median flag-pixel height, 0 (top) .. 1 (bottom). */
  focus: number
  /** Natural aspect (w/h) — needed to translate focus → object-position %. */
  aspect: number
}

const cache = new Map<string, Promise<FocusResult | null>>()

function scan(src: string): Promise<FocusResult | null> {
  const pending = cache.get(src)
  if (pending !== undefined) return pending
  const job = new Promise<FocusResult | null>((resolve) => {
    const img = new Image()
    img.onload = () => {
      const w = Math.min(SAMPLE_W, img.naturalWidth)
      const h = Math.max(1, Math.round((img.naturalHeight / img.naturalWidth) * w))
      const canvas = document.createElement('canvas')
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext('2d', { willReadFrequently: true })
      if (ctx === null) {
        resolve(null)
        return
      }
      ctx.drawImage(img, 0, 0, w, h)
      let data: Uint8ClampedArray
      try {
        data = ctx.getImageData(0, 0, w, h).data
      } catch {
        resolve(null) // tainted (shouldn't happen — local assets only)
        return
      }
      const rowCounts = new Array<number>(h).fill(0)
      let total = 0
      for (let y = 0; y < h; y++) {
        for (let x = 0; x < w; x++) {
          const i = (y * w + x) * 4
          const r = data[i]!
          const g = data[i + 1]!
          const b = data[i + 2]!
          const saffron = r > 140 && r - b > 85 && g > 45 && g < 175 && b < 110
          const green = g > 60 && g - r > 30 && g - b > 25
          if (saffron || green) {
            rowCounts[y]!++
            total++
          }
        }
      }
      if (total < w * h * MIN_COVERAGE) {
        resolve(null)
        return
      }
      // Flags fly at the TOP of poles — anchor on the topmost dense tricolor
      // rows, not the overall median (tricolor bunting/crowds lower in the
      // frame would otherwise win, e.g. balloon garlands). Two consecutive
      // rows of hits filters lone warm-sky pixels.
      let flagTop = -1
      for (let y = 0; y < h - 1; y++) {
        if (rowCounts[y]! >= 3 && rowCounts[y + 1]! >= 2) {
          flagTop = y
          break
        }
      }
      if (flagTop === -1) {
        resolve(null)
        return
      }
      // Nudge below the detected top edge so the flag sits inside the crop.
      const focus = Math.min(1, flagTop / h + 0.1)
      resolve({ focus, aspect: img.naturalWidth / img.naturalHeight })
    }
    img.onerror = () => resolve(null)
    img.src = src
  })
  cache.set(src, job)
  return job
}

/**
 * `object-position` that centers the photo's flag in a `cover` box of the
 * given aspect (width / height). Returns the upper-third default until the
 * scan lands; non-flag photos keep the default permanently.
 */
export function useFlagObjectPosition(src: string | null, boxAspect: number): string {
  const [position, setPosition] = useState(`center ${DEFAULT_FOCUS * 100}%`)

  useEffect(() => {
    setPosition(`center ${DEFAULT_FOCUS * 100}%`)
    if (src === null) return
    let alive = true
    void scan(src).then((result) => {
      if (!alive || result === null) return
      // Cover crops vertically only when the image is taller than the box.
      // visible = fraction of image height shown; solve the object-position
      // percentage that puts `focus` at the middle of the crop window.
      const visible = result.aspect / boxAspect
      if (visible >= 1) return // full height visible — nothing to bias
      const p = (result.focus - visible / 2) / (1 - visible)
      const clamped = Math.max(0, Math.min(1, p))
      setPosition(`center ${(clamped * 100).toFixed(1)}%`)
    })
    return () => {
      alive = false
    }
  }, [src, boxAspect])

  return position
}
