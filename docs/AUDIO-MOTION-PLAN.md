# Kiosk Audio + Background-Motion Plan

Source-grounded inventory of **where** custom sound and background animation can go, to be
generated with **Magnific** (custom SFX, music, and image→video). **Nothing is generated yet —
this is the plan for review.** Cross off anything you don't want; then we generate in batches.

Audit totals: **151 sound moments · 5 music cues · 18 ambience beds · 9 (optional) voice lines ·
26 animatable backgrounds.** After de-duping the shared chrome sounds, the real generation set is
roughly **~35–45 distinct SFX · ~8 music/ambience beds · ~13 new background loops.**

---

## How this maps to Magnific
| Deliverable | Magnific tool | Drop-in path |
|---|---|---|
| UI sound effects | `audio_music_generate` (short custom sounds) | new `src/audio/…` layer (needs a tiny SFX hook — not wired yet) |
| Music / ambience beds | `audio_music_generate` | same audio layer, looped |
| Animated backgrounds | `video_generate` (image→video) | `assets/**/background/bg.mp4` (app auto-plays it, muted) |
| Voice lines (optional) | `audio_tts` | parked — client sign-off first |

## Guardrails (apply to everything)
- **Tone:** dignified, warm, premium, patriotic-but-not-kitsch. No cartoon/arcade sounds.
- **No national anthem** melody or motif anywhere — all music must be **original** instrumental.
- **Unattended loops stay silent:** the 3.5 s symbols auto-advance, the 7 s DYK auto-advance, the
  120 s idle reset, and endless bg crossfades get **no** repeating tick/chime.
- **`bg.mp4` plays MUTED** — every sound is a **separate audio layer**, never baked into a video.
- **Keep the still beside the video** where the engine samples it: every history year needs
  `bg-1.png` next to any `bg.mp4` (RewindIntro textures it); Chakra needs `bg.png` beside `bg.mp4`
  (three.js env map samples it).
- Voice is **opt-in per client**, one-shot, never looping.

---

## A · GLOBAL SOUND KIT — heard on every screen, generate ONCE and reuse
These are the repeated chrome/transition sounds (they showed up in 6–7 sections each):

- **Boot brand swell** `music` — cold power-on splash: slow warm tanpura/sarangi drone blooming into a sustained amber chord (~1.2 s). *Original — never the anthem.*
- **Boot → home settle** — splash dissolves to home; soft felt "arrival" exhale.
- **Page cross-dissolve flutter** *(the signature motion cue)* — soft silk/cloth whoosh, ~250–300 ms, on **every** route change.
- **Home-button press** — warm felt tick with a low woody "homeward" resolve.
- **Back-button press** — same felt tap with a downward "step-back" inflection.
- **Quick-Access pill press** — bright felt tap with a small upward "opening" shimmer.
- **Quick-Access panel bloom / dismiss** — airy frosted swell on open, gentle release on close.
- **Quick-Access tile select** — warm confirming two-note lift ("committed"), hands off to the flutter.
- **Idle-reset swell** `ambience` — near-silent warm breath as the room returns to attract.
- **House ambience bed** `ambience` — the global "sound of the room": low seamless tanpura/string drone, no melody, mixed very low. (+ a slightly warmer **Home/attract variant**.)

---

## B · PER-SECTION SFX (unique interactions, excluding the global kit)

### Home `/`
- **Tile press** — soft felt "tup" (one shared sound, all 4 tiles).
- **Tile commit / enter swell** — warm plucked note opening into an amber bloom (base under the 4 accents).
- **Themed accents** (optional, layered on the enter swell): *Monumental* → distant large-flag flutter + warm horn; *History* → sepia rewind-air + parchment rustle; *Chakra* → single bronze temple-bell with long decay; *Symbols* → bansuri two-note + soft feather rustle.
- **Home arrival** `ambience` — slow amber sunset "settle" with a far-off ceremonial flutter.

