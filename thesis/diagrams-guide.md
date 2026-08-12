# Diagrams and screenshots — what to draw

Every figure marked in the chapters, with its type, what it must contain, and
what an examiner will look for.

**Tools.** draw.io (free, browser) handles all of these. For UML specifically,
StarUML or Visual Paradigm Community give cleaner notation. Charts in Excel
from your exported CSV.

**Numbering.** Label figures as *Figure 4.1*, *Figure 4.2* and so on. Every
figure needs a caption below it and must be referred to in the text at least
once ("as shown in Figure 4.1"). A figure nobody references reads as padding.

---

## Chapter One

### Figure 1.1 — Conceptual overview
**Type:** Simple block diagram. Not UML.

Three columns left to right:

```
   STAFF MEMBER          SYSTEM                    OUTPUT
   
   [person icon]  →   [fingerprint reader]  →   [attendance record]
                      [camera]                   validated against
                                                 [shift roster]
```

Keep it deliberately simple — this is the "what is this project" picture for a
reader on page three. The real architecture is Figure 4.2.

---

## Chapter Two

### Figure 2.1 — Genuine and impostor score distributions
**Type:** Line chart, two overlapping curves.

X-axis: match score, 0 to 1. Y-axis: frequency.

Draw two bell curves that **overlap in the middle** — the overlap is the entire
point. Left curve labelled *Impostor comparisons*, right curve *Genuine
comparisons*. Draw a vertical line through the overlap labelled *Threshold t*.

Shade and label two regions:
- Impostor curve **right** of the line = **False Acceptance (FAR)**
- Genuine curve **left** of the line = **False Rejection (FRR)**

Add an arrow showing that moving *t* right reduces FAR and increases FRR.

**Why it matters:** this single diagram explains why your threshold choice is a
policy decision, and why your sibling result happened. If you draw only one
diagram well, draw this one.

### Figure 2.2 — Conceptual framework
**Type:** Box-and-arrow framework diagram.

```
        ┌─────────────────────────┐
        │    HOSPITAL CONTEXT     │   (moderating)
        │  hand condition,        │
        │  lighting, shift        │
        │  structure, roster size │
        └───────────┬─────────────┘
                    │ moderates
                    ▼
┌──────────────────────┐        ┌──────────────────────┐
│  SYSTEM DESIGN       │───────▶│ ATTENDANCE RECORD    │
│  • modality config   │        │ QUALITY              │
│  • matching mode     │        │ • attribution        │
│  • decision policy   │        │ • inclusiveness      │
│  • shift validation  │        │ • shift validity     │
│  • station auth      │        │ • integrity          │
└──────────────────────┘        └──────────────────────┘
   (independent)                     (dependent)
```

Annotate the main arrow with **TTF** and **TAM** as the theoretical lenses.

---

## Chapter Three

### Figure 3.1 — Iterative development cycle
**Type:** Circular flow, four nodes.

```
   Design ──▶ Implement ──▶ Test ──▶ Evaluate
      ▲                                 │
      └─────────────────────────────────┘
```

Annotate the feedback arrow with the two iterations where a finding forced a
redesign:
- *Iteration 2 — device interface assumption falsified*
- *Iteration 6 — face matching mode revised after false accept*

**Why it matters:** it evidences that your methodology choice was necessary
rather than a preference.

---

## Chapter Four

### Figure 4.1 — Existing manual process
**Type:** UML activity diagram.

Swimlanes: *Staff member*, *Supervisor*, *HR Officer*.

Flow: arrive → find register → write name and time → sign → [end of shift] →
write departure time (decision: *often omitted*) → supervisor countersigns →
HR collects at pay period → transcribes to spreadsheet → discrepancy? →
resolved from memory.

**Mark with a warning symbol** the three points that depend on trust: writing
your own time, signing for yourself, and resolving disputes from memory. Those
annotations are what turn a process diagram into an argument.

