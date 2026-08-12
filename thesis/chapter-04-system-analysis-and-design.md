# CHAPTER FOUR: SYSTEM ANALYSIS AND DESIGN

## 4.1 Introduction

This chapter analyses the attendance system currently in use, identifies its
weaknesses, specifies the requirements of the proposed system and presents its
design. It is organised so that each design decision is traceable to a problem
in the analysis, and each problem to a gap established in Chapter Two.

## 4.2 Existing System Analysis

Attendance is recorded by a **manual paper register** at each departmental
station. A staff member arriving for a shift writes their name, the date and
their arrival time and signs; at the end of the shift they record a departure
time, though in practice this is frequently omitted. The supervisor
periodically reviews and countersigns. At the end of each pay period the
registers are collected by human resources and transcribed into a spreadsheet,
and discrepancies — missing entries, illegible handwriting, disputed times — are
resolved by consultation between the HR officer and the supervisor, usually from
memory.

Shift schedules are maintained separately on a printed roster revised by hand.
There is no systematic reconciliation between roster and register; the two
documents exist independently and are compared only when a dispute arises.

---

> **[DIAGRAM 4.1]** — Activity diagram of the *existing* manual process, from
> staff arrival through register entry, supervisor review, HR transcription and
> payroll. Mark the points at which the process depends on trust or on memory.

---

Analysed against the four criteria derived from the literature review, the
process fails on each. **Identity** is not verified: the register authenticates
a signature, and a colleague may sign for an absent staff member with no
possibility of detection from the record itself. **Timing** is self-selected,
with no independent source of time and no constraint on rounding. **Shift
validation** is impossible, because the register cannot distinguish a punctual
arrival for a night shift from a very late arrival for a morning one — both
appear simply as a time. **Auditability** is absent: entries can be altered or
added retrospectively, and since nothing is timestamped by an independent
mechanism, a retrospective addition is indistinguishable from a contemporaneous
one.

## 4.3 Problems with the Existing System

| # | Problem | Consequence |
|---|---|---|
| P1 | Identity is not verified | Proxy attendance is possible and undetectable |
| P2 | Times are self-reported | Recorded times may not reflect actual arrival |
| P3 | No link to the roster | A record cannot be classified as punctual, late or unscheduled |
| P4 | Departure entries omitted | Hours worked cannot be reliably computed |
| P5 | Information available only retrospectively | Staffing shortfalls cannot be addressed during a shift |
| P6 | Records alterable without trace | The record is weak evidence in a dispute |
| P7 | Manual transcription | Introduces error and consumes administrative time |
| P8 | No systematic exception handling | Anomalies are resolved informally and inconsistently |

## 4.4 Proposed System

### 4.4.1 Overview

The proposed system replaces the register with a **multimodal biometric
attendance and shift management system**. Staff present a fingerprint at a
designated station; the system identifies them, evaluates the event against
their scheduled shift and records the result. Where a fingerprint cannot be
read, facial recognition provides an alternative path.

Four components: an **administrative console** for enrolment, rostering, review
and configuration; a **check-in station** with no login and no navigation; a
**biometric bridge**, a local service exposing the fingerprint device to the
browser; and a **database** holding all records, enforcing access control and
providing matching and attendance recording as server-side functions.

---

> **[DIAGRAM 4.2]** — System architecture. Four blocks: Browser (console and
> kiosk), Local bridge service, Fingerprint device and camera, and Database.
> Show which protocol connects each pair (HTTPS, local HTTP, USB) and mark the
> trust boundary around the database.

---

### 4.4.2 Design principle: authority resides in the database

A governing principle is that **the authority to record attendance resides in
the database, not in the client**. The browser and the bridge are treated as
untrusted: they capture biometrics and present results, but they cannot decide
that an attendance event occurred. Three mechanisms realise this. The attendance
table grants no insert permission to any browser-facing role, so the only path
to a record is a server-side function. That function requires a credential
belonging to a registered station, verified against a stored hash. And access to
every table is governed by row-level security evaluated by the database on each
query, so that restricting what a user sees does not depend on the application
requesting the right rows.

The consequence is that compromising the client — or possessing the public API
key — is insufficient to forge an attendance record.

### 4.4.3 Design constraint: device access from a browser

The fingerprint device presents to the operating system as a **USB mass storage
device** rather than a serial port, and is driven by a vendor library over a
storage protocol. No browser interface can reach it: Web Serial requires a port
the device does not create, WebUSB explicitly refuses protected interface
classes of which mass storage is one, and the volume presented is a control
channel rather than a mountable file system.

The design therefore includes a **local bridge service** on the station, holding
the device and exposing its operations over HTTP bound to the loopback address.
The bridge is deliberately given no authority: it captures and returns results,
cannot write attendance records, and holds no credentials beyond those needed to
reach the local device. **A compromised bridge can refuse to scan, but cannot
fabricate attendance.**

### 4.4.4 Design decision: serial rather than parallel multimodality

