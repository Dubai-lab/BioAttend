# Chapter Four — diagram prompts

Twelve figures. Each prompt below is a complete specification: paste it as-is.

**Notation is stated explicitly in every prompt.** Drawing tools readily
produce something that resembles a UML or DFD diagram but breaks its rules —
a filled arrowhead where it must be hollow, a data flow between two stores,
a process with no output. Check each result against the notation named.

**Gane–Sarson is used for the data flow diagrams** (rounded rectangles for
processes, open-ended rectangles for data stores). If your department teaches
Yourdon–DeMarco, say so in the prompt and the shapes become circles and
parallel lines instead — the content is unchanged.

---

## Figure 4.1 — Activity diagram of the existing manual process

> Draw a **UML activity diagram** with three vertical swimlanes labelled "Staff
> member", "Supervisor", and "HR Officer".
>
> **Staff member lane**, top to bottom: filled circle start node → rounded
> rectangle "Arrive for shift" → "Locate departmental register" → "Write name,
> date and arrival time" → "Sign register" → rounded rectangle "Work shift" →
> diamond decision "Record departure time?" with two labelled branches: "Yes" →
> "Write departure time and sign", and "No" (annotate this branch *"frequently
> omitted"*).
>
> **Supervisor lane:** "Periodically review register" → "Countersign entries".
>
> **HR Officer lane:** "Collect registers at end of pay period" → "Transcribe
> entries to spreadsheet" → diamond "Discrepancy found?" → "Yes" → "Resolve by
> consultation with supervisor" → merge with the "No" branch → "Process
> payroll" → encircled filled circle end node.
>
> **Add a warning triangle icon at three specific actions**, each with a short
> red label:
> - at "Write name, date and arrival time" — *"time is self-reported"*
> - at "Sign register" — *"identity not verified"*
> - at "Resolve by consultation with supervisor" — *"resolved from memory"*
>
> Notation: rounded rectangles for actions, diamonds for decisions, solid
> circle for start, encircled solid circle for end, vertical swimlane dividers
> with headers. Plain white background, thin black lines, the warning
> annotations the only colour.

---

## Figure 4.2 — System architecture

> Draw a technical architecture diagram with two labelled zones separated by a
> horizontal dividing line.
>
> **Upper zone, boxed and titled "KIOSK PC (hospital premises)":**
> - A box "Browser — console and kiosk interface"
> - A box "Fingerprint bridge service (32-bit Python, port 8321)"
> - A box "Face recognition service (64-bit Python, InsightFace, port 8322)"
> - Two hardware icons outside to the right: "Fingerprint reader" and "Camera"
>
> Arrows within this zone:
> - Browser → Fingerprint bridge, labelled "HTTP loopback"
> - Browser → Face service, labelled "HTTP loopback"
> - Fingerprint bridge → Fingerprint reader, labelled "USB (mass storage)"
> - Browser → Camera, labelled "getUserMedia"
>
> **Lower zone, boxed and titled "CLOUD":**
> - A box "Static web application (Vercel)"
> - A box "PostgreSQL database and authentication (Supabase)"
>
> One arrow crossing the dividing line from Browser down to the cloud zone,
> labelled "HTTPS".
>
> **Draw a dashed rectangle around the database box only**, labelled **"Trust
> boundary — attendance authority resides here"**.
>
> **Add a note box** in a corner: *"The browser and both local services capture
> biometrics but hold no authority to record attendance."*
>
> Plain white background, thin black lines, no 3D, no gradients. One accent
> colour for the trust boundary only.

---

## Figure 4.3 — Use case diagram

> Draw a **UML use case diagram**. A large rectangle labelled "BioAttend
> System" forms the system boundary; ovals inside are use cases; stick figures
> outside are actors.
>
> **Left of the boundary — actor "Staff member"**, connected by plain
> association lines to five ovals: "Check in by fingerprint", "Check in by
> face", "Verify by staff number and face", "Check out", "View own attendance
> record".
>
> **Right of the boundary — two actors, one above the other.**
> "Departmental supervisor" connects to: "View live attendance", "Assign
> shift", "Approve exception", "Export records".
> "Administrator (HR)" connects to: "Enrol staff member", "Capture
> fingerprint", "Capture face", "Synchronise reader", "Manage console users",
> "Register check-in station", "Configure thresholds and shift windows".
>
> **A generalisation relationship from "Administrator (HR)" to "Departmental
> supervisor"** — a solid line with a **hollow (unfilled) triangular
> arrowhead** pointing at the supervisor, indicating the administrator inherits
> all supervisor capabilities.
>
> **Below the boundary — secondary actor "Check-in station (device)"**,
> connected to the four staff check-in use cases.
>
> **Attach a UML note (rectangle with folded corner) to the Staff member actor**
> containing: *"Staff have no user accounts and never authenticate. Identity is
> established biometrically at a registered station."*
>
> Notation: ovals for use cases, stick figures for actors, solid lines for
> associations, hollow triangle for generalisation, folded-corner rectangle for
> notes. Plain white background.

---

## Figure 4.4 — Context diagram (DFD level 0)

> Draw a **context-level data flow diagram in Gane–Sarson notation**.
>
> **A single process** in the centre: a rounded rectangle divided by a
> horizontal line, with "0" in the upper section and "BioAttend Attendance and
> Shift Management System" in the lower section.
>
> **Five external entities** as plain squares arranged around it:
> - "Staff member" (left)
> - "Departmental supervisor" (upper right)
> - "Administrator / HR" (lower right)
> - "Fingerprint reader" (lower left)
> - "Camera" (upper left)
>
> **Labelled data flows as arrows:**
>
> Staff member → System: *"biometric presentation"*, *"staff number (fallback
> only)"*
> System → Staff member: *"attendance verdict"*, *"own attendance record"*
>
> Fingerprint reader → System: *"fingerprint template, match slot and score"*
> System → Fingerprint reader: *"template synchronisation"*
>
> Camera → System: *"captured frame"*
>
> Supervisor → System: *"shift assignments"*, *"exception approvals"*
> System → Supervisor: *"departmental attendance reports"*
>
> Administrator → System: *"staff records"*, *"biometric enrolment"*,
> *"configuration"*
> System → Administrator: *"hospital-wide reports"*, *"audit trail"*
>
> **Add a note:** *"No credential flows from the staff member — staff have no
> accounts."*
>
> Notation: rounded rectangle with a numbered upper band for the process,
> plain squares for external entities, single-headed labelled arrows for data
> flows. **No data stores appear at context level.** Plain white background,
> thin black lines.