### Monumental Flags — Map & Select State `/monumental/map`
- **Section entrance** — warm rising string/brass pad ("a hall lighting up").
- **Tap a state** — soft felt tick + low bloom ("placed").
- **State lift / outline settle** — brass-tinged "thunk-glow" as the land rises into light.
- **Flag markers appear** — one composite cloth flutter (not one per marker).
- **Tooltip chip** — tiny paper "unfold" tick (optional).
- **Waving-marker ambience** `ambience` — continuous distant cloth flutter while markers are on screen.
- **"Select State" pill** — firmer felt press ("a panel is coming").
- **Overlay open** — airy rise resolving to a seated pad.
- **State-chip select (browsing)** — light crisp tick + gold shimmer ("highlighted, not applied").
- **Continue confirm** — warm two-part "accepted" cadence with a soft gold ring.
- **Overlay dismiss** — gentle descending settle.
- **Installation tile expand / collapse** — warm unfold bloom / soft fold-away.
- **"Know More"** — forward purposeful press leading into the page transition.
- **List drag-scroll + top/bottom boundary** — barely-there paper friction + soft detent (optional).

### Monumental Flags — Installation Detail `/monumental/detail/:rowId`
- **Installation opens** — dignified brass-tinged unveil (~1.1 s), never a fanfare.
- **Blurred-photo backdrop** `ambience` — low warm open-air pad, felt more than heard.
- **Sharp photo sets into card** — matte "photographic set-down" tick.
- **Flag-height figure** — single soft brass/temple-bell grace note (optional accent).
- **Photo carousel flutter / dot** — cloth-flutter cross-dissolve + felt tick *(dormant: sites ship 1 photo today)*.
- **No-photo plate** — near-silent; no error tone.

### History of Tiranga — Year Main & Rewind Intro `/history/:year`
- **Rewind intro arrival** `music` — deep reverent sub-bloom + reversed swell as the numeral sharpens.
- **Rewind reel bed** *(signature)* — warm film-projector reel spinning **backward**; rate/pitch rise with speed.
- **Each of 8 cuts** — felted projector "whoomph" / warm light-leak blink.
- **Odometer roll** — mechanical counter-ticks that smear into a ripple at speed, separate as it brakes.
- **Brake into oldest year** — descending flutter + long soft friction slow-down.
- **Landing on 1857** `music` — sustained sarangi/cello swell + gold shimmer + reverent arrival impact.
- **Tap-to-skip** — quick soft "whoosh-to-rest" collapsing the reel into the landing tone.
- **Year-pill tap (new era)** *(anchor sound)* — refined gold tick + faint brass shimmer as the pill goes gold.
- **Year-pill tap (already active)** — bare soft felt tap, no bloom (nothing navigates).
- **Odometer year-counter whir** — flip-counter whir whose **length tracks the jump distance**, ends on a chime-tick.
- **Backdrop crossfade** — soft archival emulsion/paper whoosh (layers under the counter whir).
- **Year flag swap** — brief dignified silk flutter.
- **Slide-title reveal** — one soft "ink settle" whisper (optional, low priority).
- **Read More** — warm gold press with a rising "open" tail.

### History of Tiranga — Know More `/history/:year/more`
- **Timeline dot (changes era)** — felt tick + low brass bloom ("place-and-lock").
- **Era-change transition** `ambience` — slow brass swell → archival paper-flutter ("turning a page in time").
- **Timeline dot (already active)** — muted felt tap, no flourish.
- **Gallery thumb press / select** — matte "dip" on press; felt "tuk" + gold-ring shimmer on select.
- **Large gallery image settle** `ambience` — felt-wrapped shutter-thud in an airy bloom ("a print laid down").
- **Thumb strip drag-riffle + snap** — archival-print riffle scaling with velocity + faint detent tick.
- **Thumb-row staggered entrance** — 3–7 feather-light taps left-to-right ("dealing prints").

