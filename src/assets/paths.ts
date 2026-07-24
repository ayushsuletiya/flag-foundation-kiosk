/**
 * paths — the single source of truth for where media lives under assets/.
 *
 * The tree mirrors the app: one numbered folder per category, one subfolder
 * per section, so the client can find every drop-in slot from the Finder
 * without reading code. Runtime-relative URLs (served at /assets/… in vite
 * dev, copied next to dist/index.html for the packaged file:// build).
 *
 * Every folder named background/ accepts EITHER bg.mp4 OR bg.png (or
 * bg-1..5.png for a crossfade) — resolution order lives in
 * components/DynamicBackground.tsx. Screens must take paths from here,
 * never hardcode them.
 */

export const HOME = {
  /** bg.mp4 | bg-1..5.png | bg.png (+ optional poster.png under the video) */
  background: 'assets/0-home/background',
  cards: 'assets/0-home/cards',
  logo: 'assets/0-home/logo/logo-nju.png',
} as const

export const MONUMENTAL = {
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
  /** The 24 virtue spoke icons: virtue-icons/<slug>.svg */
  virtueIcons: 'assets/3-ashok-chakra/virtue-icons',
} as const

export const SYMBOLS = {
  carouselBackground: 'assets/4-national-symbols/carousel-background',
  detailBackground: 'assets/4-national-symbols/detail-background',
  /** Per-symbol media home: symbols/<slug>/turntable/ (f_0001.png… +
   *  static.png) and symbols/<slug>/did-you-know/ (1.png, 2.png… — any
   *  count; the Did You Know card cycles them with its facts). */
  symbols: 'assets/4-national-symbols/symbols',
} as const

export const SHARED = {
  icons: 'assets/_shared/icons',
} as const

/** Installation photos live one folder per site: installations/<id>/1.jpg,
 *  2.jpg… (any count — 2+ photos turn the detail screen into a carousel). */
export const installationPhoto = (id: number, n = 1): string =>
  `${MONUMENTAL.installations}/${id}/${n}.jpg`

/** Probe cap for per-site photos and per-symbol DYK images. */
export const MAX_INSTALLATION_PHOTOS = 10
