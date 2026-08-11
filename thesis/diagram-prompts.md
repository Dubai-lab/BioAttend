# Ready-to-paste diagram prompts

One prompt per figure. Paste into an AI drawing tool, or use as a specification
if drawing by hand in draw.io.

**Before you start, three notes.**

**Charts must come from your data, not a drawing tool.** Figures 5.2, 5.3 and
5.4 plot measurements you have collected. Build those in Excel from the
exported CSV. A drawn approximation of real data is misrepresentation, and an
examiner can tell the difference immediately.

**UML notation is not decorative.** Where a figure is specified as a UML
diagram, the prompt states the notation explicitly (hollow triangle for
generalisation, crow's foot for cardinality, diamond decision nodes). Tools
often produce something that looks plausible but is not valid UML. Check the
output against the notation named in the prompt.

**Every figure needs a caption and a mention in the text.** A figure nobody
references reads as padding.

---

## Figure 1.1 — Conceptual overview

> Draw a simple three-stage block diagram for the opening chapter of a thesis.
>
> **Left:** an icon of a person, labelled "Hospital staff member".
> **Centre:** two stacked boxes labelled "Fingerprint reader" and "Camera",
> grouped inside a larger box labelled "Check-in station".
> **Right:** a box labelled "Attendance record", with a smaller box beneath it
> labelled "Validated against shift roster" connected by a short upward arrow.
>
> Arrows left to right between the three stages.
>
> Style: clean, minimal, plain white background, thin lines, no colour beyond a
> single accent. This is an introductory overview, not a technical
> architecture — keep it deliberately simple.

---

## Figure 2.1 — Genuine and impostor score distributions

> Draw a clean academic figure showing two overlapping probability distribution
> curves on a single set of axes.
>
> **X-axis:** "Match score", 0 to 1. **Y-axis:** "Frequency".
>
> **Left curve:** bell curve centred at about 0.3, labelled "Impostor
> comparisons". **Right curve:** bell curve centred at about 0.75, labelled
> "Genuine comparisons". The curves must **visibly overlap** between roughly
> 0.45 and 0.6 — the overlap is the most important feature.
>
> **A vertical dashed line** at about 0.55, labelled "Threshold t".
>
> **Shade and label two regions:** the impostor curve to the **right** of the
> line as "False Acceptance (FAR)", and the genuine curve to the **left** of
> the line as "False Rejection (FRR)".
>
> Below the axis, a horizontal double-headed arrow labelled "Moving t right
> reduces FAR and increases FRR".
>
> Two distinguishable colours, darker tones for the shaded regions, a legend.
> Plain white background, thin black axes, no 3D.

---

## Figure 2.2 — Conceptual framework

> Draw a conceptual framework diagram in the standard
> independent–moderating–dependent layout.
>
> **Top, centred:** rectangle "HOSPITAL CONTEXT (Moderating variables)"
> containing: occupational hand condition; ambient lighting; shift structure
> including shifts crossing midnight; enrolled population size; staff attitudes
> toward biometric monitoring.
>
> **Bottom left:** rectangle "SYSTEM DESIGN CHARACTERISTICS (Independent
> variables)" containing: biometric modality configuration (unimodal vs. serial
> multimodal); matching mode (identification vs. verification); decision policy
> under ambiguity (nearest match vs. refusal); shift-context validation;
> station authorisation.
>
> **Bottom right:** rectangle "ATTENDANCE RECORD QUALITY (Dependent variables)"
> containing: attribution accuracy; inclusiveness; shift validity; integrity;
> throughput.
>
> **Arrows:** a thick horizontal arrow from bottom-left to bottom-right box; a
> vertical arrow from the top box pointing **down onto the middle of that
> horizontal arrow**, not into either box, labelled "moderates".
>
> Beneath, in italics: "Theoretical lenses: Task–Technology Fit (Goodhue &
> Thompson, 1995); Technology Acceptance Model (Davis, 1989)".
>
> Plain white background, thin black borders, minimal or no fill, left-aligned
> text in boxes. Academic figure, not an infographic.

