# CHAPTER FIVE: SYSTEM IMPLEMENTATION, TESTING AND RESULTS

## 5.1 Introduction

This chapter presents the implementation of the system designed in Chapter Four,
the testing carried out on it, and the results obtained. The tools and
technologies used are given in Section 3.4 and the testing methods in Section
3.8; this chapter reports what was built with them and what was measured.

Two matters are reported in greater detail than the rest because they are
contributions in their own right: the recovery of an undocumented device
programming interface (5.2.2), and a misidentification failure found during
evaluation together with the design change made in response (5.6.3).

## 5.2 System Implementation

Development proceeded in eight increments of design, implementation and testing.

| # | Increment | Outcome |
|---|---|---|
| 1 | Database, access control, authentication | Fifteen tables, each with its security policies in the same migration as the table |
| 2 | Device access via Web Serial | **Abandoned** — §5.2.1 |
| 3 | Recovery of the device interface | Recovered empirically — §5.2.2 |
| 4 | Enrolment and reader synchronisation | Consent enforced as a technical precondition |
| 5 | Attendance capture and shift logic | Station implemented as a continuous loop with no controls |
| 6 | Facial recognition | **Revised** after the finding in §5.6.3 |
| 7 | Administration, reporting, audit | Audit entries redact biometric fields and are append-only |
| 8 | Deployment | §5.2.3 |

The database was implemented as fifteen tables under version-controlled
migrations, each created together with its row-level security policies so that
no table existed at any point without its access rules. Attendance is writable
only through a server-side function requiring a registered station's credential;
no browser-facing role holds insert permission on the table.

### 5.2.1 Web Serial: a falsified assumption

The initial design proposed direct browser-to-device communication using Web
Serial, assuming the device presented a serial interface — an assumption drawn
from the vendor library's serial functions and from serial ports visible in the
host's device list. It was false. The device registry showed those ports
belonged to an unrelated component, and that the device enumerated as
`USB\VID_2009&PID_7638`, service `USBSTOR` — mass storage, not a serial port.
This invalidated every browser-based route: Web Serial requires a port the
device never creates, WebUSB refuses protected interface classes of which mass
storage is one, and File System Access cannot address a control channel.

**Finding: no browser API can reach a fingerprint device of this class.** A
local intermediary is a necessity, not a design preference. The method that
resolved it generalises: read the operating system's device registry for vendor
and product identifiers rather than inferring from port names.

### 5.2.2 Recovery of the device programming interface

The device came with a 32-bit Windows library and a demonstration application
but no header, specification or documentation. The library exported function
names but not their signatures, which cannot be recovered from a binary by
inspection. An equivalent library for a different platform, published in an
unrelated open-source project, declared the names and argument lists for that
platform; these were taken as an initial hypothesis and proved partially
incorrect.

Five controlled probes established the corrections using one diagnostic rule:
**an access violation while writing indicates a missing out-pointer; an access
violation while reading indicates an argument that is dereferenced rather than
used as a value.** They established that every Windows export takes the other
platform's signature plus a leading device-context pointer obtained from the
open call (`Function(void* ctx, nAddr, …)`); that the device reports attached
units by drive letter; and that the search functions take two separate output
pointers rather than the single array the other binding suggested.

**An undocumented return code was found.** The search functions return `0x47` on
no match, alongside the documented `0x09`. This appears in no published
documentation for the protocol family, and both must be treated as "not found",
or a device returning it surfaces an ordinary non-match as a system fault.

The recovered interface is tabulated in **Appendix F**. Neither it nor the
diagnostic method was available in any published source at the time of study.

---

> **[DIAGRAM 5.1]** — Interface recovery process.

---

### 5.2.3 Deployment

The interfaces were deployed as a static build to a hosting platform, with the
database and authentication on the managed service; the bridge remains on each
station, since it reaches hardware attached to that machine. One behaviour
appeared only after deployment: the site is served over HTTPS from a public
origin while the bridge answers plain HTTP on loopback, which browsers treat as
a **private network access** requiring both a server opt-in and the user's
permission. A denied permission is indistinguishable from a stopped bridge,
since the request is blocked before it is sent, so both causes are named in the
interface.

---

> **[DIAGRAM 5.2]** — Deployment topology.

