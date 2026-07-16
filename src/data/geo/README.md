# geo/ — India map positions for flag installations

Data layer that places every installation district from `data/content.xlsx`
tab **04 · Flag Installations** onto the kiosk's India map.

## districts.json

One entry per unique `(state, district)` pair from tab 04 (158 pairs from
219 installation rows). The renderer draws **max one marker per district** —
dedupe installations by `(state, district)` at render time; see
`geo-report.json → districtsWithMultipleInstallations` for which districts
stack multiple sites.

```jsonc
{
  "coordinateSystem": "…",   // human-readable description
  "generatedAt": "ISO timestamp",
  "districts": [
    {
      "state": "Assam",        // exactly as spelled in tab 04 / CANONICAL_STATES
      "district": "Jorhat",    // exactly as spelled in tab 04
      "x": 0.8151,             // normalized 0-1 within the India map box
      "y": 0.3348
    }
  ]
}
```

### Coordinate space

`x`/`y` are **normalized 0–1 relative to the India map box** — the same
space as `assets/map/states/hit/_layout.json` and `active/_layout.json`
(Figma source frame 774.68 × 867.18 px). To render: multiply `x` by the
on-screen map width and `y` by the map height, measured from the map box's
top-left corner. If the map sits inside the 1920×1080 stage with an offset,
add that offset after scaling.

### Hand-correcting a marker

Edit the `x`/`y` of the district entry in `districts.json` directly and keep
the value in 0–1 map space. `geo-report.json` lists every position that was
clamped or flagged (with the originally computed coordinates) so corrections
can start from something close.

## geo-report.json

Diagnostics from the generation run — **not read by the app**:

- `affineTransform` — the fitted `lat/long → map` transform
  (`x = a·lon + b·lat + c`, `y = d·lon + e·lat + f`) and fit quality
  (`fit.rmsResidual` is in map-box units, so 0.0078 ≈ 0.8 % of the map).
- `clampedViolations` — districts whose computed position fell outside their
  own state's hit-shape bbox by more than 2 % of the map box; their
  `districts.json` entry was **clamped to the state bbox center** and the
  original computed position is preserved here for hand-correction.
- `nearMisses` — outside the strict state bbox but within the 2 % tolerance;
  kept as computed (usually districts genuinely on a state border, e.g.
  Agartala on Tripura's western edge).
- `localBboxInterpolation` — states drawn displaced from their geographic
  position (the fit rejected their anchor); their markers were interpolated
  inside the drawn state bbox instead of using the global transform
  (currently: the Andaman & Nicobar island chain).
- `statesWithoutMapShape` — markers that cannot be validated or highlighted
  because the map asset set has no shape for the state (currently:
  Chandigarh — see the note in `assets/map/states/hit/_layout.json`).
- `districtsWithMultipleInstallations` — render-time dedupe list.
- `dataNotes` — sheet quirks worth normalizing (duplicate district spellings
  like "Lahaul and Spiti" / "Lahul Spiti", "Bengaluru" / "Bengaluru Urban",
  and "Mehdipatnam" which is a Hyderabad locality, not a district).

## Provenance

Positions were derived from real district lat/long centroids (district HQ /
city coordinates where the sheet names a city), projected through a robust
least-squares affine fit calibrated on 33 state anchors — geographic bbox
centers vs the states' hit-shape bbox centers from
`assets/map/states/hit/_layout.json`. Every position was validated to fall
inside (or within 2 % of) its own state's bbox.
