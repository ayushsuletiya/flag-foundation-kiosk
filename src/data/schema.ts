/**
 * Typed row shapes for every tab of data/content.xlsx.
 *
 * Interfaces mirror the REAL headers in the workbook (verified 2026-07-15).
 * Every sheet has 3 preamble rows (title, description, blank) followed by a
 * header row, then data — the loader locates the header row by signature, so
 * these types are what comes out the other side, already trimmed and typed.
 */

// ---------------------------------------------------------------------------
// 01 · Home Menu — headers: # | Category (label in app) | Client Approval
// ---------------------------------------------------------------------------
export interface HomeTile {
  /** Display order (column "#"). */
  order: number
  /** Tile label as shown in the app (column "Category (label in app)"). */
  label: string
}

// ---------------------------------------------------------------------------
// 03 · NS Identity — headers: Symbol | Category | Symbolism heading |
//   Milestone 1..4 | Client Approval
// ---------------------------------------------------------------------------
export interface SymbolIdentity {
  /** e.g. "The Tiranga". */
  symbol: string
  /** e.g. "National Flag of India". */
  category: string
  /** One-line symbolism heading. */
  symbolismHeading: string
  /** The 4 big-number milestone strings (blank ones omitted). */
  milestones: string[]
}

// ---------------------------------------------------------------------------
// 03b · NS Carousel — headers: Symbol | Card # | Card Type / Label |
//   Headline | Body Text | Suggested Visual | Client Approval
// ---------------------------------------------------------------------------
export interface SymbolCarouselCard {
  /** Symbol this card belongs to — matches SymbolIdentity.symbol. */
  symbol: string
  /** 1-based card order within the symbol (column "Card #"). */
  cardNumber: number
  /** Pill label, e.g. "Did You Know" / "History" / "Symbolism". */
  cardType: string
  headline: string
  bodyText: string
  /** Art-direction note — not rendered on screen. */
  suggestedVisual: string | null
}

// ---------------------------------------------------------------------------
// 04 · Flag Installations — headers: # | State / UT | Location | Landmark |
//   District | Ht (ft) | Installation History & Context | Verification |
//   Confidence Tier | Primary Source | Secondary Source | Photo URL |
//   Client Approval
// ---------------------------------------------------------------------------
export interface Installation {
  /** Stable site id (column "#", 1..219). */
  id: number
  /** State / UT name — validated against CANONICAL_STATES. */
  state: string
  location: string
  landmark: string | null
  district: string | null
  /** Flag pole height in feet; null when the sheet cell is blank/non-numeric. */
  heightFt: number | null
  /** Long-form narrative (column "Installation History & Context"). */
  history: string | null
  verification: string | null
  confidenceTier: string | null
  primarySource: string | null
  secondarySource: string | null
  photoUrl: string | null
}

// ---------------------------------------------------------------------------
// 05 · History Timeline — headers: Year | Slide Title | Subtitle |
//   Main Slide Copy | Official Flag Image URL | Client Approval
// ---------------------------------------------------------------------------
export interface HistoryYear {
  /** Milestone year, e.g. "1857" (kept as string — sheet stores text). */
  year: string
  slideTitle: string
  subtitle: string | null
  mainCopy: string
  /** Official flag artwork URL; null for years still missing artwork. */
  flagImageUrl: string | null
}

// ---------------------------------------------------------------------------
// 05b · History Know More — headers: Year | Know More Heading | Bullet 1..4 |
//   Know More Description | Book Ref | Source URL | Client Approval
// ---------------------------------------------------------------------------
export interface HistoryKnowMore {
  /** Matches HistoryYear.year. */
  year: string
  heading: string
  /** Bullets 1–4, blank cells omitted. */
  bullets: string[]
  description: string | null
  bookRef: string | null
  sourceUrl: string | null
}

// ---------------------------------------------------------------------------
// 05c · Flag Code & Rights — headers: Year / Date | Category | Title |
//   Content | Primary Source | Client Approval
// ---------------------------------------------------------------------------
export interface FlagCodeMilestone {
  /** e.g. "1950", "26 January 2002", "2021 / 2022". */
  yearOrDate: string
  category: string | null
  title: string
  content: string
  primarySource: string | null
}