---

## 5.3 System Interface Implementation

Two interfaces were implemented from the design in Section 4.6.7. The
**administrative console** presents a navigation sidebar filtered by role and
shows the operational status of the biometric services, since an administrator
needs to know whether the reader is reachable before attempting an enrolment. It
covers enrolment, rostering, live attendance, exception approval, reporting,
console user management, station registration and configuration.

The **check-in station** differs by an order of magnitude in type size and by the
removal of all navigation: one message at a time, sized for reading at two
metres, clearing automatically so the next person does not see the previous
person's name. It has no login, because staff hold no accounts.

---

> **[DIAGRAM 5.6 — screenshot]** — Administrative console, overview page.
>
> **[DIAGRAM 5.7 — screenshot]** — Enrolment, fingerprint step, with the consent
> panel disabling capture until consent is recorded.
>
> **[DIAGRAM 5.8 — screenshot]** — Enrolment, face step, with the live
> anti-spoofing verdict and the five head positions.
>
> **[DIAGRAM 5.9 — screenshot]** — Live attendance: method, score, roster status.
>
> **[DIAGRAM 5.10 — screenshot]** — Check-in station, successful check-in.
>
> **[DIAGRAM 5.11 — screenshot]** — Check-in station, scan refused outside the
> shift window.

---

## 5.4 System Testing

Testing followed the four-level strategy set out in Section 3.8 — unit,
integration, functional and security — and the accuracy trial protocol in
Section 3.7. All testing was carried out against real hardware rather than
simulated responses, and access control tests were executed against a live
database using the credentials of the role under test rather than through
application code with the checks disabled.

## 5.5 Test Cases and Results

Twenty-nine functional test cases were executed. **Twenty-six passed on first
execution and three failed.** All three were defects in the system rather than
in the test definitions, and all three were corrected and re-executed
successfully. The full matrix appears in **Appendix E**.

| Case | Expected | Failure observed | Status after fix |
|---|---|---|---|
| TC14 | Check-out recorded against the correct shift date | A check-out at 06:10 for a shift begun 22:00 the previous evening was refused; shift date was resolved from the timestamp, not from the date the shift began | Pass |
| TC25 | Supervisor sees no other department's staff | A supervisor retrieved staff from a second department; the policy tested role but not department | Pass |
| TC29 | Station continues on face when the bridge is stopped | The station accepted no input at all, although the facial path was available | Pass |

TC14 and TC29 were found only because the test set contained cases drawn from
the conditions of a hospital rather than of a desk — a shift running through the
night, and a machine on which one of two services is not running. A suite
exercising only daytime shifts with everything running would have passed
twenty-nine of twenty-nine and left both defects in place.

## 5.6 System Results and Discussion

All figures are computed from the system's own attempt log, exported as CSV.
Every attempt, accepted or refused, is written to that log by the recording
function, so the dataset is a complete record of the trials rather than a
transcription of them.

### 5.6.1 Recognition accuracy

| Measure | Fingerprint | Face |
|---|---|---|
| Participants enrolled | 21 of 22 | 22 of 22 |
| Genuine attempts / impostor comparisons | 210 / 105 | 220 / 110 |
| Genuine: mean (SD), range | 78.4 (11.6), 41 – 97 | 0.847 (0.068), 0.612 – 0.934 |
| Impostor: mean (SD), range | 12.7 (8.9), 0 – 34 | 0.242 (0.101), 0.031 – 0.641 |
| Failure to enrol / to acquire | 1 of 22 (4.5%) / 6.7% | 0 / 2.3% |
| Equal error rate | distributions disjoint | 0.9% at 0.632 |
| Operating threshold | 45 | 0.68, margin 0.10 |
| FAR at threshold | 0 of 105 (95% CI ≤ 2.9%) | 0 of 110 (95% CI ≤ 2.7%) |
| FRR at threshold | 8 of 196 (4.1%) | 5 of 220 (2.3%) |
| Mean identification time | 1.31 s | 2.14 s |

**The fingerprint distributions do not overlap** — highest impostor 34, lowest
genuine 41 — and the threshold of 45 sits in that gap, nearer the genuine end,
because a false rejection costs a repeat presentation while a false acceptance
credits attendance to the wrong person. **One participant could not be enrolled
on fingerprint at all**; the ridge detail was visibly worn, and that participant
used the facial path throughout. It is the most direct evidence in this study
for the multimodal argument, since a fingerprint-only system would have excluded
them entirely.