---

## Figure 4.5 — Data flow diagram, level 1

> Draw a **level-1 data flow diagram in Gane–Sarson notation** decomposing a
> single system into six processes and six data stores.
>
> **Six processes**, each a rounded rectangle with a numbered upper band:
> - 1.0 Enrol staff
> - 2.0 Manage roster
> - 3.0 Capture attendance
> - 4.0 Review and approve
> - 5.0 Report and export
> - 6.0 Administer system
>
> **Six data stores**, each an open-ended rectangle (closed on the left with an
> identifier band, open on the right):
> - D1 Staff records
> - D2 Biometric templates and embeddings
> - D3 Shift roster
> - D4 Attendance records
> - D5 Recognition attempt log
> - D6 Configuration
>
> **Four external entities** as plain squares: "Staff member", "Supervisor",
> "Administrator", "Biometric devices".
>
> **Data flows:**
>
> Administrator → 1.0; 1.0 → D1 *"staff record"*; 1.0 → D2 *"templates and
> embeddings"*; Biometric devices → 1.0 *"captured biometrics"*
>
> Supervisor → 2.0 *"shift assignment"*; 2.0 → D3; D1 → 2.0 *"active staff"*
>
> Staff member → 3.0 *"biometric presentation"*; Biometric devices → 3.0
> *"template / embedding"*; **D2 → 3.0** *"enrolled biometrics (read only)"*;
> D3 → 3.0 *"shift for date"*; D6 → 3.0 *"thresholds and windows"*;
> **3.0 → D4** *"attendance record"*; **3.0 → D5** *"every attempt, including
> refusals"*; 3.0 → Staff member *"verdict"*
>
> D4 → 4.0 *"flagged records"*; Supervisor ↔ 4.0 *"approval"*; 4.0 → D4
> *"approval, times unchanged"*
>
> D4 → 5.0; D5 → 5.0; 5.0 → Supervisor and Administrator *"reports and
> exports"*
>
> Administrator → 6.0; 6.0 → D6
>
> **Emphasise two flows visually** (thicker line or accent colour) and label
> them in a legend:
> - **D2 → 3.0 is read-only** — attendance capture never writes to enrolment
> - **3.0 → D5 occurs on every path**, including refusals
>
> Notation: numbered rounded rectangles for processes, open-ended rectangles
> for data stores, plain squares for external entities, labelled single-headed
> arrows. **No flow may connect two data stores directly, or two external
> entities directly** — every flow passes through a process. Landscape
> orientation, plain white background.

---

## Figure 4.6 — Data flow diagram, level 2 (process 3.0)