---

## Figure 3.1 — Iterative development cycle

> Draw a circular process diagram with four stages arranged clockwise:
> "Design", "Implement", "Test", "Evaluate", connected by curved arrows, with a
> return arrow from Evaluate back to Design closing the loop.
>
> **Two callout boxes** attached to the return arrow with leader lines:
> - "Iteration 2 — device interface assumption falsified"
> - "Iteration 6 — face matching mode revised after false accept"
>
> Plain white background, thin lines, one accent colour. Academic figure.

---

## Figure 4.1 — Existing manual process

> Draw a **UML activity diagram** with three vertical swimlanes: "Staff
> member", "Supervisor", "HR Officer".
>
> **Staff member lane:** solid start node → "Arrive for shift" → "Locate
> departmental register" → "Write name, date and arrival time" → "Sign" →
> [end of shift] → decision diamond "Record departure time?" with branches
> "Yes" → "Write departure time and sign", and "No — frequently omitted".
>
> **Supervisor lane:** "Periodically review register" → "Countersign".
>
> **HR Officer lane:** "Collect registers at pay period" → "Transcribe to
> spreadsheet" → decision diamond "Discrepancy?" → "Yes" → "Resolve by
> consultation from memory" → merge → "Process payroll" → end node.
>
> **Add a warning triangle icon at three points**, each with a short label:
> at "Write name, date and arrival time" — *"self-reported"*; at "Sign" —
> *"identity not verified"*; at "Resolve from memory" — *"no record"*.
>
> Standard UML activity notation: rounded rectangles for actions, diamonds for
> decisions, solid circle for start, encircled solid circle for end.

---

## Figure 4.2 — System architecture

> Draw a deployment/block architecture diagram with two zones.
>
> **Upper zone, boxed and labelled "KIOSK PC":** a box "Browser (console and
> kiosk interface)"; a box "Fingerprint bridge service (32-bit Python, port
> 8321)"; a box "Face recognition service (64-bit Python, InsightFace, port
> 8322)". Outside to the right, two hardware icons: "Fingerprint reader" and
> "Camera".
>
> Arrows: Browser → Fingerprint bridge labelled "HTTP (loopback)"; Browser →
> Face service labelled "HTTP (loopback)"; Fingerprint bridge → reader labelled
> "USB"; Browser → camera labelled "getUserMedia".
>
> **Lower zone, boxed and labelled "CLOUD":** a box "Static site (Vercel)" and
> a box "Database and authentication (Supabase)".
>
> Arrow from Browser down to the cloud zone labelled "HTTPS".
>
> **Draw a dashed rectangle around the database box only**, labelled **"Trust
> boundary — attendance authority"**. Add a note: "Browser and local services
> hold no authority to record attendance."
>
> Plain, technical, no 3D, minimal colour.

---

## Figure 4.3 — Use case diagram

> Draw a **UML use case diagram**. A large rectangle labelled "BioAttend
> System" contains oval use cases; actors are stick figures outside it.
>
> **Left actor:** "Staff member", connected to: "Check in by fingerprint",
> "Check in by face", "Verify by staff number and face", "Check out", "View own
> attendance record".
>
> **Right actors:** "Departmental supervisor" connected to "View live
> attendance", "Assign shift", "Approve exception", "Export records". And
> "Administrator (HR)" connected to "Enrol staff member", "Capture
> fingerprint", "Capture face", "Synchronise reader", "Manage console users",
> "Register check-in station", "Configure thresholds and windows".
>
> **A generalisation arrow (hollow triangle head) from Administrator to
> Supervisor**, indicating the administrator inherits all supervisor use cases.
>
> **Bottom, secondary actor:** "Check-in station (device)" connected to the four
> staff check-in use cases.
>
> **Add a note box attached to the Staff member actor reading: "No login — staff
> have no accounts."**
>
> Standard UML use case notation: ovals for use cases, stick figures for
> actors, solid lines for associations, hollow triangle for generalisation.

