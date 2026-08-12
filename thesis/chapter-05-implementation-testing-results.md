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

> **[DIAGRAM 5.2]** — Deployment topology: hosted static site and managed
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
ten separate occasions across two sessions held on different days, for each
modality. Each trial's match score and outcome were recorded automatically by
the system's attempt log.

**Impostor trials.** Each participant's sample was compared against five other
enrolled identities, producing 105 fingerprint and 110 facial cross-comparisons
from which the false acceptance rate is computed. The sibling pair contributed
a further ten focused comparisons, each presenting against the other's enrolled
identity.

**Adverse condition trials.** Fingerprint presentations were repeated twice per
participant with the fingertip dampened and twice with it dried after
alcohol-based hand rub, and facial presentations twice per participant under
reduced illumination of approximately 80 lux, to characterise behaviour in
conditions expected in a hospital.

**Presentation attack trials.** A printed photograph and a photograph displayed
on a mobile screen were presented to the camera on ten occasions each, against
forty live presentations as a control. No fingerprint presentation attack trial
was conducted, for the reason given in Section 5.6.6.

## 5.6 Test Results

All figures in this section are computed from the system's own attempt log,
exported as CSV. Every recognition attempt, whether accepted or refused, is
written to that log by the recording function, so the dataset is a complete
record of the trials rather than a transcription of them.

### 5.6.1 Functional test results

Of the twenty-nine functional test cases, **twenty-six passed on first
execution and three failed**. All three failures were defects in the system
rather than in the test definitions, and all three were corrected and
re-executed successfully.

| Case | Requirement | Failure observed | Resolution |
|---|---|---|---|
| TC14 | FR17 Night shift check-out | A check-out presented at 06:10 for a shift beginning 22:00 the previous evening was refused as outside the window. The window computation resolved the shift date from the timestamp rather than from the date the shift began. | Shift resolution was changed to search from the previous day to the next, so a shift in progress across midnight is found. |
| TC25 | NFR5 Supervisor scope | A supervisor account retrieved staff records belonging to a second department. The row-level policy tested the actor's role but not the department match. | The policy was rewritten to compare the actor's department against the row's department. Re-tested against all four supervisor accounts. |
| TC29 | NFR4 Station with the bridge stopped | With the fingerprint service stopped, the check-in station displayed "out of service" and accepted no input, although the facial path remained fully available. | The station was changed to fall through to the facial path when the bridge is unreachable, and to name both possible causes — service stopped or browser permission denied. |

Reporting these is deliberate. Two of the three — TC14 and TC29 — were found
only because the test set contained cases drawn from the conditions of a
hospital rather than of a desk: a shift that runs through the night, and a
machine on which one of two services is not running. A suite that exercised
only daytime shifts with everything running would have passed twenty-nine of
twenty-nine and left both defects in place. The full matrix, with results, is
in **Appendix F**.

### 5.6.2 Fingerprint recognition accuracy

The device reports a match score on a 0–100 scale, produced by its own
proprietary matching algorithm (Section 5.3). The scale is the vendor's; the
operating threshold applied to it was selected from the measurements below.

| Measure | Value |
|---|---|
| Participants attempting enrolment | 22 |
| Participants successfully enrolled | 21 |
| Genuine attempts | 210 |
| Impostor comparisons | 105 |
| Genuine score: mean (SD) | 78.4 (11.6) |
| Genuine score: range | 41 – 97 |
| Impostor score: mean (SD) | 12.7 (8.9) |
| Impostor score: range | 0 – 34 |
| Failure to enrol (FTE) | 1 of 22 (4.5%) |
| Failure to acquire (FTA) | 14 of 210 (6.7%) |
| Operating threshold | 45 |
| False acceptance rate at threshold | 0 of 105 (0.00%; 95% CI upper bound 2.9%) |
| False rejection rate at threshold | 8 of 196 (4.1%) |
| Mean identification time | 1.31 s (SD 0.24) |

**The two distributions do not overlap.** The highest impostor score observed
was 34 and the lowest genuine score 41, so no threshold between those values
produces either error class on this dataset. The operating threshold of 45 sits
in that gap, nearer the genuine end, because the eight false rejections cost a
repeat presentation while a false acceptance would credit attendance to the
wrong person.

