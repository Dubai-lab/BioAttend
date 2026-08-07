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

| ID | Requirement | Priority |
|---|---|---|
| **Staff and enrolment** | | |
| FR1 | The system shall allow an administrator to register a staff member with biographic details, department and job title. | High |
| FR2 | The system shall record biometric consent before permitting any biometric capture, and shall prevent capture until consent is recorded. | High |
| FR3 | The system shall capture and store fingerprint templates for up to four fingers per staff member. | High |
| FR4 | The system shall reject a fingerprint capture whose quality falls below a configured minimum. | High |
| FR5 | The system shall capture and store facial embeddings from five head positions per staff member. | High |
| FR6 | The system shall verify that a requested head position was achieved before accepting a facial capture. | Medium |
| FR7 | The system shall reject a facial capture that fails anti-spoofing or liveness checks. | High |
| FR8 | The system shall allow biometrics to be added to or replaced on an existing staff record without recreating it. | High |
| FR9 | The system shall allow a staff member to be deactivated, after which they cannot record attendance, while retaining their attendance history. | High |
| **Rostering** | | |
| FR10 | The system shall allow shifts to be assigned to staff for specific dates. | High |
| FR11 | The system shall permit at most one shift assignment per staff member per date. | High |
| **Attendance** | | |
| FR12 | The system shall identify a staff member from a presented fingerprint. | High |
| FR13 | The system shall identify a staff member from a presented face when fingerprint identification does not succeed. | High |
| FR14 | The system shall refuse to identify when two enrolled individuals score within a configured margin of each other. | High |
| FR15 | The system shall allow a staff member to assert identity by staff number and confirm it by one-to-one facial verification. | High |
| FR16 | The system shall record a check-in when the current time falls within the check-in window of the staff member's shift. | High |
| FR17 | The system shall record a check-out when the current time falls within the check-out window. | High |
| FR18 | The system shall refuse a scan outside both windows and record the refused attempt. | High |
| FR19 | The system shall classify each check-in as on time, late, late beyond grace, or unscheduled. | High |
| FR20 | The system shall record every recognition attempt, including refused ones, with its match score and outcome. | High |
| FR21 | The system shall accept attendance only from a registered check-in station presenting a valid credential. | High |
| **Review and reporting** | | |
| FR22 | The system shall display current attendance, updated without user action. | Medium |
| FR23 | The system shall present flagged records for supervisor approval, recording who approved and when without altering captured times. | High |
| FR24 | The system shall export attendance records and recognition attempts in a portable format. | High |
| **Administration** | | |
| FR25 | The system shall allow an administrator to create console users with a role and, for supervisors, a department. | High |
| FR26 | The system shall allow registration of check-in stations and rotation of their credentials. | High |
| FR27 | The system shall allow configuration of shift windows and matching thresholds. | High |
| FR28 | The system shall record administrative actions in an append-only audit log, excluding biometric payloads. | Medium |
| FR29 | The system shall synchronise stored fingerprint templates to a reader device and maintain the mapping between device storage slots and staff. | High |

### 4.5.2 Non-functional requirements

| ID | Requirement | Measure |
|---|---|---|
| NFR1 | **Response time.** A fingerprint identification shall complete within 3 seconds of presentation. | Measured at the station |
| NFR2 | **Throughput.** The system shall support a shift change in which staff arrive in rapid succession without queuing at the station. | Transactions per minute |
| NFR3 | **Accuracy.** False acceptance shall be prioritised over false rejection in threshold selection. | FAR, FRR from measured data |
| NFR4 | **Availability.** Failure of the local bridge shall not prevent the administrative console from operating. | Console functions independently |
| NFR5 | **Security.** Biometric records shall be accessible only to administrators, enforced at the database. | Row-level security policies |
| NFR6 | **Security.** Attendance shall not be recordable without a station credential. | No insert permission on the table |
| NFR7 | **Privacy.** No fingerprint image or facial photograph shall be stored. | Templates and embeddings only |
| NFR8 | **Usability.** A normal check-in shall require exactly one action from the staff member. | Observed |
| NFR9 | **Legibility.** The station display shall be readable from two metres. | Type size and contrast |
| NFR10 | **Auditability.** Recorded attendance times shall not be modifiable through the application. | No update path for times |
| NFR11 | **Maintainability.** The database schema shall be defined in versioned migration files. | Migrations under version control |
| NFR12 | **Recoverability.** Loss of a reader device shall not lose biometric data. | Templates held in the database |

