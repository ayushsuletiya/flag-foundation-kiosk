# Crash triage — packaged Windows build won't launch

**Symptom:** installed build dies at launch, never reaches Home, window vanishes
completely (process gone from Task Manager).

**Ruled out already** by inspecting the packaged output on the build machine:

- `content.xlsx` IS present at `resources\data\content.xlsx`
- `chokidar` IS bundled at `resources\app\node_modules\chokidar`
- entry point is correct — `main: dist-electron/main.js`, `type: module`, and
  both `main.js` and `preload.cjs` exist in `resources\app\dist-electron\`
- Electron 38.8.6 supports an ESM main process (needs ≥ 28)

Window vanishing rather than going black means the **main process** is dying,
not the renderer.

---

## Run these three, in order

Open **PowerShell** (not CMD) on the kiosk machine.

### Test 1 — see the actual error

Launching from a terminal shows stderr, which is invisible when you
double-click. This is the single most useful test.

```powershell
cd "$env:LOCALAPPDATA\Programs\flag-foundation-kiosk"
.\"Flag Foundation Kiosk.exe" --enable-logging
```

If that folder doesn't exist, find it:

```powershell
Get-ChildItem -Path $env:LOCALAPPDATA,"C:\Program Files" -Recurse -Filter "Flag Foundation Kiosk.exe" -ErrorAction SilentlyContinue | Select-Object -First 3 FullName
```

**Copy back whatever it prints**, especially any line containing `Error`,
`Cannot find`, `ERR_`, `GPU`, or a stack trace.

### Test 2 — is it the GPU?

Intel Arc on a fresh Windows install with no proper driver is a common cause of
exactly this signature: window flashes, process disappears.

```powershell
.\"Flag Foundation Kiosk.exe" --disable-gpu
```

- **Launches now** → it is the GPU / driver. Fix is the Intel Arc driver on the
  machine, plus a software-rendering fallback in the app.
- **Still dies** → not the GPU. Go to Test 3.

### Test 3 — what Windows recorded

```powershell
Get-WinEvent -FilterHashtable @{LogName='Application'; StartTime=(Get-Date).AddHours(-2)} |
  Where-Object { $_.Message -match 'Flag Foundation|Electron' } |
  Select-Object -First 5 TimeCreated, Message | Format-List
```

This usually names the **faulting module** directly — if it points at a `.dll`
(especially a graphics one like `igdumdim64.dll` / `d3d11.dll`), it is a driver
problem, not app code.

---

## Also worth checking

**Is the machine actually 64-bit Windows 10/11?** The build is x64 only.

```powershell
$env:PROCESSOR_ARCHITECTURE   # expect AMD64
[Environment]::OSVersion.Version
```

**Did the whole zip transfer?** A truncated download produces a corrupt install
that dies instantly.

```powershell
certutil -hashfile "FlagFoundationKiosk-v0.1.0-onsite.zip" SHA256
```

Expected: `299858deb6f38cc333a67ea8514a85c0cf8fdd4164f973f818fe11e437bdd9f2`

---

## Known gap this exposed

The app currently has **no crash logging whatsoever** — no `uncaughtException`
handler, no `render-process-gone` handler, and no log file. That is why the
failure is silent and why this triage needs manual steps at all.

There is also a real latent defect found during this investigation, independent
of the current crash: `startContentWatcher()` attaches no `'error'` listener to
the chokidar watcher. An unhandled `'error'` event on a Node EventEmitter throws
and takes the process down. If `content.xlsx` is ever missing, locked by Excel,
or on a disconnected path, the app dies at startup with no message — the exact
signature being debugged.
