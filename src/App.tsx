/**
 * App — kiosk shell composition (Phase 1c).
 *
 * <Stage> owns the fixed 1920x1080 Figma coordinate system (scale-to-fit in
 * dev, 1:1 on the kiosk panel). HashRouter (not BrowserRouter) so the packaged
 * Electron build can navigate under file://. Routes render Phase 1 placeholder
 * screens that prove the Excel wiring; real screens replace them in Phases 2-6.
 */
import { useEffect, useState } from 'react'
import {
  HashRouter,
  Navigate,
  Route,
  Routes,
  useLocation,
  type Location,
} from 'react-router-dom'
import { Stage } from './app/Stage.tsx'
import { recordNavigation } from './app/navTrace.ts'
import { CHAKRA, HISTORY_BASE } from './assets/paths.ts'
import { probeImageCached, probeVideoCached } from './assets/probe.ts'
import { useContent } from './data/ContentContext.tsx'
import { useIdleReset } from './app/useIdleReset.ts'
import { SectionAudio } from './components/SectionAudio.tsx'
import { UiSounds } from './components/UiSounds.tsx'
import { DevContentScreen } from './app/DevContentScreen.tsx'
import { QuickAccessProvider } from './components/QuickAccessOverlay.tsx'
import { ErrorBoundary } from './components/ErrorBoundary.tsx'
import { HomeScreen } from './screens/home/HomeScreen.tsx'
import { MapExplorerScreen } from './screens/monumental/MapExplorerScreen.tsx'
import { InstallationDetailScreen } from './screens/monumental/InstallationDetailScreen.tsx'
import { ChakraExplorerScreen } from './screens/chakra/ChakraExplorerScreen.tsx'
import { YearMainScreen } from './screens/history/YearMainScreen.tsx'
import { KnowMoreScreen } from './screens/history/KnowMoreScreen.tsx'
import { SymbolsCarouselScreen } from './screens/symbols/SymbolsCarouselScreen.tsx'
import { SymbolDetailScreen } from './screens/symbols/SymbolDetailScreen.tsx'

/** Mounts the idle timer inside the router context. */
function IdleReset() {
  useIdleReset() // default 120s → back to home (attract-loop hook point)
  return null
}

/**
 * Warm the heavy chakra assets shortly after first paint: the ~575kB
 * three.js chunk (still ITS OWN chunk — only fetched early, perf guard
 * intact) and the 1.8MB sunset still. Without this, a cold visit to
 * /chakra shows a dark frame until chunk + decode land (user report:
 * "page comes black, then abruptly appears").
 */
function WarmChakra() {
  const { content } = useContent()

  useEffect(() => {
    const timer = setTimeout(() => {
      void import('./screens/chakra/Chakra3D.tsx')
      // Warm the chakra background PROBE cache (not only the decode): the
      // /chakra DynamicBackground reuses these resolved probes, so its `ready`
      // flips on the FIRST frame — the sunset paints immediately and the
      // entrance never dips through a blank/black frame.
      const ckBg = CHAKRA.background
      void probeVideoCached(`${ckBg}/bg.mp4`)
      void probeImageCached(`${ckBg}/poster.png`)
      void probeImageCached(`${ckBg}/bg.png`)
      for (let i = 1; i <= 5; i++) void probeImageCached(`${ckBg}/bg-${i}.png`)
      // History rewind intro: warm its GL chunk + every year background so
      // the film has all its frames the moment the visitor taps History.
      void import('./screens/history/rewindGL.ts')
      for (const y of content?.historyYears ?? []) {
        const bg = new Image()
        bg.src = `${HISTORY_BASE}/${y.year}/background/bg-1.png`
      }
    }, 1200) // early enough that a quick home→chakra tap finds a warm bg
    return () => clearTimeout(timer)
  }, [content])
  return null
}

/** The route table, rendered for an EXPLICIT location so the crossfade can keep
 * the outgoing page rendering (at its own frozen location) while the incoming
 * page enters at the new one. */
