/**
 * navTrace — remembers where the visitor navigated FROM.
 *
 * Screens that behave differently on section ENTRY vs in-section hops (the
 * History rewind intro plays only when arriving from outside /history) need
 * the previous pathname, which the router does not expose. AnimatedRoutes
 * records every pathname change here; the setter is idempotent so React
 * StrictMode double-renders are harmless.
 */
let previous: string | null = null
let current: string | null = null

export function recordNavigation(pathname: string): void {
  if (pathname === current) return
  previous = current
  current = pathname
}

/** Pathname the visitor came from (null on a fresh app boot). */
export function previousPathname(): string | null {
  return previous
}
