import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createReadStream } from 'node:fs'
import { cp, stat } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const dirname = path.dirname(fileURLToPath(import.meta.url))

/**
 * Serve the client-editable data/ directory at /data during browser dev so
 * ContentContext can poll content.xlsx without Electron. Always no-store —
 * the whole point is picking up the client's latest save.
 */
function serveDataDir(): Plugin {
  const dataDir = path.join(dirname, 'data')
  return {
    name: 'kiosk-serve-data-dir',
    configureServer(server) {
      server.middlewares.use('/data', (req, res) => {
        void (async () => {
          // Never fall through to the SPA fallback: a missing data file must
          // surface as a real 404, not index.html masquerading as a workbook.
          const reject = (status: number, message: string): void => {
            res.statusCode = status
            res.setHeader('Content-Type', 'text/plain')
            res.end(message)
          }
          const urlPath = (req.url ?? '/').split('?')[0] ?? '/'
          const filePath = path.join(dataDir, decodeURIComponent(urlPath))
          if (!filePath.startsWith(dataDir + path.sep)) {
            reject(403, 'Forbidden')
            return
          }
          try {
            const info = await stat(filePath)
            if (!info.isFile()) {
              reject(404, 'Not found')
              return
            }
          } catch {
            reject(404, 'Not found')
            return
          }
          res.setHeader('Content-Type', 'application/octet-stream')
          res.setHeader('Cache-Control', 'no-store')
          createReadStream(filePath).pipe(res)
        })()
      })
    },
  }
}

/**
 * Media lives in the root assets/ directory and is referenced by runtime
 * relative URLs (e.g. "assets/0-home/background/poster.png") so screens work
 * identically under vite dev (root files are served at /assets/…) and in the
 * packaged Electron build. This copies assets/ next to dist/index.html on
 * build so those URLs resolve under file:// too. Hashed-bundle filenames in
 * dist/assets/ cannot collide with the copied subdirectories.
 */
function copyAssetsDir(): Plugin {
  return {
    name: 'kiosk-copy-assets-dir',
    apply: 'build',
    async closeBundle() {
      await cp(path.join(dirname, 'assets'), path.join(dirname, 'dist', 'assets'), {
        recursive: true,
      })
    },
  }
}

/**
 * Ship the client-editable workbook inside dist/ as well.
 *
 * Electron doesn't need this (ContentContext reads the file over the IPC
 * bridge, and electron-builder ships data/ as an extraResource), but a
 * WEB deploy has no bridge: the browser transport GETs `data/content.xlsx`
 * relative to index.html and polls it every 5s. Copying it here is what
 * makes `dist/` a self-contained static site — and keeps the client's
 * "swap the workbook, screens update" workflow working when hosted
 * (replace dist/data/content.xlsx on the server; live within 5s).
 */
function copyDataDir(): Plugin {
  return {
    name: 'kiosk-copy-data-dir',
    apply: 'build',
    async closeBundle() {
      await cp(path.join(dirname, 'data'), path.join(dirname, 'dist', 'data'), {
        recursive: true,
      })
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), serveDataDir(), copyAssetsDir(), copyDataDir()],
  // Relative base so the Electron production build can load dist/ via file://
  base: './',
  server: {
    port: 5173,
    strictPort: true,
    // Dev serves assets/ with no cache headers, so Chrome heuristically
    // caches media and a swapped-in file (bg-1.png etc.) keeps showing its
    // OLD pixels on normal reload. no-cache = always revalidate (304 when
    // unchanged) — drop-in asset updates appear on plain refresh. The
    // packaged Electron build loads file:// and is unaffected.
    headers: {
      'Cache-Control': 'no-cache',
    },
  },
})
