# Hosting the kiosk as a website — plan

**Status: technically ready today.** `npm run build` (or `npx vite build`) emits a
self-contained static site in `dist/`. Verified 2026-07-23 by serving the real
`dist/` over HTTP: Excel content parsed, every screen renders, 3D chakra runs.

Nothing about the Electron kiosk build changes. This is an *additional* output.

---

## 1. Why it already works

| Requirement | Status |
|---|---|
| No Electron APIs in the renderer | ✅ zero `ipcRenderer` / `window.electron` uses |
| Routing without server rewrites | ✅ `HashRouter` — every route is `#/...` |
| Works in a subfolder | ✅ `base: './'` in `vite.config.ts` |
| Content available over HTTP | ✅ `fetch('data/content.xlsx')`, 5s poll |
| Workbook shipped in the build | ✅ `copyDataDir()` plugin (commit `a51e3ef`) |

**Client content workflow survives hosting:** replace `data/content.xlsx` on the
server and the live site picks it up **within 5 seconds** — no rebuild, no redeploy.

---

## 2. The one real problem: weight

`dist/` is **372 MB**. Breakdown of the heavy parts:

| Item | Size | Note |
|---|---|---|
| Symbol turntables (PNG sequences) | **~185 MB** | 1,325 frames total |
| └ `lion-capital-of-ashoka` alone | 100 MB | single worst offender |
| └ tiger / lotus / peacock | 31 / 21 / 19 MB | |
| History year media | 78 MB | backgrounds + galleries |
| Monumental (incl. 135 install photos) | 67 MB | |
| Videos (`.mp4`) | ~6 MB total | already efficient |

On the kiosk these load from local disk instantly. Over the internet, the first
visit to a symbol pulls tens of MB. **Everything else is fine** — it's the PNG
frame sequences, nothing else.

### Options for the weight

**A. Ship as-is (zero code change).**
Fine on a VPS or normal paid hosting. Symbols feel slow on first load, then cache.
Best if the goal is client review / remote demo.

**B. Convert turntables to WebP frames.**
Lossy WebP keeps alpha, typically 70–85% smaller → ~185 MB drops to roughly
30–55 MB, total site well under 200 MB. Needs: asset regeneration + teaching
`PngSequencePlayer` the new extension. Half-day-ish, and it would speed the
**kiosk** up too.

**C. Convert turntables to alpha video (WebM/VP9).**
Smallest of all, but a bigger change to the player and only safe because the
kiosk is Chromium. Only worth it if B isn't enough.

> Recommendation: **A** to get a link up now; **B** if the hosted version is
> going to be used regularly, since it also benefits the kiosk.

---

## 3. Where to host

| Option | Verdict |
|---|---|
| **Hostinger** (already connected here) | Best fit. Real disk, no build-size ceiling. Needs: which domain/site to deploy under. |
| **Own VPS / Hostinger VPS** | Full control; I prepare `dist/` + exact nginx/upload steps. |
| **Netlify / Vercel** | Convenient, but 372 MB will strain limits — do option **B** first. |
| **Zip handover** | I package `dist/` and hand it to whoever manages hosting. |

---

## 4. Access — decide before anything goes up

This is unreleased client content (plus AI-expansion provenance notes and
data still marked unverified in the Excel).

- **Recommended:** password protect (HTTP basic auth is enough), or an unlisted URL.
- **Avoid** a fully public, search-indexed URL until the client signs off.

---

## 5. Deployment steps (whichever host)

1. `cd flag-foundation-kiosk && npx vite build` → `dist/` (372 MB, or ~180 MB after option B)
2. Upload the **contents** of `dist/` to the web root (or a subfolder — relative paths work).
3. Confirm `data/content.xlsx` is present and served (this is the piece that used to be missing).
4. Add access protection (see §4).
5. Smoke test against the checklist below.

### Smoke test checklist
- [ ] Home shows all 4 tiles (proves the Excel parsed)
- [ ] History → 1857 rewind intro plays, year pills switch
- [ ] Know More → gallery photos load, nothing cropped
- [ ] Ashok Chakra → wheel rolls in, all 3 pills, light renders
- [ ] Symbols → carousel spins, a turntable plays (slowest thing on the web)
- [ ] Monumental → map, select a state, open an installation
- [ ] Replace `data/content.xlsx` on the server → change appears within ~5s

---

## 6. What NOT to do

- **Don't replace the onsite kiosk with the hosted version.** The museum machine
  should keep running the Electron build: local media, no network dependency,
  kiosk lockdown (fullscreen, no browser chrome, Alt+F4-only exit). A browser tab
  has none of that.
- Don't point the kiosk at the hosted URL as a shortcut for content updates —
  the Excel hot-reload already handles that locally.
