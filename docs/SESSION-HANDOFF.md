# Session handoff — 2026-07-19/20 (content + assets marathon)

Written for a fresh session with zero context. The 2026-07-18/19 handoff
(chakra assembly, Windows crash triage) is preserved below this section.

## 0. THIS SESSION — what shipped (all pushed to `feat/chakra-assembly`)

### 2026-07-23 — perf fix, photo rules, light REMOVED, flag framing, transitions

**Read this first: two things were REVERSED late in the day.** The
full-screen volumetric light (built 07-21) is GONE, and the map-list card
photo is back to its original cover-crop. Do not "restore" either.

- `8edb168` **PERF — the kiosk lag + delayed touch.** The full-screen
  god-ray volumetric (depth pre-pass + 512² 20-step march + 48-tap streak
  ≈ 18M samples) ran EVERY frame on the Arc iGPU, saturating it and
  starving pointer input. Cached it into an offscreen RT, recomputed only
  when the pose moves (1-in-3 frames for idle spin / cloth, 0 at rest).
  → **superseded by `d2ef139`, which deletes the light entirely.** Keep
  the diagnosis: per-frame full-screen volumetrics = kiosk lag.
- `d0553e9` **v0.3.1 onsite build** in `release/` (Setup .exe 487MB + zip
  529MB). 0.2.0/0.3.0 deleted — 0.3.0 shipped the slow light, do not use.
- `d446057` + `f39c07c` history gallery thumbnails NEVER crop (19 of them
  across the 9 years were beheading portraits — Sister Nivedita aspect
  0.71 in a 1.55 tile), then blur-filled.
- `7d07f90` **`src/components/UncroppedPhoto.tsx`** — one shared rule for
  content photos: never crop, frame HUGS the photo (border/radius ride the
  IMAGE via `imgClassName`, slot stays transparent). Optional `fill` prop
  blur-fills instead, for UNIFORM tiles. Applied to symbol DYK + install
  carousel. `imageFocus.ts` unwired from the detail carousel.
- `9372990` large gallery image keeps its DYNAMIC hugging frame (a fill
  there drew a fixed box — user rejected twice).
- `10671d7` **map LIST card reverted to the original** `cover` +
  `useFlagObjectPosition`. Letterboxing a 1.62 photo in a 1.38 box always
  reads as a border, whatever fills the bands. Leave it alone.
- `d2ef139` **volumetric light DELETED** (288 lines: depth pre-pass, ray
  march, streak, cached RT + blit, pinned sun, strength ramp). The wheel
  is lit by its own rig over the CSS plate; the loop is one scene render.
  Recover from `10671d7^` if ever wanted.
- `948b11f` chakra background stays blurred through the entrance (the
  "bare sunset" beat is gone).
- `84a53ee` + `4ec3b53` **flag framing**: dolly along the same view axis
  (z 537.7 → 435) so the cloth is ~609px wide (~1.22×) and centred in the
  band between the text column (ends x625) and cards (start x1348).
  Tuned on numbers via the new DEV `__chakraFlagScreen()` hook (projects
  the cloth bbox to canvas px — the dock camera is oblique so nothing
  scales linearly). 48px clearance from the cards at peak billow.
- `2461585` **tab transitions** — three real defects fixed: (1) leaving
  flag for DESIGN ended with a one-frame camera SNAP (WHEEL_CAM→DIMS_CAM,
  57 units) because the undock lerp aims at the framing current when
  setMode ran while `dims` flips the same render → restoreWheelPose now
  TWEENS (420ms); (2) undock reused the 3.2s dock duration and read as
  stuck → new `FLAG_BACK_MS` 1900 (in stays 3200); (3) a second pill tap
  inside the 240ms leave window was DROPPED → switchTab now retargets.

**Verified:** 8 consecutive transitions over every pair, no console
errors, each tab settling on its canonical framing (values r360.4
@964,626 / design r313.4 @957,628 / flag→design included).

**Also this session:** `a51e3ef` `dist/` is now a hostable static site
(copyDataDir ships `data/content.xlsx`; renderer uses no Electron APIs,
HashRouter, base './'). Plan + sizes in `docs/WEB-HOSTING-PLAN.md`
(372MB, 185MB of it symbol turntable PNG sequences). NOT deployed —
awaiting the user's host + access decision.

