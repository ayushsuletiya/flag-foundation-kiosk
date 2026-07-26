/**
 * optimize-assets — write a WebP sibling next to every PNG/JPG in assets/.
 *
 *   node scripts/optimize-assets.mjs [--force] [--dry] [--dir assets/subpath]
 *
 * WHY siblings and never a rename: CLAUDE.md's drop-in conventions are all
 * spelled in PNG filenames (bg-1.png, f_0001.png, gallery-1.png ...) and the
 * client keeps dropping PNGs into those folders. The originals stay exactly
 * where they are; the app prefers the .webp when one exists (see the generated
 * manifest) and silently falls back to the original otherwise. Reverting the
 * whole thing is `find assets -name '*.webp' -delete`.
 *
 * Guards:
 *   • idempotent  — skips when the .webp is newer than its source (--force redoes)
 *   • size guard  — if the .webp is not actually smaller, it is deleted again.
 *     Several turntable sequences are already palette-optimised PNGs where a
 *     lossy WebP comes out BIGGER; those correctly keep their PNG.
 *   • alpha       — cwebp preserves the alpha channel automatically; -alpha_q 100
 *     codes it losslessly, so cutouts (turntables, flags, map states) stay crisp.
 *
 * Emits assets/asset-manifest.json — the list of sources that have a usable
 * .webp, so the runtime can rewrite paths without probing the disk.
 */
import { execFile } from 'node:child_process'
import { readdir, stat, unlink, writeFile } from 'node:fs/promises'
import { dirname, extname, join, relative, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'

const run = promisify(execFile)
const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..')
const ASSETS = join(ROOT, 'assets')

const args = process.argv.slice(2)
const FORCE = args.includes('--force')
const DRY = args.includes('--dry')
const dirArg = args.indexOf('--dir')
const START = dirArg >= 0 ? resolve(ROOT, args[dirArg + 1]) : ASSETS

/** Photographic quality. Alpha is always coded losslessly (-alpha_q 100). */
const QUALITY = 82
/** Parallel encoders — cwebp is single-threaded, so saturate the cores. */
const CONCURRENCY = Math.max(2, (await import('node:os')).cpus().length - 1)

const SOURCE_EXT = new Set(['.png', '.jpg', '.jpeg'])

async function* walk(dir) {
  for (const entry of await readdir(dir, { withFileTypes: true })) {
    const p = join(dir, entry.name)
    if (entry.isDirectory()) yield* walk(p)
    else if (SOURCE_EXT.has(extname(entry.name).toLowerCase())) yield p
  }
}

async function mtime(p) {
  try {
    return (await stat(p)).mtimeMs
  } catch {
    return -1
  }
}

async function sizeOf(p) {
  try {
    return (await stat(p)).size
  } catch {
    return -1
  }
}

async function convert(src) {
  const out = src.replace(/\.(png|jpe?g)$/i, '.webp')
  const srcM = await mtime(src)
  const outM = await mtime(out)
  if (!FORCE && outM >= srcM && outM > 0) {
    return { src, out, skipped: true, before: await sizeOf(src), after: await sizeOf(out) }
  }
  if (DRY) return { src, out, dry: true, before: await sizeOf(src), after: 0 }

  await run('cwebp', ['-quiet', '-q', String(QUALITY), '-alpha_q', '100', src, '-o', out])
  const before = await sizeOf(src)
  const after = await sizeOf(out)
  // Size guard: an already-optimised palette PNG can encode LARGER as lossy
  // WebP. Keep whichever is genuinely smaller.
  if (after <= 0 || after >= before) {
    await unlink(out).catch(() => {})
    return { src, out, rejected: true, before, after }
  }
  return { src, out, before, after }
}

const files = []
for await (const f of walk(START)) files.push(f)
files.sort()

console.log(`optimize-assets: ${files.length} source images under ${relative(ROOT, START) || '.'}`)
if (DRY) console.log('(dry run — nothing will be written)')

let done = 0
let before = 0
let after = 0
let rejected = 0
let skipped = 0
const manifest = []

async function worker(queue) {
  for (;;) {
    const src = queue.pop()
    if (src === undefined) return
    try {
      const r = await convert(src)
      before += r.before > 0 ? r.before : 0
      if (r.rejected) {
        rejected += 1
        after += r.before // keeps the PNG, so it still costs the PNG
      } else {
        after += r.after > 0 ? r.after : 0
        if (r.skipped) skipped += 1
        manifest.push(relative(ASSETS, r.src).split('\\').join('/'))
      }
    } catch (err) {
      console.warn(`  ! failed ${relative(ROOT, src)}: ${err.message.split('\n')[0]}`)
    }
    done += 1
    if (done % 100 === 0) console.log(`  ${done}/${files.length}`)
  }
}

const queue = files.slice()
await Promise.all(Array.from({ length: CONCURRENCY }, () => worker(queue)))

const mb = (n) => (n / 1048576).toFixed(1)
console.log(
  `\ndone: ${manifest.length} webp written (${skipped} already current), ` +
    `${rejected} rejected as not smaller`,
)
console.log(`images: ${mb(before)}MB -> ${mb(after)}MB  (${(100 - (after * 100) / before).toFixed(0)}% smaller)`)

if (!DRY) {
  manifest.sort()
  await writeFile(join(ASSETS, 'asset-manifest.json'), `${JSON.stringify(manifest, null, 0)}\n`)
  console.log(`manifest: assets/asset-manifest.json (${manifest.length} entries)`)
}