### Ashok Chakra — 3D explorer `/chakra`
- **Wheel roll-in** — ceremonial wheel trundling on stone; low rolling rumble + fine bronze ring, easing down.
- **Roll settle rock-back** — soft low set-down "thunk" with brief warm resonance.
- **Chrome reveal** `music` — restrained patriotic brass-tinged arrival chord.
- **Intro skip** — quick airy "settle" whoosh.
- **Tab-pill tap** — soft felt tick + low bloom.
- **Camera glide (Values↔Design)** — gentle low airy "push".
- **Wheel-spoke select** *(hero)* — bright clean gold bell/ping + soft rotational ease as the spoke turns upright.
- **"Touch a Spoke" CTA** — warm press then the spoke chime a beat later.
- **Virtue-row pick** — soft felt tick + gold shimmer (lighter cousin of the chime).
- **Deselect** — gentle descending gold ping-down.
- **Grab / drag-spin / flick-release** — contact "catch" → continuous metal-on-stone rotational whir tracking speed → coast-to-stop spin-down.
- **Design dims draw / erase** — fine graphite "drafting" strokes + measuring ticks / soft reverse un-draw.
- **Flag-dock sequence** — pull-back whoosh → dignified mast-plant → cloth-and-rope hoist → weightless glide onto the white band → **golden merge bloom** (soft low gong + gold shimmer, the emotional payoff).
- **Flag waves** `ambience` — continuous gentle cloth flutter in a warm breeze (Flag tab only).
- **Flag undock** — gentle reverse whoosh + fabric lower.
- **DYK fact dot tap** — small crisp felt pip. *(7 s auto-advance = silent.)*

### National Symbols — Carousel `/symbols`
- **Section entrance** `music` — warm brass-and-tanpura swell rising from silence.
- **Name blur-type** — whisper-soft "gold-dust settling" shimmer.
- **Card touch** — immediate soft felt tick + low bloom.
- **Card glide (tap side card)** — soft directional silk flutter (~0.35 s), panned toward travel.
- **Swipe/drag row** — fuller cloth flutter + low woody turntable sweep, directional.
- **Card arrival at center** — warm gold "settle" chime tracing the border trace.
- **Press-hold lift into orbit** — airy upward "lift-off" bloom + faint bowed-string glissando.
- **Orbit drag-spin** — continuous low airy rotational hum tracking finger speed.
- **Drop-to-select / re-dock** — descending settle into the same gold arrival chime.
- **Prev / Next arrow tap** *(the new nav buttons)* — crisp warm glass pip, panned left/right, + the card glide.
- **Pagination dot jump** — tiny bright pip + silk sweep scaled to jump distance. *(3.5 s auto-advance = silent.)*
- **Know More** — warm gold two-note "entering" lift.

### National Symbols — Detail `/symbols/:slug`
- **Screen entrance** — warm brass-tinged bloom ("a spotlight warming a display case").
- **Title stack reveal** — airy ascending shimmer resolving on a warm chime (one cue, not per-char).
- **Stat cards settle** — 2–3 gentle frosted-glass felt chimes (may fold under the entrance).
- **Next / Previous fact chevron** — soft felt tick with forward/back air.
- **Fact change (manual)** — soft paper/cloth flutter + warm settle ("card turns"). *(7 s auto-advance = silent.)*
- **Fact dot jump** — tiny crisp bright pip.

---

## C · MUSIC & AMBIENCE BEDS (looping, per section)
1. **Global house bed** + **Home/attract variant** — see the Global Kit.
2. **Monumental** — open-air wind + periodic large-flag flutter over a low tanpura drone; quieter "focused" variant for the Select-State overlay.
3. **History (main)** — warm tanpura/sarangi pad with a distant sparse bansuri motif; **+ archive/projector-room bed** under the RewindIntro that cross-fades into it.
4. **Chakra** — sunset-by-the-water atmosphere (gentle shore + warm breeze + low golden drone); **+ slow reverent Indian-classical instrumental** (sustained strings + bansuri/sitar over tanpura).
5. **Symbols (carousel + detail)** — warm patriotic tanpura/sarangi pad + a near-subliminal grand-hall room tone. *Must stay neutral across all symbols (tiger, peacock, lotus, banyan, Ganga…).*