---

## Figure 4.4 — Entity Relationship Diagram

> Draw an **Entity Relationship Diagram in crow's foot notation** for a
> PostgreSQL schema of fifteen tables. Each entity is a rectangle with its name
> in a header band and its key attributes listed, marking PK and FK.
>
> **Reference tables (top row):** `departments` (id PK, code, name,
> is_clinical); `job_titles` (id PK, title, category); `shifts` (id PK, code,
> name, starts_at, ends_at, crosses_midnight, window settings);
> `hospital_settings` (id PK, timezone, face_match_threshold,
> face_match_margin).
>
> **Centre:** `staff` (id PK, staff_no UNIQUE, full_name, department_id FK,
> job_title_id FK, status, consent_given, fingerprints_enrolled,
> face_enrolled).
>
> **Below staff:** `fingerprint_templates` (id PK, staff_id FK, finger,
> template, quality) and `face_embeddings` (id PK, staff_id FK, embedding
> vector(512), angle, quality).
>
> **Left:** `readers` (id PK, label, capacity, last_synced_at); `reader_slots`
> (reader_id FK, slot_id, template_id FK, staff_id FK — composite PK);
> `kiosks` (id PK, code UNIQUE, token_hash, reader_id FK).
>
> **Right:** `shift_assignments` (id PK, staff_id FK, shift_id FK, shift_date);
> `attendance` (id PK, staff_id FK, shift_date, shift_id FK, department_id FK,
> check_in_at, check_in_status, check_out_at, requires_approval);
> `attendance_attempts` (id PK, staff_id FK, kiosk_id FK, method, confidence,
> decision, occurred_at).
>
> **Corner:** `profiles` (id PK, full_name, role, department_id FK);
> `audit_log` (id PK, actor_id FK, action, entity, occurred_at).
>
> **Cardinality:** one department to many staff; one staff to many fingerprint
> templates, face embeddings, shift assignments, attendance records and
> attempts; one shift to many assignments; one reader to many slots.
>
> **Annotate two unique constraints explicitly** with callout labels:
> "UNIQUE (staff_id, shift_date)" on `attendance`, and "UNIQUE (staff_id,
> finger)" on `fingerprint_templates`.
>
> Landscape orientation, plain white, thin black lines. This is a detailed
> technical figure — legibility matters more than compactness.

---

## Figure 4.5 — Class diagram

> Draw a **UML class diagram** of an application service layer. Each class is a
> rectangle in three compartments: name, attributes, operations.
>
> **Classes and their key operations:**
> - `FingerprintBridge` — connect(), enrollFinger(), identify(), sync()
> - `FaceService` — embed(frame), health()
> - `LivenessEngine` — checkLiveness(frame)
> - `EnrolmentService` — createStaff(), saveTemplate(), saveEmbedding()
> - `AttendanceService` — recordAttendance(), approveException()
> - `RosterService` — assignShift(), shiftsForDate()
> - `AuditService` — record(action, entity, detail)
>
> **Dependencies (dashed arrows with open arrowheads):** `EnrolmentService` →
> `FingerprintBridge`, `FaceService`, `LivenessEngine`; `AttendanceService` →
> `FingerprintBridge`, `FaceService`, `LivenessEngine`; `EnrolmentService` and
> `AttendanceService` → `AuditService`.
>
> Standard UML class notation. Plain white, thin black lines.

---

## Figure 4.6 — Attendance recording activity diagram