### Figure 4.2 — System architecture
**Type:** Block/deployment diagram.

```
┌── KIOSK PC ────────────────────────────┐
│  Browser ──HTTP──▶ Fingerprint bridge  │──USB──▶ [reader]
│     │      ──HTTP──▶ Face service      │
│     │                                  │──USB──▶ [camera]
└─────┼──────────────────────────────────┘
      │ HTTPS
      ▼
┌── CLOUD ──────────────────┐
│  Static site (Vercel)     │
│  Database (Supabase)  ◀── trust boundary
└───────────────────────────┘
```

Draw a **dashed box around the database** labelled *trust boundary*, and note
that the browser and local services hold no authority to record attendance.
Label each connection with its protocol.

### Figure 4.3 — Use case diagram
**Type:** UML use case.

Left actor: **Staff member** — connected to UC6 (check in by fingerprint), UC7
(check in by face), UC8 (verify by staff number), UC9 (check out).

Right actors: **Supervisor** and **Administrator**, with Administrator
generalising Supervisor (hollow triangle arrow).

Secondary actor at the bottom: **Check-in station**, connected to UC6–UC9.

**Annotate near the staff member: "no login — no account exists".** It is the
most unusual thing about the model and an examiner will ask about it.

### Figure 4.4 — Context diagram (DFD level 0)
**Type:** Data flow diagram, Gane–Sarson notation.

One process — the whole system — surrounded by five external entities: staff
member, supervisor, administrator, fingerprint reader, camera. No data stores;
they belong to level 1 and below.

**Annotate that nothing resembling a credential flows from the staff member.**
The absence is the design decision.

### Figure 4.5 — Data flow diagram, level 1
**Type:** Data flow diagram, Gane–Sarson notation.

Six processes — 1.0 Enrol staff, 2.0 Manage roster, 3.0 Capture attendance,
4.0 Review and approve, 5.0 Report and export, 6.0 Administer system — and six
data stores: D1 Staff, D2 Biometric templates and embeddings, D3 Roster,
D4 Attendance, D5 Attempt log, D6 Configuration.

Two flows carry the argument of the chapter and should be visually emphasised:

- **D2 → 3.0 is read-only.** Attendance capture reads enrolled biometrics and
  never writes to them. Enrolment is the only path into D2.
- **3.0 → D5 fires on every path**, refusals included. The attempt log is not
  an error log; it is the complete record of what the system was asked.

### Figure 4.6 — Data flow diagram, level 2 (process 3.0)
**Type:** Data flow diagram, Gane–Sarson notation.

Decomposes capture into 3.1 Identify by fingerprint, 3.2 Identify by face,
3.3 Verify asserted identity, 3.4 Validate against shift window, 3.5 Record
attendance, 3.6 Log attempt.

The cascade 3.1 → 3.2 → 3.3 must read as a fall-through, because it is the
serial fusion described in §4.4.4: fingerprint first, face on no match, staff
number plus 1:1 verification when face is ambiguous. Drawn as three parallel
branches it says something the system does not do.

### Figure 4.7 — Entity Relationship Diagram
**Type:** ERD, crow's foot notation.

All fifteen tables from Appendix D. Suggested layout:

- **Top:** `departments`, `job_titles`, `shifts`, `hospital_settings`
- **Centre:** `staff` (the hub — most relationships pass through it)
- **Below staff:** `fingerprint_templates`, `face_embeddings`
- **Left:** `readers`, `reader_slots`, `kiosks`
- **Right:** `shift_assignments`, `attendance`, `attendance_attempts`
- **Corner:** `profiles`, `audit_log`

Show primary keys (PK), foreign keys (FK) and cardinality. **Mark the two
unique constraints explicitly** — `(staff_id, shift_date)` on attendance and
`(staff_id, finger)` on templates — because both encode a business rule.

This is the largest diagram and the one examined most closely. Give it a full
page in landscape if needed.

