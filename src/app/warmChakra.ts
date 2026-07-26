/**
 * warmChakra — pull the heavy Ashok Chakra pieces into cache BEFORE the visitor
 * lands on /chakra: the ~575 kB three.js chunk and the sunset background.
 *
 * Called twice, deliberately:
 *   • App mounts a timer that warms it shortly after first paint, and
 *   • the Home tile calls it on POINTERDOWN — i.e. while the finger is still
 *     down, a beat before navigate() runs. If the visitor taps Chakra within
 *     the first second (before the timer fired), that head start is the
 *     difference between a warm entrance and a cold chunk fetch mid-transition.
 *
 * Idempotent: every extra call after the first is a no-op.
 */
import { CHAKRA } from '../assets/paths.ts'
import { probeImageCached, probeVideoCached } from '../assets/probe.ts'

let started = false

export function warmChakra(): void {
  if (started) return
  started = true
  // The scene chunk (stays its OWN chunk — this only fetches it early).
  void import('../screens/chakra/Chakra3D.tsx')
  // Warm the background PROBE cache too, not just the bytes: /chakra's
  // DynamicBackground reuses these resolved probes, so `ready` is true on its
  // FIRST frame and the sunset paints with no blank/black beat.
  const bg = CHAKRA.background
  void probeVideoCached(`${bg}/bg.mp4`)
  void probeImageCached(`${bg}/poster.png`)
  void probeImageCached(`${bg}/bg.png`)
  for (let i = 1; i <= 5; i += 1) void probeImageCached(`${bg}/bg-${i}.png`)
}
