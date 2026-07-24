/**
 * excelLoader — parses data/content.xlsx into a typed ContentStore.
 *
 * Design rules:
 *  - NEVER throws on bad rows. Problems land in the ValidationReport instead;
 *    the kiosk keeps running with whatever content is usable.
 *  - Tolerant of the workbook's layout: every sheet has 3 preamble rows
 *    (title, description, blank) before the header row, so the header row is
 *    located by signature, and columns are mapped by header NAME — the client
 *    can reorder or insert columns without breaking the app.
 *  - All strings trimmed; blank cells become null; numerics coerced.
 *
 * Environment-agnostic: takes raw bytes (ArrayBuffer/Uint8Array), so it runs
 * in the renderer (fetch / IPC) and in Node scripts (fs.readFile) unchanged.
 */
import { read, utils } from 'xlsx'
import type { WorkBook, WorkSheet } from 'xlsx'
import {
  CANONICAL_STATES,
  type ChakraContent,
  type ChakraRow,
  type ChakraVirtue,
  type ContentStore,
  type FlagCodeMilestone,
  type FlagDesignSpec,
  type FlagFact,
  type HistoryKnowMore,
  type HistoryYear,
  type HomeTile,
  type Installation,
  type LoadResult,
  type SourceRef,
  type SymbolCarouselCard,
  type SymbolIdentity,
  type ValidationIssue,
  type ValidationReport,
} from './schema.ts'

type Cell = string | number | boolean | Date | null

/** A data row paired with its 1-based Excel row number (for error reporting). */
interface TableRow {
  cells: Cell[]
  excelRow: number
}

interface Table {
  /** header text (trimmed, original casing) → column index */
  columns: Map<string, number>
  rows: TableRow[]
}

class Reporter {
  readonly errors: ValidationIssue[] = []
  readonly warnings: ValidationIssue[] = []

  error(sheet: string, message: string, row?: number): void {
    this.errors.push(row === undefined ? { sheet, message } : { sheet, row, message })
  }

  warn(sheet: string, message: string, row?: number): void {
    this.warnings.push(row === undefined ? { sheet, message } : { sheet, row, message })
  }

  report(): ValidationReport {
    return { errors: this.errors, warnings: this.warnings }
  }
}

// ---------------------------------------------------------------------------
// Cell coercion helpers
// ---------------------------------------------------------------------------

/** Trimmed string or null for blank/absent cells. */
function asString(cell: Cell | undefined): string | null {
  if (cell === null || cell === undefined) return null
  // A date-typed cell (read with cellDates) would String()-dump to a JS date
  // string; render it as "26 January 2002". Use UTC — xlsx date serials are
  // UTC-anchored, so local getters can drift a calendar day.
  if (cell instanceof Date) {
    return cell.toLocaleDateString('en-GB', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      timeZone: 'UTC',
    })
  }
  const s = String(cell).trim()
  return s === '' ? null : s
}

/** Finite number or null. Accepts numeric strings like "108" / "108.5". */
function asNumber(cell: Cell | undefined): number | null {
  if (cell === null || cell === undefined) return null
  if (cell instanceof Date) return null // a date is not a plain number
  if (typeof cell === 'number') return Number.isFinite(cell) ? cell : null
  const s = String(cell).trim().replace(/,/g, '')
  if (s === '') return null
  const n = Number(s)
  return Number.isFinite(n) ? n : null
}

function isBlankRow(cells: Cell[]): boolean {
  return cells.every((c) => asString(c) === null)
}

// ---------------------------------------------------------------------------
// Sheet → Table extraction
// ---------------------------------------------------------------------------

/** Find a sheet whose name starts with the given tab number prefix (e.g. "04"). */
function findSheet(wb: WorkBook, prefix: string): { name: string; sheet: WorkSheet } | null {
  const name = wb.SheetNames.find((n) => n.trim().startsWith(prefix))
  if (!name) return null
  const sheet = wb.Sheets[name]
  return sheet ? { name, sheet } : null
}

const HEADER_SCAN_LIMIT = 12

/**
 * Locate the header row (first row within the top HEADER_SCAN_LIMIT rows that
 * contains every signature header), then collect all non-blank rows below it.
 * Returns null (and reports an error) when the signature cannot be found.
 */
