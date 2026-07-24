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
// Client's authoritative per-virtue descriptions (Ashok Chakra Data.xlsx,
// "Values" sheet, 2026-07-24). Two sentences each; the ValuesTab flows them as
// one wrapped paragraph.
export const VIRTUE_DESCRIPTIONS: Record<string, string> = {
  Love: 'Love inspires compassion, unity, and care for all. It reminds us to build a society rooted in kindness.',
  Courage:
    'Courage is the strength to stand for what is right. It empowers us to face challenges without fear.',
  Patience:
    'Patience teaches calmness in difficult times. It helps us persevere with wisdom and resilience.',
  Peacefulness:
    'Peacefulness encourages harmony within ourselves and with others. It is the foundation of a just and stable society.',
  Magnanimity:
    'Magnanimity means being generous in victory and gracious in defeat. It reflects nobility of character and forgiveness.',
  Goodness:
    'Goodness is choosing kindness, honesty, and moral values. It inspires actions that benefit everyone around us.',
  Faithfulness:
    'Faithfulness means staying true to your values and commitments. It builds trust, loyalty, and lasting relationships.',
  Gentleness:
    'Gentleness shows that true strength comes with kindness. It promotes respect, empathy, and understanding.',
  Selflessness:
    'Selflessness places the needs of others before personal gain. It reflects a spirit of service and compassion.',
  'Self-Control':
    'Self-control is the ability to master our thoughts and actions. It helps us make wise and responsible decisions.',
  'Self-Sacrifice':
    'Self-sacrifice means giving for a greater purpose. It reflects dedication to family, community, and nation.',
  Truthfulness:
    'Truthfulness is the courage to be honest in every situation. It forms the basis of trust and integrity.',
  Righteousness:
    'Righteousness means choosing the path of justice and virtue. It guides us to act with fairness and honor.',
  Justice:
    'Justice ensures fairness, equality, and respect for all. It is essential for a strong and united nation.',
  Mercy:
    'Mercy is showing compassion even when punishment is possible. It reflects humanity, kindness, and understanding.',
  Gracefulness:
    'Gracefulness combines dignity with humility in every action. It reflects elegance in both character and conduct.',
  Humility:
    'Humility reminds us to stay grounded despite success. It encourages lifelong learning and mutual respect.',
  Empathy:
    'Empathy is the ability to understand another person’s feelings. It strengthens compassion and meaningful human connections.',
  Sympathy:
    'Sympathy means offering care and support to those in need. It reminds us that no one should face hardship alone.',
  'Spiritual Knowledge':
    'Spiritual knowledge inspires inner wisdom and self-awareness. It encourages a life guided by truth and purpose.',
  Forgiveness:
    'Forgiveness frees us from anger and resentment. It opens the way to healing, peace, and reconciliation.',
  Honesty:
    'Honesty means acting with truth and transparency. It builds confidence, trust, and strong character.',
  'Eternal Peace':
    'Eternal peace represents harmony that endures through time. It is achieved through justice, compassion, and understanding.',
  Benevolence:
    'Benevolence is the desire to do good for others. It inspires generosity, service, and the welfare of all.',
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

let measureCtx: CanvasRenderingContext2D | null = null

/**
 * Measured shrink-to-fit: the 0.62em/char heuristic above overestimates
 * narrow-lettered words ("Faithfulness" is mostly i/t/f/l), shrinking them
 * far more than needed (user 2026-07-20: "faithfulness text is too small").
 * Real canvas metrics keep every headline as large as actually fits.
 */
export function fitHeadlineMeasured(text: string, base: number, avail: number): number {
  measureCtx ??= document.createElement('canvas').getContext('2d')
  if (measureCtx === null) return fitHeadline(text, base, avail)
  measureCtx.font = `600 ${base}px Poppins, sans-serif`
  const width = measureCtx.measureText(text).width
  if (width <= avail) return base
  return Math.max(40, (base * avail) / width)
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
