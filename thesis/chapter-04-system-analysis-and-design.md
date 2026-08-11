# CHAPTER FOUR: SYSTEM ANALYSIS AND DESIGN

## 4.1 Introduction

This chapter analyses the attendance system currently in use in the study
setting, identifies its weaknesses, specifies the requirements of the proposed
system, and presents its design. The design is expressed through use case,
entity-relationship, class, activity and sequence models, together with the
database design and the access control architecture.

The chapter is organised so that each design decision is traceable to a problem
identified in the analysis, and each problem is traceable to a gap established in
the literature review.

---

## 4.2 Existing System Analysis

### 4.2.1 Description of the existing process

Attendance in the study setting is recorded by a **manual paper register**
maintained at each departmental station. The process operates as follows:

1. A staff member arriving for a shift locates the register for their department
   and writes their name, the date and their time of arrival, and signs.
2. At the end of the shift they record a departure time and sign again, though
   in practice the departure entry is frequently omitted.
3. The departmental supervisor periodically reviews the register and countersigns
   it.
4. At the end of each pay period the registers are collected by the human
   resources office, where entries are transcribed into a spreadsheet for
   payroll processing.
5. Discrepancies — missing entries, illegible handwriting, disputed times — are
   resolved by consultation between the HR officer and the supervisor, usually
   from memory.

Shift schedules are maintained separately, typically on a printed roster posted
at the departmental station and revised by hand as changes occur. There is no
systematic reconciliation between the roster and the register; the two documents
exist independently and are compared only when a dispute arises.

---

> **[DIAGRAM 4.1]** — Activity diagram of the *existing* manual process, from
> staff arrival through register entry, supervisor review, HR transcription and
> payroll. Mark the points at which the process depends on trust or on memory.

---

### 4.2.2 Analysis of the existing process

The process was analysed against the four criteria derived from the literature
review: identity verification, inclusiveness, shift validation and record
integrity.

**Identity verification.** The register authenticates a signature, not a person.
Nothing in the process establishes that the individual who wrote an entry is the
individual named. A colleague may sign on behalf of an absent staff member with
no possibility of detection from the record itself.

**Timing accuracy.** The recorded time is the time the staff member *writes*,
which they select. There is no independent source of time, and rounding to
convenient values is unconstrained.

**Shift validation.** Because the register and roster are separate documents,
the register cannot distinguish a punctual arrival for a night shift from a very
late arrival for a morning shift. Both appear simply as a time.

**Completeness.** Departure entries are frequently omitted, producing records
from which hours worked cannot be computed.

**Latency.** Attendance information is available to management only after
collection and transcription, typically at the end of a pay period. There is no
means of establishing current staffing levels during a shift.

**Auditability.** Paper entries can be altered or added retrospectively. Because
entries are not timestamped by any independent mechanism, a retrospective
addition is indistinguishable from a contemporaneous one.

## 4.3 Problems with the Existing System

The analysis identifies the following problems, each of which the proposed
system is designed to address.

| # | Problem | Consequence |
|---|---|---|
| P1 | Identity is not verified | Proxy attendance is possible and undetectable |
| P2 | Times are self-reported | Recorded times may not reflect actual arrival |
| P3 | No link to the roster | A record cannot be classified as punctual, late or unscheduled |
| P4 | Departure entries omitted | Hours worked cannot be reliably computed |
| P5 | Information available only retrospectively | Staffing shortfalls cannot be addressed during a shift |
| P6 | Records are alterable without trace | The record is weak evidence in a dispute |
| P7 | Manual transcription | Introduces error and consumes administrative time |
| P8 | No systematic exception handling | Anomalies are resolved informally and inconsistently |

## 4.4 Proposed System

### 4.4.1 Overview

The proposed system replaces the paper register with a **multimodal biometric
attendance and shift management system**. Staff present a fingerprint at a
designated check-in station; the system identifies them, evaluates the event
against their scheduled shift, and records the result. Where a fingerprint
cannot be read, facial recognition provides an alternative path.

The system comprises four components:

1. **Administrative console** — a web application through which administrators
   enrol staff, capture biometrics, manage rosters, review attendance and
   configure the system, and through which departmental supervisors review and
   approve exceptions for their own staff.

2. **Check-in station (kiosk)** — a dedicated screen, running on a computer with
   the biometric hardware attached, at which staff record attendance. It has no
   login and no navigation.

3. **Biometric bridge** — a local service running on the station that
   communicates with the fingerprint device and exposes it to the browser. Its
   necessity is explained in Section 4.4.3.

4. **Database and application services** — a managed relational database holding
   all records, enforcing access control, and providing the matching and
   attendance-recording operations as server-side functions.

---

