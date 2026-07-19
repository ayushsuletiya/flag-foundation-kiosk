/**
 * paths — the single source of truth for where media lives under assets/.
 *
 * The tree mirrors the app: one numbered folder per category, one subfolder
 * per section, so the client can find every drop-in slot from the Finder
 * without reading code. Runtime-relative URLs (served at /assets/… in vite
 * dev, copied next to dist/index.html for the packaged file:// build).
 *
 * Every folder named background/ (and the monumental intro/) accepts EITHER
 * bg.mp4 OR bg.png (or bg-1..5.png for a crossfade) — resolution order lives
 * in components/DynamicBackground.tsx. Screens must take paths from here,
 * never hardcode them.
 */

export const HOME = {
  /** bg.mp4 | bg-1..5.png | bg.png (+ optional poster.png under the video) */
  background: 'assets/0-home/background',
  cards: 'assets/0-home/cards',
  logo: 'assets/0-home/logo/logo-nju.png',
} as const

export const MONUMENTAL = {
  /** intro.mp4 plays once → map; poster.png shows under/instead of it */
  introVideo: 'assets/1-monumental-flags/intro/intro.mp4',
  introPoster: 'assets/1-monumental-flags/intro/poster.png',
  /** bg.mp4 (full-bleed loop) | bg.png (calibrated terrain still) */
  mapBackground: 'assets/1-monumental-flags/map/background',
  mapStates: 'assets/1-monumental-flags/map/states',
  flagMarker: 'assets/1-monumental-flags/map/flag-marker',
  selectStateBackground: 'assets/1-monumental-flags/select-state/background',
  installations: 'assets/1-monumental-flags/installations',
} as const

/** Per-year media in <base>/<year>/{background,flag,gallery}/ */
export const HISTORY_BASE = 'assets/2-history-of-tiranga'

export const CHAKRA = {
  background: 'assets/3-ashok-chakra/background',
  /** The 3D scene's environment texture — keep bg.png present even when a
   *  bg.mp4 is dropped; three.js samples the still, the DOM plays the video. */
  backgroundStill: 'assets/3-ashok-chakra/background/bg.png',
  flagPole: 'assets/3-ashok-chakra/flag-tab/flag-pole.png',
  wheelPoster: 'assets/3-ashok-chakra/wheel/wheel-poster.png',
} as const

export const SYMBOLS = {
  carouselBackground: 'assets/4-national-symbols/carousel/background',
  detailBackground: 'assets/4-national-symbols/detail/background',
  /** Optional per-symbol Did You Know photo: dyk/<slug>.png (falls back to
   *  the symbol's turntable static cutout). */
  dyk: 'assets/4-national-symbols/detail/dyk',
  turntables: 'assets/4-national-symbols/turntables',
} as const

export const SHARED = {
  icons: 'assets/_shared/icons',
  virtueIcons: 'assets/_shared/icons/virtues',
} as const

export const installationPhoto = (id: number): string =>
  `${MONUMENTAL.installations}/${id}.jpg`