> Draw a **UML activity diagram** for a server-side attendance recording
> function. Rounded rectangles for actions, diamonds for decisions, solid
> circle start, encircled circle ends.
>
> Flow from the start node:
> 1. "Verify station credential" → diamond "Valid?" → **No** → end node "REJECT
>    — invalid station".
> 2. **Yes** → "Look up staff member" → diamond "Active?" → **No** → end node
>    "REJECT — inactive staff".
> 3. **Yes** → "Find shift covering this moment (search previous day to next
>    day so a night shift in progress is found)" → diamond "Shift found?" →
>    **No** → end node "RECORD as unscheduled — FLAG for supervisor".
> 4. **Yes** → diamond "Check-in already recorded?" → **No** → diamond "Within
>    check-in window?" with three branches: "Before" → end "REJECT — too
>    early"; "Within" → end "RECORD — on time or late"; "After grace" → end
>    "RECORD — late, FLAG for supervisor".
> 5. **Yes** → diamond "Check-out already recorded?" → **Yes** → end "REJECT —
>    duplicate". **No** → diamond "Within check-out window?" → **No** → end
>    "REJECT — window closed"; **Yes** → end "RECORD check-out".
>
> **Add one note box** attached to the diagram reading: "Every outcome,
> including every rejection, is written to the attempt log."
>
> Vertical layout, plain white, thin black lines.

---

## Figure 4.7 — Sequence diagram: fingerprint check-in

> Draw a **UML sequence diagram** with five lifelines, left to right: "Staff
> member" (actor), "Kiosk (browser)", "Fingerprint bridge", "Reader (device)",
> "Database".
>
> Messages in order, as solid arrows with dashed return arrows:
> 1. Staff member → Kiosk: "present finger"
> 2. Kiosk → Bridge: "identify()"
> 3. Bridge → Reader: "capture image, extract features, search library"
> 4. Reader ⇢ Bridge: "slot number, match score"
> 5. Bridge ⇢ Kiosk: "slot, score"
> 6. Kiosk → Database: "look up staff for slot"
> 7. Database ⇢ Kiosk: "staff_id"
> 8. Kiosk → Database: **"record_attendance(kiosk credential, staff_id, method,
>    score)"** — draw this message thicker or in a contrasting colour
> 9. Database → Database (self-message): "verify credential; resolve shift;
>    evaluate window"
> 10. Database ⇢ Kiosk: "verdict"
> 11. Kiosk → Staff member: "display name, status, time"
> 12. Kiosk → Kiosk (self-message): "clear after 5 seconds"
>
> **Add a note attached to message 8:** "The station credential travels with
> every attendance write. No credential, no record."
>
> Standard UML sequence notation with activation bars.

---

## Figure 4.8 — Sequence diagram: fallback path

> Draw a **UML sequence diagram** with six lifelines: "Staff member" (actor),
> "Kiosk (browser)", "Fingerprint bridge", "Liveness engine (browser)", "Face
> service", "Database".
>
> Messages in order:
> 1. Staff member → Kiosk: "present finger"
> 2. Kiosk → Bridge: "identify()" ⇢ **"no match"**
> 3. Kiosk → Liveness engine: "checkLiveness(frame)" ⇢ "live face confirmed"
> 4. Kiosk → Face service: "embed(frame)" ⇢ "512-d embedding"
> 5. Kiosk → Database: "identify_face(embedding)"
> 6. Database ⇢ Kiosk: **"ambiguous — margin not met"** — highlight this return
> 7. Kiosk → Staff member: "prompt for staff number"
> 8. Staff member → Kiosk: "enter staff number"
> 9. Kiosk → Face service: "embed(frame)" ⇢ "embedding"
> 10. Kiosk → Database: "verify_face_by_staff_no(staff number, embedding)"
> 11. Database ⇢ Kiosk: "verified, staff_id"
> 12. Kiosk → Database: "record_attendance(credential, staff_id, face, score)"
> 13. Database ⇢ Kiosk: "verdict" → display
>
> **Add a note attached to message 6:** "Two candidates scored within the
> configured margin, so the system named nobody and asked instead."
>
> Standard UML sequence notation with activation bars.

---

## Figure 4.9 — Interface wireframes

