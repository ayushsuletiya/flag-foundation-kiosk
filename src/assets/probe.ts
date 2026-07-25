/**
 * probe — can the browser load this media file?
 *
 * Kiosk media is user-dropped loose files the bundler can't know about, so
 * every screen discovers its assets by probing candidate URLs. A miss is a
 * silent onerror (works identically over vite dev HTTP and packaged file://).
 * Results are memoised for the app's lifetime — kiosk assets are immutable
 * at runtime.
 */

const cache = new Map<string, Promise<boolean>>()

function probeImage(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const img = new Image()
    img.onload = () => resolve(true)
    img.onerror = () => resolve(false)
    img.src = url
  })
}

function probeVideo(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const video = document.createElement('video')
    video.preload = 'metadata'
    video.onloadedmetadata = () => resolve(true)
    video.onerror = () => resolve(false)
    video.src = url
  })
}

export function probeImageCached(url: string): Promise<boolean> {
  let hit = cache.get(url)
  if (hit === undefined) {
    hit = probeImage(url)
    cache.set(url, hit)
  }
  return hit
}

export function probeVideoCached(url: string): Promise<boolean> {
  const key = `video:${url}`
  let hit = cache.get(key)
  if (hit === undefined) {
    hit = probeVideo(url)
    cache.set(key, hit)
  }
  return hit
}

function probeAudio(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    const audio = new Audio()
    audio.preload = 'metadata'
    audio.onloadedmetadata = () => resolve(true)
    audio.onerror = () => resolve(false)
    audio.src = url
  })
}

export function probeAudioCached(url: string): Promise<boolean> {
  const key = `audio:${url}`
  let hit = cache.get(key)
  if (hit === undefined) {
    hit = probeAudio(url)
    cache.set(key, hit)
  }
  return hit
}
