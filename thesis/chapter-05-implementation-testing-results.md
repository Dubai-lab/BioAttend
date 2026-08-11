# CHAPTER FIVE: SYSTEM IMPLEMENTATION, TESTING AND RESULTS

## 5.1 Introduction

This chapter documents the implementation of the system designed in Chapter
Four, the technologies used, the interfaces produced, the testing conducted and
the results obtained. Section 5.7 discusses those results against the research
questions stated in Chapter One.

Two aspects of the implementation are reported in unusual detail because they
constitute contributions in their own right: the recovery of an undocumented
device programming interface (Section 5.2.3), and the identification and
correction of a misidentification failure discovered during evaluation
(Section 5.6.4).

## 5.2 System Development

Development proceeded in seven increments, each comprising design,
implementation and testing. Two increments produced findings that invalidated a
prior design decision and required revision; these are reported rather than
omitted, since they constitute the principal empirical findings of the study.

### 5.2.1 Increment 1 — Foundation

The first increment established the database schema, access control policies,
authentication and application shell. All fifteen tables were created with their
row-level security policies defined in the same migration as the table itself, so
that no table existed at any point without its access rules.

A convention was adopted for every table: create the table, grant explicit
permissions, enable row-level security, then define policies — all within one
migration. This was necessitated by a platform change during the study period, in
which tables ceased to be exposed to the data API automatically and required
explicit permission grants.

### 5.2.2 Increment 2 — Fingerprint device access (initial approach, abandoned)

The initial design proposed direct browser-to-device communication using the
Web Serial API, on the assumption that the device presented a serial interface.
This assumption was drawn from the vendor library's use of serial communication
functions and from the presence of serial ports in the host system's device
list.

The assumption was false. Interrogation of the host's device registry
established that the ports observed belonged to an unrelated internal component,
and that the fingerprint device enumerated as:

```
USB Mass Storage Device — USB\VID_2009&PID_7638 — service: USBSTOR
```

The device presents itself as a storage volume, not a serial port. This
invalidated the Web Serial approach entirely, and by extension every browser-based
alternative:

- **Web Serial** requires a serial port, which the device does not create.
- **WebUSB** explicitly refuses devices in protected interface classes, of which
  mass storage is one.
- **File System Access** cannot be used, as the volume is a control channel
  rather than a mountable file system.

**Finding.** No browser API can communicate with a fingerprint device of this
class. A local intermediary process is a necessity rather than a design
preference.

The Web Serial implementation was discarded and the local bridge described in
Chapter Four adopted in its place. The episode is reported because the incorrect
assumption is a plausible one — the vendor's own library contains serial
communication code, which belongs to a different model in the same product
family — and because the diagnostic method that resolved it (inspecting the
operating system's device registry for the vendor and product identifiers rather
than inferring from port names) is generally applicable.

### 5.2.3 Increment 3 — Recovery of the device programming interface

The device was supplied with a 32-bit Windows library and a demonstration
application, but **no header file, no interface specification and no
documentation**. The library exported function names but not their signatures,
which are not recoverable from the binary by inspection alone.

An equivalent library for a different platform was located, published as part of
an unrelated open-source project, which declared the function names and argument
lists for that platform. These were adopted as an initial hypothesis. The
hypothesis proved **partially incorrect**, and the corrections were established
empirically through a sequence of controlled probes.

**Probe 1 — device enumeration.** Calling the device-count function with no
arguments produced an access violation while writing to a low memory address,
indicating the function expected a pointer it had not been given. Supplying a
buffer produced a return value of 1 and wrote the byte `0x44` — ASCII `'D'` —
revealing that the function reports attached devices by **drive letter**, and
confirming that the device was mounted as drive D.

**Probe 2 — argument shape of the open function.** Every all-integer signature
faulted. The fault was an access violation while *writing*, characteristic of a
null out-parameter. Supplying a pointer as the first argument succeeded,
establishing that the first parameter is an output pointer receiving a device
context — the Windows counterpart of a file descriptor on the other platform.
The device opened with device type 2, corresponding to the mass-storage
transport.

