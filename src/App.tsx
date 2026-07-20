/**
 * App — kiosk shell composition (Phase 1c).
 *
 * <Stage> owns the fixed 1920x1080 Figma coordinate system (scale-to-fit in
 * dev, 1:1 on the kiosk panel). HashRouter (not BrowserRouter) so the packaged
 * Electron build can navigate under file://. Routes render Phase 1 placeholder
 * screens that prove the Excel wiring; real screens replace them in Phases 2-6.
 */
import { HashRouter, Route, Routes, useLocation } from 'react-router-dom'
import { Stage } from './app/Stage.tsx'
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
        <QuickAccessProvider>
          <AnimatedRoutes />
        </QuickAccessProvider>
      </HashRouter>
    </Stage>
  )
}

export default App
