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

### Figure 4.4 — Entity Relationship Diagram
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

### Figure 4.5 — Class diagram
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

### Figure 4.6 — Attendance recording activity diagram
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

### Figure 4.7 — Sequence diagram, fingerprint check-in
**Type:** UML sequence diagram.

Lifelines: `Staff member`, `Kiosk (browser)`, `Fingerprint bridge`, `Reader`,
`Database`.

Messages in order: present finger → capture → search library → return (slot,
score) → resolve slot to staff → **record_attendance(credential, staff, method,
score)** → verify credential → resolve shift → evaluate window → return verdict
→ display → clear after 5s.

**Emphasise the credential travelling with the attendance call** — it is the
mechanism behind Rule 1.

### Figure 4.8 — Sequence diagram, fallback path
**Type:** UML sequence diagram.

Lifelines: `Staff member`, `Kiosk`, `Fingerprint bridge`, `Face service`,
`Database`.

Flow: present finger → **no match** → camera → liveness check (browser) →
embed (face service) → identify_face → **returns ambiguous** → prompt for staff
number → staff enters number → verify_face_by_staff_no → verified → record.

This diagram illustrates the design decision in §4.4.5 and directly answers
Research Question 4.

### Figure 4.9 — Interface wireframes
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

### Figure 5.1b — Deployment topology
**Type:** Deployment diagram.

Two zones. **Cloud:** static site + managed database. **Kiosk PC:** browser,
fingerprint bridge (32-bit), face service (64-bit), reader, camera.

Mark which connections cross the public internet (HTTPS) and which stay local
(loopback HTTP, USB). Annotate the loopback connection with *"requires local
network permission"*.

### Figure 5.2 — Fingerprint score distributions
**Type:** Histogram, two series. Build in Excel from your exported CSV.

X-axis: match score. Y-axis: count. Genuine attempts in one colour, impostor in
another. Vertical line at your operating threshold.

### Figure 5.3 — Face similarity distributions ⭐
**Type:** Histogram or scatter, three series.

Genuine comparisons, **sibling comparisons marked distinctly**, and unrelated
impostor comparisons. Vertical line at the threshold.

**This is the most informative graph in your thesis.** It shows visually why
the design changed. If you can produce it twice — once with the old model,
once with ArcFace — the before-and-after comparison is a genuinely strong
result.

### Figure 5.4 — FAR / FRR against threshold
**Type:** Line chart, two lines crossing.

X-axis: threshold, 0 to 1. Y-axis: error rate %. FAR falls as threshold rises;
FRR rises. Mark the **crossing point as the Equal Error Rate**, and mark your
**selected operating threshold** — which should sit to the right of the EER,
because you deliberately favour false rejection over false acceptance.

Annotate that choice; it is a decision you must be able to defend.

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
| 4 | 9 | — |
| 5 | 5 | 12 |
| **Total** | **18** | **12** |

At roughly a third of a page each for figures and a quarter for screenshots,
expect **15–18 pages** of figures. With ~40 pages of text plus front matter,
references and appendices, that lands close to your 65-page target.

**If you need to cut figures**, the ones carrying least weight are 4.5 (class
diagram) and 5.1 (recovery flowchart) — both are described adequately in prose.
Never cut 2.1, 4.4, 4.6 or 5.3.