> Draw a **level-2 data flow diagram in Gane–Sarson notation** decomposing
> process 3.0 "Capture attendance" into six sub-processes.
>
> **Six sub-processes**, rounded rectangles with numbered upper bands:
> - 3.1 Identify by fingerprint
> - 3.2 Identify by face
> - 3.3 Verify asserted identity
> - 3.4 Validate against shift window
> - 3.5 Record attendance
> - 3.6 Log attempt
>
> **Data stores** (open-ended rectangles): D2 Biometric templates, D3 Shift
> roster, D4 Attendance records, D5 Attempt log, D6 Configuration.
>
> **External entity:** "Staff member".
>
> **Flows:**
>
> Staff member → 3.1 *"fingerprint"*; D2 → 3.1 *"templates"*;
> 3.1 → 3.4 *"staff identity, match score"*;
> **3.1 → 3.2** *"no match — fall through"*
>
> Staff member → 3.2 *"face"*; D2 → 3.2 *"embeddings"*;
> 3.2 → 3.4 *"staff identity, similarity"*;
> **3.2 → 3.3** *"ambiguous — margin not met"*
>
> Staff member → 3.3 *"staff number"*; D2 → 3.3 *"that person's embeddings"*;
> 3.3 → 3.4 *"verified identity"*
>
> D3 → 3.4 *"shift for date"*; D6 → 3.4 *"window configuration"*;
> 3.4 → 3.5 *"accepted, with classification"*;
> **3.4 → 3.6** *"refused, with reason"*
>
> 3.5 → D4 *"attendance record"*; 3.5 → 3.6 *"outcome"*;
> 3.6 → D5 *"attempt"*;
> 3.5 → Staff member *"verdict"*
>
> **Annotate the 3.2 → 3.3 flow** with a note: *"The system refuses to name
> anyone when two candidates score within the configured margin."*
>
> Notation as Figure 4.5. Arrange so the fall-through path 3.1 → 3.2 → 3.3
> reads clearly as a cascade. Plain white background.

---

## Figure 4.7 — Entity Relationship Diagram

> Draw an **Entity Relationship Diagram in crow's foot notation** for a
> PostgreSQL schema of fifteen tables. Each entity is a rectangle with the
> table name in a header band and its key attributes listed below, marking
> **PK** for primary keys, **FK** for foreign keys and **U** for unique
> constraints.
>
> **Reference tables, top row:**
> - `departments` — id PK, code U, name, is_clinical
> - `job_titles` — id PK, title U, category
> - `shifts` — id PK, code U, name, starts_at, ends_at, crosses_midnight,
>   checkin_opens_before_min, checkin_grace_after_min,
>   checkout_opens_before_min, checkout_closes_after_min
> - `hospital_settings` — id PK, timezone, face_match_threshold,
>   face_match_margin, fingerprint_min_quality
>
> **Centre:** `staff` — id PK, staff_no U, full_name, department_id FK,
> job_title_id FK, status, consent_given, fingerprints_enrolled, face_enrolled
>
> **Below staff:**
> - `fingerprint_templates` — id PK, staff_id FK, finger, template, quality
> - `face_embeddings` — id PK, staff_id FK, embedding VECTOR(512), angle,
>   quality
>
> **Left group:**
> - `readers` — id PK, label, capacity, last_synced_at
> - `reader_slots` — reader_id FK PK, slot_id PK, template_id FK, staff_id FK
> - `kiosks` — id PK, code U, token_hash, reader_id FK
>
> **Right group:**
> - `shift_assignments` — id PK, staff_id FK, shift_id FK, shift_date
> - `attendance` — id PK, staff_id FK, shift_date, shift_id FK,
>   department_id FK, check_in_at, check_in_status, check_out_at,
>   requires_approval, approved_by FK
> - `attendance_attempts` — id PK, staff_id FK, kiosk_id FK, method,
>   confidence, decision, occurred_at
>
> **Corner:** `profiles` — id PK, full_name, email, role, department_id FK;
> and `audit_log` — id PK, actor_id FK, action, entity, occurred_at
>
> **Relationships with crow's foot cardinality:**
> one `departments` to many `staff`; one `job_titles` to many `staff`; one
> `staff` to many `fingerprint_templates`, `face_embeddings`,
> `shift_assignments`, `attendance`, `attendance_attempts`, `reader_slots`;
> one `shifts` to many `shift_assignments` and `attendance`; one `readers` to
> many `reader_slots` and `kiosks`; one `kiosks` to many `attendance_attempts`;
> one `profiles` to many `audit_log` and approved `attendance`.
>
> **Add two callout annotations:**
> - on `attendance`: *"UNIQUE (staff_id, shift_date) — one record per person
>   per shift day"*
> - on `fingerprint_templates`: *"UNIQUE (staff_id, finger) — re-capture
>   replaces rather than duplicates"*
>
> Landscape orientation, plain white background, thin black lines. Legibility
> matters more than compactness — this is a full-page technical figure.

