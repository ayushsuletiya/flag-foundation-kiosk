/**
 * transitionContract — the ONLY thing shared between HomeScreen (phase 1,
 * exit + morph) and SymbolsCarouselScreen (phase 2, arrive) of the
 * Home → Symbols cinematic transition (spec 2026-07-19).
 *
 * HANDOFF is the stage-space rect the morphing card ends at on the Home
 * side and starts at on the symbols side. It equals the carousel's
 * CENTER-SLOT card rect: carousel origin (100, 200) + card offset
 * (354, 51) → stage (454, 251), 379x472, radius 60 — so the seed card is
 * already exactly on its slot-0 pose when the symbols screen takes over.
 */
export const HANDOFF = { left: 454, top: 251, width: 379, height: 472, radius: 60 } as const

// ---- Phase 1 (HomeScreen exit) — ~1.9s -----------------------------
export const EXIT_SLIDE_MS = 600 // other tiles slide out, veil rises
export const EXIT_GLOW_MS = 600 // 600–1200: black; symbols tile glows
export const EXIT_MORPH_START = 1200
export const EXIT_MORPH_MS = 700 // 1200–1900: tile → glass symbol card
export const EXIT_TOTAL_MS = 1900

// (Phase 2 — the symbols-side arrive cinematic — was removed by user
// decision 2026-07-19: the symbols screen opens at rest behind a short
// black fade. The seed still decides which symbol fronts the carousel.)

/** Router state passed by HomeScreen when navigating to /symbols. */
export interface SymbolsEntryState {
  seed: string
  cinematic: boolean
}

/** location.state is unknown-shaped; validate instead of trusting casts. */
export function readEntryState(state: unknown): SymbolsEntryState | null {
  if (typeof state !== 'object' || state === null) return null
  const s = state as Record<string, unknown>
  if (typeof s['seed'] !== 'string' || typeof s['cinematic'] !== 'boolean') return null
  return { seed: s['seed'], cinematic: s['cinematic'] }
}
