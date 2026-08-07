# BioAttend — Northcrest General

Biometric staff attendance and shift management using fingerprint and facial
recognition.

---

## How it fits together

```
Browser (Chrome/Edge, hospital PC)
  ├── HTTP ──▶ localhost:8321 ──ctypes──▶ fpsapit.dll ──USB──▶ Fingerprint reader
  ├── getUserMedia ─────── USB ────────▶ Webcam    (face embeddings computed in-browser)
  └── supabase-js ──────── HTTPS ──────▶ Supabase  (templates, roster, attendance)

Vercel = static file host for the built React app. Nothing more.
```

Three facts shaped every decision below:

1. **The fingerprint reader is a USB mass-storage device**, not a serial port —
   `VID_2009 / PID_7638`, service `USBSTOR`. It mounts as a disc drive, which is
   why Windows raises *"can't access this disc"* on plug-in.

   **No browser API can reach it.** Web Serial needs a COM port that does not
   exist; WebUSB refuses mass-storage devices outright; the volume is a control
   channel, not a filesystem. Hence the local Python bridge in [`bridge/`](bridge/).

2. **Fingerprint templates can only be matched by the reader's firmware.** They
   are proprietary — neither JavaScript nor Postgres can compare them. Matching
   happens on the device; Supabase holds the templates as the system of record
   and the reader's flash is a re-syncable cache.

3. **Staff never sign in.** They have no accounts. If they could, anyone with a
   webcam at home could mark themselves present. Attendance is written only by a
   registered kiosk.

## Who uses what

| | Signs in? | Sees |
|---|---|---|
| **Staff** | Never — no account exists | Nothing. They walk up to a kiosk and present a finger. |
| **Supervisor** | Yes | Own department: live attendance, roster, exceptions, reports |
| **Admin / HR** | Yes | Everything, plus enrolment, devices, access, audit log, settings |
| **Kiosk** | Device credential, not a person | The check-in screen only |

## The rules enforced in the database

**Rule 1 — only a registered kiosk can write attendance.**
`public.attendance` grants no `INSERT` to any browser-facing role. The single
write path is `record_attendance()`, which demands a kiosk code and a
bcrypt-checked token. A leaked anon key plus a laptop webcam still cannot forge
a check-in.

**Rule 2 — time windows govern state, not scan order.**
After the check-in window closes the system does *not* start checking people
out. It stays shut until the check-out window opens.

```
06:30–08:00   CHECK-IN open
08:00–14:30   CLOSED — scan recorded as an attempt, rejected
14:30–16:00   CHECK-OUT open
```

Late arrivals past the grace window are still recorded, flagged
`late_unapproved` for supervisor sign-off. A scan is never silently dropped — a
nurse covering an emergency must not vanish from the log.

**Rule 3 — an ambiguous face match names nobody.**
`identify_face()` requires the best match to clear a similarity threshold *and*
beat the runner-up by a margin. Two people scoring close together returns
`ambiguous`, and the kiosk asks for a staff number instead, then verifies 1:1.

This exists because of a measured failure: with one face enrolled, a sibling
matched at 0.69–0.80 against a 0.62 threshold — the same band as the genuine
person. See `thesis/chapter-05` §5.6.4.

**Night shifts cross midnight.** A shift starting 23:00 on the 7th files under
the 7th even when check-out happens at 07:00 on the 8th. That is what
`shift_date` and `crosses_midnight` are for.

## Project layout

```
src/
  components/
    layout/        Sidebar, ConsoleLayout
    enrollment/    FingerCapture, FaceCapture
    kiosk/         StaffNumberEntry
    attendance/    StatusPill
    devices/       ReaderSync
  lib/
    supabase.ts    Client (anon key only — service role never reaches the browser)
    auth-context.tsx
    provisioning.ts  Creating console users without the service role key
    fingerprint/   bridge.ts (HTTP client), sync.ts (templates → reader flash)
    face/          engine.ts (Human wrapper), kiosk-face.ts (match RPCs)
    attendance.ts, audit.ts, csv.ts, reference-data.ts, navigation.ts
  pages/           One per route
  routes/          ProtectedRoute
  types/           Database types
bridge/            Python service owning the fingerprint device
supabase/
  migrations/      Ordered SQL — the source of truth for the schema
  scripts/         One-off bootstrap helpers
thesis/            Written report, six chapters
SDK/               Vendor fingerprint SDK (git-ignored, 118 MB)
scripts/           copy-models.mjs — face models from node_modules to public/
```

