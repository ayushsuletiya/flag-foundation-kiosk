# Setting the project up on another PC

The repo is self-contained: all 1,723 asset files, the fonts, and the client's
`data/content.xlsx` are committed. There is **no `.env` file and no API keys** —
nothing to configure after cloning. `npm install` + `npm run dev` is the whole
setup; nothing else has to be generated, downloaded or converted.

---

## 1. Prerequisites

| Tool | Version | Notes |
|---|---|---|
| **Node.js** | **22 LTS or 24** | Vite 7 + Electron 38 need ≥ 20.19. Built on 24.14.1. |
| **Git** | any recent | |

Get Node from <https://nodejs.org> (take the LTS installer), or:

```bash
# Windows
winget install OpenJS.NodeJS.LTS

# macOS
brew install node
```

Check it:

```bash
node -v      # expect v22.x or v24.x
npm -v
```

---

## 2. Clone

**Clone the `feat/chakra-assembly` branch.** `main` is **31 commits behind** and
has none of the chakra assembly animation, the Design tab rework, the audio
system, or the 2026-07-26 performance work.

```bash
git clone -b feat/chakra-assembly https://github.com/ayushsuletiya/flag-foundation-kiosk.git
cd flag-foundation-kiosk
```

The repo is public, so no login is required. It is ~200 MB of history, so the
clone takes a minute on a normal connection.

---

## 3. Install

```bash
npm install
```

Pulls Electron (~150 MB) as well, so allow a few minutes on a first run.

---

## 4. Run it

**In the browser** — fastest for UI work, hot reload:

```bash
npm run dev
```

Then open <http://localhost:5173>. The app is a fixed 1920×1080 stage that
scales to fit, so it will letterbox in a smaller window. That is by design.

**In the real Electron kiosk window** — fullscreen, no chrome, exactly how it
runs onsite:

```bash
npm run dev:electron
```

Quit it with **Alt+F4** (Windows) or **Cmd+Q** (macOS). There is no exit button.

---

## 5. Verify the setup is sound

```bash
npm run typecheck      # all three tsconfigs — must pass
npm run lint           # see the known pre-existing failure below
npm run check:content  # validates data/content.xlsx through the real loader
npm run build          # full production build
```

**`npm run lint` fails on `main` and on this branch**, at
`SymbolsCarouselScreen.tsx:312` (`useEffect` called conditionally). It is a
pre-existing issue unrelated to recent work. To lint only what you're touching:

```bash
npx oxlint src/screens/chakra/
```

---

## 6. Building the Windows kiosk installer

```bash
npm run dist:win
```

Output lands in `release/`:

- `Flag Foundation Kiosk Setup <version>.exe` — one-click installer (~353 MB;
  the version comes from `package.json`, currently 0.3.1)
- `win-unpacked/` — portable, run the `.exe` inside directly

This cross-builds successfully from macOS as well as natively on Windows.

> **Caveat learned the hard way:** a build that compiles is not a build that
> runs. The v0.1.0 installer passed every check on the build machine and still
> died at launch on the target hardware. If you produce an installer, run it on
> a real Windows machine before shipping it anywhere.

---

## About the WebP files — you do NOT need to do anything

There is a `scripts/optimize-assets.mjs` that writes a `.webp` sibling next to
every PNG/JPG (measured 388.8 MB → 81.8 MB, alpha preserved). **Ignore it.**

- The `.webp` files are **not committed**, and **nothing loads them** — the app
  requests `.png` only. A fresh clone is complete and correct without them.
- Running the script is **optional and currently pointless**: it changes nothing
  at runtime until the loader is wired to prefer `.webp` with a `.png` fallback.
- It also shells out to **`cwebp`**, which is *not* a project dependency — it
  only exists on a machine where someone installed libwebp (`brew install
  webp`). It will simply fail elsewhere, which is harmless.

So: **do not run it, and do not worry that your clone is missing anything.**
When the loader is wired, the script should be ported to `sharp` (a normal npm
dependency with prebuilt binaries for macOS/Windows/Linux) and hooked into
`npm run build`, so every machine regenerates them automatically with no manual
step and no 82 MB of binaries in git history.

---

## Things worth knowing before you start

**Content is driven by Excel, live.** All copy comes from `data/content.xlsx`.
Edit and save it while the app is running and the screen updates within a
second — no restart. Column mapping is by *header name*, so the client can
reorder columns safely. Never hardcode copy that exists in that workbook.

**The coordinate system is fixed at 1920×1080.** Positions are literal Figma
pixels. `src/app/Stage.tsx` scales the whole stage to fit. Do not make anything
responsive.

**Idle reset returns Home after 120 s.** This is intended kiosk behaviour, and
it will interrupt you while testing a long animation — it is not a bug.

**Perf guards for the Intel Arc iGPU:** no full-screen `backdrop-filter`, never
nest them, three.js only via lazy import so it stays in its own chunk.

**Dev-only debug hook.** On the Chakra Design tab, `window.__chakraScrub(p)`
freezes the 8-second build animation at any progress 0–1, and
`window.__chakraPlay()` resumes. Stripped from production builds. It is global
and last-mounted-scene wins, so make sure the Design tab is the active one.

---

## If something breaks

| Symptom | Cause |
|---|---|
| `EBADENGINE` on install | Node too old — need ≥ 20.19, use 22 LTS or 24 |
| Blank browser page | Wrong port. Vite pins 5173 via `strictPort`; free it, or start with `PORT=5180 npm run dev` |
| Chakra wheel never appears | The three.js scene holds off-stage until its shaders link. If the tab is in the background, rAF is frozen so it waits — focus the window |
| Audio silent until you tap | Browsers block autoplay; the first touch arms it. A background tab is muted on purpose |
| Electron window opens white | Vite dev server not up yet — it retries 40× at 500 ms |
| Missing images | Clone was incomplete. Assets ARE committed; re-clone |
| `npm run lint` fails | Expected — see the pre-existing issue above |
