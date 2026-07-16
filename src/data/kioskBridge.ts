/**
 * Renderer-side typing for the Electron preload bridge
 * (electron/preload.cts exposes `window.kiosk` via contextBridge).
 *
 * In pure-browser dev mode `window.kiosk` is undefined — callers must
 * feature-detect and fall back to fetch() polling.
 */
export interface KioskBridge {
  /** Read data/content.xlsx from disk via the main process. */
  readContentFile: () => Promise<Uint8Array>
  /**
   * Subscribe to main-process notifications that content.xlsx changed on disk
   * (chokidar watcher, debounced 500ms). Returns an unsubscribe function.
   */
  onContentChanged: (callback: () => void) => () => void
}

declare global {
  interface Window {
    kiosk?: KioskBridge
  }
}

/** The bridge if running inside Electron, otherwise null (browser dev mode). */
export function getKioskBridge(): KioskBridge | null {
  return typeof window !== 'undefined' && window.kiosk ? window.kiosk : null
}