**Probe 3 — argument shape of the command functions.** With the device open, the
image-capture function was called with candidate first arguments. Passing small
integers faulted while *reading* those exact addresses, proving the first
parameter is a **dereferenced pointer** rather than a numeric address. Passing
the context returned a plausible code. A separate call wrote to an address
consistent with an argument slot being shifted by one, indicating a missing
parameter.

**Conclusion.** The Windows interface follows the pattern:

```
Other platform:   Function(deviceAddress, ...)
Windows:          Function(void* context, deviceAddress, ...)
```

Every command takes an additional leading context pointer obtained from the open
call. Verified behaviour:

| Call | Result |
|---|---|
| `Open(&context, type=2, port=1, baud=57600, packet=2, index=0)` | 0 (success) |
| `GetImage(context, 0xFFFFFFFF)` | `0x02` — "no finger", correct with an empty sensor |
| `TemplateNum(context, 0xFFFFFFFF, &count)` | 0, count = 0 |
| `ReadInfoPage(context, 0xFFFFFFFF, buffer)` | 0, buffer contains the product identification string |

**Probe 4 — search functions.** A later fault during identification revealed
that the search functions take **two separate output pointers** — one for the
matched storage slot, one for the match score — rather than a single array as
the other platform's binding suggested.

**Probe 5 — undocumented return code.** The search functions were observed to
return `0x47` when the library contained no match. This code appears in no
published documentation for the protocol family; the documented code for the
same condition is `0x09`. It was established empirically that both must be
treated as "not found", since a device returning an undocumented code would
otherwise surface to the user as a system fault rather than an ordinary
non-match.

**Contribution.** The interface described above was not available in any
published source at the time of the study. Its recovery, and the diagnostic
method used — distinguishing read faults from write faults to determine whether
an argument is a pointer, and using return-code plausibility to confirm argument
alignment — is offered as a contribution to practitioners integrating similar
undocumented devices.

---

> **[DIAGRAM 5.1]** — Interface recovery process: hypothesis from the alternative
> platform binding → probe → fault classification → revised hypothesis → verified
> signature. A simple flow with the five probes as steps.

---

### 5.2.4 Increment 4 — Enrolment and synchronisation

Staff enrolment was implemented as a five-step process: identity, role and
shift, fingerprint capture, face capture, and review. Biometric consent is
recorded in a panel adjacent to the capture steps, and the capture controls
remain disabled until all three consent conditions are recorded. Consent is thus
a **technical precondition** rather than an administrative instruction.

Fingerprint enrolment captures each finger three times and merges the samples
into a single template on the device before uploading it. Captures below the
configured quality threshold are rejected and not stored.

Reader synchronisation was implemented to write stored templates into the
device's internal storage and record the resulting slot-to-staff mapping.
Synchronisation writes only active staff, so deactivating a staff member removes
them from the device at the next synchronisation.

### 5.2.5 Increment 5 — Attendance capture and shift logic

The check-in station and the server-side attendance function were implemented
together, following the logic specified in Chapter Four. The station operates as
a continuous loop with no user interface controls: it waits for a presentation,
resolves it, displays the outcome, clears, and waits again.

### 5.2.6 Increment 6 — Facial recognition (initial approach, revised)

Facial recognition was implemented using pretrained models executing in the
browser. The initial design used one-to-many identification as the fallback
path: where a fingerprint failed, the camera would identify the staff member
directly.

Evaluation of this design produced a **false acceptance** (Section 5.6.4) which
invalidated it. The design was revised as described in Chapter Four, Section
4.4.5.

### 5.2.7 Increment 7 — Administration, reporting and audit

The final increment implemented the administrative functions: staff records with
biometric editing, roster management, live attendance, exception approval,
reporting and export, console user and station management, configuration, and
audit logging.

The audit facility explicitly redacts biometric fields before writing an entry,
so that the audit trail does not become a secondary and less-protected copy of
the biometric data. Audit entries are append-only: no update or delete policy
exists for any application role.

### 5.2.8 Increment 8 — Deployment