**One participant could not be enrolled.** Repeated capture attempts on all
four fingers produced templates below the configured quality floor; the
participant works in a role involving frequent use of alcohol-based hand rub
and the ridge detail on the presented fingers was visibly worn. This
participant was enrolled with facial biometrics and used the facial path
throughout the trial without difficulty.

That single case is the most direct evidence in the study for the multimodal
argument of Section 2.2.5. A fingerprint-only system would have excluded this
person entirely, and the fallback that exists for convenience turned out to be
the only means by which one participant in twenty-two could use the system at
all.

**Failures to acquire** — presentations from which no usable image was
obtained — occurred at 6.7%, concentrated in the damp-fingertip condition
reported in Section 5.6.5. They are recorded separately from false rejections
because the two have different remedies: a failure to acquire is resolved by
drying the finger and presenting again, a false rejection by the facial
fallback.

---

> **[DIAGRAM 5.3]** — Fingerprint genuine and impostor score distributions
> (histogram), with the operating threshold at 45 marked and the gap between
> the two distributions (34 to 41) visible.

---

### 5.6.3 Facial recognition accuracy

Facial comparison is by cosine similarity between 512-dimension ArcFace
embeddings, on a scale where 1.0 is identity and 0.0 is orthogonality. The
figures below were measured with the final model; the earlier model, under
which the misidentification of Section 5.6.4 occurred, produced the separate
figures reported there.

| Measure | Value |
|---|---|
| Participants enrolled with face | 22 |
| Genuine comparisons | 220 |
| Impostor comparisons | 110 |
| Genuine similarity: mean (SD) | 0.847 (0.068) |
| Genuine similarity: range | 0.612 – 0.934 |
| Impostor similarity: mean (SD) | 0.242 (0.101) |
| Impostor similarity: range | 0.031 – 0.641 |
| Impostor excluding the sibling pair: mean (SD) | 0.221 (0.074) |
| Impostor excluding the sibling pair: range | 0.031 – 0.438 |
| **Sibling pair: genuine similarity** | 0.856 mean, range 0.812 – 0.901 |
| **Sibling pair: impostor similarity** | 0.571 mean, range 0.494 – 0.641 |
| **Sibling pair: separation margin** | 0.171 |
| Equal error rate | 0.9% at similarity 0.632 |
| Selected operating threshold | 0.68 |
| Selected margin over runner-up | 0.10 |
| FAR at operating threshold | 0 of 110 (0.00%; 95% CI upper bound 2.7%) |
| FRR at operating threshold | 5 of 220 (2.3%) |

Three observations follow from these figures.

**The sibling pair is a separate population.** Impostor comparisons among
unrelated participants reached 0.438 at most, while the sibling pair reached
0.641 — half again as high, and within 0.171 of the lowest genuine score
recorded for either of them. Treating the impostor comparisons as one
distribution, as most reported evaluations do, gives a mean of 0.242 and
conceals the fact that ten of the 110 comparisons behave nothing like the other
hundred. Reporting the two separately is the only honest presentation.

**The operating threshold was set above the equal error rate, deliberately.**
The equal error rate falls at 0.632. Setting the threshold there would balance
the two error types, which is the conventional choice and the wrong one here.
The costs are not symmetric: a false rejection asks a member of staff to type
their staff number, while a false acceptance writes a payroll-bearing
attendance record in the name of someone who was not present. The threshold was
therefore set at 0.68, accepting a false rejection rate of 2.3% in exchange for
observing no false acceptance in 110 comparisons. This is the decision-theoretic
argument of Section 2.3.3 applied to a measured distribution rather than
asserted in the abstract.

**A zero false acceptance rate is not a claim of zero risk.** No false
acceptance was observed in 110 impostor comparisons. By the rule of three, the
upper bound of the 95% confidence interval for the true rate is approximately
3/110, or 2.7%. The correct statement is that the false acceptance rate is
below 2.7% at 95% confidence — not that it is zero. A study reporting "100%
accuracy" from a hundred trials is reporting the size of its sample, not the
quality of its system.

---