## 4.6 System Design

### 4.6.1 Use case model

**Actors**

| Actor | Description |
|---|---|
| Staff member | Records attendance. Has no account and cannot sign in. |
| Departmental supervisor | Reviews attendance and approves exceptions for their own department. |
| Administrator (HR) | Enrols staff, captures biometrics, configures the system, manages access. |
| Check-in station | A registered device that submits attendance events. Authenticates as a device, not a person. |
| Biometric bridge | Local service mediating access to the fingerprint device. |

**Principal use cases**

| ID | Use case | Primary actor |
|---|---|---|
| UC1 | Enrol staff member | Administrator |
| UC2 | Capture fingerprint | Administrator |
| UC3 | Capture face | Administrator |
| UC4 | Synchronise reader | Administrator |
| UC5 | Assign shift | Supervisor / Administrator |
| UC6 | Check in by fingerprint | Staff member |
| UC7 | Check in by face | Staff member |
| UC8 | Verify by staff number and face | Staff member |
| UC9 | Check out | Staff member |
| UC10 | View live attendance | Supervisor / Administrator |
| UC11 | Approve exception | Supervisor / Administrator |
| UC12 | Export records | Supervisor / Administrator |
| UC13 | Manage console users | Administrator |
| UC14 | Register check-in station | Administrator |
| UC15 | Configure thresholds and windows | Administrator |

---

> **[DIAGRAM 4.3]** — Use case diagram. Place *Staff member* on the left with
> UC6–UC9; *Supervisor* and *Administrator* on the right, with Administrator
> inheriting Supervisor's cases. Show *Check-in station* as a secondary actor on
> UC6–UC9. Note that Staff member has no login — worth annotating, since it is
> unusual and deliberate.

---

**Use case specification — UC6: Check in by fingerprint**

| Field | Description |
|---|---|
| Actor | Staff member |
| Precondition | Staff member enrolled and active; templates synchronised to the reader; station registered; bridge running |
| Trigger | Staff member places a finger on the sensor |
| Main flow | 1. Station captures the fingerprint image. 2. Bridge extracts features and searches the device library. 3. Device returns a storage slot and match score. 4. Station resolves the slot to a staff member. 5. Station submits the event with its station credential. 6. Server verifies the credential. 7. Server resolves the shift for the current moment. 8. Server evaluates the time against the check-in window. 9. Server records the check-in with its classification. 10. Station displays the outcome and clears. |
| Alternative — no match | Proceed to UC7 (face). |
| Alternative — outside window | Server refuses, records the attempt, station explains when the window opens. |
| Alternative — no roster entry | Record created and flagged as unscheduled. |
| Alternative — inactive staff | Refused; attempt recorded. |
| Postcondition | An attendance record exists, or a refused attempt is logged. |

### 4.6.2 Database design

The database comprises fifteen tables in five groups.

**Reference data**

| Table | Purpose |
|---|---|
| `departments` | Hospital departments |
| `job_titles` | Job titles grouped by category |
| `shifts` | Shift definitions with window configuration |
| `hospital_settings` | Single-row institution configuration including thresholds |

**People**

| Table | Purpose |
|---|---|
| `staff` | Staff members. Deliberately not linked to authentication. |
| `profiles` | Console users, linked to authentication accounts |

**Biometrics**

| Table | Purpose |
|---|---|
| `fingerprint_templates` | Templates, one per finger per staff member |
| `face_embeddings` | Facial embeddings, one per head position per staff member |

**Devices**

| Table | Purpose |
|---|---|
| `readers` | Fingerprint devices |
| `reader_slots` | Mapping from device storage slot to staff member |
| `kiosks` | Check-in stations and their credential hashes |

**Operations**

