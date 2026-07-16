import { app, BrowserWindow, ipcMain } from 'electron'
import { watch, type FSWatcher } from 'chokidar'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/** Vite dev server URL (port pinned via strictPort in vite.config.ts). */
const DEV_SERVER_URL = process.env['VITE_DEV_SERVER_URL'] ?? 'http://localhost:5173'
const DEV_LOAD_RETRIES = 40
const DEV_LOAD_RETRY_MS = 500

/**
 * THE client-editable content file. Packaged builds ship it under
 * resources/data (electron-builder extraResources — configured in Phase 7);
 * in dev it lives at the repo root next to dist-electron/.
 */
const CONTENT_XLSX_PATH = app.isPackaged
  ? path.join(process.resourcesPath, 'data', 'content.xlsx')
  : path.join(dirname, '..', 'data', 'content.xlsx')

const CONTENT_DEBOUNCE_MS = 500

let mainWindow: BrowserWindow | null = null
let contentWatcher: FSWatcher | null = null
let contentDebounce: NodeJS.Timeout | null = null

/**
 * Watch content.xlsx and notify every renderer (debounced 500ms — Excel
 * saves fire multiple fs events, often via atomic replace, so listen to
 * 'all' rather than just 'change').
 */
function startContentWatcher(): void {
  contentWatcher = watch(CONTENT_XLSX_PATH, { ignoreInitial: true })
  contentWatcher.on('all', () => {
    if (contentDebounce) clearTimeout(contentDebounce)
    contentDebounce = setTimeout(() => {
      contentDebounce = null
      for (const win of BrowserWindow.getAllWindows()) {
        win.webContents.send('content-changed')
      }
    }, CONTENT_DEBOUNCE_MS)
  })
}

/**
 * Dev only: the window may come up before the Vite dev server finishes
 * booting (dev:electron starts both concurrently), so retry until it
 * responds instead of showing a load error.
 */
async function loadDevServer(win: BrowserWindow, attempt = 0): Promise<void> {
  try {
    await win.loadURL(DEV_SERVER_URL)
  } catch {
    if (win.isDestroyed() || attempt >= DEV_LOAD_RETRIES) return
    setTimeout(() => {
      void loadDevServer(win, attempt + 1)
    }, DEV_LOAD_RETRY_MS)
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1920,
    height: 1080,
    frame: false,
    fullscreen: true,
    kiosk: true,
    autoHideMenuBar: true,
    backgroundColor: '#000000',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(dirname, 'preload.cjs'),
    },
  })

  if (app.isPackaged) {
    // Production: load the built renderer from dist/ (base './' in vite.config.ts).
    void mainWindow.loadFile(path.join(dirname, '../dist/index.html'))
  } else {
    void loadDevServer(mainWindow)
  }

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  // Renderer pulls the workbook bytes over IPC (works packaged, where the
  // renderer is on file:// and cannot fetch the data directory).
  ipcMain.handle('read-content-file', async (): Promise<Uint8Array> => {
    const buf = await readFile(CONTENT_XLSX_PATH)
    return new Uint8Array(buf.buffer, buf.byteOffset, buf.byteLength)
  })

  startContentWatcher()
  createWindow()

  app.on('activate', () => {
    // macOS dev convenience: re-create the window when the dock icon is clicked.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  // Kiosk: quitting when the window goes away lets the OS watchdog restart us.
  if (contentDebounce) clearTimeout(contentDebounce)
  void contentWatcher?.close()
  app.quit()
})
