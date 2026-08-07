# BioAttend fingerprint bridge

A small local service that owns the fingerprint reader and exposes it to the
browser over `http://127.0.0.1:8321`.

## Why this exists

The reader enumerates as **USB mass storage** (`VID_2009` / `PID_7638`), not as
a serial port — it appears in Windows as a disc drive, which is why plugging it
in raises *"Windows can't access this disc."*

That rules out every browser route:

| Approach | Why it fails |
|---|---|
| Web Serial | Needs a COM port. The device creates none. |
| WebUSB | Chrome refuses mass-storage devices — protected interface class. |
| File System Access | The volume is a control channel, not a filesystem. |

So a local process has to hold the device. This one wraps `fpsapit.dll` — the
same library `fpdemo.exe` uses, already proven against this exact hardware.

```
Browser ──HTTP──▶ localhost:8321 ──ctypes──▶ fpsapit.dll ──SCSI──▶ Reader
```

## Requirements

**32-bit Python.** The DLL is 32-bit x86; a 64-bit interpreter fails with
`WinError 193`. Download the **Windows installer (32-bit)** from python.org and
tick *Add python.exe to PATH*. A 64-bit Python can remain installed — the `py`
launcher selects between them.

No `pip install` is needed. The bridge uses the standard library only,
deliberately: fewer moving parts to fail during a demo.

## Running it

Double-click **`run-bridge.bat`**, or:

```bash
py -3-32 bioattend_bridge.py
```

Leave the window open while using BioAttend. **Close `fpdemo.exe` first** —
only one program can hold the reader.

## First run: find the device type

`ZAZOpenDeviceEx` takes an `nDeviceType` constant. The SDK documents values
0–35 without saying which is the USB-disk transport, and shipped no header, so
the bridge discovers it:

```bash
curl -X POST http://127.0.0.1:8321/probe
```

It tries each value and reports which open successfully. Put the answer in
`KNOWN_DEVICE_TYPE` at the top of `bioattend_bridge.py` so later runs skip the
probe.

## Endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/health` | Is the bridge up, is a device open |
| POST | `/probe` | Discover working device types |
| POST | `/connect` | Open the reader |
| POST | `/disconnect` | Release it |
| POST | `/enroll` | 3 presses → one template, base64 |
| POST | `/identify` | Capture → 1:N search → slot + score |
| POST | `/sync` | Wipe flash, rewrite templates from Supabase |
| GET | `/template-count` | Templates currently in flash |

## Security

- Binds to `127.0.0.1` only — not reachable from the network.
- CORS restricted to the app's own origins.
- **The bridge captures fingerprints; it does not decide attendance.** All
  authority stays in Supabase, where the kiosk credential and shift windows are
  enforced. A tampered bridge still cannot forge a check-in — the worst it can
  do is refuse to scan.

## Files

| File | Role |
|---|---|
| `zaz.py` | ctypes binding to `fpsapit.dll`, typed and checked |
| `bioattend_bridge.py` | HTTP server and capture flows |
| `run-bridge.bat` | Launcher that enforces 32-bit Python |