> **[DIAGRAM 5.4]** — Facial genuine and impostor similarity distributions, with
> the ten sibling impostor comparisons plotted as a third, separately coloured
> series. This is the most informative graph in the thesis: it shows visually
> why the design was changed.
>
> **[DIAGRAM 5.5]** — FAR and FRR against threshold, with the equal error rate
> at 0.632 and the selected operating point at 0.68 both marked.

---

### 5.6.4 Misidentification finding

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

**Confirmatory trial.** The design response was then tested against the
condition that produced the failure. Both siblings were enrolled with facial
biometrics simultaneously, the facial model was replaced with the
512-dimension model described in Section 5.3, and the threshold and margin were
set to the values derived in Section 5.6.3. Each sibling then presented at the
check-in station on twenty occasions, forty presentations in total.

| Outcome | Occurrences | Proportion |
|---|---|---|
| Correct identification, margin satisfied | 33 | 82.5% |
| *Ambiguous* returned, staff number requested, verification succeeded | 7 | 17.5% |
| **Incorrect identification** | **0** | **0.0%** |

In the seven ambiguous cases the correct sibling was the highest-scoring
candidate on all seven occasions, but the runner-up — the other sibling —
scored within 0.10 of it, so the function declined to name anyone. In each case
the staff member entered their staff number and the subsequent one-to-one
verification succeeded on the first attempt.

This is the result the design change was made to produce. **The system does not
now distinguish the siblings reliably; it recognises that it cannot, and asks.**
Those are different claims, and only the second is supported by the data. Under
the earlier design the same seven presentations would have been resolved by
taking the highest score, which is precisely the operation that produced the
false acceptance.

The margin condition fired eight times across the whole evaluation: seven of
the forty sibling presentations, and once among the 220 genuine comparisons
from the rest of the sample, involving two participants of similar age and
build. Its cost is therefore concentrated almost entirely on the population it
exists for. Outside the sibling pair it asks for a staff number roughly once in
every two hundred check-ins; within it, once in every six.

### 5.6.5 Performance under adverse conditions

Hospital work is wet-handed and unevenly lit. Both modalities were therefore
re-tested under the conditions of Section 5.5.3.

| Condition | Presentations | Successful | Rate | Mean score |
|---|---|---|---|---|
| Fingerprint, normal | 210 | 196 | 93.3% | 78.4 |
| Fingerprint, fingertip dampened | 42 | 27 | 64.3% | 61.2 |
| Fingerprint, fingertip dried after hand rub | 42 | 35 | 83.3% | 70.8 |
| Face, normal illumination | 220 | 215 | 97.7% | 0.847 |
| Face, reduced illumination (~80 lux) | 44 | 39 | 88.6% | 0.781 |

**Dampness is the dominant failure condition.** Success fell from 93.3% to
64.3% when the fingertip was wet, a larger degradation than any other condition
tested. This is a hardware property — moisture bridges the ridge valleys and
the optical sensor cannot resolve the pattern — and it is not correctable in
software.

Its practical significance is high in this setting specifically. Clinical staff
wash or sanitise their hands many times per shift, and the check-in station is
placed near a ward entrance where staff arrive having just done so. A third of
presentations failing at that moment would be intolerable, and it is a
substantial part of the case for the facial fallback being an operational
requirement rather than a convenience.

Reduced illumination degraded facial matching but did not defeat it: the mean
similarity fell by 0.066, which remains well clear of the 0.68 threshold, and
the five failures were refusals rather than misidentifications. The system was
less able to recognise people in poor light; it did not become more likely to
recognise the wrong one.

### 5.6.6 Presentation attack resistance

| Attack | Attempts | Rejected | Accepted | Mean liveness score |
|---|---|---|---|---|
| Printed photograph to camera | 10 | 10 | 0 | 0.09 |
| Photograph displayed on phone screen | 10 | 10 | 0 | 0.14 |
| Live face (control) | 40 | 0 | 40 | 0.88 |

Against a liveness threshold of 0.55, artefact scores (0.02–0.27) and live-face
scores (0.71–0.96) are separated by a wide margin, and no artefact came within
0.28 of the threshold. The anti-spoofing model rejected every artefact before
any embedding was computed, so a photograph never reaches the matching stage at
all.

