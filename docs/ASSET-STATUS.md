# Asset Status — every image & video slot in the app

_Compiled 2026-07-19 after the full content-preparation pass (FFOI book mining +
Wikimedia research + designer-handoff wiring + Magnific enhancement).
Complements `ASSET_MANIFEST.md` (the pre-build Figma audit) in the project root._

Statuses: **REAL** = final client-grade asset · **AI-SCENE** = client-commissioned AI scene render (approved design direction) · **PLACEHOLDER** = still the generated stand-in · **EMPTY** = slot exists, no file.

## Videos (`assets/video/`)
| Slot | Status | Source |
|---|---|---|
| `home-bg.mp4` 1920×1080, 10 s loop | AI-SCENE | Handoff `flag_loop` (sunset India Gate + flag, matches Figma home), Magnific-upscaled to 4K, delivered at 1080p (4K master in session backup) |
| `india-map-loop.mp4` 1920×1080, 10 s loop | AI-SCENE | Handoff `india_map_fx_loop` terrain render (repaired from broken `*.mp4.mp4` naming) |
| `monumental-intro-5s.mp4` 1920×1080, 4.5 s | AI-SCENE | Handoff `india_map_loop` (plays once → map explorer) |
| `assets/images/home/bg-poster.png` | AI-SCENE | Frame of home-bg.mp4 (poster now matches the video) |

## History of Tiranga (`assets/images/history/<year>/`)
**Year flags — all 9 years REAL, 1200×768 (exact 1.5625 box ratio → zero crop), RGBA transparent:**
- 1906 · 1907 · 1917 · 1921 · 1931 · 1947 — official FFOI flag-evolution art (414×265 from flagfoundationofindia.in), Magnific precision-enhanced, original alpha preserved
- 1857 · 1905 · 1941 — FFOI book artwork (pp. 35/36/43), enhanced ×2 passes, page background removed via border flood-fill (enclosed whites like the 1941 flag's white band preserved)

**Era backgrounds `bg-1.png` 1920×1080:**
- 1906/1907/1917/1921/1931/1947 — AI-SCENE, designer handoff 4K era renders (Freepik Mystic)
- 1857/1905/1941 — PLACEHOLDER (navy chakra card). No handoff render exists for these years.

**Galleries `gallery-1..6.png` — 35 images, all REAL (book scans or Wikimedia public domain):**
| Year | Images |
|---|---|
| 1857 | Bahadur Shah Zafar portrait · enthroned court painting (1838) · Meerut revolt engraving (1857) · Capture of Delhi litho (1858) |
| 1905 | Sister Nivedita portrait · Vivekananda group, Kashmir 1898 · INC Bombay 1904 · Nivedita with Sarada Devi |
| 1906 | Sachindra Prasad Bose · Bande Mataram weekly front page · Bipin Chandra Pal · Surendranath Banerjee |
| 1907 | Bhikhaji Cama sketch (book p.38) · Cama portrait · Cama with S.R. Rana · Stuttgart Congress 1907 |
| 1917 | Annie Besant c.1910 · Tilak (Young India) · Tilak in Madras 1917 |
| 1921 | Pingley Venkayya sketch (book p.41) · Gandhi in 1921 (CWMG) · Bombay Chronicle boycott notice 31 Jul 1921 |
| 1931 | Karachi Congress session · Mirabehn at Karachi |
| 1941 | 1948 calendar art with Bose (book p.44) · Netaji reviewing Azad Hind Fauj · INA group · INA Rangoon · Indian Legion Berlin |
| 1947 | Nehru presenting Tiranga (book p.13) · Princess Park crowd (p.17) · stadium hoisting (kept) · Mountbatten salute (p.18) · Hansa Mehta sketch (p.15) · Nehru "Tryst with Destiny" |

The watermarked 1947 image (indianexpress) and the duplicate gallery-1/2 pair are gone; the code-side 1947 `gallery-2` skip was removed with them.

## Home (`assets/images/home/`)
4 category cards, NJU logo, poster — REAL (Figma exports). No gaps.

## National Symbols (`assets/sequences/symbols/`)
10 turntable sequences REAL (107 frames each; lion capital 241): tiger, peacock, lotus, mango, flag, ganga (गंगा water-text), indian-elephant, indian-banyan, indian-rupee, lion-capital-of-ashoka.
- **ganges-river-dolphin — NEW 107-frame sequence** cut from `symbol-source/clips/dolphin2.mp4` via rembg. ⚠️ **Species check needed:** the clip's dolphin has a tall curved dorsal fin (marine-dolphin trait); a Gangetic dolphin has a low hump + longer rostrum. Recommend regenerating the clip keyframed strictly on `symbol-source/river-dolphin.png` (the approved still, which this pass also overwrote as poster — recoverable from that source file).
- jana-gana-mana, vande-mataram, saka-calendar — static only (dropped from rotation by user decision).
- Did You Know cards reuse each symbol's static cutout by design; only tiger has the dedicated `tiger-stripes.png`.

## Monumental Flags (`assets/map/`, `assets/images/installations/`)
- Map kit (terrain still/render, 39 state active/hit shapes, select-state bg) — REAL.
- Installation photos: **109 of 219** mirrored; 110 rows have no Photo URL (Excel warning). Book photos for Kargil/Kaithal/Raigarh matched rows that already have photos, so they were not used. Filling the 110 needs FFOI site/photo-gallery mining — open item.
- Flag-marker PNG sequence — static only (animated sequence still user-provided).

## Chakra (`assets/images/chakra/`, `assets/3d/`)
bg-sunset, flag-pole, wheel-poster — REAL. `ashoka_chakra.glb` copied from handoff as backup (app uses the parametric three.js wheel).

## Excel (`data/content.xlsx`) — updated this pass
- 05: `Official Flag Image URL` filled for 1857/1905/1941 (bundled asset paths).
- 05b: 7 stale "— (screen not built yet)" notes replaced with real Know More descriptions (composed strictly from the approved bullets, book spellings).
- 07: 4 provenance rows added (book scans, Wikimedia PD list, handoff renders, Magnific precision enhancement).
- `npm run check:content`: 0 errors.

## Book image catalog
Full 131-page catalog of the FFOI book's ~105 images (page, subject, caption, quality, candidate slot): session scratchpad `book-catalog.json` / `book-interesting.json`. 22 images extracted to `book-picks/`. Unused but cataloged: 23 flag-code do/don't illustrations (no Flag Code screen in the app), international flags, chakra technical drawing (p.21).

## Remaining gaps (in priority order)
1. Era backgrounds for 1857/1905/1941 (commission matching Freepik Mystic renders, or accept the placeholder).
2. 110 installation photos (FFOI `/photos` + `/monumental-flags` mining, then `npm run mirror:photos`).
3. Animated flag-marker sequence (S1) for the map.
4. Dolphin clip species fix (see above).
5. Timeline thumbnails from the handoff (`flag_timeline_assets/thumbnails/`) not wired — AI-composited people; kiosk timeline uses text pills, and showing "period-representative figures" as real people risks misleading visitors. Held back deliberately.