The console and kiosk interfaces were deployed as a static build to a hosting
platform, with the database and authentication remaining on the managed
service. The local bridge remains on each check-in station, since it exists to
reach hardware physically attached to that machine and cannot be hosted.

Deployment surfaced one behaviour absent in local development. The deployed
site is served over HTTPS from a public origin, while the bridge answers over
plain HTTP on the loopback address. Browsers treat a request from a public
origin to a local one as a **private network access**, and require both an
explicit server opt-in and the user's permission. The bridge was extended to
answer the corresponding preflight; the permission is granted once per machine
through the browser's site settings.

The failure mode is worth recording: a denied permission is indistinguishable
from a stopped bridge, since the request is blocked before it is sent and the
bridge logs nothing. Both causes are therefore named in the interface when the
bridge is unreachable.

---

> **[DIAGRAM 5.1b]** — Deployment topology: hosted static site and managed
> database in one region, and the check-in station with its local bridge and
> attached reader. Mark which connections cross the public internet and which
> stay on the local machine.

---

## 5.3 Technologies Used

### 5.3.1 Justification of principal choices

| Requirement | Technology | Justification |
|---|---|---|
| Client application | React 18.3 with TypeScript 5.9 | Component model suits the two interface densities; static typing prevents a class of error in code handling biometric identifiers |
| Build tooling | Vite 5.4 | Fast rebuilds during iterative development; code splitting used to isolate the 1.6 MB machine learning runtime |
| Styling | Tailwind CSS 4.0 | Design tokens defined once and applied consistently across both interface densities |
| Database and authentication | Supabase (PostgreSQL) | Row-level security allows access control to be enforced by the database rather than the application, satisfying NFR5 |
| Vector similarity | pgvector | Enables facial similarity search to be performed server-side, so that the station never receives biometric data |
| Facial recognition | @vladmandic/human 3.3.6 | Actively maintained; includes anti-spoofing and liveness models, which comparable libraries do not |
| Local bridge | Python 3.13 (32-bit) | Required by the 32-bit vendor library; `ctypes` requires no compilation step, which was essential while interface signatures were still being established |
| Bridge HTTP server | Python standard library | No third-party dependency, reducing installation requirements on hospital machines |

### 5.3.2 Note on model provenance

The facial recognition models are **pretrained and were not trained as part of
this study**. The system computes embeddings using these models and compares
them; no model weights were modified. This is stated explicitly because the
distinction between using a pretrained model and training one is frequently
blurred in student project reporting.

The models used are: a face detector, a facial landmark model, a 1,024-dimension
descriptor model, an anti-spoofing classifier and a liveness classifier. They
are served from the application's own origin rather than a third-party network,
so that a check-in station continues to function when external connectivity is
unavailable.

### 5.3.3 Note on the fingerprint matching algorithm

Fingerprint matching is performed **by the device firmware**, not by software
written for this study. The template format is proprietary and the matching
algorithm is not published or inspectable. Consequently the fingerprint accuracy
reported in Section 5.6 characterises the device, not an algorithm contributed by
this work. This constraint is stated in Section 1.7 and is a property of using
commercially available biometric hardware.

## 5.4 User Interface

### 5.4.1 Administrative console

The console presents a persistent navigation sidebar grouped into attendance,
workforce and system functions, filtered by the signed-in user's role. The
sidebar also displays the operational status of the biometric service, since an
administrator needs to know whether the reader is reachable before attempting an
enrolment.

---

> **[SCREENSHOT 5.1]** — Console overview page showing the summary tiles and
> today's activity.
>
> **[SCREENSHOT 5.2]** — Enrolment, fingerprint step, showing the four finger
> targets, the capture progress indicator and the consent panel with capture
> disabled until consent is recorded.
>
> **[SCREENSHOT 5.3]** — Enrolment, face step, showing the camera preview with
> the live anti-spoofing verdict overlaid and the five head positions.
>
> **[SCREENSHOT 5.4]** — Live attendance, showing records with method, match
> score and status.
>
> **[SCREENSHOT 5.5]** — Exceptions, showing a flagged record with its
> explanation and the approval control.
>
> **[SCREENSHOT 5.6]** — Reports, showing the biometric performance figures and
> export controls.
>
> **[SCREENSHOT 5.7]** — Settings, showing the shift window table and the
> threshold controls.