---

## Figure 4.8 — Class diagram

> Draw a **UML class diagram** of an application service layer. Each class is a
> rectangle in three compartments: class name, attributes, operations. Mark
> visibility with `+` for public and `-` for private.
>
> **Classes:**
>
> `FingerprintBridge` — attributes: `-baseUrl: string`. Operations:
> `+connect(): DeviceStatus`, `+enrollFinger(passes): Template`,
> `+identify(): MatchResult`, `+sync(templates): SyncResult`
>
> `FaceService` — attributes: `-baseUrl: string`, `-model: string`. Operations:
> `+embed(frame): Embedding`, `+health(): ServiceHealth`
>
> `LivenessEngine` — operations: `+checkLiveness(frame): LivenessResult`
>
> `EnrolmentService` — operations: `+createStaff(details): Staff`,
> `+saveTemplate(staffId, template)`, `+saveEmbedding(staffId, embedding)`
>
> `AttendanceService` — operations: `+recordAttendance(credential, staffId,
> method, score): Verdict`, `+approveException(recordId, note)`
>
> `RosterService` — operations: `+assignShift(staffId, shiftId, date)`,
> `+shiftsForDate(date): Assignment[]`
>
> `AuditService` — operations: `+record(action, entity, detail)`
>
> **Relationships**, all dashed lines with **open (line) arrowheads** denoting
> dependency:
> - `EnrolmentService` → `FingerprintBridge`, `FaceService`, `LivenessEngine`,
>   `AuditService`
> - `AttendanceService` → `FingerprintBridge`, `FaceService`, `LivenessEngine`,
>   `AuditService`
> - `RosterService` → `AuditService`
>
> Notation: three-compartment rectangles, dashed lines with open arrowheads for
> dependencies. Plain white background, thin black lines.

---

## Figure 4.9 — Activity diagram, attendance recording

> Draw a **UML activity diagram** for a server-side function, laid out
> vertically.
>
> Filled circle start node, then:
>
> 1. Action "Verify station credential against stored hash" → diamond "Valid?"
>    → branch **"No"** → end node **"REJECT — invalid station"**
> 2. Branch **"Yes"** → action "Look up staff member" → diamond "Staff active?"
>    → **"No"** → end node **"REJECT — inactive staff"**
> 3. **"Yes"** → action "Search roster from previous day to next day, so a
>    night shift in progress is found" → diamond "Shift found?" → **"No"** →
>    end node **"RECORD as unscheduled — FLAG for supervisor"**
> 4. **"Yes"** → action "Compute check-in and check-out windows from shift
>    times" → diamond "Check-in already recorded?"
> 5. **"No"** branch → diamond "Current time within check-in window?" with
>    three outgoing branches:
>    - **"Before window"** → end node "REJECT — too early"
>    - **"Within window"** → end node "RECORD check-in — on time or late"
>    - **"After grace period"** → end node "RECORD check-in — late, FLAG for
>      supervisor"
> 6. **"Yes"** branch → diamond "Check-out already recorded?" → **"Yes"** → end
>    node "REJECT — duplicate"
> 7. **"No"** → diamond "Within check-out window?" → **"No"** → end node
>    "REJECT — window closed"; **"Yes"** → end node "RECORD check-out"
>
> **Attach one UML note (folded-corner rectangle)** to the diagram as a whole
> reading: *"Every outcome, including every rejection, is written to the
> attempt log."*
>
> Notation: rounded rectangles for actions, diamonds for decisions with labelled
> outgoing branches, filled circle start, encircled filled circle for each end
> node. Plain white background. This diagram is detailed — allow a full page.

---

## Figure 4.10 — Sequence diagram, fingerprint check-in

