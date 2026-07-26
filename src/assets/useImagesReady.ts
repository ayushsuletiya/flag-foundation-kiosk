/**
 * useImagesReady — gate a reveal on images being fully decoded.
 *
 * Screens use this so their entrance animation plays over ALREADY-PAINTED
 * artwork instead of racing it: nothing animates in until every photo it needs
 * is decoded, so a visitor never watches the pictures arrive.
 */
import { useEffect, useState } from 'react'

import { areImagesDecoded, preloadImages } from './preload.ts'

export function useImagesReady(srcs: readonly string[]): boolean {
  // Join, so the effect re-runs only when the actual list changes (callers
  // usually pass a fresh array literal every render).
  const key = srcs.join('|')
  // Start TRUE when everything is already decoded, synchronously on the very
  // first render. Returning to a screen must not blank its artwork for a frame
  // and re-run the entrance — that reads as "the images are loading again"
  // (user 2026-07-26) even though nothing is refetched.
  const [ready, setReady] = useState(() => areImagesDecoded(srcs))

  useEffect(() => {
    if (srcs.length === 0 || areImagesDecoded(srcs)) {
      setReady(true)
      return
    }
    let alive = true
    setReady(false)
    void preloadImages(srcs).then(() => {
      if (alive) setReady(true)
    })
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- keyed on the joined list
  }, [key])

  return ready
}