> **[DIAGRAM 4.2]** — System architecture. Four blocks: Browser (console and
> kiosk), Local bridge service, Fingerprint device and camera, and Database.
> Show which protocol connects each pair (HTTPS, local HTTP, USB) and mark
> the trust boundary around the database.

---

### 4.4.2 Design principle: authority resides in the database

A governing principle of the design is that **the authority to record attendance
resides in the database, not in the client application**. The browser and the
local bridge are treated as untrusted: they capture biometrics and present
results, but they cannot decide that an attendance event occurred.

This is realised by three mechanisms:

- The attendance table grants no insert permission to any browser-facing role.
  The only path by which a record can be created is a server-side function.
- That function requires a credential belonging to a registered check-in
  station, verified against a stored hash.
- Access to each table is governed by row-level security policies evaluated by
  the database on every query, so that restricting what a user sees does not
  depend on the application requesting the right rows.

The consequence is that compromising the client — or possessing the public API
key — is insufficient to forge an attendance record.

### 4.4.3 Design constraint: device access from a browser

The fingerprint device presents itself to the host operating system as a **USB
mass storage device** rather than a serial port, and is driven by a
vendor-supplied library over a storage protocol.

No browser interface can reach such a device. The Web Serial API requires a
serial port, which the device does not create. The WebUSB API explicitly refuses
devices belonging to protected interface classes, of which mass storage is one.
The volume the device presents is a control channel rather than a mountable file
system.

The design therefore includes a **local bridge service**: a small program running
on the check-in station that holds the device and exposes its operations over an
HTTP interface bound to the loopback address. The browser communicates with the
bridge over that interface.

The bridge is deliberately given no authority. It captures biometrics and
returns results; it cannot write attendance records, and it holds no credentials
beyond those needed to reach the local device. A compromised bridge can refuse
to scan, but cannot fabricate attendance.

### 4.4.4 Design decision: serial rather than parallel multimodality

Following the analysis in Section 2.2.5, the system implements **serial**
multimodal operation. Fingerprint recognition is attempted first. Facial
recognition is invoked only when the fingerprint path does not produce a
confident identification.

The justification is throughput. Hospital shift changes concentrate arrivals
into a short window; requiring every staff member to present two biometrics
imposes an acquisition cost on the whole population in order to serve a minority
whose fingerprints do not read. Serial operation confines that cost to the
staff who need it.

### 4.4.5 Design decision: refusal under ambiguity

The system implements the principle that **an ambiguous comparison must not be
resolved to the nearest match**.

For facial identification, the server-side matching function computes the
similarity of the probe against every enrolled individual and applies two
conditions before returning an identity:

1. the best match must exceed a configured similarity threshold; and
2. the best match must exceed the second-best match by a configured **margin**.

If two individuals score closely, the second condition fails and the function
returns *ambiguous*, naming nobody. The system then asks the person to assert
their identity — by entering their staff number — and performs a one-to-one
verification instead.

This converts the question from *"who is this?"*, which facial recognition
answers unreliably, to *"is this the person they claim to be?"*, which it answers
well. The empirical basis for this decision is reported in Chapter Five.

### 4.4.6 Design decision: shift windows govern state

Each shift defines four configurable windows expressed in minutes relative to
the shift boundaries: check-in opens before the start, check-in grace after the
start, check-out opens before the end, and check-out closes after the end.

The system's state at any moment is determined by these windows, not by the
sequence of scans. After the check-in window closes, the system does not begin
accepting check-outs; it accepts nothing until the check-out window opens. A
scan in the intervening period is recorded as an attempt and refused with an
explanation.

Arrivals after the grace window are **recorded and flagged** for supervisor
approval rather than refused. A staff member who worked must not be absent from
the record because they were late.

Night shifts cross the calendar day boundary. Each attendance record therefore
carries a **shift date** — the date on which the shift began — distinct from the
timestamp of the event. A shift beginning at 23:00 on the 7th is filed under the
7th even when its check-out occurs at 07:00 on the 8th.

## 4.5 System Requirements

### 4.5.1 Functional requirements

Twenty-nine functional requirements were specified, grouped into five areas.
The full specification is presented in **Appendix A**; the requirements
central to the design decisions above are summarised here.

**Enrolment (FR1–FR9).** The system registers staff with biographic details,
records biometric consent before permitting any capture, and stores up to four
fingerprint templates and five facial embeddings per person. Captures below a
configured quality threshold are rejected rather than stored. Biometrics can be
added to or replaced on an existing record without recreating it, and a staff
member can be deactivated — blocking attendance while retaining their history.

**Rostering (FR10–FR11).** Shifts are assigned per staff member per date, with
at most one assignment per person per day.