**Twenty attack attempts support a weaker claim than the table suggests.** By
the rule of three, zero acceptances in twenty attempts places the upper bound
of the 95% confidence interval at approximately 15%. The measurements
demonstrate that the anti-spoofing stage functions and that two common attack
types are rejected; they do not establish a presentation attack detection rate
in the sense of ISO/IEC 30107, which requires a far larger and more varied
attack set, including three-dimensional artefacts not available here.

**The fingerprint device performs no liveness detection.** This is a property
of the hardware, established from the recovered interface: the device exposes
no presentation attack function and returns no liveness indication. No
fingerprint spoofing trial was therefore conducted, because there is nothing to
measure — the device would compare an artefact's ridge pattern exactly as it
compares a finger's. This is reported here as a limitation of the system as
built, not as an untested pass, and it is the reason the fingerprint path is
described in Section 4.4.4 as the convenient modality rather than the secure
one.

### 5.6.7 Access control results

Each test was executed against a live database using the credentials of an
account holding the stated role, not by calling application code with the
checks disabled. The distinction matters: these policies are enforced by the
database, and testing them through the application would demonstrate only that
the application asks politely.

| Test | Expected | Observed |
|---|---|---|
| Supervisor reads biometric templates | No rows | 0 rows returned |
| Supervisor reads another department's staff | No rows | 0 rows returned |
| Supervisor reads own department's staff | Rows returned | 34 rows returned |
| Direct insert into attendance table | Permission denied | `permission denied for table attendance` |
| Direct update of a recorded check-in time | Permission denied | `permission denied for table attendance` |
| Attendance function with invalid station credential | Rejected | Rejected, attempt logged |
| Attendance function with no station credential | Rejected | Rejected, attempt logged |
| Attendance function with valid credential | Recorded | Recorded, attempt logged |
| Anonymous client reads staff table | No rows | 0 rows returned |

All nine behaved as specified. The two refused write attempts are the more
significant results: they establish that the prohibition on writing attendance
directly is enforced by the database rather than by the absence of a button in
the interface, which is the claim made in Section 4.4.2. A privilege that is
withheld at the point of the grant cannot be recovered by an attacker who
controls the browser.

### 5.6.8 Performance and usability

| Measure | Value |
|---|---|
| Mean fingerprint identification time | 1.31 s (SD 0.24) |
| Mean face verification time | 2.14 s (SD 0.38) |
| Mean end-to-end check-in, fingerprint path | 2.9 s |
| Mean end-to-end check-in, facial fallback path | 4.6 s |
| Mean enrolment duration per staff member | 4 min 12 s (SD 47 s) |
| Mean presentation attempts per successful check-in | 1.18 |
| Proportion of check-ins served by the fingerprint path | 92.7% |
| Proportion requiring the facial fallback | 7.3% |
| Proportion requiring staff number entry | 1.4% |
| TAM: perceived usefulness (mean, SD) | 4.41 (0.51) |
| TAM: perceived ease of use (mean, SD) | 4.32 (0.58) |

Both Technology Acceptance Model constructs were measured on a five-point
Likert scale across 22 respondents. Perceived usefulness (4.41) exceeded
perceived ease of use (4.32), and the lowest-scoring individual item was ease
of use in the facial fallback, where participants reported uncertainty about
where to look and how long to hold still. This is an interface finding rather
than a recognition one, and it is carried into the recommendations in
Section 6.4.

Against the non-functional requirement of a check-in completing within five
seconds (NFR-3), both paths comply: 2.9 s on the fingerprint path and 4.6 s on
the fallback. The fallback's margin is narrow, and the 2.14 s facial
verification is dominated by model inference on a CPU. A machine with a GPU, or
a smaller model, would reduce it, at the cost of the accuracy characterised in
Section 5.6.3 — a trade this study did not make, because a slower correct
answer is worth more than a faster wrong one in this application.

## 5.7 Discussion of Results

### 5.7.1 Research Question 1 — weaknesses of current practice

The eight problems identified in Section 4.3 correspond closely to those
reported in the literature reviewed in Section 2.4, with one exception worth
noting.

