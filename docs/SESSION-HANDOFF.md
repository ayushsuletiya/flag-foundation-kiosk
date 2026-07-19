# Session handoff — 2026-07-19/20 (content + assets marathon)

Written for a fresh session with zero context. The 2026-07-18/19 handoff
(chakra assembly, Windows crash triage) is preserved below this section.

## 0. THIS SESSION — what shipped (all pushed to `feat/chakra-assembly`)

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