// ---------------------------------------------------------------------------
// 06 · Ashok Chakra — headers: Section | Item | Content | Client Approval
// The sheet is a keyed reference table; the loader also derives the 24
// virtues (Section = "24 Virtues", Item = "Spoke N") into ChakraVirtue[].
// ---------------------------------------------------------------------------
export interface ChakraRow {
  /** "Overview" | "History" | "Architecture" | "Design spec" | "Meaning" | "24 Virtues". */
  section: string
  item: string
  content: string
}

export interface ChakraVirtue {
  /** Spoke number 1..24. */
  spoke: number
  /** Virtue name, e.g. "Love", "Courage". */
  virtue: string
}

export interface ChakraContent {
  /** All reference rows in sheet order (includes the virtue rows). */
  rows: ChakraRow[]
  /** The 24 spoke virtues, sorted by spoke number. */
  virtues: ChakraVirtue[]
}

// ---------------------------------------------------------------------------
// 07 · Sources — headers: Area | Source | URL
// ---------------------------------------------------------------------------
export interface SourceRef {
  area: string
  source: string
  url: string | null
}

// ---------------------------------------------------------------------------
// 08 · Flag Facts (Official) — headers: # | Question | Answer | Source
// ---------------------------------------------------------------------------
export interface FlagFact {
  /** Q&A number (column "#", 1..127). */
  number: number
  question: string
  answer: string
  source: string | null
}

// ---------------------------------------------------------------------------
// 09 · Flag Design & Sizes — headers: Category | Item | Detail
// ---------------------------------------------------------------------------
export interface FlagDesignSpec {
  /** e.g. "Colours", "Proportion", "Standard size 6". */
  category: string
  item: string
  detail: string | null
}

// ---------------------------------------------------------------------------
// Store + validation
// ---------------------------------------------------------------------------
export interface ContentStore {
  homeTiles: HomeTile[]
  symbolIdentities: SymbolIdentity[]
  symbolCarouselCards: SymbolCarouselCard[]
  installations: Installation[]
  historyYears: HistoryYear[]
  historyKnowMore: HistoryKnowMore[]
  flagCodeMilestones: FlagCodeMilestone[]
  chakra: ChakraContent
  sources: SourceRef[]
  flagFacts: FlagFact[]
  flagDesignSpecs: FlagDesignSpec[]
  /** ISO timestamp of when this store was parsed. */
  loadedAt: string
}

export interface ValidationIssue {
  /** Sheet name as it appears in the workbook. */
  sheet: string
  /** 1-based Excel row number the issue points at (omitted for sheet-level issues). */
  row?: number
  message: string
}

export interface ValidationReport {
  errors: ValidationIssue[]
  warnings: ValidationIssue[]
}

/** Result of a load — content is always produced, even with a dirty report. */
export interface LoadResult {
  content: ContentStore
  validation: ValidationReport
}

/**
 * Canonical State / UT names exactly as spelled in tab 04 (and in the map
 * asset filenames). 36 entries = 28 states + 8 union territories.
 */
export const CANONICAL_STATES: readonly string[] = [
  'Andaman & Nicobar Islands',
  'Andhra Pradesh',
  'Arunachal Pradesh',
  'Assam',
  'Bihar',
  'Chandigarh',
  'Chhattisgarh',
  'Dadra & Nagar Haveli and Daman & Diu',
  'Delhi',
  'Goa',
  'Gujarat',
  'Haryana',
  'Himachal Pradesh',
  'Jammu & Kashmir',
  'Jharkhand',
  'Karnataka',
  'Kerala',
  'Ladakh',
  'Lakshadweep',
  'Madhya Pradesh',
  'Maharashtra',
  'Manipur',
  'Meghalaya',
  'Mizoram',
  'Nagaland',
  'Odisha',
  'Puducherry',
  'Punjab',
  'Rajasthan',
  'Sikkim',
  'Tamil Nadu',
  'Telangana',
  'Tripura',
  'Uttar Pradesh',
  'Uttarakhand',
  'West Bengal',
] as const

/**
 * Display labels for state/UT names that overflow the compact map pills/chips.
 * The CANONICAL name stays the data key everywhere — this is presentation only.
 */
const STATE_SHORT_LABELS: Readonly<Record<string, string>> = {
  'Andaman & Nicobar Islands': 'Andaman & Nicobar',
  'Dadra & Nagar Haveli and Daman & Diu': 'Dadra & Nagar Haveli',
}

/** Short display label for a state/UT (falls back to the canonical name). */
export function stateShortLabel(state: string): string {
  return STATE_SHORT_LABELS[state] ?? state
}
