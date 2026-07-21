# Onsite Kiosk Testing — Windows Build

**v0.3.0, built 2026-07-21 from `feat/chakra-assembly`.** On top of the
v0.2.0 build (history rewind intro, real archival backgrounds, v3 content)
this adds the reworked **Ashok Chakra section**: the rolling entrance
(background beat → the wheel rolls in upright from stage left → leans into
its hero pose → chrome rises), ONE persistent 3D scene across all three
pills (tab switches glide the camera / fade the callouts / play the
flag-dock forward and in reverse — the wheel never blinks), the full-screen
volumetric sunlight on every tab rendered UNDER the wheel and UI (sun pinned
to the plate, edge-to-edge, vignette over it), progressive background blur
(sky soft, shore crisp), black-dip entrance, cloth bend-constraints (no more
fold-through tearing), and flag/pole shadow casting. Cross-built from macOS;
all runtime deps are pure JS, so nothing needed native rebuilding.

**Watch onsite in particular:** the chakra section now renders full-screen
volumetrics every frame on the Arc iGPU — check it stays smooth on the NUC
through a few minutes of idling on each chakra tab (Values / Design /
Chakra in Flag) and through several tab round-trips.

## What to take

Artifacts are in `release/`:

| File | Use |
|---|---|
| `Flag Foundation Kiosk Setup 0.3.0.exe` | **Installer.** One-click, runs after finish. Use this. |
| `Flag Foundation Kiosk-0.3.0-win.zip` | Portable. Unzip and run the `.exe` inside — no install, no admin rights. Good fallback. |
| `win-unpacked/` | Already-extracted form of the zip. Copy the whole folder if you prefer. |

Copy to a USB stick. Target: ASUS NUC 14 Pro Plus, Windows 11 x64.

## Running it

Installer: double-click, it installs and launches itself.
Portable: unzip, run `Flag Foundation Kiosk.exe`.

The app opens **fullscreen, frameless, in kiosk mode** — no title bar, no menu,
no taskbar access.

## Getting out — read before you start

**`Alt` + `F4` is the only way to quit.** There is no in-app exit, no Escape
handler, and no registered shortcut. `Alt`+`F4` closes the window, which fires
`window-all-closed` → `app.quit()`.

If that fails: `Ctrl`+`Shift`+`Esc` opens Task Manager over the kiosk window —
end `Flag Foundation Kiosk` from there.

**There is no DevTools access.** No F12, no `Ctrl`+`Shift`+`I` — the default menu
is gone and no shortcut is registered. You cannot open a console or an FPS meter
in this build. See "Known gaps" below.

## Client content

The client-editable workbook ships inside the app and **hot-reloads** — a
`chokidar` watcher in the main process notifies the renderer on save (500 ms
debounce, so Excel's write-then-rename doesn't fire it twice).

Its installed location:

```
<install dir>\resources\data\content.xlsx
```

Find `<install dir>` via the Start Menu shortcut → right-click → Open file
location. For the portable build it is `win-unpacked\resources\data\`.

To test the pipeline: open that file in Excel on the kiosk, change a cell, save,
and the running app should pick it up without a restart.

## Known gaps (Phase 7 is not done)

CLAUDE.md lists "kiosk hardening + Windows/NSIS packaging (autostart, watchdog,
soak test)" as pending. Specifically, this build does **not** have:

- **Autostart on boot.** The app will not launch by itself after a power cycle.
  Add a Startup-folder shortcut manually if you need to test unattended boot.
- **A watchdog.** `main.ts` notes that quitting on window-close "lets the OS
  watchdog restart us" — but no such watchdog exists yet. If the app closes or
  crashes, it stays closed.
- **DevTools / any FPS readout.** Nothing to measure GPU performance with.
- **Screen-saver / display-sleep suppression.** Not configured; Windows power
  settings will still blank the display.

## Behaviour to expect

- **Idle reset:** after 120 s with no touch the app returns Home. Intended.
- **Design tab:** entering it plays the 8 s build animation every time. Any
  touch skips straight to the finished annotated wheel.
- **Chakra in Flag:** the docking animation replays on every entry.
- **Fixed 1920×1080.** The stage scales to fit; on a non-1080p panel expect
  letterboxing rather than reflow. This is by design.