For face, the impostor comparisons are two populations rather than one:
unrelated pairs reached 0.438 at most, while the sibling pair reached 0.641
against a genuine minimum of 0.812 for the same individuals — a separation
margin of 0.171. **The threshold was set above the equal error rate
deliberately**, because the costs are asymmetric: a false rejection asks a staff
member to type their staff number, a false acceptance writes a payroll-bearing
record in the name of someone absent. **A zero false acceptance rate is not a
claim of zero risk**; by the rule of three the 95% upper bound is 2.7%.

---

> **[DIAGRAM 5.3]** — Fingerprint genuine and impostor score distributions.
>
> **[DIAGRAM 5.4]** — Facial genuine and impostor similarity distributions, with
> the sibling comparisons as a separate series.
>
> **[DIAGRAM 5.5]** — FAR and FRR against threshold.

---

### 5.6.2 Adverse conditions, attacks and access control

| Condition | Presentations | Successful | Rate |
|---|---|---|---|
| Fingerprint, normal | 210 | 196 | 93.3% |
| Fingerprint, dampened | 42 | 27 | 64.3% |
| Fingerprint, dried after hand rub | 42 | 35 | 83.3% |
| Face, normal illumination | 220 | 215 | 97.7% |
| Face, ~80 lux | 44 | 39 | 88.6% |

**Dampness is the dominant failure condition** — a hardware property, since
moisture bridges the ridge valleys, and not correctable in software. Its
significance is that clinical staff sanitise their hands many times per shift
and arrive having just done so. Reduced illumination degraded facial matching
without defeating it, and its five failures were refusals rather than
misidentifications.

Every presentation attack was rejected: ten printed photographs and ten on a
phone screen, against forty live presentations as control, with artefact
liveness scores of 0.02–0.27 against 0.71–0.96 for live faces at a threshold of
0.55. **Twenty attempts support a weaker claim than that suggests** — an upper
bound of roughly 15% by the rule of three — and do not establish a detection
rate in the sense of ISO/IEC 30107-3 (ISO, 2023). **The fingerprint device
performs no liveness detection at all**, established from the recovered
interface, so no fingerprint spoofing trial was conducted; this is reported as a
limitation, not an untested pass.

All nine access control tests behaved as specified. Supervisors retrieved no
biometric templates and no other department's staff, anonymous clients retrieved
nothing, direct insert and update on the attendance table were refused with
`permission denied`, and the recording function accepted a valid station
credential while refusing an invalid or absent one, logging every attempt. The
two refused writes are the significant results: **the prohibition on writing
attendance directly is enforced by the database, not by the absence of a button
in the interface.**

### 5.6.3 Misidentification finding

During evaluation of the one-to-many facial path, the system recorded attendance
for the wrong individual: a participant not enrolled in the system presented
their face and was identified as an enrolled participant to whom they are
closely related. The logged scores show why.

| Comparison | Similarity |
|---|---|
| Enrolled participant against own enrolled face | 0.69 – 0.80 |
| Sibling against the enrolled participant's face | 0.69 – 0.78 |
| Operating threshold at the time | 0.62 |

**The two distributions overlapped completely.** No threshold could admit the
genuine participant while excluding the sibling. A second factor compounded it:
the matching function already contained a margin condition intended to refuse a
decision when two individuals score closely, but it **had not been exercised**,
because only one individual was enrolled and there was no runner-up against
which to compute a margin. The safeguard designed for precisely this failure was
inactive because the enrolled population was too small to activate it.

**Two findings arise.** First, one-to-many facial identification with a small
enrolled population does not discriminate between similar individuals: the
comparison approximates *"does this face resemble the enrolled one?"* rather than
*"which of these people is this?"*, and most human faces satisfy the former.
Second, a margin-based safeguard cannot be validated on a single-identity
population — testing that omits the multi-identity case leaves it untested while
the system appears to work.

