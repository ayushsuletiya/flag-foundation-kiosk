/**
 * preload — fetch AND DECODE images before anything shows them.
 *
 * A plain <img src> paints whenever the bytes happen to land, so a cold screen
 * visibly "loads": the card photos pop in one by one over the finished layout
 * (user 2026-07-26: "the photo load should never show while application opening
 * / changing category"). Waiting for load alone is not enough either — the
 * first paint of a large PNG still costs a decode on the main thread, which is
 * exactly the stutter we're trying to hide on weak hardware.
 *
 * So: load, then img.decode(), then reveal. Results are remembered process-wide,
 * so returning to a screen is instant.
 */

/** Sources already loaded AND decoded in this session. */
const decoded = new Set<string>()
/** In-flight preloads, so N callers for one src share a single request. */
const inflight = new Map<string, Promise<void>>()

/** Load + decode one image. NEVER rejects — a missing asset must not block a
 *  screen (the kiosk drops assets in at its own pace). */
export function preloadImage(src: string): Promise<void> {
  if (decoded.has(src)) return Promise.resolve()
  const running = inflight.get(src)
  if (running !== undefined) return running

  const p = new Promise<void>((resolve) => {
    const img = new Image()
    const done = () => {
      decoded.add(src)
      inflight.delete(src)
      resolve()
    }
    img.onload = () => {
      // decode() pays the rasterisation cost HERE instead of on first paint.
      if (typeof img.decode === 'function') void img.decode().then(done, done)
      else done()
    }
    img.onerror = () => {
      inflight.delete(src)
      resolve() // treat "not delivered yet" as ready — never hang the UI
    }
    img.src = src
  })
  inflight.set(src, p)
  return p
}

/** Load + decode many. Resolves when all have settled. */
export function preloadImages(srcs: readonly string[]): Promise<void> {
  return Promise.all(srcs.map(preloadImage)).then(() => undefined)
}

/** True once every src is decoded and safe to show. */
export function areImagesDecoded(srcs: readonly string[]): boolean {
  return srcs.every((s) => decoded.has(s))
}
