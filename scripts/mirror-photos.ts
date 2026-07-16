/**
 * mirror-photos — downloads every Photo URL from data/content.xlsx tab
 * "04 · Flag Installations" into assets/images/installations/<id>.jpg so the
 * kiosk can run fully offline.
 *
 * Behaviour:
 *  - filename is the row's "#" id (Installation.id), saved as .jpg regardless
 *    of the source format — the renderer only ever looks up <id>.jpg
 *  - concurrency 6, 15 s timeout per request
 *  - idempotent: existing non-empty files are skipped (delete a file to force
 *    a re-download)
 *  - failures are logged and skipped, never fatal; exit code stays 0 as long
 *    as the workbook itself parsed
 *
 * Run: npm run mirror:photos   (Node >= 23.6 — native type stripping)
 */
import { mkdir, readFile, stat, unlink, writeFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { loadContent } from '../src/data/excelLoader.ts'

const dirname = path.dirname(fileURLToPath(import.meta.url))
const xlsxPath = path.join(dirname, '..', 'data', 'content.xlsx')
const outDir = path.join(dirname, '..', 'assets', 'images', 'installations')

const CONCURRENCY = 6
const TIMEOUT_MS = 15_000

interface Job {
  id: number
  url: string
}

interface Outcome {
  job: Job
  status: 'downloaded' | 'skipped-existing' | 'failed'
  detail?: string
}

async function fileExistsNonEmpty(file: string): Promise<boolean> {
  try {
    const s = await stat(file)
    return s.isFile() && s.size > 0
  } catch {
    return false
  }
}

async function download(job: Job): Promise<Outcome> {
  const dest = path.join(outDir, `${job.id}.jpg`)
  if (await fileExistsNonEmpty(dest)) {
    return { job, status: 'skipped-existing' }
  }
  try {
    const res = await fetch(job.url, {
      signal: AbortSignal.timeout(TIMEOUT_MS),
      headers: { 'user-agent': 'flag-foundation-kiosk-mirror/1.0 (offline asset mirror)' },
    })
    if (!res.ok) {
      return { job, status: 'failed', detail: `HTTP ${res.status}` }
    }
    const bytes = new Uint8Array(await res.arrayBuffer())
    if (bytes.byteLength === 0) {
      return { job, status: 'failed', detail: 'empty response body' }
    }
    await writeFile(dest, bytes)
    return { job, status: 'downloaded', detail: `${(bytes.byteLength / 1024).toFixed(0)} KB` }
  } catch (err) {
    await unlink(dest).catch(() => {}) // never leave a partial file behind
    const message = err instanceof Error ? (err.name === 'TimeoutError' ? `timeout after ${TIMEOUT_MS / 1000}s` : err.message) : String(err)
    return { job, status: 'failed', detail: message }
  }
}

// ---------------------------------------------------------------------------

const bytes = await readFile(xlsxPath)
const { content } = loadContent(bytes)
const installations = content.installations

const jobs: Job[] = installations
  .filter((row): row is typeof row & { photoUrl: string } => row.photoUrl !== null)
  .map((row) => ({ id: row.id, url: row.photoUrl }))
const missing = installations.length - jobs.length

await mkdir(outDir, { recursive: true })
console.log(`mirror-photos: ${installations.length} installations, ${jobs.length} with Photo URL, ${missing} without`)
console.log(`→ ${outDir}\n`)

const outcomes: Outcome[] = []
let cursor = 0
async function worker(): Promise<void> {
  while (cursor < jobs.length) {
    const job = jobs[cursor++]
    if (!job) break
    const outcome = await download(job)
    outcomes.push(outcome)
    const tag = outcome.status === 'downloaded' ? ' ok ' : outcome.status === 'skipped-existing' ? 'skip' : 'FAIL'
    console.log(`[${tag}] ${String(job.id).padStart(3)}.jpg  ${outcome.detail ?? ''}`)
  }
}
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker()))

const downloaded = outcomes.filter((o) => o.status === 'downloaded').length
const skipped = outcomes.filter((o) => o.status === 'skipped-existing').length
const failed = outcomes.filter((o) => o.status === 'failed')

console.log('\nSummary')
console.log('-------')
console.log(`downloaded       ${downloaded}`)
console.log(`skipped existing ${skipped}`)
console.log(`failed           ${failed.length}`)
console.log(`no Photo URL     ${missing}`)
for (const f of failed) {
  console.log(`  FAIL #${f.job.id}: ${f.detail}  ${f.job.url}`)
}
