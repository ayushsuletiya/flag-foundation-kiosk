/**
 * SectionAudio — drives the per-zone background score from the current route,
 * and arms audio on the first user gesture. Mounted once inside the router.
 */
import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'

import { SHARED } from '../assets/paths.ts'
import { armAudio, setSection } from '../audio/sectionAudio.ts'

function bedFor(path: string): { key: string; src: string } {
  if (path.startsWith('/monumental')) return { key: 'monumental', src: SHARED.scoreMonumental }
  if (path.startsWith('/history')) return { key: 'history', src: SHARED.scoreHistory }
  if (path.startsWith('/chakra')) return { key: 'chakra', src: SHARED.scoreChakra }
  if (path.startsWith('/symbols')) return { key: 'symbols', src: SHARED.scoreSymbols }
  return { key: 'home', src: SHARED.ambience }
}

export function SectionAudio() {
  const { pathname } = useLocation()

  useEffect(() => {
    const bed = bedFor(pathname)
    setSection(bed.key, bed.src)
  }, [pathname])

  useEffect(() => {
    const arm = () => armAudio()
    window.addEventListener('pointerdown', arm, { capture: true })
    window.addEventListener('keydown', arm, { capture: true })
    return () => {
      window.removeEventListener('pointerdown', arm, { capture: true })
      window.removeEventListener('keydown', arm, { capture: true })
    }
  }, [])

  return null
}