Self-reported times, omitted departures and manual transcription appear in
substantially every study of paper-based attendance and were confirmed here. So
was the absence of any link between the record of attendance and the roster
that authorised it — a gap that makes the question *"was this person supposed
to be here?"* unanswerable from the record itself.

The exception is the treatment of exceptions. Prior studies generally describe
manual registers as producing incorrect data. What was observed here is
narrower and more troubling: the register produces data that is *not obviously
incorrect*. A countersigned entry recording an arrival at 07:00 is indefensible
only if someone knows the person arrived at 07:40, and nobody does after the
pay period closes. The problem is not that the record is wrong but that it
carries no evidence of its own reliability, which is why the system built here
records every attempt, flags rather than silently corrects, and preserves the
original time when a supervisor approves an exception.

### 5.7.2 Research Question 2 — combining the two modalities

The serial architecture achieved its intended effect on both counts.

**Throughput.** 92.7% of check-ins completed on the fingerprint path alone, at
a mean of 2.9 seconds and 1.18 presentations. The facial path, which is slower
(4.6 s) and requires the participant to face a camera, was invoked for the
remaining 7.3%. A parallel architecture that fused both modalities on every
transaction would have imposed the slower path's cost on all 100% of
transactions to improve an error rate already below the confidence interval of
the sample — the argument advanced in Section 4.4.4, here supported by
measurement.

**Population coverage.** One participant of twenty-two could not be enrolled on
fingerprint at all, and a further 6.7% of otherwise valid presentations failed
to acquire, rising to 35.7% with a damp fingertip. Ross and Jain (2003) identify
coverage of individuals whom one modality cannot serve as a principal benefit of
multimodal systems; this study observed exactly that case rather than asserting
it. For that participant the facial path was not a fallback but the only path,
and a fingerprint-only system would have excluded a member of staff from
recording their own attendance for reasons entirely outside their control.

The damp-fingertip result generalises the point. In a hospital the condition
that most degrades fingerprint capture is the condition staff are required by
infection control to be in. A second modality is therefore an operational
requirement of this setting specifically, not a general refinement.

### 5.7.3 Research Question 3 — architecture for browser-based biometrics

The finding that no browser API can reach the device is a constraint on a class
of systems, not a property of this one. The device enumerates as USB mass
storage; WebUSB refuses claimed-class devices, WebHID does not apply, and Web
Serial has nothing to open. Any browser-based system integrating a biometric
device of this class faces the same wall, and the sequence of eliminations
documented in Section 5.2.2 is offered so that others need not repeat it.

The consequence is a local bridge — an additional component, an additional
installation, and an additional failure mode, as test case TC29 demonstrated.
What the architecture avoids is the usual cost of such a component. The bridge
holds no privilege: it captures and it reports, and the authority to record
attendance remains in the database behind a credential the bridge does not
hold. This was verified directly in Section 5.6.7, where writes attempted
outside the recording function were refused by the database. The security model
is therefore unchanged by the bridge's existence, which is the property that
makes the compromise acceptable.

### 5.7.4 Research Question 4 — preventing misattribution

This is the central finding of the study, and four things about it matter.

**It was observed, not hypothesised.** The system recorded attendance for a
person who was not present, in the name of someone who was not there either.
Had the evaluation sample been drawn only from visually dissimilar volunteers —
which is the default, since researchers recruit whoever is available — the
failure would not have occurred, the safeguard would have remained untested,
and the thesis would have reported a clean result for a system carrying a
latent defect.

**It was a property of the matching mode, not a defect of the code.** Jain et
al. (2004) establish that one-to-many identification error grows with the
enrolled population and with similarity between enrolled identities. The
measured distributions confirm this directly: unrelated impostors reached 0.438
at most, while the sibling pair reached 0.641 against a genuine minimum of
0.812 for the same individuals under the final model, and overlapped completely
under the earlier one. No threshold could have separated them. The
implementation behaved exactly as written; what was wrong was asking it to
choose.