Fingerprint recognition is attempted first; facial recognition is invoked only
when it does not produce a confident identification.

The justification is throughput. Hospital shift changes concentrate arrivals
into a short window, and requiring every staff member to present two biometrics
imposes an acquisition cost on the whole population to serve a minority whose
fingerprints do not read. Serial operation confines that cost to the staff who
need it.

### 4.4.5 Design decision: refusal under ambiguity

The system implements the principle that **an ambiguous comparison must not be
resolved to the nearest match**. The server-side matching function computes
similarity against every enrolled individual and applies two conditions before
returning an identity: the best match must exceed a configured similarity
threshold, **and** must exceed the second-best by a configured **margin**. If
two individuals score closely the second condition fails and the function
returns *ambiguous*, naming nobody. The system then asks the person to assert
their identity by entering their staff number, and performs one-to-one
verification instead.

This converts the question from *"who is this?"*, which facial recognition
answers unreliably, to *"is this the person they claim to be?"*, which it
answers well. The empirical basis for the decision is reported in Chapter Five.

### 4.4.6 Design decision: shift windows govern state

Each shift defines four configurable windows in minutes relative to its
boundaries: check-in opens before the start, check-in grace after the start,
check-out opens before the end, check-out closes after the end.

**State is determined by these windows, not by the sequence of scans.** After
the check-in window closes the system does not begin accepting check-outs; it
accepts nothing until the check-out window opens, and a scan in between is
recorded as an attempt and refused with an explanation. Arrivals after the grace
window are **recorded and flagged** for approval rather than refused — a staff
member who worked must not be absent from the record because they were late.

Night shifts cross the calendar day boundary, so each record carries a **shift
date**, the date the shift began, distinct from the event timestamp. A shift
beginning 23:00 on the 7th is filed under the 7th even when its check-out occurs
at 07:00 on the 8th.

## 4.5 System Requirements

**Twenty-nine functional requirements** are specified in full in **Appendix A**,
in five groups. *Enrolment* (FR1–FR9) registers staff, records biometric consent
before permitting any capture, stores up to four fingerprint templates and five
facial embeddings per person, and rejects captures below a quality threshold.
*Rostering* (FR10–FR11) assigns at most one shift per person per date.
*Attendance* (FR12–FR21) identifies by fingerprint, falls back to face, refuses
to identify when two individuals score within a configured margin, classifies
each event against the shift window, logs every attempt including refusals, and
accepts attendance only from a registered station presenting a valid credential.
*Review* (FR22–FR24) covers live attendance, supervisor approval that records
who signed off without altering captured times, and export. *Administration*
(FR25–FR29) covers console users, station registration, thresholds, append-only
audit logging excluding biometric payloads, and reader synchronisation.

**Twelve non-functional requirements** are in **Appendix B**. Four govern the
design directly: **NFR3** — false acceptance is prioritised over false rejection
when selecting thresholds, because the errors are not equally damaging; **NFR5**
— biometric records are accessible only to administrators, enforced by row-level
security rather than application logic; **NFR6** — attendance is not recordable
without a station credential; **NFR12** — loss of a reader device does not lose
biometric data.

## 4.6 System Design

### 4.6.1 Use case model

| Actor | Description |
|---|---|
| Staff member | Records attendance. Has no account and cannot sign in. |
| Departmental supervisor | Reviews attendance and approves exceptions for their own department. |
| Administrator (HR) | Enrols staff, captures biometrics, configures the system, manages access. |
| Check-in station | A registered device submitting attendance events, authenticating as a device rather than a person. |
| Local services | Mediate access to the fingerprint reader and the recognition models. |

Fifteen use cases are identified, shown in Figure 4.3. That the staff member —
the principal subject of the system — has no account and never authenticates is
the most consequential feature of this model, and is what prevents attendance
being recorded from anywhere other than a registered station.

---

> **[DIAGRAM 4.3]** — Use case diagram.

---

### 4.6.2 Data flow modelling

The use case model states what the system does for whom. Data flow diagrams
state what moves between those functions and where it rests, which is the view
that exposes the biometric data paths.

At **context level** the system is a single process exchanging data with five
external entities: staff member, supervisor, administrator, fingerprint reader
and camera. The staff member supplies only a biometric sample and receives only
a verdict — no credential passes in either direction, because none exists.

**Level 1** decomposes the system into six processes — 1.0 Enrol staff, 2.0
Manage roster, 3.0 Capture attendance, 4.0 Review and approve, 5.0 Report and
export, 6.0 Administer system — and six data stores: D1 Staff, D2 Biometric
templates and embeddings, D3 Roster, D4 Attendance, D5 Attempt log, D6
Configuration.

Two flows carry the design's central constraints. **Process 3.0 reads D2 but
never writes to it** — attendance capture cannot alter enrolment. And **every
path through 3.0 writes to D5**, including those that refuse, so a rejected scan
leaves evidence rather than nothing.

