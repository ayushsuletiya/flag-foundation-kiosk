/**
 * chakraData — copy + lookup helpers for the Ashok Chakra explorer.
 *
 * Everything that CAN come from data/content.xlsx does (virtue names/order,
 * design-spec values, Tiranga facts). The constants below are the pieces the
 * workbook does not carry today — flagged in the build notes so they can move
 * into the Excel later without touching the screens:
 *   - per-virtue descriptions (sheet 06 has names only; Justice matches the
 *     Figma comp verbatim, the rest follow its tone)
 *   - the Values-tab intro paragraph (Figma copy)
 *   - the Design-tab subtitle + "Chakra Design" bullets (IS1 engineering
 *     constants baked into the Figma wheel PNG)
 *   - the Chakra-in-Flag intro + colour symbolism blurbs (Figma copy)
 */
import type { ChakraContent, ChakraRow } from '../../data/schema.ts'

// ---------------------------------------------------------------------------
// Virtue icons — assets/3-ashok-chakra/virtue-icons/<slug>.svg.
// 6 are Figma exports (48px viewBox, baked stroke colors) rendered as <img>;
// the other 18 are generated line icons using currentColor → rendered as a
// CSS mask so they take the warm-brown stroke of the designed set.
// ---------------------------------------------------------------------------
export const FIGMA_ICON_SLUGS: ReadonlySet<string> = new Set([
  'justice',
  'mercy',
  'gracefulness',
  'humility',
  'empathy',
  'sympathy',
])

export function virtueIconSlug(virtue: string): string {
  return virtue.toLowerCase().replace(/\s+/g, '-')
}

// ---------------------------------------------------------------------------
// Per-virtue descriptions (NOT in the Excel — see header note).
// Keyed by the exact virtue strings of sheet "06 · Ashok Chakra".
// ---------------------------------------------------------------------------
export const VIRTUE_DESCRIPTIONS: Record<string, string> = {
  Love: 'Love is the warmth that binds people together. It turns strangers into neighbours and a nation into one family.',
  Courage:
    'Courage is the strength to stand for what is right, even when it is hard or frightening.',
  Patience:
    'Patience is calm endurance. It waits, works quietly, and never gives up on what truly matters.',
  Peacefulness:
    'Peacefulness is harmony within and around us — settling differences with dialogue, never with anger.',
  Magnanimity:
    'Magnanimity is greatness of heart — being generous in victory and gracious in defeat.',
  Goodness: 'Goodness is choosing kindness in every small act, expecting nothing in return.',
  Faithfulness:
    'Faithfulness is loyalty that does not waver — to people, to promises, and to the nation.',
  Gentleness: 'Gentleness is strength under control. It wins hearts where force never can.',
  Selflessness: 'Selflessness puts others first. It finds joy in giving rather than receiving.',
  'Self-Control':
    'Self-control is mastery over one’s impulses — the quiet discipline behind every achievement.',
  'Self-Sacrifice':
    'Self-sacrifice is giving up one’s own comfort, and even one’s life, for something greater.',
  Truthfulness: 'Truthfulness is living without masks. Truth alone triumphs — Satyameva Jayate.',
  Righteousness:
    'Righteousness is walking the path of dharma — doing right simply because it is right.',
  Justice:
    'Justice means the same rule for everyone. It is the fairness that holds a society together and guides every honest decision.',
  Mercy: 'Mercy is compassion for those who err. It tempers justice with a humane heart.',
  Gracefulness: 'Gracefulness is dignity in conduct — acting with elegance, courtesy and poise.',
  Humility: 'Humility is greatness without pride. The strongest are often the most humble.',
  Empathy:
    'Empathy is feeling another’s joy and pain as your own — the first step to understanding.',
  Sympathy:
    'Sympathy is standing beside those who suffer, sharing their burden with an open heart.',
  'Spiritual Knowledge':
    'Spiritual knowledge is the wisdom of the inner self — knowing who we are beyond what we own.',
  Forgiveness:
    'Forgiveness releases anger and resentment. It frees both the forgiven and the forgiver.',
  Honesty: 'Honesty is being true in word and deed, in public and in private alike.',
  'Eternal Peace':
    'Eternal peace is the lasting calm a life of dharma earns — peace within, and peace for all.',
  Benevolence:
    'Benevolence is active goodwill — working for the well-being of every living being.',
}

export function virtueDescription(virtue: string): string {
  return (
    VIRTUE_DESCRIPTIONS[virtue] ??
    `${virtue} is one of the 24 values the spokes of the Ashok Chakra stand for.`
  )
}

// ---------------------------------------------------------------------------
// Values tab copy (Figma comp 795:5832 — not in the Excel)
// ---------------------------------------------------------------------------
export const VALUES_INTRO =
  'The 24 spokes stand for the 24 hours of the day, and for 24 values that guide us towards progress and righteousness.'

// ---------------------------------------------------------------------------
// Design tab (Figma comp 795:6157)
// ---------------------------------------------------------------------------
export const DESIGN_SUBTITLE = 'The Wheel of Dharma at the heart of India’s Tricolour.'

/**
 * "Chakra Design" title block — label/value rows, the way a construction sheet
 * lists its spec. Every value mirrors the Excel's `Design spec | Geometry` row:
 *   "Outer ring ⌀185 : inner ⌀160, 24 scalloped notches, spokes swell to
 *    width 6 and taper to 2 at the ⌀32 hub. (BIS flag specification.)"
 * Kept as a structured constant rather than parsed out of that sentence — it is
 * prose, not table data, and a regex over it would break the moment the client
 * rewords it. If these need to be client-editable, the fix is to add one
 * `Design spec` row per dimension to the Excel, not to parse this one.
 *
 * The Figma render also carried "Rim Thickness: 12.5 mm" — dropped, as no row
 * in content.xlsx sources that figure.
 */