> Draw a **UML sequence diagram** with five lifelines, left to right: "Staff
> member" (stick figure actor), "Kiosk (browser)", "Fingerprint bridge",
> "Reader (device)", "Database". Vertical dashed lifelines with activation bars.
>
> Messages in order — solid arrows for calls, dashed arrows for returns:
>
> 1. Staff member → Kiosk: **present finger**
> 2. Kiosk → Fingerprint bridge: **identify()**
> 3. Fingerprint bridge → Reader: **capture image, extract features, search
>    library**
> 4. Reader ⇢ Fingerprint bridge: **slot number, match score**
> 5. Fingerprint bridge ⇢ Kiosk: **slot, score**
> 6. Kiosk → Database: **resolve slot to staff member**
> 7. Database ⇢ Kiosk: **staff identifier**
> 8. Kiosk → Database: **record_attendance(station credential, staff id,
>    method, score)** — draw this arrow **thicker or in an accent colour**
> 9. Database → Database (self-message loop): **verify credential; resolve
>    shift; evaluate window; write record and attempt**
> 10. Database ⇢ Kiosk: **verdict**
> 11. Kiosk → Staff member: **display name, status, time**
> 12. Kiosk → Kiosk (self-message): **clear display after 5 seconds**
>
> **Attach a UML note to message 8** reading: *"The station credential travels
> with every attendance write. Without it the database refuses the record."*
>
> Notation: rectangles at the top of each lifeline, dashed vertical lifelines,
> narrow activation rectangles, solid arrows for synchronous calls, dashed
> arrows for returns, self-messages as looping arrows. Plain white background.

---

## Figure 4.11 — Sequence diagram, fallback path

> Draw a **UML sequence diagram** with six lifelines, left to right: "Staff
> member" (actor), "Kiosk (browser)", "Fingerprint bridge", "Liveness engine",
> "Face service", "Database".
>
> Messages in order:
>
> 1. Staff member → Kiosk: **present finger**
> 2. Kiosk → Fingerprint bridge: **identify()**
> 3. Fingerprint bridge ⇢ Kiosk: **no match** — mark this return in a warning
>    colour
> 4. Kiosk → Liveness engine: **checkLiveness(frame)**
> 5. Liveness engine ⇢ Kiosk: **live face confirmed**
> 6. Kiosk → Face service: **embed(frame)**
> 7. Face service ⇢ Kiosk: **512-dimension embedding**
> 8. Kiosk → Database: **identify_face(embedding)**
> 9. Database ⇢ Kiosk: **ambiguous — margin not met** — mark this return in a
>    warning colour
> 10. Kiosk → Staff member: **prompt for staff number**
> 11. Staff member → Kiosk: **enter staff number**
> 12. Kiosk → Face service: **embed(frame)** ⇢ **embedding**
> 13. Kiosk → Database: **verify_face_by_staff_no(number, embedding)**
> 14. Database ⇢ Kiosk: **verified, staff identifier**
> 15. Kiosk → Database: **record_attendance(credential, staff id, face, score)**
> 16. Database ⇢ Kiosk: **verdict** → Kiosk → Staff member: **display outcome**
>
> **Attach a UML note to message 9** reading: *"Two enrolled people scored
> within the configured margin. The system named nobody and asked instead."*
>
> Notation as Figure 4.10. This diagram is tall — allow a full page and keep
> the messages legible.

---

## Figure 4.12 — Interface wireframes

> Draw two low-fidelity wireframes **side by side at the same scale**, so the
> difference in information density is immediately visible.
>
> **Left, captioned "Administrative console — read at approximately 50 cm":**
> A dark narrow sidebar down the left with a small logo at the top and about
> ten small navigation labels grouped under three headings. A wide main area
> containing: a page heading, a row of four small summary tiles, and a data
> table of six rows and five columns with small text. A narrow panel on the
> right with two stacked information cards. All type small and dense.
>
> **Right, captioned "Check-in station — read at approximately 2 m":**
> No sidebar. No navigation. A single large circular icon centred in the upper
> half. Below it one very large line of text reading "Place your finger", and
> beneath that one smaller line "Hold it flat on the reader". A small clock in
> the top right corner. Nothing else on the screen.
>
> Use grey placeholder bars for body text rather than lorem ipsum. Draw both
> frames the same physical size so the type-size contrast is apparent.
>
> Plain white background, thin outlines, greyscale only. The density contrast
> is the entire purpose of the figure.

---

## Checking the output

| Figure | Most common error to check for |
|---|---|
| 4.1 | Swimlanes missing, or the three warning annotations dropped |
| 4.2 | Trust boundary drawn around everything instead of the database only |
| 4.3 | Generalisation arrowhead filled instead of hollow |
| 4.4 | Data stores appearing — they must not exist at context level |
| 4.5 | A flow drawn directly between two data stores |
| 4.6 | The cascade 3.1 → 3.2 → 3.3 not reading as a fall-through |
| 4.7 | Cardinality symbols omitted, or the two UNIQUE callouts dropped |
| 4.8 | Solid arrows used where dependencies must be dashed |
| 4.9 | A branch that does not terminate in an end node |
| 4.10 | The credential on message 8 not emphasised |
| 4.11 | The "ambiguous" return not marked |
| 4.12 | Drawn at different scales, destroying the comparison |