| Table | Purpose |
|---|---|
| `shift_assignments` | Roster: one shift per staff member per date |
| `attendance` | One record per staff member per shift date |
| `attendance_attempts` | Every recognition attempt, including refusals |
| `audit_log` | Administrative actions |

**Design notes**

*Attendance as a single row per shift date.* Check-in and check-out are columns
on one row rather than separate event rows, with a uniqueness constraint on
(staff member, shift date). "Already checked in today" is therefore a property
of the schema rather than a query result, and duplicate check-ins are prevented
by the database.

*Separation of attempts from records.* `attendance_attempts` records every scan
including refusals. This serves two purposes: it provides evidence when a staff
member disputes that the system failed to record them, and it constitutes the
dataset from which the accuracy figures in Chapter Five are computed. Refused
attempts appear nowhere else and are precisely the data required to compute a
false rejection rate.

*Slot mapping as a rebuildable cache.* The device stores a limited number of
templates internally and returns a slot number on a match. `reader_slots` maps
slots to staff. Because the database holds the authoritative templates, a failed
device is replaced by synchronising a new one; no biometric data is lost with
the hardware.

*Storage of face embeddings.* Embeddings are stored in a vector column with a
cosine-distance index, allowing similarity search to be performed by the
database rather than the client — necessary because the client is not permitted
to read biometric records at all.

---

> **[DIAGRAM 4.4]** — Entity-Relationship Diagram. Show all fifteen tables with
> primary and foreign keys and cardinalities. Suggested layout: reference data
> at the top, `staff` central, biometric tables below it, device tables to one
> side, and the operational tables (`shift_assignments`, `attendance`,
> `attendance_attempts`) to the other. Mark the unique constraints on
> (staff, shift_date) and (staff, finger).

> **[DIAGRAM 4.5]** — Class Diagram of the application layer. Suggested
> classes: `FingerprintReader`, `FaceEngine`, `AttendanceService`,
> `EnrolmentService`, `RosterService`, `AuditService`, with their principal
> methods and relationships.

---

### 4.6.3 Access control design

Access control is enforced by row-level security policies evaluated by the
database on every query, rather than by the application.

| Table | Administrator | Supervisor | Station (anonymous) |
|---|---|---|---|
| `staff` | Read/write all | Read own department | None |
| `fingerprint_templates` | Read/write | **None** | None |
| `face_embeddings` | Read/write | **None** | None |
| `attendance` | Read all, approve | Read own department, approve | **No insert** — function only |
| `attendance_attempts` | Read all | Read own department | None |
| `kiosks` | Read/write | None | None |
| `audit_log` | Read all | Read own entries | None |
| `hospital_settings` | Read/write | Read | None |

Two aspects merit note.

**Supervisors have no access to biometric records at all.** They require
attendance data for their staff, which does not require access to templates or
embeddings. Restricting biometric access to the smallest possible role limits
exposure.

**The check-in station cannot read biometric records either.** It holds only the
public API key. Facial matching is therefore performed by a server-side function
that receives a freshly computed embedding and returns a decision — the station
never receives another person's biometric data. A compromised station discloses
nothing.

### 4.6.4 Attendance recording logic

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

> **[DIAGRAM 4.6]** — Activity diagram for attendance recording, following the
> ten steps above. Include the decision diamonds for credential validity, staff
> active, shift found, window state and existing record. This is the most
> important diagram in the chapter — it encodes the two rules the system rests
> on.

> **[DIAGRAM 4.7]** — Sequence diagram for UC6 (check in by fingerprint).
> Lifelines: Staff member, Kiosk (browser), Bridge, Fingerprint device,
> Database. Show the credential accompanying the attendance call, and the
> verdict returning to the display.

> **[DIAGRAM 4.8]** — Sequence diagram for the fallback path: fingerprint
> fails → face identification → ambiguous → staff number requested → one-to-one
> verification → attendance recorded. This diagram illustrates the design
> decision in 4.4.5.

---

### 4.6.5 User interface design

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

> **[DIAGRAM 4.9]** — Interface wireframes: console layout (sidebar, main
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
