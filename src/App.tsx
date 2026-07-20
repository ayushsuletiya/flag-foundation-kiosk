/**
 * App — kiosk shell composition (Phase 1c).
 *
 * <Stage> owns the fixed 1920x1080 Figma coordinate system (scale-to-fit in
 * dev, 1:1 on the kiosk panel). HashRouter (not BrowserRouter) so the packaged
 * Electron build can navigate under file://. Routes render Phase 1 placeholder
 * screens that prove the Excel wiring; real screens replace them in Phases 2-6.
 */
import { useEffect } from 'react'
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Stage } from './app/Stage.tsx'
import { recordNavigation } from './app/navTrace.ts'
import { CHAKRA, HISTORY_BASE } from './assets/paths.ts'
import { useContent } from './data/ContentContext.tsx'
import { useIdleReset } from './app/useIdleReset.ts'
import { DevContentScreen } from './app/DevContentScreen.tsx'
import { QuickAccessProvider } from './components/QuickAccessOverlay.tsx'
import { HomeScreen } from './screens/home/HomeScreen.tsx'
import { MonumentalIntroScreen } from './screens/monumental/MonumentalIntroScreen.tsx'
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
      const img = new Image()
      img.src = `${CHAKRA.background}/bg.png`
      // History rewind intro: warm its GL chunk + every year background so
      // the film has all its frames the moment the visitor taps History.
      void import('./screens/history/rewindGL.ts')
      for (const y of content?.historyYears ?? []) {
        const bg = new Image()
        bg.src = `${HISTORY_BASE}/${y.year}/background/bg-1.png`
      }
    }, 2500)
    return () => clearTimeout(timer)
  }, [content])
  return null
}

/**
 * Page-level crossfade: the arriving screen fades/rises in over the dark
 * stage (320ms). Key rules:
 * - History year pills swap :year via replace-nav — the year stays INSIDE
 *   one page, so the key collapses the segment and the screen's own inner
 *   fades handle it (a full remount would restart the bg crossfade loop).
 * - /symbols (carousel) opens at rest behind its own 0.9s black fade
 *   (user decision — no home→symbols transition); the wrapper stays inert.
 */
function AnimatedRoutes() {
  const location = useLocation()
  recordNavigation(location.pathname) // idempotent — safe under StrictMode
  const transitionKey = location.pathname.replace(/^\/history\/[^/]+/, '/history')
  const inert = location.pathname === '/symbols'

  return (
    <div
      key={transitionKey}
      className={inert ? undefined : 'route-enter'}
      style={{ position: 'absolute', inset: 0 }}
    >
      <Routes location={location}>
        <Route path="/" element={<HomeScreen />} />
        <Route path="/monumental" element={<MonumentalIntroScreen />} />
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
    </div>
  )
}

function App() {
  return (
    <Stage>
      <HashRouter>
        <IdleReset />
        <WarmChakra />
        <QuickAccessProvider>
          <AnimatedRoutes />
        </QuickAccessProvider>
      </HashRouter>
    </Stage>
  )
}

export default App
