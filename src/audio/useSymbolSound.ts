/**
 * useSymbolSound — plays the current symbol's ambience (a soft looping bed under
 * the National Symbols score) and crossfades it as the symbol changes. Drop a
 * file at assets/4-national-symbols/symbols/<slug>/sound.mp3 to give a symbol its
 * sound (e.g. a distant jungle/tiger bed, a river for Ganga); symbols without a
 * file simply stay silent. The layer clears when leaving the symbols section.
 */
import { useEffect } from 'react'

import { SYMBOLS } from '../assets/paths.ts'
import { probeAudioCached } from '../assets/probe.ts'
import { setLayer } from './sectionAudio.ts'

export function useSymbolSound(slug: string | null): void {
  useEffect(() => {
    if (slug === null) {
      setLayer(null)
      return
    }
    let alive = true
    const src = `${SYMBOLS.symbols}/${slug}/sound.mp3`
    // Probe once (cached) so missing files don't 404 on every auto-advance.
    void probeAudioCached(src).then((ok) => {
      if (!alive) return
      if (ok) setLayer(`sym:${slug}`, src)
      else setLayer(null)
    })
    return () => {
      alive = false
      setLayer(null)
    }
  }, [slug])
}