**Attendance (FR12–FR21).** The system identifies by fingerprint, falls back to
face, and refuses to identify when two individuals score within a configured
margin of each other. Each event is evaluated against the shift window and
classified as on time, late, late beyond grace, or unscheduled. Every attempt is
recorded, including refusals. Attendance is accepted only from a registered
station presenting a valid credential.

**Review (FR22–FR24)** covers live attendance, supervisor approval that records
who signed off without altering captured times, and export of both attendance
and raw recognition attempts.

**Administration (FR25–FR29)** covers console users, station registration,
threshold configuration, append-only audit logging that excludes biometric
payloads, and reader synchronisation.

### 4.5.2 Non-functional requirements

Twelve non-functional requirements are specified in full in **Appendix B**,
each with a stated measure. Four govern the design directly:

- **NFR3** — false acceptance is prioritised over false rejection when
  selecting thresholds, because the two errors are not equally damaging.
- **NFR5** — biometric records are accessible only to administrators, enforced
  by row-level security rather than application logic.
- **NFR6** — attendance is not recordable without a station credential.
- **NFR12** — loss of a reader device does not lose biometric data.

## 4.6 System Design

### 4.6.1 Use case model

Five actors interact with the system.

| Actor | Description |
|---|---|
| Staff member | Records attendance. Has no account and cannot sign in. |
| Departmental supervisor | Reviews attendance and approves exceptions for their own department. |
| Administrator (HR) | Enrols staff, captures biometrics, configures the system, manages access. |
| Check-in station | A registered device that submits attendance events, authenticating as a device rather than a person. |
| Local services | Mediate access to the fingerprint reader and the recognition models. |

Fifteen use cases are identified, listed in full with the specification for
UC6 (check in by fingerprint) in **Appendix C**. That the staff member — the
principal subject of the system — has no account and never authenticates is
the most consequential feature of this model, and is what prevents attendance
being recorded from anywhere other than a registered station.

---

> **[DIAGRAM 4.3]** — Use case diagram.

---

### 4.6.2 Data flow modelling

The use case model states what the system does for whom. Data flow diagrams
state what moves between those functions and where it rests, which is the view
that exposes the biometric data paths.

**Context level (Figure 4.4).** The system appears as a single process
exchanging data with five external entities: the staff member, the departmental
supervisor, the administrator, the fingerprint reader and the camera. The staff
member supplies only a biometric sample and receives only a verdict — no
credential passes in either direction, because none exists.

**Level 1 (Figure 4.5)** decomposes the system into six processes and six data
stores:

| Process | Function |
|---|---|
| 1.0 Enrol staff | Create records, record consent, capture biometrics |
| 2.0 Manage roster | Assign shifts to staff by date |
| 3.0 Capture attendance | Identify, validate against shift, record |
| 4.0 Review and approve | Present exceptions, record supervisor sign-off |
| 5.0 Report and export | Produce attendance and attempt datasets |
| 6.0 Administer system | Console users, stations, thresholds |

| Store | Contents |
|---|---|
| D1 | Staff records |
| D2 | Biometric templates and embeddings |
| D3 | Shift roster |
| D4 | Attendance records |
| D5 | Recognition attempt log |
| D6 | Configuration |

Two flows in this diagram carry the design's central constraints. Process 3.0
reads D2 but never writes to it — attendance capture cannot alter enrolment.
And every path through 3.0 writes to D5, including those that refuse, so a
rejected scan leaves evidence rather than nothing.

**Level 2 (Figure 4.6)** decomposes process 3.0, which is where identification,
validation and refusal all occur, and is therefore the only process whose
internal structure is not self-evident from the level above.

---

> **[DIAGRAM 4.4]** — Context diagram (DFD level 0).
>
> **[DIAGRAM 4.5]** — Data flow diagram, level 1.
>
> **[DIAGRAM 4.6]** — Data flow diagram, level 2: decomposition of process 3.0,
> Capture attendance.

---

### 4.6.3 Database design

The database comprises fifteen tables across reference data, people,
biometrics, devices and operations. The full schema with design notes is
presented in **Appendix D**.

Three decisions shape it.

**Attendance is one row per staff member per shift date**, with check-in and
check-out as columns and a uniqueness constraint on that pair. "Already checked
in today" is therefore enforced by the schema rather than by a query.

**Recognition attempts are stored separately from attendance records.** Every
scan is logged, including refusals — which serves as evidence when a staff
member disputes that the system failed them, and constitutes the dataset from
which the accuracy figures in Chapter Five are computed. Refused attempts
appear nowhere else, and a false rejection rate cannot be calculated without
them.

**The device's stored templates are treated as a rebuildable cache.** The
database holds the authoritative copies, so a failed reader is replaced by
synchronising a new one and no biometric data is lost with the hardware.

---