### Figure 4.8 — Class diagram
**Type:** UML class diagram, application layer only (not the database).

Suggested classes with key methods:

| Class | Methods |
|---|---|
| `FingerprintBridge` | connect(), enroll(), identify(), sync() |
| `FaceService` | embed(), health() |
| `LivenessEngine` | checkLiveness() |
| `AttendanceService` | record(), approve() |
| `EnrolmentService` | createStaff(), saveTemplate(), saveEmbedding() |
| `RosterService` | assignShift(), shiftsForDate() |
| `AuditService` | record() |

Show `EnrolmentService` depending on both `FingerprintBridge` and
`FaceService`; `AttendanceService` depending on all three capture classes.

### Figure 4.9 — Attendance recording activity diagram
**Type:** UML activity diagram with decision nodes.

**This is the most important diagram in the thesis.** It encodes both rules.

```
start
  ▼
Verify station credential ──invalid──▶ REJECT (log attempt)
  ▼ valid
Staff active? ──no──▶ REJECT (log attempt)
  ▼ yes
Find shift for this moment
  (search yesterday → tomorrow, so a night
   shift in progress is found)
  ▼
Shift found? ──no──▶ RECORD as unscheduled, FLAG
  ▼ yes
Check-in exists? ──no──▶ In check-in window?
  │                        ├─ before ──▶ REJECT "too early"
  │                        ├─ within ──▶ RECORD on time / late
  │                        └─ after  ──▶ RECORD late-unapproved, FLAG
  ▼ yes
Check-out exists? ──yes──▶ REJECT duplicate
  ▼ no
In check-out window? ──no──▶ REJECT "window closed"
  ▼ yes
RECORD check-out
```

Every terminal node writes to the attempt log — annotate that once rather than
on each branch.

### Figure 4.10 — Sequence diagram, fingerprint check-in
**Type:** UML sequence diagram.

Lifelines: `Staff member`, `Kiosk (browser)`, `Fingerprint bridge`, `Reader`,
`Database`.

Messages in order: present finger → capture → search library → return (slot,
score) → resolve slot to staff → **record_attendance(credential, staff, method,
score)** → verify credential → resolve shift → evaluate window → return verdict
→ display → clear after 5s.

**Emphasise the credential travelling with the attendance call** — it is the
mechanism behind Rule 1.

### Figure 4.11 — Sequence diagram, fallback path
**Type:** UML sequence diagram.

Lifelines: `Staff member`, `Kiosk`, `Fingerprint bridge`, `Face service`,
`Database`.

Flow: present finger → **no match** → camera → liveness check (browser) →
embed (face service) → identify_face → **returns ambiguous** → prompt for staff
number → staff enters number → verify_face_by_staff_no → verified → record.

This diagram illustrates the design decision in §4.4.5 and directly answers
Research Question 4.

### Figure 4.12 — Interface wireframes
**Type:** Two side-by-side wireframes, drawn to relative scale.

Left: **console** — sidebar, main content area, context rail, small type,
dense tables.
Right: **kiosk** — no navigation, one centred message, type several times
larger.

Draw them at the same scale so the density difference is visible at a glance.
That contrast is the point.

---

## Chapter Five

### Figure 5.1 — Interface recovery process
**Type:** Flowchart.

```
Hypothesis from Android binding
  ▼
Probe ──▶ Fault? ──write fault──▶ argument is an out-pointer
  │           │
  │           └──read fault───▶ argument is dereferenced (a pointer)
  │           └──plausible code─▶ signature correct
  ▼
Revise hypothesis ──▶ (loop)
  ▼
Verified signature
```

List the five probes as steps alongside.

### Figure 5.2 — Deployment topology
**Type:** Deployment diagram.

Two zones. **Cloud:** static site + managed database. **Kiosk PC:** browser,
fingerprint bridge (32-bit), face service (64-bit), reader, camera.