---

### 5.4.2 Check-in station

The station interface differs from the console by roughly an order of magnitude
in type size and by the removal of all navigation. It displays one message at a
time, sized for reading at approximately two metres, and clears automatically so
that the next person does not see the previous person's name.

---

> **[SCREENSHOT 5.8]** — Station idle state, prompting for a fingerprint.
>
> **[SCREENSHOT 5.9]** — Station success state, showing name, staff number,
> shift and time.
>
> **[SCREENSHOT 5.10]** — Station showing a flagged outcome, e.g. unscheduled
> attendance.
>
> **[SCREENSHOT 5.11]** — Station refusing a scan outside the window, showing
> when check-out opens.
>
> **[SCREENSHOT 5.12]** — Station staff number entry for the verification
> fallback.

---

## 5.5 System Testing

### 5.5.1 Testing strategy

Four levels of testing were applied:

**Unit and component testing** — individual functions, particularly the packet
construction and parsing of the device protocol, and the window computation for
shifts crossing midnight.

**Integration testing** — the paths between browser, bridge, device and
database, verified end to end with real hardware rather than simulated.

**Functional testing** — each requirement from Section 4.5.1 executed as one or
more test cases with defined preconditions, inputs and expected outputs.

**Security testing** — deliberate attempts to perform actions the system is
designed to prevent, including recording attendance without a station
credential, accessing biometric records as a supervisor, and presenting
artefacts to the biometric sensors.

### 5.5.2 Functional test cases

Twenty-nine test cases were defined, one or more per functional requirement,
each with defined preconditions, inputs and expected outputs. The full matrix
is presented in **Appendix F**.

Cases fall into two groups. Positive cases verify that the system performs a
required function — enrolment completes, a check-in is recorded, an export
produces the expected columns. **Negative cases verify that the system refuses
what it should refuse**, and are the more informative of the two here: capture
before consent is recorded, attendance submitted without a station credential,
a supervisor reading biometric records, a scan outside every shift window, a
photograph presented to the camera. A system that performs its functions but
fails to refuse invalid operations would satisfy the first group entirely while
being unfit for use.

### 5.5.3 Accuracy trial protocol

**Genuine trials.** Each enrolled participant presented their own biometric on
[X] separate occasions across at least two sessions, for each modality. Each
trial's match score and outcome were recorded automatically.

**Impostor trials.** Each participant presented their biometric while the system
attempted comparison against every other enrolled individual, producing
cross-comparisons from which the false acceptance rate is computed.

**Adverse condition trials.** Fingerprint presentations were repeated with the
fingertip dampened and with it dried, and facial presentations under reduced
illumination, to characterise behaviour in conditions expected in a hospital.

**Presentation attack trials.** A printed photograph and a photograph displayed
on a mobile screen were presented to the camera on [X] occasions each.

## 5.6 Test Results

> **[TO COMPLETE]** — The tables in this section define what to report. Populate
> them from the exported attempt log after testing.

### 5.6.1 Functional test results

> Summarise: of 28 cases, [X] passed and [Y] failed. Discuss any failures and
> their resolution. A test that failed and was fixed is a legitimate result;
> report it rather than re-running until everything passes.

### 5.6.2 Fingerprint recognition accuracy

| Measure | Value |
|---|---|
| Participants enrolled | |
| Genuine attempts | |
| Impostor attempts | |
| Genuine score: mean (SD) | |
| Genuine score: range | |
| Impostor score: mean (SD) | |
| Impostor score: range | |
| Failure to enrol (FTE) | |
| Failure to acquire (FTA) | |
| False acceptance rate at operating threshold | |
| False rejection rate at operating threshold | |
| Mean identification time | |

---

> **[DIAGRAM 5.2]** — Fingerprint genuine and impostor score distributions
> (histogram or density plot), with the operating threshold marked.

---

### 5.6.3 Facial recognition accuracy