**The safeguard was inactive because the test population was too small.** The
margin condition had been implemented before the failure occurred and did not
fire, because a margin requires a runner-up and only one identity was enrolled.
This is a lesson about testing as much as about design: a safeguard that
depends on the state of the data cannot be validated against data that lacks
that state. The confirmatory trial in Section 5.6.4 addressed this by enrolling
both siblings simultaneously, at which point the condition fired on seven of
forty presentations.

**The design response trades convenience for correctness, and the trade is
right here.** Refusing to name anyone costs a staff member six keystrokes. The
alternative costs a payroll record attributed to a person who was absent, and —
in a hospital — a staffing record asserting that someone was present on a ward
when they were not. Section 2.3.3 frames biometric matching as a decision under
asymmetric loss; this is that asymmetry made concrete. The threshold at 0.68
rather than at the equal error rate of 0.632 is the same asymmetry applied to
the continuous case.

The system's honest claim is therefore not that it distinguishes siblings. It
does not, reliably. Its claim is that it detects when it cannot distinguish
them and declines to guess, which is a weaker capability and a stronger
guarantee.

### 5.7.5 Research Question 5 — accuracy and threshold selection

Both operating thresholds were selected from the measured distributions
reported in Sections 5.6.2 and 5.6.3, not adopted from the vendor's default or
from figures published for other populations.

For fingerprint, the genuine and impostor distributions were disjoint on this
dataset (impostor maximum 34, genuine minimum 41). Any threshold in that gap
yields zero observed errors, so the choice of 45 is a judgement about which
error to prefer as the sample grows rather than a fit to the data: it sits
nearer the genuine end, favouring occasional rejection over occasional
acceptance.

For face, the distributions overlap slightly and the equal error rate falls at
0.632. The threshold was set above it, at 0.68, for the reason given in
Section 5.6.3. This is a deliberate departure from the convention of operating
at the equal error rate, which is appropriate only where the two errors cost
the same. In an attendance system they do not.

Comparison with the studies in Section 2.4 must be made carefully. Reported
accuracies in that literature range from 95% to above 99%, but those figures
derive from populations of different sizes, different sensor hardware,
different capture conditions and — most importantly — different matching modes,
with several reporting verification accuracy while describing an identification
system. The figures here are drawn from 22 participants under conditions
including damp fingertips and 80-lux illumination, and include a deliberately
adversarial pair. They are not directly comparable with any of them, and a
claim that this system outperforms or underperforms those studies would not be
supportable.

What can be said is narrower and, for a system intended for deployment, more
useful: on this population, under these conditions, with these thresholds, no
false acceptance was observed in 215 impostor comparisons across both
modalities, giving an upper bound of approximately 1.4% at 95% confidence.

### 5.7.6 Comparison with the existing system

| Problem | Status | Evidence |
|---|---|---|
| P1 Identity not verified | Resolved | Identity established biometrically at a registered station; no path exists to record attendance without a match (§5.6.7) |
| P2 Times self-reported | Resolved | Times are set by the database clock at the moment of the call, not supplied by the caller (§4.6.6) |
| P3 No link to roster | Resolved | Every record carries its shift assignment; unscheduled attendance is recorded and flagged rather than refused (§5.6.1, TC-14) |
| P4 Departure entries omitted | Partially resolved | Check-out is prompted and recorded when presented, but the system cannot compel a departure scan. Missing check-outs are surfaced as exceptions rather than eliminated |
| P5 Retrospective information only | Resolved | Live attendance view updates as records are written; supervisors see the current ward state rather than the previous pay period's |
| P6 Records alterable | Resolved | No role holds INSERT or UPDATE on the attendance table; supervisor approval annotates a record without altering its times (§5.6.7) |
| P7 Manual transcription | Resolved | Export produces payroll-ready CSV directly from the recorded data; no re-keying occurs |
| P8 No systematic exception handling | Resolved | Late, unscheduled and out-of-window events are classified at the point of recording and queued for review with the reason attached |

Seven of the eight are resolved and one partially. **P4 is the honest
exception.** A member of staff who walks out without presenting a finger leaves
no departure record, and no technical measure available to this system prevents
that — the improvement over the paper register is that the omission is now
visible the same day rather than discovered at payroll, and is attributable to
a specific person and shift. Whether omissions fall in practice is a question
about organisational routine, and it cannot be answered from a trial of this
length.

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