> **[DIAGRAM 4.7]** — Entity-Relationship Diagram, all fifteen tables.
>
> **[DIAGRAM 4.8]** — Class diagram of the application service layer.

---

### 4.6.4 Data dictionary

Every table, field, data type, nullability and purpose is documented in the
data dictionary presented in **Section 4.6.3 (separate document
`data-dictionary.md`, to be inserted here)**, covering all fifteen tables
across the five groups above.

Three conventions hold throughout. Every table carries a creation timestamp,
and those that can be modified carry a modification timestamp maintained by a
database trigger rather than by the application, so the value cannot be
falsified by a client. Foreign keys to reference data restrict deletion, so a
department in use cannot be removed; foreign keys to staff cascade, so removing
a staff member removes their biometric data with them. **No table stores a raw
biometric image** — only templates and embeddings, neither of which can be
reversed into the original sample.

### 4.6.5 Access control design

Access is enforced by row-level security policies evaluated by the database on
every query, rather than by the application. The full matrix is given in
**Appendix E**.

Two aspects merit emphasis. **Supervisors have no access to biometric records
at all** — they require attendance data, which does not require access to
templates or embeddings, and restricting biometrics to the smallest possible
role limits exposure. **The check-in station cannot read biometric records
either**: it holds only the public API key, and facial matching is performed by
a server-side function that receives a freshly computed embedding and returns a
decision. A compromised station therefore discloses nothing.

### 4.6.6 Attendance recording logic

Attendance recording is implemented as a single server-side function which is
the only path by which an attendance record can be created. Its logic:

1. Verify the station credential against the stored hash. Reject if invalid.
2. Verify the staff member exists and is active. Reject and log if not.
3. Determine the current date in the configured time zone.
4. Search roster entries from the previous day to the following day, so that a
   night shift in progress is found regardless of the calendar date.
5. For each candidate, compute the shift start and end as absolute times, adding
   a day to the end where the shift crosses midnight, then derive the four
   windows.
6. Select the shift whose span contains the current moment. If none, record an
   unscheduled check-in and flag it.
7. If no check-in exists, evaluate against the check-in window and classify the
   result.
8. If a check-in exists and a check-out does not, evaluate against the check-out
   window; refuse if the window has not opened and the minimum shift duration
   has not elapsed.
9. If both exist, record a duplicate attempt and refuse.
10. Record the attempt in all cases, and return a structured verdict.

---

> **[DIAGRAM 4.9]** — Activity diagram for attendance recording, following the
> ten steps above. Include the decision diamonds for credential validity, staff
> active, shift found, window state and existing record. This is the most
> important diagram in the chapter — it encodes the two rules the system rests
> on.

> **[DIAGRAM 4.10]** — Sequence diagram for UC6 (check in by fingerprint).
> Lifelines: Staff member, Kiosk (browser), Bridge, Fingerprint device,
> Database. Show the credential accompanying the attendance call, and the
> verdict returning to the display.

> **[DIAGRAM 4.11]** — Sequence diagram for the fallback path: fingerprint
> fails → face identification → ambiguous → staff number requested → one-to-one
> verification → attendance recorded. This diagram illustrates the design
> decision in 4.4.5.

---

### 4.6.7 User interface design

The system presents two interfaces with deliberately different characteristics.

**The administrative console** is designed for a seated user at approximately
50 cm, and is information-dense: a persistent navigation sidebar, tabular data,
contextual detail panels and compact type.

**The check-in station** is designed for a standing user at approximately two
metres. It has no navigation, no login and a single message at a time, in type
several times larger than the console. Outcomes are shown as a name and a status
in a form readable across a corridor, and the display clears itself after a few
seconds so that the next person does not see the previous person's name.

The same visual identity — colour, typography, iconography — is shared, but the
density differs by roughly an order of magnitude. Treating these as one design
would produce a station unusable in practice; treating them as unrelated would
produce an incoherent system.

---

> **[DIAGRAM 4.12]** — Interface wireframes: console layout (sidebar, main
> content, context rail) beside the kiosk layout (single centred message). Show
> them at relative scale to make the density difference visible.

---

## 4.7 Chapter Summary

This chapter analysed the manual register in use in the study setting and
identified eight problems arising from it. It specified twenty-nine functional
and twelve non-functional requirements for a system addressing those problems,
and presented the design of that system.

Four design decisions were justified in detail: that authority to record
attendance resides in the database rather than the client; that a local bridge
service is required because the fingerprint device is not reachable from a
browser; that multimodality is serial rather than parallel, to protect
throughput; and that ambiguous facial comparisons are refused rather than
resolved to the nearest match. The database design, access control model,
attendance recording logic and interface design were presented, together with
the diagram set documenting them.