| Measure | Value |
|---|---|
| Participants enrolled with face | |
| Genuine comparisons | |
| Impostor comparisons | |
| Genuine similarity: mean (SD) | |
| Genuine similarity: range | |
| Impostor similarity: mean (SD) | |
| Impostor similarity: range | |
| **Sibling pair: genuine similarity** | |
| **Sibling pair: impostor similarity** | |
| **Sibling pair: separation margin** | |
| Equal error rate | |
| Selected operating threshold | |
| FAR at operating threshold | |
| FRR at operating threshold | |

---

> **[DIAGRAM 5.3]** — Facial genuine and impostor similarity distributions, with
> the sibling impostor comparisons marked distinctly. This is the most
> informative graph in the thesis: it shows visually why the design was changed.
>
> **[DIAGRAM 5.4]** — FAR/FRR against threshold, with the equal error rate and
> the selected operating point marked.

---

### 5.6.4 Misidentification finding

> **[TO COMPLETE — narrative below is drafted from the observed event; confirm
> the figures against your logs before submission.]**

During evaluation of the one-to-many facial identification path, the system
recorded an attendance event for the wrong individual. A participant not
enrolled in the system presented their face and was identified as an enrolled
participant to whom they are closely related.

Examination of the logged match scores established the cause. Observed
similarity scores were:

| Comparison | Similarity |
|---|---|
| Enrolled participant against own enrolled face | 0.69 – 0.80 |
| Sibling against the enrolled participant's face | 0.69 – 0.78 |
| Operating threshold at the time | 0.62 |

**The two distributions overlapped completely.** No threshold value could admit
the genuine participant while excluding the sibling: any threshold low enough
for the former admitted the latter.

A second contributing factor was identified. The matching function contained a
margin condition intended to refuse a decision when two individuals scored
closely. This condition **had not been exercised**, because only one individual
was enrolled with facial biometrics at the time — there was no second candidate
against which to compute a margin. The safeguard designed for precisely this
failure was inactive because the enrolled population was too small to activate
it.

**Two findings arise:**

1. **One-to-many facial identification with a small enrolled population does not
   discriminate between similar individuals.** With few identities enrolled, the
   comparison approximates *"does this face resemble the enrolled one?"* rather
   than *"which of these people is this?"*, and most human faces satisfy the
   former.

2. **A margin-based safeguard cannot be validated on a single-identity
   population.** Testing that omits the multi-identity case leaves the safeguard
   untested while giving the appearance of a working system.

**Design response.** The matching function was revised to enforce two
conditions rather than one, and a second fallback stage was added.

One-to-many identification is retained as the first fallback, because a
check-in requiring typing is one staff will avoid, and the throughput argument
for serial multimodality (Section 4.4.4) applies equally to the fallback path.
However, the function now returns an identity only if the best match both
exceeds the similarity threshold **and** exceeds the runner-up by a configured
margin. Where either condition fails it returns *ambiguous*, naming nobody.

The system then requests the staff number and performs one-to-one verification
against the asserted identity, as described in Section 4.4.5.

The resulting behaviour is therefore graded rather than binary:

| Condition | System response |
|---|---|
| Confident, unambiguous match | Attendance recorded, no typing |
| Ambiguous or weak match | Staff number requested, then 1:1 verification |
| Verification fails | Refused; attempt logged |

This preserves the speed of the common case while removing the specific
failure observed, since the misidentification arose from an unambiguous-looking
match against a population too small to produce a competing candidate. The
threshold was additionally raised, and the margin widened, on the basis of the
scores above.

> **[TO COMPLETE]** — The margin condition has not yet been observed to fire,
> because it requires two similar individuals to be enrolled simultaneously.
> Report the outcome of that trial (Section 5.6.4, final note) as the
> confirmatory evidence for this design response.

> **[TO COMPLETE]** — After enrolling the second sibling, repeat the trial and
> report whether the margin condition correctly returns *ambiguous*. This is the
> confirmatory test for the design response and should be reported here.

### 5.6.5 Presentation attack resistance

| Attack | Attempts | Rejected | Accepted |
|---|---|---|---|
| Printed photograph to camera | | | |
| Photograph displayed on phone screen | | | |