> Draw two side-by-side low-fidelity wireframes at the **same scale**, so the
> difference in information density is visible at a glance.
>
> **Left, labelled "Administrative console — read at ~50 cm":** a narrow dark
> sidebar on the left with a logo at top and about ten small navigation items;
> a main content area with a page heading, four small summary tiles in a row,
> and a data table of six rows and five columns; a narrow context panel on the
> right. Small text throughout.
>
> **Right, labelled "Check-in station — read at ~2 m":** no sidebar, no
> navigation. A single large circular icon centred, one very large line of text
> beneath it reading "Place your finger", and one smaller line beneath that. A
> small clock in the top right corner. Nothing else.
>
> Use grey placeholder blocks for text rather than lorem ipsum. Plain white
> background, thin outlines. The contrast in density is the point of the
> figure.

---

## Figure 5.1 — Interface recovery process

> Draw a flowchart of an empirical reverse-engineering process.
>
> Start: "Hypothesis from equivalent Android binding" → "Call function with
> candidate signature" → decision diamond "Result?" with three branches:
> - "Access violation **writing** low address" → "Argument is an out-parameter
>   pointer"
> - "Access violation **reading** the passed value" → "Argument is a
>   dereferenced pointer, not an integer"
> - "Plausible return code" → "Signature confirmed"
>
> The first two branches loop back to "Revise hypothesis" → "Call function with
> candidate signature". The third proceeds to end node "Verified signature".
>
> **A side panel listing the five probes:** device enumeration; open-function
> argument shape; command-function argument shape; search-function output
> pointers; undocumented return code.
>
> Plain white, thin black lines.

---

## Figure 5.1b — Deployment topology

> Draw a deployment diagram with two clearly separated zones.
>
> **Zone 1, "Cloud":** a node "Static web application (Vercel)" and a node
> "PostgreSQL database and authentication (Supabase)".
>
> **Zone 2, "Kiosk PC (hospital)":** a node "Browser" containing "Console and
> kiosk interface" and "Liveness detection"; a node "Fingerprint bridge
> (32-bit Python)"; a node "Face recognition service (64-bit Python,
> InsightFace)". Two attached devices: "Fingerprint reader (USB)" and "Camera
> (USB)".
>
> **Connections:** Browser → Cloud labelled "HTTPS — public internet"; Browser
> → both local services labelled "HTTP — loopback only"; services → devices
> labelled "USB".
>
> **Annotate the loopback connections** with a note: "Requires local network
> access permission, granted once per machine."
>
> **Draw a dividing line** between the zones labelled "public internet /
> local machine".
>
> Plain, technical, no 3D.

---

## Figures 5.2, 5.3, 5.4 — build these in Excel, not with a drawing tool

These plot data you have measured. Drawing an approximation would be
misrepresenting results.

**Figure 5.2 — Fingerprint score distributions.** Histogram, two series
(genuine, impostor) from the exported attempts CSV. X: match score. Y: count.
Vertical line at the operating threshold.

**Figure 5.3 — Face similarity distributions.** Histogram or scatter, three
series: genuine, sibling, unrelated impostor. Vertical line at the threshold.
If you can produce this for both the original model and ArcFace, present them
side by side — that before-and-after is your strongest single result.

**Figure 5.4 — FAR/FRR against threshold.** Line chart, two series. X:
threshold 0 to 1. Y: error rate %. FAR falls as threshold rises, FRR rises.
Mark the crossing point as the Equal Error Rate, and mark your selected
operating threshold with a label explaining why it sits to the right of the
EER.

To build 5.4: in Excel, list candidate thresholds in a column (0.30, 0.35,
0.40 … 0.95), then for each compute
`FAR = COUNTIF(impostor_scores, ">="&threshold) / COUNT(impostor_scores)` and
`FRR = COUNTIF(genuine_scores, "<"&threshold) / COUNT(genuine_scores)`.
Plot both columns against the threshold column.