function RouteTable({ location }: { location: Location }) {
  return (
    <Routes location={location}>
      <Route path="/" element={<HomeScreen />} />
      {/* Intro video removed (user decision) — Monumental Flags opens straight
          on the map. This redirect covers every entry point to /monumental. */}
      <Route path="/monumental" element={<Navigate to="/monumental/map" replace />} />
      <Route path="/monumental/map" element={<MapExplorerScreen />} />
      <Route path="/monumental/detail/:rowId" element={<InstallationDetailScreen />} />
      <Route path="/history" element={<YearMainScreen />} />
      <Route path="/history/:year" element={<YearMainScreen />} />
      <Route path="/history/:year/more" element={<KnowMoreScreen />} />
      <Route path="/chakra" element={<ChakraExplorerScreen />} />
      <Route path="/symbols" element={<SymbolsCarouselScreen />} />
      <Route path="/symbols/:slug" element={<SymbolDetailScreen />} />
      <Route path="/dev/content" element={<DevContentScreen />} />
      {/* Unknown routes fall back to home — kiosk must never dead-end. */}
      <Route path="*" element={<HomeScreen />} />
    </Routes>
  )
}

/** Fade duration of the page cross-dissolve (matches `.page-enter` in index.css). */
const PAGE_FADE_MS = 300

interface PageEntry {
  key: string
  location: Location
}

/**
 * Page-level CROSS-DISSOLVE: on navigation the arriving page fades in ON TOP of
 * the outgoing one, which stays fully painted underneath until the fade
 * finishes — so a completed page is ALWAYS on screen and the transition never
 * dips through the (warm) stage, let alone black (the failure mode we chased
 * all of 2026-07-25). Both trees are briefly alive during the ~300ms fade;
 * deliberately short for the iGPU guard (a WebGL page unmounts right after).
 *
 * History year pills swap :year via replace-nav — the year stays INSIDE one
 * page (same transitionKey), so no crossfade fires and the screen's own inner
 * fades handle it (a full remount would restart the bg crossfade loop).
 */
function AnimatedRoutes() {
  const location = useLocation()
  recordNavigation(location.pathname) // idempotent — safe under StrictMode
  const transitionKey = location.pathname.replace(/^\/history\/[^/]+/, '/history')

  // A stack of live pages: the LAST entry is current; any earlier entries are
  // outgoing pages still fading out beneath it. React keeps each instance alive
  // by its stable `key`, so an outgoing page is NOT remounted while it exits.
  const [pages, setPages] = useState<PageEntry[]>([{ key: transitionKey, location }])

  useEffect(() => {
    let changed = false
    setPages((prev) => {
      const top = prev[prev.length - 1]
      if (top.key === transitionKey) {
        // Same page (e.g. a history year swap) — update its location in place.
        if (top.location === location) return prev
        const next = prev.slice()
        next[next.length - 1] = { key: transitionKey, location }
        return next
      }
      // New page — append; the previous one(s) stay to fade out beneath it.
      changed = true
      return [...prev.filter((p) => p.key !== transitionKey), { key: transitionKey, location }]
    })
    // Fallback cleanup in case the animationend below is ever missed.
    if (changed) {
      const t = window.setTimeout(
        () => setPages((prev) => (prev.length > 1 ? [prev[prev.length - 1]] : prev)),
        PAGE_FADE_MS + 250,
      )
      return () => window.clearTimeout(t)
    }
  }, [transitionKey, location])

  // Drop every outgoing page once the arriving page has finished fading in.
  const settle = () => setPages((prev) => (prev.length > 1 ? [prev[prev.length - 1]] : prev))

  return (
    <>
      {pages.map((p, i) => {
        const isTop = i === pages.length - 1
        const entering = isTop && pages.length > 1
        return (
          <div
            key={p.key}
            className={entering ? 'page-enter' : undefined}
            style={{
              position: 'absolute',
              inset: 0,
              zIndex: i,
              // Outgoing pages beneath must not swallow taps meant for the
              // arriving page on top.
              pointerEvents: isTop ? undefined : 'none',
            }}
            // Guard on currentTarget so bubbling child animations (a screen's
            // own entrance) don't settle the stack early.
            onAnimationEnd={
              entering
                ? (e) => {
                    if (e.target === e.currentTarget) settle()
                  }
                : undefined
            }
          >
            <RouteTable location={p.location} />
          </div>
        )
      })}
    </>
  )
}

function App() {
  return (
    <Stage>
      <HashRouter>
        <IdleReset />
        <WarmChakra />
        <SectionAudio />
        <UiSounds />
        <QuickAccessProvider>
          <ErrorBoundary>
            <AnimatedRoutes />
          </ErrorBoundary>
        </QuickAccessProvider>
      </HashRouter>
    </Stage>
  )
}

export default App
