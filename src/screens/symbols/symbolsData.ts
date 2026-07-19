/**
 * symbolsData — presentation keys derived from the Excel National Symbols
 * content ("03 · NS Identity" / "03b · NS Carousel").
 *
 * Content strings stay live from data/content.xlsx; this module only maps
 * them to stable URL slugs (which double as asset folder names under
 * assets/4-national-symbols/turntables/<slug>/), short display names for the carousel
 * headline, and parsed milestone label/value pairs for the detail stat cards.
 */
import type { SymbolIdentity } from '../../data/schema.ts'

/**
 * Curated slugs (build spec §3): symbols whose asset folders already exist
 * ship under fixed names. Everything else falls through to kebab-case.
 */
const SPECIAL_SLUGS: Record<string, string> = {
  'the tiranga': 'flag',
  'national flag': 'flag',
  'the royal bengal tiger': 'tiger',
  'royal bengal tiger': 'tiger',
  'the indian peacock': 'peacock',
  'indian peacock': 'peacock',
}

/** "The Indian Rupee — ₹" → "indian-rupee"; "The Royal Bengal Tiger" → "tiger". */
export function symbolSlug(symbolName: string): string {
  const key = symbolName.trim().toLowerCase()
  const special = SPECIAL_SLUGS[key]
  if (special !== undefined) return special
  return key
    .replace(/^the\s+/, '')
    .normalize('NFKD')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
}

/**
 * Short display names for the carousel headline (Figma shows "TIGER", not
 * "The Royal Bengal Tiger"). Keyed by slug; unknown symbols fall back to the
 * Excel name uppercased without its leading article.
 */
const SHORT_NAMES: Record<string, string> = {
  flag: 'TIRANGA',
  'lion-capital-of-ashoka': 'LION CAPITAL',
  'jana-gana-mana': 'JANA GANA MANA',
  'vande-mataram': 'VANDE MATARAM',
  'saka-calendar': 'SAKA CALENDAR',
  tiger: 'TIGER',
  peacock: 'PEACOCK',
  lotus: 'LOTUS',
  'indian-banyan': 'BANYAN',
  mango: 'MANGO',
  ganga: 'GANGA',
  'ganges-river-dolphin': 'RIVER DOLPHIN',
  'indian-rupee': 'RUPEE',
  'indian-elephant': 'ELEPHANT',
}

export function symbolShortName(identity: SymbolIdentity): string {
  const curated = SHORT_NAMES[symbolSlug(identity.symbol)]
  if (curated !== undefined) return curated
  return identity.symbol.replace(/^the\s+/i, '').toUpperCase()
}

/** Carousel subtitle: "National Animal of India" → "National Animal". */
export function symbolSubtitle(identity: SymbolIdentity): string {
  return identity.category.replace(/\s+of india\s*$/i, '')
}

// ---------------------------------------------------------------------------
// Milestones — Excel strings are "Label: Value" (e.g. "Project Tiger: 1973")
// ---------------------------------------------------------------------------
export interface Milestone {
  label: string
  value: string
}

export function parseMilestone(raw: string): Milestone {
  const i = raw.indexOf(':')
  if (i === -1) return { label: '', value: raw.trim() }
  return { label: raw.slice(0, i).trim(), value: raw.slice(i + 1).trim() }
}

/** Values that lead with a digit (or ~/₹ + digit) get the big gold treatment. */
export function isNumericMilestone(value: string): boolean {
  return /^[~₹]?\d/.test(value)
}

/**
 * Fit-by-formula font size so Excel-editable values never overflow their
 * fixed Figma card (audit risk #5). `base` is the Figma size; `avail` the
 * usable card width in px; 0.62em is a safe average glyph width for
 * Poppins Bold.
 */
export function fitFontSize(text: string, base: number, avail: number): number {
  const fitted = avail / (0.62 * Math.max(1, text.length))
  return Math.min(base, Math.max(18, fitted))
}