Mark which connections cross the public internet (HTTPS) and which stay local
(loopback HTTP, USB). Annotate the loopback connection with *"requires local
network permission"*.

### Figure 5.3 — Fingerprint score distributions
**Type:** Histogram, two series.

X-axis: match score, 0–100. Y-axis: count. Genuine attempts in one colour,
impostor in another. Vertical line at the operating threshold of 45.

The gap between the two distributions — no comparison of either type falls
between 34 and 41 — is the result. Auto-binning will close it up if the bin
width is set carelessly, so check that the empty band survives.

### Figure 5.4 — Face similarity distributions
**Type:** Histogram, three series.

Genuine comparisons, unrelated impostor comparisons, and **sibling comparisons
as a separate series in a contrasting colour**. Vertical lines at the equal
error rate (0.632) and the operating threshold (0.68).

**This is the most informative graph in the thesis.** It shows visually why the
design changed: the sibling series sits between the other two, far above the
unrelated impostors and close enough to the genuine scores to be alarming. The
series has only ten values against 220 and 100, so it will be drawn small —
check it is still visible and does not disappear behind the others.

### Figure 5.5 — FAR / FRR against threshold
**Type:** Line chart, two lines crossing.

X-axis: threshold. Y-axis: error rate %. FAR falls as threshold rises; FRR
rises. Mark the **crossing point as the Equal Error Rate** (0.9% at 0.632), and
mark the **selected operating threshold** at 0.68 — to the right of the EER,
because false rejection is deliberately preferred to false acceptance.

Cap the Y axis at 14%. The FRR curve reaches 80% at threshold 0.90, and an axis
scaled to fit it compresses the crossing region to nothing.

Annotate the choice of operating point; it is a decision you must be able to
defend.

---

## Screenshots (Chapter Five)

Capture at full window size, light background, no browser chrome if possible.

| # | Screen | Must show |
|---|---|---|
| 5.1 | Console overview | Summary tiles, today's activity |
| 5.2 | Enrolment — fingerprint | Four finger targets, progress, **consent panel with capture disabled** |
| 5.3 | Enrolment — face | Camera preview with **live anti-spoof verdict overlaid**, five angles |
| 5.4 | Live attendance | Records with method, score, status |
| 5.5 | Exceptions | A flagged record with its explanation and approval control |
| 5.6 | Reports | Biometric performance figures and export controls |
| 5.7 | Settings | Shift window table and threshold sliders |
| 5.8 | Kiosk idle | "Place your finger" |
| 5.9 | Kiosk success | Name, staff number, shift, time |
| 5.10 | Kiosk flagged | Unscheduled or late outcome in amber |
| 5.11 | Kiosk refused | "Not yet — check-out opens at…" |
| 5.12 | Kiosk keypad | Staff number entry |

**Two worth capturing that aren't in the list:** the anti-spoof rejecting a
printed photo (5.3 variant), and the kiosk running with the fingerprint service
stopped. Both demonstrate claims you make in the text.

---

## Summary

| Chapter | Figures | Screenshots |
|---|---|---|
| 1 | 1 | — |
| 2 | 2 | — |
| 3 | 1 | — |
| 4 | 12 | — |
| 5 | 5 | 12 |
| **Total** | **21** | **12** |

At roughly a third of a page each for figures and a quarter for screenshots,
expect **17–20 pages** of figures. With ~40 pages of text plus front matter,
references and appendices, that lands close to your 65-page target.

**If you need to cut figures**, the ones carrying least weight are 4.8 (class
diagram) and 5.1 (recovery flowchart) — both are described adequately in prose.
Figure 4.6 can also go if space is tight, since 4.5 already shows the six
processes and §4.4.4 explains the cascade in prose.

Never cut 2.1, 4.7 (ERD), 4.9 (attendance logic) or 5.3. Departments that
require data flow diagrams treat 4.4 and 4.5 as mandatory — check yours before
touching them.