function extractTable(
  sheetName: string,
  sheet: WorkSheet,
  signatureHeaders: string[],
  reporter: Reporter,
): Table | null {
  const grid: Cell[][] = utils.sheet_to_json(sheet, { header: 1, defval: null })
  const limit = Math.min(grid.length, HEADER_SCAN_LIMIT)

  for (let r = 0; r < limit; r++) {
    const row = grid[r]
    if (!row) continue
    const headerTexts = row.map((c) => asString(c))
    const hasAll = signatureHeaders.every((h) => headerTexts.includes(h))
    if (!hasAll) continue

    const columns = new Map<string, number>()
    headerTexts.forEach((h, idx) => {
      if (h !== null && !columns.has(h)) columns.set(h, idx)
    })

    const rows: TableRow[] = []
    for (let d = r + 1; d < grid.length; d++) {
      const cells = grid[d]
      if (!cells || isBlankRow(cells)) continue // tolerate blank spacer rows
      rows.push({ cells, excelRow: d + 1 })
    }
    return { columns, rows }
  }

  reporter.error(
    sheetName,
    `Header row not found (expected columns: ${signatureHeaders.join(' | ')}) — sheet skipped`,
  )
  return null
}

/** Column accessor bound to one table (missing header ⇒ always null). */
function columnGetter(table: Table): (row: TableRow, header: string) => Cell | undefined {
  return (row, header) => {
    const idx = table.columns.get(header)
    return idx === undefined ? undefined : row.cells[idx]
  }
}

// ---------------------------------------------------------------------------
// Per-tab parsers
// ---------------------------------------------------------------------------

