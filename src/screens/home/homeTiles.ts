/**
 * The four category tiles, shared by the Home screen and the Quick Access
 * overlay so a visitor finds the same card in the same place from anywhere in
 * the kiosk (user 2026-07-24: "quick access tiles should be like home page
 * tiles placement" — the overlay had its own order and its own label strings,
 * so National Symbols was 1st there and 4th on Home, and the same card read
 * "Ashok Chakra" on one screen and "Explore Ashok Chakra" on the other).
 *
 * Geometry here is the HOME frame's (Figma 795:4086). Quick Access re-lays the
 * same cards at its own panel scale — only `photo`, `fallbackLabel`,
 * `labelWidth` and `solidScrim` are shared by both.
 */
import { HOME } from '../../assets/paths.ts'

/**
 * Placement of the photo inside the card, as CSS percentages of the card
 * box — literal values from the Figma image-fill crop (get_design_context
 * on 795:4086). Every photo fully covers its card, so the Figma layers
 * hidden underneath (warm gradients, 20%-opacity texture, chakra sky
 * plate) are not reproduced.
 */
export interface PhotoBox {
  left: string
  top: string
  width: string
  height: string
}

export interface TileSpec {
  route: string
  /** Original Figma fill image (uncropped source, not a pre-baked crop). */
  image: string
  /** Figma frame x of the card on the HOME screen. */
  left: number
  /** Card width on HOME (Ashok Chakra is 293.054, others 294.104). */
  width: number
  /** Figma image-fill crop for this card. */
  photo: PhotoBox
  /** Label text-box width from Figma (labels wrap inside it). */
  labelWidth: number
  /**
   * Figma label string — fallback until the Excel row arrives. '\n' marks
   * Figma's hard line breaks (rendered via white-space: pre-line); soft
   * wrapping alone cannot reproduce them ("History of" fits 152px, but the
   * design breaks after "History").
   */
  fallbackLabel: string
  /** National Symbols card: scrim ends in solid #5E3809. */
  solidScrim?: boolean
}

/** The 4 tiles in Home-Menu order (Excel rows 1-4 map onto this order). */
export const HOME_TILES: readonly TileSpec[] = [
  {
    route: '/monumental',
    image: `${HOME.cards}/card-monumental.png`,
    left: 72,
    width: 294.104,
    photo: { left: '-1.2%', top: '-1.03%', width: '102.28%', height: '143.77%' },
    labelWidth: 228.981,
    fallbackLabel: 'Monumental Flags',
  },
  {
    route: '/history',
    image: `${HOME.cards}/card-history.png`,
    left: 420.77,
    width: 294.104,
    photo: { left: '0%', top: '0%', width: '100%', height: '138.07%' },
    labelWidth: 152.304,
    fallbackLabel: 'History\nof Tiranga',
  },
  {
    route: '/chakra',
    image: `${HOME.cards}/card-chakra.png`,
    left: 769.54,
    width: 293.054,
    photo: { left: '-35.82%', top: '0%', width: '171.98%', height: '100%' },
    labelWidth: 235.283,
    fallbackLabel: 'Ashok\nChakra',
  },
  {
    route: '/symbols',
    image: `${HOME.cards}/card-symbols.png`,
    left: 1123.9,
    width: 294.104,
    photo: { left: '-7.6%', top: '-24.62%', width: '115.37%', height: '149.38%' },
    labelWidth: 256.291,
    fallbackLabel: 'National Symbols of India',
    solidScrim: true,
  },
]

/** Home card box, for callers that lay the same tiles out at another scale. */
export const HOME_TILE_H = 403.343
export const HOME_TILE_W = 294.104
export const HOME_TILE_RADIUS = 49.61
export const HOME_TILE_BORDER = 3.924
/** Label box top, measured from the card top (see HomeScreen.css). */
export const HOME_LABEL_TOP = 294.13
export const HOME_LABEL_SIZE = 27.332
export const HOME_LABEL_LINE = 1.226
/** Horizontal gap between cards on Home (72 + 294.104 → 420.77). */
export const HOME_TILE_GAP = 54.666

/**
 * Excel labels are plain strings; when one matches the designed label
 * (ignoring line breaks), render the designed version so Figma's hard
 * line breaks are preserved. Diverging Excel copy soft-wraps as-is.
 */
export function designedLabel(excelLabel: string | undefined, fallback: string): string {
  if (excelLabel === undefined) return fallback
  const norm = (s: string) => s.replace(/\s+/g, ' ').trim()
  return norm(excelLabel) === norm(fallback) ? fallback : excelLabel
}