export interface DesignSpecRow {
  label: string
  value: string
}
export const DESIGN_SPEC_ROWS: readonly DesignSpecRow[] = [
  { label: 'Outer ring', value: '⌀185' },
  { label: 'Inner ring', value: '⌀160' },
  { label: 'Hub', value: '⌀32' },
  { label: 'Spokes', value: '24 @ 15°' },
  { label: 'Notches', value: '24 scalloped' },
  { label: 'Spoke taper', value: '6 → 2' },
]

/** Standard the geometry above is quoted from (Excel `Design spec | Geometry`). */
export const DESIGN_SPEC_CREDIT = 'BIS flag specification'

/** First #RRGGBB in a chakra row's content ("app swatch #06038D" wins — last match). */
export function chakraRowHex(rows: ChakraRow[]): string {
  const row = rows.find((r) => r.section === 'Design spec' && /colou?r code/i.test(r.item))
  const matches = row?.content.match(/#[0-9a-fA-F]{6}/g)
  return (matches?.[matches.length - 1] ?? '#06038D').toUpperCase()
}

export function chakraSpokeCount(rows: ChakraRow[]): string {
  const row = rows.find((r) => r.section === 'Design spec' && /spokes/i.test(r.item))
  return row?.content.trim() ?? '24'
}

/**
 * Opening sentence of the Excel's `Meaning | 24 spokes` row — the "why" that
 * anchors the Design tab's left column under the subtitle. That row runs long
 * (it enumerates the Buddhist/Hindu/Jain cycles), so only the lead sentence is
 * taken; the full text belongs to the Values tab, not the spec drawing.
 */
export function chakraMeaningLine(rows: ChakraRow[]): string {
  const row = rows.find((r) => r.section === 'Meaning' && /24 spokes/i.test(r.item))
  const first = row?.content.trim().split(/(?<=\.)\s+/)[0]?.trim()
  return first !== undefined && first.length > 0
    ? first
    : 'Continuous motion = progress and dharma.'
}

// ---------------------------------------------------------------------------
// Chakra in Flag tab (Figma comp 795:6208)
// ---------------------------------------------------------------------------
export const TIRANGA_INTRO =
  'A horizontal tricolour of deep saffron, white and dark green in equal bands, with the navy-blue Ashok Chakra at its centre. Its width to length is always 2 : 3 — and though we call it Tiranga, it officially carries four colours.'

export interface ColourSymbolism {
  name: string
  swatch: string
  description: string
}
export const COLOUR_SYMBOLISM: readonly ColourSymbolism[] = [
  { name: 'Saffron', swatch: '#FF6820', description: 'Represents the strength, courage, and sacrifice' },
  { name: 'White', swatch: '#FFFFFF', description: 'Stands for peace, purity, and truth.' },
  {
    name: 'Green',
    swatch: '#046A38',
    description: 'Symbolizes the fertility, growth, and auspiciousness of the land.',
  },
]

/**
 * "Did You Know?" facts — assembled from the workbook (NS Carousel Tiranga
 * cards + chakra overview + flag-facts sheet all live in the store), so the
 * carousel stays Excel-driven. Falls back to a single baked fact only when
 * the store is empty.
 */
export function buildDidYouKnowFacts(opts: {
  chakra: ChakraContent | undefined
  carouselFacts: string[]
  flagFactAnswers: string[]
}): string[] {
  const facts: string[] = []
  const push = (f: string | undefined | null) => {
    const t = f?.trim()
    // ≤135 chars ≈ 4 lines at 21px/26px in the 438px fact box — anything longer
    // runs into the pagination-dot strip (the Figma card was drawn for a
    // 2-line mock fact).
    if (t && t.length <= 135 && !facts.includes(t)) facts.push(t)
  }
  for (const f of opts.carouselFacts) push(f)
  push(opts.chakra?.rows.find((r) => r.section === 'Overview' && r.item === 'What it is')?.content)
  for (const f of opts.flagFactAnswers) {
    if (facts.length >= 5) break
    push(f)
  }
  if (facts.length === 0) {
    facts.push('The Tiranga was adopted just weeks before India became independent.')
  }
  return facts.slice(0, 5)
}

/** Shrink-to-fit for the big selected-virtue headline (same recipe as symbols). */
export function fitHeadline(text: string, base: number, avail: number): number {
  const fitted = avail / (0.62 * Math.max(1, text.length))
  return Math.min(base, Math.max(28, fitted))
}

/**
 * Split a multi-word name into at most TWO lines, balanced by length
 * ("Spiritual Knowledge" → ["Spiritual", "Knowledge"]). Headlines keep one
 * consistent size and stack instead of shrinking to a sliver (user
 * 2026-07-20: "texts consistent in size; if too long break in two parts").
 * Single words return as one line — the caller fit-shrinks those.
 */
export function splitTwoLines(text: string): string[] {
  const words = text.trim().split(/\s+/)
  if (words.length < 2) return [text.trim()]
  let best: [string, string] = [words[0]!, words.slice(1).join(' ')]
  let bestDiff = Number.POSITIVE_INFINITY
  for (let i = 1; i < words.length; i++) {
    const a = words.slice(0, i).join(' ')
    const b = words.slice(i).join(' ')
    const diff = Math.abs(a.length - b.length)
    if (diff < bestDiff) {
      bestDiff = diff
      best = [a, b]
    }
  }
  return best
}