function parseHomeTiles(wb: WorkBook, reporter: Reporter): HomeTile[] {
  const found = findSheet(wb, '01')
  if (!found) {
    reporter.error('01 · Home Menu', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(found.name, found.sheet, ['#', 'Category (label in app)'], reporter)
  if (!table) return []
  const col = columnGetter(table)

  const tiles: HomeTile[] = []
  for (const row of table.rows) {
    const label = asString(col(row, 'Category (label in app)'))
    if (label === null) {
      reporter.error(found.name, 'Missing tile label — row skipped', row.excelRow)
      continue
    }
    const order = asNumber(col(row, '#'))
    if (order === null) {
      reporter.warn(found.name, `Tile "${label}" has no numeric order — appended last`, row.excelRow)
    }
    tiles.push({ order: order ?? Number.MAX_SAFE_INTEGER, label })
  }
  tiles.sort((a, b) => a.order - b.order)
  if (tiles.length !== 4) {
    reporter.warn(found.name, `Expected 4 home tiles, found ${tiles.length}`)
  }
  // Rows bind to routes by POSITION (Monumental / History / Chakra / Symbols),
  // so a reordered sheet silently misroutes a tile. Warn if the sorted labels
  // don't look like that order — the category keyword should survive a reword.
  const EXPECTED_TILE_KEYWORDS = ['monumental', 'history', 'chakra', 'symbol']
  tiles.forEach((tile, i) => {
    const kw = EXPECTED_TILE_KEYWORDS[i]
    if (kw !== undefined && !tile.label.toLowerCase().includes(kw)) {
      reporter.warn(
        found.name,
        `Home tile #${i + 1} "${tile.label}" isn't where the "${kw}" category is expected — Home Menu rows must stay in Monumental / History / Chakra / Symbols order (tiles route by position)`,
      )
    }
  })
  return tiles
}

function parseSymbolIdentities(wb: WorkBook, reporter: Reporter): SymbolIdentity[] {
  const found = findSheet(wb, '03 ')
  if (!found) {
    reporter.error('03 · NS Identity', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(
    found.name,
    found.sheet,
    ['Symbol', 'Category', 'Symbolism heading', 'Milestone 1'],
    reporter,
  )
  if (!table) return []
  const col = columnGetter(table)

  const out: SymbolIdentity[] = []
  const seen = new Set<string>()
  for (const row of table.rows) {
    const symbol = asString(col(row, 'Symbol'))
    const category = asString(col(row, 'Category'))
    if (symbol === null || category === null) {
      reporter.error(found.name, 'Missing Symbol or Category — row skipped', row.excelRow)
      continue
    }
    if (seen.has(symbol)) {
      reporter.error(found.name, `Duplicate symbol "${symbol}"`, row.excelRow)
    }
    seen.add(symbol)

    // Keep all four slots by POSITION ('' for a blank). The detail screen maps
    // milestones onto four different-shaped stat cards (wide/small/small/wide),
    // so filtering blanks out would shift e.g. Milestone 4 into Milestone 2's
    // small slot. The screen skips rendering the empty ones.
    const milestones = (['Milestone 1', 'Milestone 2', 'Milestone 3', 'Milestone 4'] as const).map(
      (h) => asString(col(row, h)) ?? '',
    )
    const filledMilestones = milestones.filter((m) => m !== '').length
    if (filledMilestones < 4) {
      reporter.warn(found.name, `"${symbol}" has ${filledMilestones}/4 milestones`, row.excelRow)
    }

    const symbolismHeading = asString(col(row, 'Symbolism heading'))
    if (symbolismHeading === null) {
      reporter.warn(found.name, `"${symbol}" missing symbolism heading`, row.excelRow)
    }
    out.push({ symbol, category, symbolismHeading: symbolismHeading ?? '', milestones })
  }
  return out
}

function parseSymbolCarousel(
  wb: WorkBook,
  identities: SymbolIdentity[],
  reporter: Reporter,
): SymbolCarouselCard[] {
  const found = findSheet(wb, '03b')
  if (!found) {
    reporter.error('03b · NS Carousel', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(
    found.name,
    found.sheet,
    ['Symbol', 'Card #', 'Card Type / Label', 'Headline', 'Body Text'],
    reporter,
  )
  if (!table) return []
  const col = columnGetter(table)
  const knownSymbols = new Set(identities.map((s) => s.symbol))

  const out: SymbolCarouselCard[] = []
  for (const row of table.rows) {
    const symbol = asString(col(row, 'Symbol'))
    const headline = asString(col(row, 'Headline'))
    const bodyText = asString(col(row, 'Body Text'))
    if (symbol === null || headline === null || bodyText === null) {
      reporter.error(found.name, 'Missing Symbol, Headline or Body Text — row skipped', row.excelRow)
      continue
    }
    if (knownSymbols.size > 0 && !knownSymbols.has(symbol)) {
      reporter.warn(found.name, `Card symbol "${symbol}" not present in NS Identity tab`, row.excelRow)
    }
    const cardNumber = asNumber(col(row, 'Card #'))
    if (cardNumber === null) {
      reporter.warn(found.name, `Card for "${symbol}" has no numeric Card # — appended last`, row.excelRow)
    }
    out.push({
      symbol,
      cardNumber: cardNumber ?? Number.MAX_SAFE_INTEGER,
      cardType: asString(col(row, 'Card Type / Label')) ?? '',
      headline,
      bodyText,
      suggestedVisual: asString(col(row, 'Suggested Visual')),
    })
  }
  return out
}

function parseInstallations(wb: WorkBook, reporter: Reporter): Installation[] {
  const found = findSheet(wb, '04')
  if (!found) {
    reporter.error('04 · Flag Installations', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(
    found.name,
    found.sheet,
    ['#', 'State / UT', 'Location', 'District', 'Ht (ft)'],
    reporter,
  )
  if (!table) return []
  const col = columnGetter(table)
  const canonical = new Set<string>(CANONICAL_STATES)

  const out: Installation[] = []
  const seenIds = new Set<number>()
  let missingPhotoCount = 0
  let nextFallbackId = 100_000 // keeps rows with a broken "#" usable and unique

  for (const row of table.rows) {
    const state = asString(col(row, 'State / UT'))
    const location = asString(col(row, 'Location'))
    if (state === null || location === null) {
      reporter.error(found.name, 'Missing State / UT or Location — row skipped', row.excelRow)
      continue
    }
    if (!canonical.has(state)) {
      reporter.error(found.name, `Unknown state name "${state}" (check spelling against map assets)`, row.excelRow)
    }

    let id = asNumber(col(row, '#'))
    if (id === null) {
      reporter.warn(found.name, `Missing site id ("#") for "${location}" — assigned fallback id`, row.excelRow)
      id = nextFallbackId++
    } else if (seenIds.has(id)) {
      // Reusing an id collides React keys and makes both rows expand/route as
      // one — give the duplicate a fresh unique id instead (like a missing id).
      reporter.error(found.name, `Duplicate site id ${id} ("${location}") — assigned fallback id`, row.excelRow)
      id = nextFallbackId++
    }
    seenIds.add(id)

    const heightFt = asNumber(col(row, 'Ht (ft)'))
    if (heightFt === null) {
      reporter.warn(found.name, `"${location}" has no numeric height (Ht (ft))`, row.excelRow)
    }

    const photoUrl = asString(col(row, 'Photo URL'))
    if (photoUrl === null) missingPhotoCount++

    out.push({
      id,
      state,
      location,
      landmark: asString(col(row, 'Landmark')),
      district: asString(col(row, 'District')),
      heightFt,
      history: asString(col(row, 'Installation History & Context')),
      verification: asString(col(row, 'Verification')),
      confidenceTier: asString(col(row, 'Confidence Tier')),
      primarySource: asString(col(row, 'Primary Source')),
      secondarySource: asString(col(row, 'Secondary Source')),
      photoUrl,
    })
  }

  if (missingPhotoCount > 0) {
    reporter.warn(found.name, `${missingPhotoCount} of ${out.length} installations have no Photo URL`)
  }
  return out
}

function parseHistoryYears(wb: WorkBook, reporter: Reporter): HistoryYear[] {
  const found = findSheet(wb, '05 ')
  if (!found) {
    reporter.error('05 · History Timeline', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(
    found.name,
    found.sheet,
    ['Year', 'Slide Title', 'Main Slide Copy'],
    reporter,
  )
  if (!table) return []
  const col = columnGetter(table)

  const out: HistoryYear[] = []
  const seen = new Set<string>()
  for (const row of table.rows) {
    const year = asString(col(row, 'Year'))
    const slideTitle = asString(col(row, 'Slide Title'))
    const mainCopy = asString(col(row, 'Main Slide Copy'))
    if (year === null || slideTitle === null || mainCopy === null) {
      reporter.error(found.name, 'Missing Year, Slide Title or Main Slide Copy — row skipped', row.excelRow)
      continue
    }
    if (seen.has(year)) {
      reporter.error(found.name, `Duplicate timeline year "${year}"`, row.excelRow)
    }
    seen.add(year)

    const flagImageUrl = asString(col(row, 'Official Flag Image URL'))
    if (flagImageUrl === null) {
      reporter.warn(found.name, `Year ${year} has no Official Flag Image URL (placeholder shown)`, row.excelRow)
    }
    out.push({
      year,
      slideTitle,
      subtitle: asString(col(row, 'Subtitle')),
      mainCopy,
      flagImageUrl,
    })
  }
  return out
}

function parseHistoryKnowMore(
  wb: WorkBook,
  years: HistoryYear[],
  reporter: Reporter,
): HistoryKnowMore[] {
  const found = findSheet(wb, '05b')
  if (!found) {
    reporter.error('05b · History Know More', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(
    found.name,
    found.sheet,
    ['Year', 'Know More Heading', 'Bullet 1'],
    reporter,
  )
  if (!table) return []
  const col = columnGetter(table)
  const timelineYears = new Set(years.map((y) => y.year))

  const out: HistoryKnowMore[] = []
  for (const row of table.rows) {
    const year = asString(col(row, 'Year'))
    const heading = asString(col(row, 'Know More Heading'))
    if (year === null || heading === null) {
      reporter.error(found.name, 'Missing Year or Know More Heading — row skipped', row.excelRow)
      continue
    }
    if (timelineYears.size > 0 && !timelineYears.has(year)) {
      reporter.warn(found.name, `Know More year "${year}" has no matching timeline year`, row.excelRow)
    }
    const bullets = (['Bullet 1', 'Bullet 2', 'Bullet 3', 'Bullet 4'] as const)
      .map((h) => asString(col(row, h)))
      .filter((b): b is string => b !== null)
    if (bullets.length === 0) {
      reporter.warn(found.name, `Know More for ${year} has no bullets`, row.excelRow)
    }
    out.push({
      year,
      heading,
      bullets,
      description: asString(col(row, 'Know More Description')),
      bookRef: asString(col(row, 'Book Ref')),
      sourceUrl: asString(col(row, 'Source URL')),
    })
  }
  return out
}

function parseFlagCode(wb: WorkBook, reporter: Reporter): FlagCodeMilestone[] {
  const found = findSheet(wb, '05c')
  if (!found) {
    reporter.error('05c · Flag Code & Rights', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(found.name, found.sheet, ['Year / Date', 'Title', 'Content'], reporter)
  if (!table) return []
  const col = columnGetter(table)

  const out: FlagCodeMilestone[] = []
  for (const row of table.rows) {
    const yearOrDate = asString(col(row, 'Year / Date'))
    const title = asString(col(row, 'Title'))
    const content = asString(col(row, 'Content'))
    if (yearOrDate === null || title === null || content === null) {
      reporter.error(found.name, 'Missing Year / Date, Title or Content — row skipped', row.excelRow)
      continue
    }
    out.push({
      yearOrDate,
      category: asString(col(row, 'Category')),
      title,
      content,
      primarySource: asString(col(row, 'Primary Source')),
    })
  }
  return out
}

const VIRTUE_SECTION = '24 Virtues'
const SPOKE_ITEM_RE = /^Spoke\s+(\d+)$/i

function parseChakra(wb: WorkBook, reporter: Reporter): ChakraContent {
  const empty: ChakraContent = { rows: [], virtues: [] }
  const found = findSheet(wb, '06')
  if (!found) {
    reporter.error('06 · Ashok Chakra', 'Sheet missing from workbook')
    return empty
  }
  const table = extractTable(found.name, found.sheet, ['Section', 'Item', 'Content'], reporter)
  if (!table) return empty
  const col = columnGetter(table)

  const rows: ChakraRow[] = []
  const virtues: ChakraVirtue[] = []
  const seenSpokes = new Set<number>()

  for (const row of table.rows) {
    const section = asString(col(row, 'Section'))
    const item = asString(col(row, 'Item'))
    const content = asString(col(row, 'Content'))
    if (section === null || content === null) {
      reporter.error(found.name, 'Missing Section or Content — row skipped', row.excelRow)
      continue
    }
    rows.push({ section, item: item ?? '', content })

    if (section === VIRTUE_SECTION) {
      const match = item === null ? null : SPOKE_ITEM_RE.exec(item)
      if (!match || match[1] === undefined) {
        reporter.error(found.name, `Virtue row item "${item ?? ''}" is not "Spoke N"`, row.excelRow)
        continue
      }
      const spoke = Number(match[1])
      if (spoke < 1 || spoke > 24) {
        reporter.error(found.name, `Spoke number ${spoke} out of range 1-24`, row.excelRow)
        continue
      }
      if (seenSpokes.has(spoke)) {
        reporter.error(found.name, `Duplicate spoke ${spoke}`, row.excelRow)
        continue
      }
      seenSpokes.add(spoke)
      virtues.push({ spoke, virtue: content })
    }
  }

  virtues.sort((a, b) => a.spoke - b.spoke)
  if (virtues.length !== 24) {
    reporter.error(found.name, `Expected 24 chakra virtues, found ${virtues.length}`)
  }
  return { rows, virtues }
}

function parseSources(wb: WorkBook, reporter: Reporter): SourceRef[] {
  const found = findSheet(wb, '07')
  if (!found) {
    reporter.error('07 · Sources', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(found.name, found.sheet, ['Area', 'Source', 'URL'], reporter)
  if (!table) return []
  const col = columnGetter(table)

  const out: SourceRef[] = []
  for (const row of table.rows) {
    const area = asString(col(row, 'Area'))
    const source = asString(col(row, 'Source'))
    if (area === null || source === null) {
      reporter.error(found.name, 'Missing Area or Source — row skipped', row.excelRow)
      continue
    }
    const url = asString(col(row, 'URL'))
    if (url === null) {
      reporter.warn(found.name, `Source "${source}" has no URL`, row.excelRow)
    }
    out.push({ area, source, url })
  }
  return out
}

function parseFlagFacts(wb: WorkBook, reporter: Reporter): FlagFact[] {
  const found = findSheet(wb, '08')
  if (!found) {
    reporter.error('08 · Flag Facts (Official)', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(found.name, found.sheet, ['#', 'Question', 'Answer'], reporter)
  if (!table) return []
  const col = columnGetter(table)

  const out: FlagFact[] = []
  const seen = new Set<number>()
  for (const row of table.rows) {
    const question = asString(col(row, 'Question'))
    const answer = asString(col(row, 'Answer'))
    if (question === null || answer === null) {
      reporter.error(found.name, 'Missing Question or Answer — row skipped', row.excelRow)
      continue
    }
    const number = asNumber(col(row, '#'))
    if (number === null) {
      reporter.warn(found.name, 'Fact has no numeric "#"', row.excelRow)
    } else if (seen.has(number)) {
      reporter.error(found.name, `Duplicate fact number ${number}`, row.excelRow)
    } else {
      seen.add(number)
    }
    out.push({ number: number ?? 0, question, answer, source: asString(col(row, 'Source')) })
  }
  return out
}

function parseFlagDesign(wb: WorkBook, reporter: Reporter): FlagDesignSpec[] {
  const found = findSheet(wb, '09')
  if (!found) {
    reporter.error('09 · Flag Design & Sizes', 'Sheet missing from workbook')
    return []
  }
  const table = extractTable(found.name, found.sheet, ['Category', 'Item', 'Detail'], reporter)
  if (!table) return []
  const col = columnGetter(table)

  const out: FlagDesignSpec[] = []
  for (const row of table.rows) {
    const category = asString(col(row, 'Category'))
    const item = asString(col(row, 'Item'))
    if (category === null || item === null) {
      reporter.error(found.name, 'Missing Category or Item — row skipped', row.excelRow)
      continue
    }
    out.push({ category, item, detail: asString(col(row, 'Detail')) })
  }
  return out
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Parse workbook bytes into a typed ContentStore + ValidationReport.
 * Never throws for content problems; only truly unreadable bytes produce a
 * store of empty collections plus a single fatal error in the report.
 */
export function loadContent(data: ArrayBuffer | Uint8Array): LoadResult {
  const reporter = new Reporter()
  const loadedAt = new Date().toISOString()

  let wb: WorkBook | null = null
  try {
    const bytes = data instanceof Uint8Array ? data : new Uint8Array(data)
    // cellDates keeps date-typed cells as Date objects instead of raw serials
    // (e.g. 37282), which asString/asNumber then handle explicitly.
    wb = read(bytes, { type: 'array', cellDates: true })
  } catch (err) {
    reporter.error(
      '(workbook)',
      `content.xlsx could not be parsed: ${err instanceof Error ? err.message : String(err)}`,
    )
  }

  if (!wb) {
    return {
      content: {
        homeTiles: [],
        symbolIdentities: [],
        symbolCarouselCards: [],
        installations: [],
        historyYears: [],
        historyKnowMore: [],
        flagCodeMilestones: [],
        chakra: { rows: [], virtues: [] },
        sources: [],
        flagFacts: [],
        flagDesignSpecs: [],
        loadedAt,
      },
      validation: reporter.report(),
    }
  }

  const symbolIdentities = parseSymbolIdentities(wb, reporter)
  const historyYears = parseHistoryYears(wb, reporter)

  const content: ContentStore = {
    homeTiles: parseHomeTiles(wb, reporter),
    symbolIdentities,
    symbolCarouselCards: parseSymbolCarousel(wb, symbolIdentities, reporter),
    installations: parseInstallations(wb, reporter),
    historyYears,
    historyKnowMore: parseHistoryKnowMore(wb, historyYears, reporter),
    flagCodeMilestones: parseFlagCode(wb, reporter),
    chakra: parseChakra(wb, reporter),
    sources: parseSources(wb, reporter),
    flagFacts: parseFlagFacts(wb, reporter),
    flagDesignSpecs: parseFlagDesign(wb, reporter),
    loadedAt,
  }

  return { content, validation: reporter.report() }
}