**PANE LIMIT (recurring):** the preview pane suspends rAF, so animation
MOTION cannot be measured here — only end states and forced frames. Dev
hooks for that: `__chakraRollScrub(p)`, `__chakraFlagScrub(p)`,
`__chakraWheelScreen()`, `__chakraFlagScreen()`, `__chakraScrub(p)`.
Console buffer also persists across reloads and replays STALE HMR errors
— re-check on a fresh load before believing them.

**Open:** v0.3.1 does NOT contain anything after `d0553e9` (no-crop
photos, light removal, flag framing, transition fixes) — cut **v0.3.2**
before the next onsite test. Transition MOTION still wants the user's eye
in a visible browser.

### 2026-07-20/21 night — chakra section: persistent scene + full-screen light
Iterative user-driven rework of /chakra, commits in order:
- `aafb1b8` roll entrance v2: wheel rolls UPRIGHT (lean returns after landing),
  constant-friction ease, roll waits for the background (useDynamicBackground
  gate + 'wait' intro phase); WarmChakra prefetch 2.5s→1.2s.
- `5fc2e65` entrance dressing: BLACK dip in (no brown base flash), sunset
  shows BARE (no blur/scrim, brightness 1.14) while the wheel travels.
- `a7d2e9c` progressive background blur: sharp plate + blur(7px) copy
  gradient-masked to die by the ground (.ck-bg-blur).
- `0ecc660` tab exits + flag scene: 240ms shrink+fade pill switches, flag
  HOME framing fixed, dock plane measured locally (parallax fix), cloth
  BEND constraints (skip-one, 0.35) kill the fold-through tear.
- `5e0babd` (superseded) one-frame pose-matched scene handoff into flag.
- `ae17305` **ONE PERSISTENT Chakra3D scene for all three tabs** — the wheel
  never remounts: camera TWEENS values↔design, dims callouts FADE (assembly
  entrance retired on switches), dock plays forward AND reverse. All cameras
  re-derived; `__chakraWheelScreen()` dev hook projects exact framings.
- `f250fa3` + `5ca8769` + `23c2c1c` + (this) **FULL-SCREEN LIGHT, ALL TABS**:
  canvas = the whole 1920×1080 stage (no mask/edge dissolve — light runs off
  the screen edge naturally), rays ungated in flag mode, flag cloth/pole cast
  into the volumetrics (backlit Tiranga), VOL_R 460, strength 0.33, dpr≤1.5,
  angular RAY FAN in the streak pass (film-style beams from the sun on every
  tab — open air alone is featureless; boost 1.45, fan 0.62±0.38 @ sin 9θ/23θ).
  Gotcha fixed en route: a FILLED opacity animation on .ck-tab-body kept a
  permanent stacking context that trapped card z-indexes under the full-stage
  canvas (taps eaten) — fill-mode 'backwards' releases it.
  PERF NOTE for Phase-7 soak: full-stage canvas + per-frame rays ≈ 2.07Mpx
  ×2 passes at kiosk dpr 1 — watch the Arc iGPU headroom; the ray recompute
  can be paused while idle if needed (CLAUDE.md perf guard note).