## Setup

```bash
npm install          # also copies face models into public/models
cp .env.example .env.local     # fill in Supabase URL and anon key
npm run dev
```

Apply the migrations in filename order via the Supabase SQL editor, then run
`supabase/scripts/bootstrap_admin.sql` to create the first administrator.

**Supabase Auth settings** — under Authentication → Providers → Email:
*Allow new users to sign up* must be **on**, *Confirm email* **off**, or the
in-app creation of console users cannot complete.

### Running the fingerprint bridge

```bash
cd bridge
py -3-32 bioattend_bridge.py     # or double-click run-bridge.bat
```

Needs **32-bit Python** — the vendor DLL is 32-bit x86 and a 64-bit interpreter
fails with `WinError 193`. Leave the window open while using BioAttend, and
close `fpdemo.exe` first: only one program can hold the reader.

### Allowing the site to reach the bridge

The deployed site is served over HTTPS while the bridge runs on `127.0.0.1`.
Chrome asks once per site whether it may reach the local machine, and
**remembers a refusal** — after which every call fails with:

```
blocked by CORS policy: Permission was denied for this request
to access the `loopback` address space
```

Grant it at: address bar icon → *Site settings* → **Apps on device**
(also labelled *Local network access*) → on, then reload.

This is required **once per kiosk machine** and does not transfer between them.
A new kiosk will appear broken until it is granted, so it belongs on the
deployment checklist.

## Database conventions — do not break these

Every table follows the same four steps **in one migration**:

1. `create table`
2. explicit `GRANT`s — required since the October 2026 Data API change; without
   them the API returns `permission denied for table`
3. `alter table … enable row level security`
4. policies

Additional rules learned the hard way:

- Never `using (true)` on a write policy
- Never reference `user_metadata` in a policy — users can edit their own
- Every `SECURITY DEFINER` function sets `search_path = ''`
- **pgvector operators must be schema-qualified**: `OPERATOR(extensions.<=>)`.
  A bare `<=>` fails under an empty `search_path`
- Supabase rejects unqualified `DELETE` (safe-update guard)
- Postgres has no `max(uuid)` aggregate
- Wrap as `(select auth.uid())` so it evaluates once, not per row
- All SQL lives in migration files. No dashboard clicking — that leaves no
  history and nothing to roll back to

Run **Security Advisor** in the Supabase dashboard after applying migrations.

## TypeScript gotcha

Database row types must be `type`, **never `interface`**. supabase-js requires
them to satisfy `Record<string, unknown>`, and TypeScript grants implicit index
signatures only to type aliases. An `interface` silently fails the constraint,
the whole schema resolves to `never`, and the errors appear at your call sites
pointing nowhere near the cause.

## Hardware

| | |
|---|---|
| Device | `USB\VID_2009&PID_7638` — mass storage, mounts as a drive |
| Library | `fpsapit.dll`, 32-bit x86, no header shipped |
| Device type | `2` (USB-disk transport) |
| Manufacturer | LIROX, sensor 781102, protocol Ver 1.34 |

The DLL's interface was recovered by probing — see `bridge/diag*.py`, which are
kept deliberately as the only documentation this API has. The rule: **Windows
signatures = the Android JNI signature plus a leading device-context pointer**,
and `ZAZOpenDeviceEx`'s first parameter is an OUT pointer receiving that context.

## Status

Both biometrics work end to end: enrol → sync → identify → attendance recorded,
with face as the fallback. All console pages are implemented.

Outstanding: sibling face test with both siblings enrolled; threshold tuning
from measured data (current values are informed guesses); multi-participant
accuracy testing; deployment.

