/**
 * UiSounds — installs ONE global pointerdown listener that plays a UI sound for
 * any button/control press, so every interaction gets tactile feedback with no
 * per-component wiring. The sound is chosen from an explicit `data-sfx`, then the
 * control's accessible name (Home / Back / Quick Access), then a few known
 * labels (Know More / Read More / Continue → a confirm), else a soft tap.
 *
 * Mounted once at the app root. Capture-phase so it fires even if the target
 * stops propagation; pointerdown (not click) so the sound lands the instant the
 * finger touches.
 */
import { useEffect } from 'react'

import { playSfx, type SfxKind } from '../audio/sfx.ts'

const HIT = 'button, [role="button"], a[href], [data-sfx]'

export function UiSounds() {
  useEffect(() => {
    const onDown = (e: PointerEvent) => {
      const target = e.target
      if (!(target instanceof Element)) return
      const el = target.closest<HTMLElement>(HIT)
      if (el === null) return

      // Opt-out: a control that voices itself elsewhere (e.g. the chakra spoke
      // chime, fired from selectSpoke) marks data-sfx="off" so it doesn't also
      // get the generic delegated tap on top.
      if (el.dataset.sfx === 'off') return

      let kind: SfxKind | string | undefined = el.dataset.sfx
      if (kind === undefined || kind === '') {
        const aria = (el.getAttribute('aria-label') ?? '').toLowerCase()
        const txt = (el.textContent ?? '').trim().toLowerCase()
        if (/(^|\s)home(\s|$)/.test(aria)) kind = 'home'
        else if (aria === 'back') kind = 'back'
        else if (aria.includes('quick access') || txt === 'quick access') kind = 'open'
        else if (txt === 'know more' || txt === 'read more' || txt === 'continue') kind = 'select'
        else kind = 'tap'
      }
      playSfx(kind)
    }
    window.addEventListener('pointerdown', onDown, { capture: true })
    return () => window.removeEventListener('pointerdown', onDown, { capture: true })
  }, [])

  return null
}
