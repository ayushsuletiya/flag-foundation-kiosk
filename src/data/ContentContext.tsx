/**
 * ContentContext — makes the parsed Excel content available app-wide and
 * keeps it hot: swap data/content.xlsx and every screen re-renders.
 *
 * Two transports, feature-detected:
 *  - Electron: bytes come over IPC (window.kiosk.readContentFile) and the
 *    main process pushes 'content-changed' when chokidar sees the file change.
 *  - Pure-browser dev (plain `vite`): bytes come from GET /data/content.xlsx
 *    (served by the dataDir plugin in vite.config.ts) and we poll every 5s,
 *    only re-parsing when the bytes actually changed.
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react'
import { loadContent } from './excelLoader.ts'
import { getKioskBridge } from './kioskBridge.ts'
import type { ContentStore, ValidationReport } from './schema.ts'

const BROWSER_POLL_MS = 5000
const CONTENT_URL = 'data/content.xlsx' // relative — works under vite dev and file://

export interface ContentContextValue {
  /** Parsed content, or null until the first load resolves. */
  content: ContentStore | null
  /** Row-level problems from the last load, or null until the first load. */
  validation: ValidationReport | null
  /** True while the very first load is in flight. */
  loading: boolean
  /** Fatal transport error (file unreachable), null when the last load worked. */
  error: string | null
  /** Force an immediate re-read of content.xlsx. */
  reload: () => void
}

const ContentContext = createContext<ContentContextValue | null>(null)

/** Cheap FNV-1a hash so the 5s browser poll only re-parses on real changes. */
function hashBytes(bytes: Uint8Array): number {
  let h = 0x811c9dc5
  for (let i = 0; i < bytes.length; i++) {
    h ^= bytes[i]!
    h = Math.imul(h, 0x01000193)
  }
  return h >>> 0
}

async function fetchBytes(): Promise<Uint8Array> {
  const bridge = getKioskBridge()
  if (bridge) {
    return await bridge.readContentFile()
  }
  const res = await fetch(`${CONTENT_URL}?t=${Date.now()}`, { cache: 'no-store' })
  if (!res.ok) {
    throw new Error(`GET ${CONTENT_URL} → HTTP ${res.status}`)
  }
  return new Uint8Array(await res.arrayBuffer())
}

export function ContentProvider({ children }: { children: ReactNode }) {
  const [content, setContent] = useState<ContentStore | null>(null)
  const [validation, setValidation] = useState<ValidationReport | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const lastHashRef = useRef<number | null>(null)
  const inFlightRef = useRef(false)

  /** Load + parse. When `force` is false, identical bytes are skipped. */
  const load = useCallback(async (force: boolean) => {
    if (inFlightRef.current) return
    inFlightRef.current = true
    try {
      const bytes = await fetchBytes()
      const hash = hashBytes(bytes)
      if (!force && lastHashRef.current === hash) return
      lastHashRef.current = hash

      const result = loadContent(bytes)
      setContent(result.content)
      setValidation(result.validation)
      setError(null)
    } catch (err) {
      // Transport failure — keep the previous content on screen.
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      inFlightRef.current = false
      setLoading(false)
    }
  }, [])

  const reload = useCallback(() => {
    void load(true)
  }, [load])

  useEffect(() => {
    void load(true)

    const bridge = getKioskBridge()
    if (bridge) {
      // Electron: push-based hot reload from the main-process file watcher.
      const unsubscribe = bridge.onContentChanged(() => {
        void load(true)
      })
      return unsubscribe
    }

    // Browser dev: poll; hash check inside load() skips unchanged bytes.
    const timer = setInterval(() => {
      void load(false)
    }, BROWSER_POLL_MS)
    return () => clearInterval(timer)
  }, [load])

  const value = useMemo<ContentContextValue>(
    () => ({ content, validation, loading, error, reload }),
    [content, validation, loading, error, reload],
  )

  return <ContentContext.Provider value={value}>{children}</ContentContext.Provider>
}

/** Access the live content store. Must be used inside <ContentProvider>. */
export function useContent(): ContentContextValue {
  const ctx = useContext(ContentContext)
  if (ctx === null) {
    throw new Error('useContent() must be used inside <ContentProvider>')
  }
  return ctx
}
