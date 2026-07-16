import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

// Bundled Google fonts (offline-safe via @fontsource)
// Poppins — workhorse UI, weights 300-800
import '@fontsource/poppins/300.css'
import '@fontsource/poppins/400.css'
import '@fontsource/poppins/500.css'
import '@fontsource/poppins/600.css'
import '@fontsource/poppins/700.css'
import '@fontsource/poppins/800.css'
// Parisienne — script accents ("The ... of india"); single-weight family (400 only)
import '@fontsource/parisienne/400.css'
// Inter — year/stat numerals (600 detail stat labels, 800 height numerals)
import '@fontsource/inter/400.css'
import '@fontsource/inter/600.css'
import '@fontsource/inter/700.css'
import '@fontsource/inter/800.css'
// Port Lligat Slab — slab accents; single-weight family (400 only)
import '@fontsource/port-lligat-slab/400.css'

// Gilroy (local TTFs) + design tokens + kiosk reset
import './styles/fonts.css'
import './styles/tokens.css'
import './index.css'

import { ContentProvider } from './data/ContentContext.tsx'
import App from './App.tsx'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <ContentProvider>
      <App />
    </ContentProvider>
  </StrictMode>,
)