> Report the anti-spoofing scores observed for live faces against artefacts.
> Note that the **fingerprint device provides no liveness detection**; this is a
> property of the hardware and should be reported as a limitation rather than
> tested and presented as a pass.

### 5.6.6 Access control results

| Test | Expected | Observed |
|---|---|---|
| Supervisor reads biometric templates | No rows | |
| Supervisor reads another department's staff | No rows | |
| Direct insert into attendance table | Permission denied | |
| Attendance function with invalid station credential | Rejected | |
| Attendance function with valid credential | Recorded | |

### 5.6.7 Performance and usability

| Measure | Value |
|---|---|
| Mean fingerprint identification time | |
| Mean face verification time | |
| Mean enrolment duration per staff member | |
| Mean presentation attempts per successful check-in | |
| TAM: perceived usefulness (mean, SD) | |
| TAM: perceived ease of use (mean, SD) | |

## 5.7 Discussion of Results

> **[TO COMPLETE — structure provided; fill from your figures.]**

### 5.7.1 Research Question 1 — weaknesses of current practice

Discuss the analysis in Chapter Four against the literature, noting where the
observed manual process matched or differed from the weaknesses reported in
prior studies.

### 5.7.2 Research Question 2 — combining the two modalities

Discuss whether the serial architecture achieved its intended effect: whether
staff whose fingerprints failed were successfully served by the face path, and
what proportion of transactions required the fallback. Relate this to the
population coverage benefit identified by Ross and Jain (2003).

If any participant failed to enrol on fingerprint, report it — this is direct
evidence for the inclusiveness argument, and a study that observes no such case
should say so rather than assert the benefit.

### 5.7.3 Research Question 3 — architecture for browser-based biometrics

Discuss the finding that no browser API can reach a mass-storage-class biometric
device, and the consequences for systems of this kind. Note that the local
bridge holds no authority, so the architecture does not weaken the security
model despite introducing an additional component.

### 5.7.4 Research Question 4 — preventing misattribution

This is the central discussion. Address:

- that the misidentification was **observed rather than hypothesised**;
- that it arose from the overlap of genuine and impostor distributions, which is
  a property of one-to-many matching predicted by Jain et al. (2004) and not a
  defect of the implementation;
- that the safeguard designed to prevent it was inactive because the enrolled
  population was too small, which is a testing lesson as much as a design one;
- that the design response — refusing to decide and requiring identity to be
  asserted — trades convenience for correctness, and why that trade is right for
  attendance records specifically.

Relate the asymmetry of the two errors back to the decision theory in Section
2.3.3.

### 5.7.5 Research Question 5 — accuracy and threshold selection

Discuss the measured distributions and the threshold selected. State explicitly
that the operating threshold was chosen **from the measured data** rather than
adopted from the literature or the vendor, and justify the position selected
relative to the equal error rate.

Compare the observed accuracy with figures reported in the studies reviewed in
Section 2.4, noting differences in population size, hardware and conditions that
limit direct comparison.

### 5.7.6 Comparison with the existing system

Summarise the improvement against the eight problems identified in Section 4.3,
stating for each whether it is resolved, partially resolved or outstanding.

| Problem | Status | Evidence |
|---|---|---|
| P1 Identity not verified | | |
| P2 Times self-reported | | |
| P3 No link to roster | | |
| P4 Departure entries omitted | | |
| P5 Retrospective information only | | |
| P6 Records alterable | | |
| P7 Manual transcription | | |
| P8 No systematic exception handling | | |

## 5.8 Chapter Summary

This chapter documented the implementation of the system across seven
increments, two of which produced findings that invalidated prior design
decisions. The device programming interface was recovered empirically and is
documented here, having been unavailable in any published source. The
technologies used were stated with their justifications, and the distinction
between using pretrained models and training them was made explicit.

Testing covered functional verification of twenty-nine requirements, accuracy
measurement under genuine, impostor and adverse conditions, presentation attack
trials and access control verification. The principal empirical finding — a
false acceptance between closely related individuals under one-to-many facial
matching, and the design change made in response — is reported in Section 5.6.4
and discussed against the research questions in Section 5.7.
