/**
 * check-content — sanity-check the REAL data/content.xlsx through the exact
 * loader the app uses, then print row counts per tab and the ValidationReport.
 *
 * Run: npm run check:content   (Node >= 23.6 — native type stripping)
 * Exit code 1 when the report contains errors; warnings alone pass.
 */
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContent } from '../src/data/excelLoader.ts'
import type { ValidationIssue } from '../src/data/schema.ts'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const xlsxPath = path.join(dirname, '..', 'data', 'content.xlsx')

const bytes = await readFile(xlsxPath)
const { content, validation } = loadContent(bytes)

const counts: Array<[label: string, count: number]> = [
  ['01 · Home Menu → homeTiles', content.homeTiles.length],
  ['03 · NS Identity → symbolIdentities', content.symbolIdentities.length],
  ['03b · NS Carousel → symbolCarouselCards', content.symbolCarouselCards.length],
  ['04 · Flag Installations → installations', content.installations.length],
  ['05 · History Timeline → historyYears', content.historyYears.length],
  ['05b · History Know More → historyKnowMore', content.historyKnowMore.length],
  ['05c · Flag Code & Rights → flagCodeMilestones', content.flagCodeMilestones.length],
  ['06 · Ashok Chakra → chakra.rows', content.chakra.rows.length],
  ['06 · Ashok Chakra → chakra.virtues', content.chakra.virtues.length],
  ['07 · Sources → sources', content.sources.length],
  ['08 · Flag Facts → flagFacts', content.flagFacts.length],
  ['09 · Flag Design & Sizes → flagDesignSpecs', content.flagDesignSpecs.length],
]

console.log(`content.xlsx  →  ${xlsxPath}`)
console.log(`parsed at     →  ${content.loadedAt}\n`)
console.log('Row counts per tab')
console.log('------------------')
for (const [label, count] of counts) {
  console.log(`${String(count).padStart(4)}  ${label}`)
}

const printIssue = (issue: ValidationIssue): void => {
  const where = issue.row === undefined ? issue.sheet : `${issue.sheet} row ${issue.row}`
  console.log(`  - [${where}] ${issue.message}`)
}

console.log(`\nValidation report — ${validation.errors.length} error(s), ${validation.warnings.length} warning(s)`)
if (validation.errors.length > 0) {
  console.log('\nERRORS')
  validation.errors.forEach(printIssue)
}
if (validation.warnings.length > 0) {
  console.log('\nWARNINGS')
  validation.warnings.forEach(printIssue)
}
if (validation.errors.length === 0 && validation.warnings.length === 0) {
  console.log('  clean — no issues')
}

process.exitCode = validation.errors.length > 0 ? 1 : 0