---

## D · BACKGROUND ANIMATIONS (static → looping `bg.mp4` via Magnific)

**Drop-in video candidates** (the app auto-plays `bg.mp4`; keep the still fallback beside it):

| # | Screen | Asset | Status | Motion |
|---|--------|-------|--------|--------|
| 1 | Home | `0-home/background/bg.mp4` | exists — **refine** | slow tricolour breathing in an evening breeze, imperceptible cloud drift, golden light shift; invisible loop point |
| 2 | Map (main) | `1-monumental-flags/map/background/bg.mp4` | exists — **refine** | near-still atmospheric haze drift + dawn-to-day light breathing; **keep terrain registered** to the calibrated still |
| 3 | Select-State | `1-monumental-flags/select-state/background/bg.png` | **NEW** | glowing-India "breathing glow" (~8–12 s), warm haze rising, coastline rim-shimmer; reads through the scrim |
| 4–12 | History eras (×9) | `2-history-of-tiranga/{1857,1905,1906,1907,1917,1921,1931,1941,1947}/background/bg-1.png` | **NEW** | per-era slow Ken-Burns + atmosphere (see below); **camera + light only — never re-animate historical figures** |
| 13 | Chakra | `3-ashok-chakra/background/bg.png` | **NEW** *(keep `bg.png`)* | dignified slow sunset-over-water: golden light shimmer on the sea, very slow high clouds, breathing sun-glow |
| 14 | Symbols carousel stage | `4-national-symbols/carousel-background/bg.png` | **NEW (careful)** | subtle mandala shimmer + slow podium key-light drift; **podium must stay registered** |
| 15 | Symbols detail stage | `4-national-symbols/detail-background/bg.png` | **NEW (careful)** | ultra-subtle warm "spotlight" light-bloom on the display podium |

**Per-era history motion (all: slow, reverent, figures frozen):**
- **1857** — slow push-in on the Delhi-uprising lithograph; drifting smoke/ember haze, warm firelight flicker.
- **1905** — dappled leaf-shadow flicker + faint canopy breeze on the Swadeshi garden group; sepia-grain breathing.
- **1906** — "Bande Mataram" masthead parallaxing over a blurred field; dust motes in a light shaft.
- **1907** — slow pull-back revealing the Stuttgart Congress assembly; warm light-leak, drifting grain.
- **1917** — barely-there breathing zoom on the Tilak portrait; catch-light bloom, halftone shimmer.
- **1921** — vignette easing open on the Pingali Venkayya portrait; warm bloom on the white cap. *(least motion of the set.)*
- **1931** — the hoisted tricolour ripples faintly (the emotional beat) while a slow pan crosses the rally crowd; heat-haze.
- **1941** — solemn track down the receding line of Bose's INA troops; dust, soft light bloom.
- **1947** — very slow reverent push-in on Nehru at the AIR mic; dust motes in the hall light, warm freedom-glow.

**Code-level CSS motion — NOT Magnific** (listed so they aren't mistaken for video slots):
- Boot splash (pre-React CSS — already pulses).
- Installation-detail blurred backdrop (per-photo, 100+ sites → a CSS "breathing" transform on the `<img>`, not a droppable video).
- History `FallbackBackdrop` & the warm-dark letterbox/stage fill — **leave static** (honest placeholders / black-flash guard).

---

## E · Suggested generation order (once you approve)
1. **Global sound kit + house bed** (~11 sounds) — unlocks feedback on every screen at once.
2. **History era background loops** (9 videos) — highest visual payoff, and the section you've been iterating on.
3. **Per-section SFX** — Chakra & Symbols are the richest (spoke chime, flag-dock, orbit).
4. **Section music/ambience beds** (~6).
5. **Remaining background loops** (select-state, chakra, symbol stages) + **Home/Map refinements**.
6. **Voice** — only if the client signs off on wording/language/voice (kept out by default).

Before any generation I'll `simulate_cost` in Magnific so you approve the credit spend per batch.
