/**
 * Preload bridge (compiled to CommonJS `preload.cjs` — sandboxed preloads
 * cannot use ESM). Exposes the minimal `window.kiosk` API the renderer's
 * ContentContext needs; typed on the renderer side in src/data/kioskBridge.ts.
 */
import electron = require('electron')

const { contextBridge, ipcRenderer } = electron

const kioskBridge = {
  /** Read data/content.xlsx via the main process (works packaged, no fetch). */
  readContentFile: (): Promise<Uint8Array> =>
    ipcRenderer.invoke('read-content-file') as Promise<Uint8Array>,

  /**
   * Subscribe to file-watcher notifications (chokidar in main, debounced
   * 500ms). Returns an unsubscribe function.
   */
  onContentChanged: (callback: () => void): (() => void) => {
    const listener = (): void => {
      callback()
    }
    ipcRenderer.on('content-changed', listener)
    return () => {
      ipcRenderer.removeListener('content-changed', listener)
    }
  },
}

contextBridge.exposeInMainWorld('kiosk', kioskBridge)
