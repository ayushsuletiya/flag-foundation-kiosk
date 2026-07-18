# Handoff prompt — paste this into Claude Code on the Windows kiosk machine

Everything below the line is written for a fresh Claude session that has no
prior context. Copy from the line down.

---

You are debugging a crashing desktop app on the Windows machine you are running
on. Work on THIS machine — do not assume you can reach the build machine.

## The app

**Flag Foundation of India — museum kiosk.** Electron 38.8.6 + React 18 + Vite +
three.js, packaged with electron-builder as a one-click NSIS installer, v0.1.0,
x64 only. It is a fullscreen 1920×1080 kiosk app with no title bar, no menu and
no exit button (quit with Alt+F4).

Target hardware is an **ASUS NUC 14 Pro Plus (NUC14RVSU5)**, Intel Core Ultra 5
125H, **Intel Arc iGPU (Xe-LPG)**, Windows 11 x64. It is a barebone kit, so RAM
and SSD were added separately and the OS may be a fresh install.

## The failure

The app was installed from the one-click installer. On launch:

- the window **vanishes completely** — the process disappears from Task Manager
- it **never reaches the Home screen**
- there is no error dialog

Window vanishing rather than going black means the **main process** is dying,
not the renderer.

## Already ruled out — do NOT re-investigate these

These were verified by inspecting the packaged output on the build machine:

- `content.xlsx` IS correctly packaged at `resources\data\content.xlsx`
- `chokidar` IS bundled at `resources\app\node_modules\chokidar`
- the entry point is correct — `main: dist-electron/main.js`, `type: module`,
  and both `main.js` and `preload.cjs` exist in `resources\app\dist-electron\`
- Electron 38.8.6 supports an ESM main process (needs ≥ 28)
- the installer is x64 and the machine should be x64 — confirm, but it is not
  the leading theory

**The app has no crash logging of any kind** — no `uncaughtException` handler,
no `render-process-gone` handler, no log file. That is why the failure is
silent, and it is why your job is to capture evidence externally.

## Leading hypothesis

**Intel Arc GPU driver.** A fresh Windows install often runs on the Microsoft
Basic Display Adapter rather than a real Intel Arc driver. Electron on a machine
with a broken or missing GPU driver produces exactly this signature: window
flashes, process gone, no message. Test it early — step 2 settles it in seconds.

## Do this, in order, and report what you find

Use **PowerShell**. Find the install first:

```powershell
Get-ChildItem -Path $env:LOCALAPPDATA,"C:\Program Files","C:\Program Files (x86)" `
  -Recurse -Filter "Flag Foundation Kiosk.exe" -ErrorAction SilentlyContinue |
  Select-Object -First 3 FullName
```

`cd` into that folder for the steps below.

### 1. Capture the actual error

Double-clicking hides stderr. Launching from a terminal is the single most
useful test.

```powershell
.\"Flag Foundation Kiosk.exe" --enable-logging 2>&1 | Tee-Object -FilePath "$env:USERPROFILE\Desktop\kiosk-stderr.txt"
```

Report every line, especially anything with `Error`, `Cannot find`, `ERR_`,
`GPU`, `DXGI`, `d3d`, or a stack trace.

### 2. Is it the GPU? (settles the leading hypothesis)

```powershell
.\"Flag Foundation Kiosk.exe" --disable-gpu
```

- **Launches now** → confirmed GPU/driver. Go to step 3.
- **Still dies** → not the GPU. Skip to step 4.

Also try, and report which of these launch:

```powershell
.\"Flag Foundation Kiosk.exe" --disable-gpu-compositing
.\"Flag Foundation Kiosk.exe" --use-angle=d3d9
.\"Flag Foundation Kiosk.exe" --in-process-gpu
```

### 3. Check the actual display driver

```powershell
Get-CimInstance Win32_VideoController |
  Select-Object Name, DriverVersion, DriverDate, Status | Format-List
```

If `Name` is **"Microsoft Basic Display Adapter"**, that is the bug — the real
Intel Arc driver is not installed. Report it and stop; the fix is installing the
Intel Arc/Iris driver from Intel or ASUS, not changing app code.

### 4. What Windows recorded

```powershell
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-3)} -ErrorAction SilentlyContinue |
  Where-Object { $_.Message -match 'Flag Foundation|Electron|kiosk' } |
  Select-Object -First 5 TimeCreated, Message | Format-List
```

The **faulting module** name is the prize here. If it is a graphics DLL
(`igdumdim64.dll`, `d3d11.dll`, `nvoglv64.dll`), it is a driver problem.

### 5. Environment sanity

```powershell
$env:PROCESSOR_ARCHITECTURE          # expect AMD64
[Environment]::OSVersion.Version
Get-CimInstance Win32_PhysicalMemory | Select-Object BankLabel, Capacity
```

Note the RAM result: this iGPU is bandwidth-bound and the build notes require
**both SO-DIMM slots populated**. A single stick will not cause this crash, but
it halves GPU performance and is worth flagging now while you are on the machine.

## Rules for you

- **You do NOT need the source code, and you do NOT need GitHub access.**
  Every step above runs against the installed `.exe`. Do not try to clone
  anything, do not install `gh`, and do not set up SSH keys. The repo is
  private and cloning it is not part of this task. If a clone fails, ignore it
  and carry on with step 1.
- **Do not guess fixes.** Find the root cause first. Several obvious theories
  were already eliminated (see above) — adding more guesses wastes the trip.
- **Do not modify application code from this machine.** The source lives on the
  build machine. Your job is evidence, not patches.
- Report findings as: which step, the exact output, and your conclusion.

## Useful to know while you are there

- Quit the app with **Alt+F4**. There is no exit button.
- It has **no autostart and no auto-restart** — that work is not done yet, so
  if it dies it stays dead.
- After 120 s idle it returns to Home by itself. That is intended, not a bug.