### 2026-07-20 late — Ashok Chakra rolling entrance (category intro #2)
- `350f0b8` **/chakra section intro**: arriving from OUTSIDE (navTrace-gated,
  same rule as the History rewind) → sunset background alone for 750ms → the
  finished wheel ROLLS in from off-stage left over 1.8s → chrome rises in
  staggered (620ms, title→tabs→left column→panel). Mechanics: Chakra3D
  `entrance="roll"` — the scene derives BOTH the `.ck-wheel` box translateX
  (reported via `onRollFrame`; translating the BOX keeps its edge-feather
  mask riding along) and `chakra.rotation.z` from ONE remaining-travel
  number over the wheel's screen radius (359px), so it rolls without
  slipping. easeOutBack settle (+33px overshoot ≈ 5° rock-back). God-rays
  held off while the wheel is displaced (their sun would sit off the
  plate's real sun) and reignite over 700ms on landing; in-scene contact
  shadows travel WITH the wheel. Any touch skips (`.ck-intro-touch` overlay
  → finishRoll snap); parent 7s watchdog reveals chrome even if the chunk/
  WebGL dies or rAF is suspended; classes drop at 'done' so the rise-in can
  never fight interactive transforms. In-section tab hops never replay
  (tabs are state, not routes). Dev QA: `window.__chakraRollScrub(p)`
  renders frozen roll frames even on hidden pages. Verified in preview:
  hold/skip/watchdog paths, frames at p=0/.08/.35/.70/1, Design/Flag tabs
  and Values-return unregressed, typecheck clean. Full-motion pacing still
  needs the USER's visible Chrome (pane runs hidden → rAF suspended).
  Pacing knobs: ROLL_HOLD_MS 750 / ROLL_MS 1800 / ROLL_BACK 0.8 (Chakra3D).
  NOTE: an ultracode review workflow was attempted but both agents hit the
  session usage limit — no external review ran; verification above is ours.
- Category-intro track status: History ✓ (rewind) · Chakra ✓ (roll-in) ·
  Monumental already opens with intro.mp4 · Symbols has a standing NO-INTRO
  user decision (2026-07-19) — ASK before adding one there.

### 2026-07-20 evening — history backgrounds v3, rewind intro, v0.2.0 build
Commits, in order:
- `c67d6d2` chakra page entrance smoothed (DynamicBackground fade-in for ALL
  screens, warm ck-screen base, WarmChakra idle prefetch of the three.js
  chunk + chakra bg).
- `163971f` no ground shadows while the chakra assembles (600ms ease-back).
- `95c2bf7` + `65a46d0` chakra virtue text: splitTwoLines() two-line stacking
  ("Spiritual/Knowledge" at 88.5px ×2) + fitHeadlineMeasured() canvas-metric
  fit ("Faithfulness" 80.8px, was 59) — headline + list pills.
- `66717ea` history bg round 2: 1917→sharp Tilak blur-fill, 1906→paper-
  artifact masthead card, 1905→group right of the flag slot.
- `34707a5` **generative expand, USER-APPROVED**: 1905/1917/1921 archival
  photos AI-extended to widescreen with **Nano Banana Pro**
  (`imagen-nano-banana-2` via images_generate + image reference, 21:9 for
  crop slack). **ideogram images_expand REPLACES subjects — never use.**
  Disclosed per-asset in provenance + Excel tab 10.
- `63b76f3` vite dev now sends Cache-Control: no-cache (swapped assets show
  on plain refresh; user saw stale 1905 from Chrome's heuristic cache).
- `4e27183` 1941 bg re-rendered with **GPT 2** (`gpt-2`) — Bose likeness
  face-compared and verified (nano version distorted his jaw, rejected).
- `4e2a003` 1947 bg MIRRORED (user decision) — Nehru's rostrum now visible
  right of the text column; tighter window keeps seated faces off the
  year-flag slot. AIR mic-box lettering reads reversed (disclosed).
- `cf2c302` **v0.2.0 onsite build** — `release/` holds Setup 0.2.0.exe
  (465MB) + 0.2.0-win.zip (504MB) + win-unpacked, verified to contain the
  new assets; ONSITE-TESTING.md refreshed; stale Sources row rewritten.
- `09b910c` + `5273e62` + `f40e3a9` **History rewind intro**: entering
  /history from outside plays a ~5.7s WebGL film-rewind (rewindGL.ts lazy
  shader quad: streaks, aberration, gate weave, grain, light-leaks, gold
  dust particles ×900) with a per-digit ODOMETER counting every year and
  slot-machine braking into **1857 — the section's new default year**
  (DEFAULT_HISTORY_YEAR changed from 1947). Any touch skips; watchdog
  covers rAF-suspended (hidden) pages; navTrace.ts records prev pathname.
  Numeral verified dead-center. NOTE: full-motion playback was verified by
  the USER in Chrome — the dev preview pane runs hidden (rAF suspended),
  only forced single frames render there.

Open after this session: user may tune rewind pacing (arrive 1.1s / brake
1.05s / particle density); intros for the OTHER three categories are the
declared next enhancement (history was #1); optional GPT-2 likeness re-run
for Tilak (1917) / Gandhi (1921) if the user spots drift; ~810+ Magnific
credits spent (user-approved batch).

### 2026-07-20 polish pass (/goal — verified live in preview)
- **History backgrounds are now REAL archival images** (user directive: NO
  AI-generated backgrounds, ever — upscale/expand real photos only). All 9
  `background/bg-1.png` rebuilt from that year's provenance-verified gallery
  image (Lanczos + warm grade + grain; 1921 = self-blur-fill composite of
  the Gandhi photo; scratchpad `real-bgs.py`). Provenance doc + Excel
  credits tab rows updated to the derived-from-gallery sources.
- **Symbols podium grounding**: tiger/peacock/elephant/banyan/flag stand ON
  the podium (visible alpha-bbox bottom pinned to y=725.5 via
  `useGroundedOffset` in `symbolsMedia.ts`); dolphin/ganga/lotus/etc keep
  floating (user decision).
- **Know More gallery**: year flag artwork always leads the gallery
  (`historyAssets.ts`); large image NEVER cropped — dynamic framed box hugs
  the image's own aspect (contain, max 728×485); thumbs stay uniform, flag
  thumb contained on a dark plate.
- **Monumental**: "Flags" script descender un-clipped (padding+negative
  margin — background-clip:text only paints ink inside the border box; same
  fix applied to the chakra title); installation card + detail photos keep
  the FLAG in frame via tricolor-detection crop focus
  (`src/assets/imageFocus.ts` — anchors on the topmost dense tricolor rows,
  so balloon garlands lower in frame can't win).
- **Select State overlay**: subtitle count line removed; Continue is the
  Figma cream pill (309×101 r50 at stage 806,948, straddling the panel's
  bottom edge).
- **Chakra in Flag**: hero slot scaled 1.2x (same 0.669 aspect → same camera
  framing) and moved down — pole tip clears the tab pill.
- **Global polish**: 320ms route fade/rise (`AnimatedRoutes` in App.tsx;
  history year-pill swaps collapse to one key so they DON'T remount;
  `/symbols` stays inert per the no-transition user decision); Quick Access
  panel backdrop-blur (panel-sized, not full-screen — perf guard intact);
  BlurTypeText word-grouping (no mid-word wraps) + rolled out to symbol
  detail titles, history year/title, Know More heading, chakra headlines
  (gradient moves onto chars — parent bg-clip:text skips filtered subtrees).

Milestone commits, in order:
- `30b9123` fix: monumental expanded-card glow clipping (single glow source
  when the first-row patch is active) + KnowMore portrait crop bias.
- `965bbfd` content: FULL asset pass — all 9 history year flags real
  (official FFOI art ×6 + book art 1857/1905/1941, 1200×768 RGBA, zero-crop),
  35 gallery images (FFOI book scans + Wikimedia PD, all visually verified),
  era bg-1 ×6 from designer handoff 4K, videos wired 1080p (home-bg,
  india-map-loop, monumental-intro-5s — repaired `*.mp4.mp4` misnames),
  ganges-river-dolphin 107-frame rembg turntable, Excel updates
  (flag paths, 7 real Know More descriptions, provenance rows).
- `273124b` refactor: category-first `assets/` tree — `0-home /
  1-monumental-flags / 2-history-of-tiranga/<year> / 3-ashok-chakra /
  4-national-symbols / _shared`, client README.txt in each. **Every
  `background/` folder is dynamic** (`bg.mp4` wins → `bg-1..5.png`
  crossfade → `bg.png` → placeholder) via `src/components/
  DynamicBackground.tsx` + `src/assets/probe.ts`; every path lives in
  `src/assets/paths.ts` — screens never hardcode.
- `225b7ab` refactor round 2 (user-directed): installations = one FOLDER
  per site (`installations/<id>/1.jpg, 2.jpg…` → 2+ photos = auto
  carousel with dots on the detail screen); national symbols =
  `carousel-background/ + detail-background/ + symbols/<slug>/
  {turntable, did-you-know}/` (DYK photos `1.png…N.png`, any count,
  cycle with the fact pages); history gallery flexible to 24 images with
  a scrollable thumb row; chakra virtue icons moved into
  `3-ashok-chakra/virtue-icons/`; `data/README.txt` documents every
  Excel tab.
- `5686969` content: era backgrounds for 1857/1905/1941 (Magnific sepia
  scenes matched to the handoff set, disclosed in Sources; 1905's
  archival border auto-cropped) + sharper 1905/1941 flag art (fresh 4x
  passes — the first jobs died server-side while reporting "processing").
- `09e06e0` content: 26 installation photos mined from FFOI's own
  galleries (caption+height matched, all visually reviewed, 2 rejected)
  → **135/219 sites covered**; Excel Photo URLs filled + mirrored to
  `installations/<id>/1.jpg`.
- `db3df15` docs: **museum image-provenance register** — Excel tab
  `10 · Image Credits` (70 rows) + `docs/IMAGE-PROVENANCE.md`. All 28
  Wikimedia gallery images re-verified against the Commons API on
  2026-07-20 (license/author/date + dimension match). 1947 gallery-3
  REPLACED (legacy image had no traceable source) with 'Chandni Chowk on
  15 August 1947' (Govt Photo Division, PD). Caption fact: Bande Mataram
  front page is 29 Sep 1906, not 1907.

Reference docs now in repo: `docs/ASSET-STATUS.md` (every slot + status),
`docs/IMAGE-PROVENANCE.md`, `data/README.txt`, per-folder `assets/**/README.txt`.

## 0.1 HARD RULES (user-set this session)
- **NEVER call any billing Magnific tool without explicit per-batch user
  approval** — propose with rough cost, wait. (Saved to memory too.)
- Asset drop-ins must stay zero-code: numbered folders, `bg.*` convention,
  numbered sequences — keep it that way in any new feature.

## 0.2 OPEN ITEMS after this session
- **84/219 installation photos** — nothing exists on the FFOI site;
  needs client photography.
- **4 already-paid Magnific enhancements** (book photos: lotus, peacock,
  mango, Ganga-at-Devprayag intended as `did-you-know/1.png` for those
  symbols) are finished at Magnific, awaiting the user's yes/no to
  download + install. Do NOT spend more without approval.
- **Dolphin turntable species check** — clip's dolphin has a marine-style
  dorsal fin; regenerate keyframed on `symbol-source/river-dolphin.png`
  (needs approval; the previous approved static was overwritten but is
  recoverable from that source file).
- Animated flag-marker sequence (map markers) still static-only.
- Handoff timeline thumbnails deliberately NOT wired (AI-composited
  people — risky on a museum wall).
- Phase 7 Windows packaging/hardening (pre-existing, unchanged below).

---

# Previous handoff — 2026-07-18/19

Covers what shipped, what is half-done, and the mistakes worth not repeating.

---

## 1. Git state

- Branch **`feat/chakra-assembly`**, pushed, **not merged into `main`**.
- `main` is 15+ commits behind and predates all of today's work.
- **The GitHub repo is now PUBLIC** (`github.com/ayushsuletiya/flag-foundation-kiosk`).
  It was made public deliberately, with the client's OK confirmed. Note that
  `data/content.xlsx` — all the museum copy — is therefore world-readable.
- Working tree clean. `release/` is gitignored.

To get current on a new machine, see `docs/DEV-SETUP.md`. **Clone the branch,
not `main`:**

```bash
git clone -b feat/chakra-assembly https://github.com/ayushsuletiya/flag-foundation-kiosk.git
```

---

## 2. What is DONE and verified

### Chakra Design tab rework
- Camera pulled back in dims mode (`DIMS_CAM`) so dimension callouts clear the
  canvas edge-feather and the stats card.
- "Chakra Design" card is now a label→value title block, driven by the Excel's
  `Design spec | Geometry` row, credited "BIS flag specification".
- **"Rim Thickness: 12.5 mm" was removed** — no row in `content.xlsx` sources
  that figure. Do not re-add it without a source.
- Meaning line added under the subtitle from the Excel's `Meaning | 24 spokes`.

### Chakra assembly animation (8 s, Design tab intro)
Built across 5 reviewed tasks. Choreography lives in
`src/screens/chakra/chakraAssembly.ts`; `Chakra3D.tsx` owns the scene.

Sequence: construction circles strike on the ground → hub → 24 spokes grow
outward in a 58 ms staggered clockwise cascade → rim seats onto the tips →
whole thing stands up as the camera lowers → settles **frame-identical** to the
pre-existing static dims view.

Key design property: `applyAssemblyTimeline(1, refs)` **is** the resting pose.
That single invariant is what makes skip-on-touch and the final settle correct
without a separate reset path. Do not break it.

Later refinement: each construction line now forms with the part it measures
(⌀32 with the hub, ⌀64 with the spokes, ⌀185/⌀160 with the rim), and chip text
writes itself on — numbers roll up, symbols/words type on. The draft beat was
removed and its 0.8 s redistributed.

### Light-blue flash fix
The wheel flashed light blue on cold mount. Two separate causes:
1. A stale loading poster (`wheel-poster.png`) — removed.
2. **The real cause:** the scene seeded `RoomEnvironment` (a *cool* studio probe)
   at intensity 0.55 before the warm sunset env finished loading. Against the
   cobalt body colour that renders light blue. Now `environmentIntensity` is
   held at **0** until the sunset env is ready.

### Dev-only debug hook
`window.__chakraScrub(p)` freezes the assembly at any progress 0–1;
`window.__chakraPlay()` resumes. Stripped from production (`import.meta.env.DEV`,
verified absent from `dist/`). It is **global and last-mounted-scene wins** — make
sure the Design tab is the active one before scrubbing.

---

## 3. Windows kiosk — UNRESOLVED

The packaged build crashed at launch on the target NUC (window vanished, process
gone, never reached Home). Then, with a **byte-identical binary**, it started
working. Nothing in the app changed.

**The root cause was never identified.** Most likely explanation (untested): a
fresh Windows install booting on the Microsoft Basic Display Adapter, with
Windows Update later installing the real Intel Arc driver. That fits the
signature exactly but was never confirmed — the diagnostic commands in
`docs/CRASH-TRIAGE.md` were never run.

**This will probably come back.** Treat it as live.

Also found during that investigation, still unfixed: `startContentWatcher()` in
`electron/main.ts` attaches **no `'error'` listener** to the chokidar watcher. An
unhandled `'error'` on a Node EventEmitter throws and kills the process. If
`content.xlsx` is ever missing, locked by Excel, or on a disconnected path, the
app dies at startup silently — the exact signature above.

Artifacts: `docs/CRASH-TRIAGE.md`, `docs/WINDOWS-CLAUDE-HANDOFF.md` (a
paste-ready prompt for a Claude session running on the kiosk machine),
`docs/ONSITE-TESTING.md`.

Installer built at `release/FlagFoundationKiosk-v0.1.0-onsite.zip` (353 MB,
SHA-256 `299858deb6f38cc333a67ea8514a85c0cf8fdd4164f973f818fe11e437bdd9f2`).
**It predates the light-blue flash fix** — anything newer needs a rebuild.

---

## 4. Kiosk hardening (Phase 7) — DESIGNED, NOT BUILT

Requirement: one-touch setup, no crashes, runs 24/7 unattended, fully offline
(no network, logs retrieved by USB).

Design agreed but **no code written**:

- **Progressive safe-mode launch** — the centrepiece. Write a marker on start,
  clear it once the window renders. On next launch, if the previous run died
  before rendering: retry 1 with `--disable-gpu-compositing`, retry 2 with
  `--disable-gpu`, retry 3 with `--use-angle=swiftshader`. This makes the
  unexplained crash above **self-healing even without knowing its cause**, which
  is why it matters.
- Crash logging to a rotating local file (`uncaughtException`,
  `unhandledRejection`, `render-process-gone`, GPU-process handlers). There is
  currently **no logging of any kind**, which is why the crash was invisible.
- The chokidar `'error'` handler.
- Scheduled 4 am restart (Chromium/three.js leak over days).
- Watchdog via Scheduled Task with restart-on-failure.
- Installer provisioning: autostart, auto-login after power loss, never sleep,
  no screensaver, notifications off, Windows Update auto-reboot blocked.
- "Collect Logs" desktop shortcut for USB retrieval.

Two things the installer **cannot** do: BIOS "restore on AC power loss" must be
set by hand in firmware, and auto-login stores a credential in the registry.

---

## 5. National Symbols media pipeline — IN PROGRESS, BLOCKED

### Goal
PNG sequences at `assets/sequences/symbols/<slug>/f_0001.png…`, **460×818 RGBA**
(that is 9:16 — an earlier note claiming 3:4 was wrong), ~107 frames, plus
`static.png` as poster.

### Already shipped (untouched, do not regenerate)
`tiger` (107) · `peacock` (107) · `lotus` (107) · `lion-capital-of-ashoka` (241)

### Decided: only 6 symbols get new media
Turntables were **abandoned** in favour of natural motion (dolphin swimming,
elephant trumpeting, mango floating).

**Explicitly dropped, by user decision — do not generate these:**
Jana Gana Mana, Vande Mataram, The Ganga, The Saka Calendar.

Reason worth remembering: an earlier design invented "physical proxies" for
abstract symbols (the Ganga as a puja kalash, the anthem as a manuscript). That
was **wrong** — a ceremonial pot labelled "National River of India" is factually
misleading on a museum exhibit. The lesson: do not invent visual stand-ins for
symbols; if a symbol has no honest object, ask rather than substitute.

These four will have **no sequence**. Confirm the carousel's no-sequence
fallback renders sensibly — previously every card had one.

### Source assets (outside the repo, ~180 MB, deliberately not committed)
`/Users/ayush/Flag Foundation/symbol-source/`
- Approved 4K stills: `flag.png`, `banyan.png`, `mango.png`,
  `river-dolphin.png`, `rupee.png` (+ `final-set.jpg` contact sheet)
- `clips/` — generated MP4s, 1080×1920, 121 frames each.
  **Use the `*2.mp4` versions** (`elephant2`, `dolphin2`, `flag2`, `rupee2`,
  `banyan2`) — those have the locked camera. The non-`2` ones are the bad first
  pass.

### THE BLOCKER — read this before touching the pipeline

Chroma keying **does not work** for these assets and should be abandoned. Three
attempts failed:

1. `colorkey` (RGB) at 0.34 — ate the grey subjects.
2. `colorkey` tuned — same.
3. `chromakey` (YUV) at 0.16 — ate almost everything.

The reason is inherent, not a tuning problem: `colorkey` compares in RGB, so
desaturated subjects (grey elephant, grey dolphin, brushed-steel rupee) sit too
close to the key colour and get chewed away. The flag survives only because it is
strongly saturated. The banyan cannot be green-keyed **at all** — green foliage
on a green backdrop is unkeyable in principle (it was regenerated on blue, which
also failed).

**The correct tool is AI matting.** `rembg` is **already installed** on this
machine (`python3 -c "import rembg"` succeeds). It segments by what the subject
*is*, not by colour, so it handles grey subjects and fine foliage. This was
about to be tested when the session ended — **it is untested.**

Important consequence: **if AI matting is used, the green screen was never
necessary.** All the flat-green prompting constraints were solving a problem we
did not need to have. Future symbol art can be generated on any background.

### Next concrete step
Test `rembg` on `symbol-source/clips/rbtest/*.png` (frames already extracted at
frame 90). If it mattes cleanly, the pipeline is:

```
clip → ffmpeg extract 107 frames → rembg per frame → resize 460×818 RGBA
     → assets/sequences/symbols/<slug>/f_%04d.png → cp f_0001.png static.png
```

Watch disk: ~30 MB per symbol at 282 KB/frame; six symbols ≈ 180 MB on top of
the existing 171 MB, which grows the 353 MB installer noticeably.

---

## 6. Magnific notes (saves rediscovery)

- **Unlimited does not apply through MCP.** `account_balance` reports
  `isUnlimitedMode: true` but `unlimitedAppliesHere: false`. MCP generations
  always bill credits; the browser applies unlimited.
- In the browser, **only some settings are unlimited**: image gen at **1K** is
  unlimited, 2K/4K bill (~150 credits). **Seedance 1.5 Pro** video is unlimited;
  Seedance 2.0 bills.
- **Turn the "AI prompt" toggle OFF.** It rewrites your prompt. With it on,
  "green screen background" became "walking through a snowy forest during a
  crisp winter afternoon". It also caused an over-styled toy-miniature look.
- **Keep prompts short.** Long, heavily-specified prompts ("no floor, no shadow,
  isolated, evenly lit from all sides") produce toy-miniature results, because
  killing shadows and grounding removes the cues that read as real scale.
- **Always include a camera lock** for video: "Static locked-off tripod camera,
  absolutely no camera movement, no pan, no tilt, no zoom, no dolly, fixed frame
  throughout." Without it the camera drifts, dragging the subject around frame
  and shifting background lighting.
- Model slug for Nano Banana 2 is `imagen-nano-banana-2-flash`
  (`imagen-nano-banana-2` is confusingly named "Nano Banana **Pro**").
- Driving the Magnific web UI is slow and brittle (~10 interactions per video,
  with modals that intercept clicks). MCP is far faster where credits allow.

---

## 7. Open questions for the user

1. Merge `feat/chakra-assembly` into `main`? Held back because the Windows
   crash was unexplained.
2. Build the Phase 7 hardening? It was designed and approved in principle but no
   code exists.
3. The four dropped symbols — confirm the carousel handles cards with no
   sequence.
4. Elephant: three 4K stills were generated in the *browser* early on and never
   downloaded. A fresh one was generated via MCP and is the one used in
   `elephant2.mp4`.
