# National Symbols — turntable generation sheet

Ready-to-paste prompts for the 10 symbols that still need turntables.

**Model:** Seedance 2.0 Mini (`bytedance-seedance-mini-2.0`)
**Settings for every clip:** duration **5s**, aspect **3:4**, resolution **720p**,
camera motion **360Orbit**, sound effects **off**.

**Background is flat chroma green on purpose.** Do not ask the model for a
transparent or dark background — a flat, evenly lit green keys out cleanly in
ffmpeg for free. Removing backgrounds through the API would cost one call per
frame (~107 per symbol) and is the single most expensive way to do this.

Target output per symbol: `assets/sequences/symbols/<slug>/f_0001.png …`,
460×818 RGBA, ~107 frames — matching the existing tiger/peacock/lotus sets.

---

## Already done — do not regenerate

`tiger` (107) · `peacock` (107) · `lotus` (107) · `lion-capital-of-ashoka` (241)

---

## Group A — physical objects (straightforward turntables)

### 1. flag → `flag`
*The Tiranga. Directory exists but has zero frames.*

> A ceremonial Indian tricolour flag on a polished brass pole, fabric caught mid-furl and rippling slowly, deep saffron, white and India green bands with the navy Ashoka Chakra centred, museum studio lighting, sharp fabric weave detail, subject centred and fully in frame, flat chroma green background, no shadows on the background

### 2. Indian Banyan → `banyan`

> An ancient Indian banyan tree, wide canopy and many aerial prop roots descending to the ground, rich green foliage, gnarled bark detail, museum studio lighting, complete tree centred and fully in frame, flat chroma green background, no shadows on the background

### 3. Mango → `mango`

> A cluster of three ripe Indian Alphonso mangoes on a short leafy stem, gradient of gold to blush red skin, two glossy dark green leaves, fine skin texture, museum studio lighting, subject centred and fully in frame, flat chroma green background, no shadows on the background

### 4. Ganges River Dolphin → `river-dolphin`

> A Ganges river dolphin, long narrow beak and small rounded dorsal ridge, smooth grey-brown skin with a soft wet sheen, body gently arched as if mid-swim, suspended level and centred, museum studio lighting, subject fully in frame, flat chroma green background, no shadows on the background

### 5. Indian Elephant → `elephant`

> A majestic Indian elephant standing calmly in profile, trunk relaxed and curled slightly inward, detailed wrinkled grey skin, large ears held close, tusks visible, museum studio lighting, whole animal centred and fully in frame, flat chroma green background, no shadows on the background

---

## Group B — the "abstract" five

These are not objects you can spin, so each gets a **physical proxy** that
carries the same meaning. This keeps every card in the carousel visually
consistent — an object rotating on the podium — instead of five odd ones out.

### 6. Jana Gana Mana → `jana-gana-mana`
*Proxy: the anthem as a manuscript.*

> An open handwritten manuscript on aged cream parchment, Devanagari calligraphy in dark iron-gall ink, the page resting on a carved teak book stand, gold leaf border detail, edges softly worn, museum studio lighting, centred and fully in frame, flat chroma green background, no shadows on the background

### 7. Vande Mataram → `vande-mataram`
*Proxy: the song as a bound songbook — deliberately distinct from item 6 so the
two don't read as duplicates.*

> A closed antique songbook bound in deep maroon cloth with gold embossed Devanagari lettering, gilded page edges, a saffron silk ribbon bookmark trailing from the pages, resting upright, museum studio lighting, centred and fully in frame, flat chroma green background, no shadows on the background

### 8. Saka Calendar → `saka-calendar`
*Proxy: a brass astronomical dial — a calendar as an instrument. This one
genuinely rotates, which suits the treatment.*

> An ornate circular brass astronomical calendar dial, concentric engraved rings marked with Devanagari month names and numerals, a raised central gnomon, aged patina in the recesses with polished high points, museum studio lighting, centred and fully in frame, flat chroma green background, no shadows on the background

### 9. The Ganga → `ganga`
*Proxy: a temple kalash of river water — the river as a vessel.*

> An ornate copper and brass temple kalash filled with clear water, a mango leaf arrangement and a whole coconut set in its mouth, hammered metal texture with warm reflections, a marigold garland at its base, museum studio lighting, centred and fully in frame, flat chroma green background, no shadows on the background

### 10. Indian Rupee ₹ → `rupee`
*Proxy: the glyph as a machined emblem.*

> The Indian rupee symbol as a solid machined emblem, brushed stainless steel with polished bevelled edges, standing upright, crisp geometric form, subtle warm rim light along the edges, museum studio lighting, centred and fully in frame, flat chroma green background, no shadows on the background

---

## Post-processing (run locally, no API cost)

For each downloaded clip, from the repo root:

```bash
SLUG=elephant                       # change per symbol
SRC=~/Downloads/$SLUG.mp4
OUT=assets/sequences/symbols/$SLUG
mkdir -p "$OUT"

ffmpeg -i "$SRC" \
  -vf "fps=24,colorkey=0x00B140:0.30:0.10,despill,scale=460:818:force_original_aspect_ratio=decrease,pad=460:818:(ow-iw)/2:(oh-ih)/2:color=0x00000000,format=rgba" \
  -frames:v 107 "$OUT/f_%04d.png"
```

Then set the poster frame the carousel falls back to:

```bash
cp "$OUT/f_0001.png" "$OUT/static.png"
```

**Tune `colorkey` per clip.** `0.30` is the similarity threshold and `0.10` the
blend. If green fringes survive, raise similarity slightly; if parts of the
subject vanish, lower it. Check a mid-sequence frame, not just the first — the
subject rotates and its edge colours change.

**Sanity check before committing:**

```bash
ls "$OUT" | grep -c '^f_.*png$'     # expect 107
```

At ~282 KB per frame, each symbol adds roughly 30 MB. All ten is ~300 MB on top
of the existing 171 MB, which is worth checking against the installer size
before shipping them all.