**Level 2** decomposes process 3.0, where identification, validation and refusal
all occur, and which is therefore the only process whose internal structure is
not self-evident from the level above.

---

> **[DIAGRAM 4.4]** — Context diagram (DFD level 0).
>
> **[DIAGRAM 4.5]** — Data flow diagram, level 1.
>
> **[DIAGRAM 4.6]** — Data flow diagram, level 2: decomposition of process 3.0,
> Capture attendance.

---

### 4.6.3 Database design

Fifteen tables span reference data, people, biometrics, devices and operations.
The full schema with design notes is in **Appendix C**, and the data dictionary
follows in Section 4.6.4. Three decisions shape it.

**Attendance is one row per staff member per shift date**, with check-in and
check-out as columns and a uniqueness constraint on that pair, so "already
checked in today" is enforced by the schema rather than by a query.

**Recognition attempts are stored separately from attendance records.** Every
scan is logged, including refusals — evidence when a staff member disputes that
the system failed them, and the dataset from which Chapter Five's accuracy
figures are computed. Refused attempts appear nowhere else, and a false
rejection rate cannot be calculated without them.

**The device's stored templates are a rebuildable cache.** The database holds
the authoritative copies, so a failed reader is replaced by synchronising a new
one and no biometric data is lost with the hardware.

---

> **[DIAGRAM 4.7]** — Entity-Relationship Diagram, all fifteen tables.
>
> **[DIAGRAM 4.8]** — Class diagram of the application service layer.

---

### 4.6.4 Data dictionary

Every table, field, data type, nullability and purpose is documented in the data
dictionary reproduced here, covering all fifteen tables across the five groups
above.

Three conventions hold throughout. Every table carries a creation timestamp, and
those that can be modified carry a modification timestamp maintained by a
database trigger rather than by the application, so the value cannot be
falsified by a client. Foreign keys to reference data restrict deletion, so a
department in use cannot be removed; foreign keys to staff cascade, so removing
a staff member removes their biometric data with them. **No table stores a raw
biometric image** — only templates and embeddings, neither of which can be
reversed into the original sample.

### 4.6.5 Access control design

Access is enforced by row-level security policies evaluated by the database on
every query rather than by the application. The full matrix is in **Appendix D**.

Two aspects merit emphasis. **Supervisors have no access to biometric records at
all** — they require attendance data, which does not require access to templates
or embeddings, and restricting biometrics to the smallest possible role limits
exposure. **The station cannot read biometric records either**: it holds only
the public API key, and facial matching is performed by a server-side function
receiving a freshly computed embedding and returning a decision. A compromised
station therefore discloses nothing.

### 4.6.6 Attendance recording logic

Attendance recording is a single server-side function, the only path by which a
record can be created:

1. Verify the station credential against the stored hash; reject if invalid.
2. Verify the staff member exists and is active; reject and log if not.
3. Search roster entries from the previous day to the following day, so a night
   shift in progress is found regardless of the calendar date.
4. For each candidate compute shift start and end as absolute times, adding a
   day to the end where the shift crosses midnight, then derive the four windows.
5. Select the shift whose span contains the current moment. If none, record an
   unscheduled check-in and flag it.
6. If no check-in exists, evaluate against the check-in window and classify.
7. If a check-in exists and a check-out does not, evaluate against the check-out
   window; refuse if it has not opened.
8. If both exist, record a duplicate attempt and refuse.
9. **Record the attempt in all cases**, and return a structured verdict.

---

> **[DIAGRAM 4.9]** — Activity diagram for attendance recording, following the
> steps above, with decision diamonds for credential validity, staff active,
> shift found, window state and existing record. This is the most important
> diagram in the chapter — it encodes the two rules the system rests on.
>
> **[DIAGRAM 4.10]** — Sequence diagram for UC6 (check in by fingerprint).
> Lifelines: Staff member, Kiosk, Bridge, Fingerprint device, Database. Show the
> credential accompanying the attendance call and the verdict returning.
>
> **[DIAGRAM 4.11]** — Sequence diagram for the fallback path: fingerprint fails
> → face identification → ambiguous → staff number requested → one-to-one
> verification → attendance recorded. Illustrates the decision in 4.4.5.

---

### 4.6.7 User interface design

The system presents two interfaces with deliberately different characteristics.
**The console** is designed for a seated user at approximately 50 cm and is
information-dense: persistent sidebar, tabular data, contextual detail panels,
compact type. **The station** is designed for a standing user at approximately
two metres, with no navigation, no login and a single message at a time in type
several times larger. Outcomes are shown as a name and a status readable across
a corridor, and the display clears itself after a few seconds so the next person
does not see the previous person's name.

The same visual identity is shared, but density differs by roughly an order of
magnitude. Treating these as one design would produce a station unusable in
practice; treating them as unrelated would produce an incoherent system.

---

> **[DIAGRAM 4.12]** — Interface wireframes: console layout beside the station
> layout, at relative scale to make the density difference visible.

---