**Design response.** One-to-many identification is retained as the first
fallback, because a check-in requiring typing is one staff will avoid. But the
function now returns an identity only if the best match both exceeds the
threshold **and** beats the runner-up by a configured margin. Where either fails
it returns *ambiguous*, naming nobody, and the system requests the staff number
and performs one-to-one verification against the asserted identity.

**Confirmatory trial.** Both siblings were then enrolled simultaneously, the
model replaced, and the threshold and margin set to the values in 5.6.1. Each
presented twenty times.

| Outcome | Occurrences | Proportion |
|---|---|---|
| Correct identification, margin satisfied | 33 | 82.5% |
| *Ambiguous*, staff number requested, verification succeeded | 7 | 17.5% |
| **Incorrect identification** | **0** | **0.0%** |

In all seven ambiguous cases the correct sibling was the highest-scoring
candidate, but the other scored within 0.10, so the function named nobody. **The
system does not now distinguish the siblings reliably; it recognises that it
cannot, and asks.** Only the second claim is supported by the data. Under the
earlier design those seven would have been resolved by taking the highest score
— the exact operation that produced the false acceptance.

### 5.6.4 Performance and acceptance

| Measure | Value |
|---|---|
| Mean end-to-end check-in, fingerprint / fallback | 2.9 s / 4.6 s |
| Mean enrolment duration per staff member | 4 min 12 s |
| Mean presentation attempts per successful check-in | 1.18 |
| Check-ins by fingerprint / face / staff number | 92.7% / 7.3% / 1.4% |
| TAM: perceived usefulness / ease of use (mean of 22) | 4.41 / 4.32 |

Both paths meet NFR-3, a check-in within five seconds. The lowest-scoring
questionnaire item was ease of use in the facial fallback, where participants
were uncertain where to look and how long to hold still — an interface finding
rather than a recognition one, carried into Section 6.4.

### 5.6.5 Discussion

The five research questions are answered by the results above and the
conclusions drawn from them in Chapter Six. One finding warrants discussion
here, beside its evidence.

**The misidentification was observed, not hypothesised.** Had the sample
contained only visually dissimilar volunteers, the failure would not have
occurred, the margin safeguard would have stayed untested, and this thesis would
have reported a clean result for a system carrying a latent defect. It was a
property of the matching mode rather than a defect of the code, as Jain et al.
(2004) predict for identification and Sami et al. (2022) document for
high-similarity face pairs. And the safeguard was inactive because the test
population was too small — a lesson about testing as much as about design, since
a safeguard depending on the state of the data cannot be validated against data
lacking that state. The response trades six keystrokes against a payroll record
attributed to an absent person, which is the asymmetric loss of Section 2.3.3
made concrete.

### 5.6.6 Comparison with the existing system

| Problem | Status | Evidence |
|---|---|---|
| P1 Identity not verified | Resolved | No path records attendance without a biometric match |
| P2 Times self-reported | Resolved | Times set by the database clock, not by the caller |
| P3 No link to roster | Resolved | Every record carries its shift; unscheduled attendance is flagged |
| P4 Departure entries omitted | **Partially** | Recorded when presented, but cannot be compelled |
| P5 Retrospective information only | Resolved | Live view updates as records are written |
| P6 Records alterable | Resolved | No role holds INSERT or UPDATE; approval does not alter times |
| P7 Manual transcription | Resolved | Export produces payroll-ready CSV directly |
| P8 No exception handling | Resolved | Events classified at recording, queued with the reason |

**P4 is the honest exception.** No technical measure available to this system
compels a departure scan. The improvement over the paper register is that the
omission is visible the same day and attributable to a specific person and
shift.

## 5.7 Chapter Summary

This chapter reported the implementation of the system across eight increments,
two of which produced findings that invalidated prior design decisions: the
discovery that no browser interface can reach a mass-storage-class fingerprint
device, and a false acceptance between closely related individuals under
one-to-many facial matching. The device programming interface was recovered
empirically and is documented in Appendix F, having been unavailable in any
published source.

Twenty-nine functional test cases were executed, of which twenty-six passed on
first execution and three exposed defects that were corrected. Accuracy was
measured over 645 recognition comparisons under normal and adverse conditions,
yielding no observed false acceptance in either modality at thresholds selected
from the measured distributions. Seven of the eight problems identified in the
existing system are resolved and one partially.
