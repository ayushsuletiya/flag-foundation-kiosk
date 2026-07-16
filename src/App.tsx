/**
 * App — kiosk shell composition (Phase 1c).
 *
 * <Stage> owns the fixed 1920x1080 Figma coordinate system (scale-to-fit in
 * dev, 1:1 on the kiosk panel). HashRouter (not BrowserRouter) so the packaged
 * Electron build can navigate under file://. Routes render Phase 1 placeholder
 * screens that prove the Excel wiring; real screens replace them in Phases 2-6.
 */
import { HashRouter, Route, Routes } from 'react-router-dom'
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

function App() {
  return (
    <Stage>
      <HashRouter>
        <IdleReset />
        <QuickAccessProvider>
          <Routes>
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
        </QuickAccessProvider>
      </HashRouter>
    </Stage>
  )
}

export default App
