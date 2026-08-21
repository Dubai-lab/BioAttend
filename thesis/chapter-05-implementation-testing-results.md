# CHAPTER FIVE: SYSTEM IMPLEMENTATION, TESTING AND RESULTS

## 5.1 Introduction

This chapter reports the implementation of the design in Chapter Four, the
testing conducted and the results obtained. Two matters are reported in greater
detail than the rest because they are contributions in their own right: the
recovery of an undocumented device programming interface (5.2.2), and a
misidentification failure found during evaluation with the design change made in
response (5.6.4).

## 5.2 System Development

Development proceeded in eight increments of design, implementation and testing.

| # | Increment | Outcome |
|---|---|---|
| 1 | Database, access control, authentication | Fifteen tables, each with its security policies in the same migration as the table |
| 2 | Device access via Web Serial | **Abandoned** — §5.2.1 |
| 3 | Recovery of the device interface | Recovered empirically — §5.2.2 |
| 4 | Enrolment and reader synchronisation | Consent enforced as a technical precondition |
| 5 | Attendance capture and shift logic | Station implemented as a continuous loop with no controls |
| 6 | Facial recognition | **Revised** after the finding in §5.6.4 |
| 7 | Administration, reporting, audit | Audit entries redact biometric fields and are append-only |
| 8 | Deployment | §5.2.3 |

### 5.2.1 Web Serial: a falsified assumption

The initial design proposed direct browser-to-device communication using Web
Serial, assuming the device presented a serial interface — an assumption drawn
from the vendor library's serial functions and from serial ports visible in the
host's device list.

It was false. The device registry showed those ports belonged to an unrelated
component, and that the device enumerated as `USB\VID_2009&PID_7638`, service
`USBSTOR` — mass storage, not a serial port. This invalidated every
browser-based route: Web Serial requires a port the device never creates, WebUSB
refuses protected interface classes of which mass storage is one, and File
System Access cannot address a volume that is a control channel rather than a
file system.

**Finding: no browser API can reach a fingerprint device of this class.** A
local intermediary is a necessity, not a design preference. The episode is
reported because the wrong assumption is a plausible one — the vendor's library
contains serial code belonging to a different model in the same family — and
because the method that resolved it generalises: read the operating system's
device registry for vendor and product identifiers rather than inferring from
port names.

### 5.2.2 Recovery of the device programming interface

The device came with a 32-bit Windows library and a demonstration application
but no header, specification or documentation. The library exported function
names but not their signatures, which cannot be recovered from a binary by
inspection.

An equivalent library for a different platform, published in an unrelated
open-source project, declared the names and argument lists for that platform.
These were taken as an initial hypothesis, which proved partially incorrect.
Five controlled probes established the corrections using one diagnostic rule:
**an access violation while writing indicates a missing out-pointer; an access
violation while reading indicates an argument that is dereferenced rather than
used as a value.**

The probes established that every Windows export takes the other platform's
signature plus a leading device-context pointer obtained from the open call
(`Function(void* ctx, nAddr, …)`); that the device reports attached units by
drive letter; and that the search functions take two separate output pointers
rather than the single array the other binding suggested.

**An undocumented return code was found.** The search functions return `0x47` on
no match, alongside the documented `0x09`. This appears in no published
documentation for the protocol family. Both must be treated as "not found", or a
device returning it surfaces an ordinary non-match to the user as a system
fault.

The recovered interface is tabulated in **Appendix F**. Neither it nor the
diagnostic method was available in any published source at the time of study.

---

> **[DIAGRAM 5.1]** — Interface recovery process: hypothesis from the alternative
> platform binding → probe → fault classification → revised hypothesis →
> verified signature.

---

### 5.2.3 Deployment

The interfaces were deployed as a static build to a hosting platform, with the
database and authentication on the managed service. The bridge remains on each
station, since it reaches hardware attached to that machine.

One behaviour appeared only after deployment. The site is served over HTTPS from
a public origin while the bridge answers plain HTTP on loopback, and browsers
treat that as a **private network access** requiring both a server opt-in and
the user's permission. The bridge was extended to answer the preflight. A denied
permission is indistinguishable from a stopped bridge, because the request is
blocked before it is sent and the bridge logs nothing, so both causes are named
in the interface.

---

> **[DIAGRAM 5.2]** — Deployment topology: hosted static site and managed
> database in one region, and the station with its local bridge and attached
> reader. Mark which connections cross the public internet and which stay on the
> machine.

---

## 5.3 Technologies Used

The tools and technologies used, with the justification for each, are set out in
Section 3.4. Two constraints from that section shaped the implementation
reported here and are restated because the results depend on them: **the facial
recognition models are pretrained and were not trained in this study**, and
**fingerprint matching is performed by the device firmware** using a proprietary
algorithm that could not be inspected. The fingerprint accuracy in Section 5.6
therefore characterises the device rather than an algorithm written for this
research.

## 5.4 User Interface

The console presents a navigation sidebar filtered by role and shows the status
of the biometric services, since an administrator needs to know whether the
reader is reachable before attempting an enrolment. The station differs by an
order of magnitude in type size and by the removal of all navigation: one
message at a time, sized for reading at two metres, clearing automatically so
the next person does not see the previous person's name.

---

> **[SCREENSHOT 5.1]** — Console overview, summary tiles and today's activity.
>
> **[SCREENSHOT 5.2]** — Enrolment, fingerprint step: finger targets, capture
> progress, and the consent panel with capture disabled.
>
> **[SCREENSHOT 5.3]** — Enrolment, face step: camera preview with the live
> anti-spoofing verdict and the five head positions.
>
> **[SCREENSHOT 5.4]** — Live attendance, showing method, match score, status.
>
> **[SCREENSHOT 5.5]** — Station success state: name, staff number, shift, time.
>
> **[SCREENSHOT 5.6]** — Station refusing a scan outside the window.

---

## 5.5 System Testing

Testing followed the four-level strategy set out in Section 3.8 — unit,
integration, functional and security — and the accuracy trial protocol described
in Section 3.7. Twenty-nine functional cases were executed against real hardware
rather than simulated responses; the full matrix with results appears in
Appendix E. Results are reported below.

## 5.6 Test Results

All figures are computed from the system's own attempt log, exported as CSV.
Every attempt, accepted or refused, is written to that log by the recording
function, so the dataset is a complete record of the trials rather than a
transcription of them.

### 5.6.1 Functional test results

Of twenty-nine cases, **twenty-six passed on first execution and three failed**.
All three were defects in the system rather than in the test definitions, and
all three were corrected and re-executed successfully.

| Case | Failure observed | Resolution |
|---|---|---|
| TC14 | A check-out at 06:10 for a shift begun 22:00 the previous evening was refused; shift date was resolved from the timestamp, not from the date the shift began | Resolution searches from the previous day to the next, so a shift crossing midnight is found |
| TC25 | A supervisor retrieved staff from a second department; the policy tested role but not department | Policy compares the actor's department against the row's |
| TC29 | With the fingerprint service stopped the station accepted no input, although the facial path was available | Station falls through to face and names both possible causes |

TC14 and TC29 were found only because the test set contained cases drawn from
the conditions of a hospital rather than of a desk. A suite exercising only
daytime shifts with all services running would have passed twenty-nine of
twenty-nine and left both defects in place.

### 5.6.2 Fingerprint recognition accuracy

| Measure | Value |
|---|---|
| Participants attempting / successfully enrolled | 22 / 21 |
| Genuine attempts / impostor comparisons | 210 / 105 |
| Genuine score: mean (SD), range | 78.4 (11.6), 41 – 97 |
| Impostor score: mean (SD), range | 12.7 (8.9), 0 – 34 |
| Failure to enrol (FTE) | 1 of 22 (4.5%) |
| Failure to acquire (FTA) | 14 of 210 (6.7%) |
| Operating threshold | 45 |
| FAR at threshold | 0 of 105 (0.00%; 95% CI upper bound 2.9%) |
| FRR at threshold | 8 of 196 (4.1%) |
| Mean identification time | 1.31 s (SD 0.24) |

The distributions do not overlap: highest impostor 34, lowest genuine 41. The
threshold of 45 sits in that gap, nearer the genuine end, because a false
rejection costs a repeat presentation while a false acceptance credits
attendance to the wrong person.

**One participant could not be enrolled.** All four fingers produced templates
below the quality floor; the ridge detail was visibly worn. That participant
used the facial path throughout without difficulty. It is the most direct
evidence in this study for the multimodal argument — a fingerprint-only system
would have excluded them entirely.

---

> **[DIAGRAM 5.3]** — Fingerprint genuine and impostor score distributions, with
> the threshold at 45 marked and the gap between 34 and 41 visible.

---

### 5.6.3 Facial recognition accuracy

Comparison is by cosine similarity between 512-dimension ArcFace embeddings. The
figures are from the final model; the earlier model, under which the
misidentification below occurred, produced the figures reported in 5.6.4.

| Measure | Value |
|---|---|
| Participants enrolled with face | 22 |
| Genuine / impostor comparisons | 220 / 110 |
| Genuine: mean (SD), range | 0.847 (0.068), 0.612 – 0.934 |
| Impostor, all: mean (SD), range | 0.242 (0.101), 0.031 – 0.641 |
| Impostor, excluding sibling pair | 0.221 (0.074), 0.031 – 0.438 |
| **Sibling pair, genuine** | 0.856 mean, 0.812 – 0.901 |
| **Sibling pair, impostor** | 0.571 mean, 0.494 – 0.641 |
| **Sibling pair, separation margin** | 0.171 |
| Equal error rate | 0.9% at similarity 0.632 |
| Operating threshold / margin over runner-up | 0.68 / 0.10 |
| FAR at threshold | 0 of 110 (0.00%; 95% CI upper bound 2.7%) |
| FRR at threshold | 5 of 220 (2.3%) |

**The sibling pair is a separate population.** Unrelated impostors reached 0.438
at most; the siblings reached 0.641. Reporting all impostor comparisons as one
distribution gives a mean of 0.242 and conceals that ten of the 110 behave
nothing like the other hundred.

**The threshold was set above the equal error rate deliberately.** Operating at
the EER is conventional and wrong here, because the costs are asymmetric: a
false rejection asks a member of staff to type their staff number, a false
acceptance writes a payroll-bearing record in the name of someone absent.

**A zero false acceptance rate is not a claim of zero risk.** By the rule of
three the 95% upper bound is 3/110, or 2.7%. The rate is below 2.7% at 95%
confidence; it is not zero.

---

> **[DIAGRAM 5.4]** — Facial genuine and impostor similarity distributions, with
> the ten sibling impostor comparisons as a third, separately coloured series.
>
> **[DIAGRAM 5.5]** — FAR and FRR against threshold, with the equal error rate at
> 0.632 and the operating point at 0.68 marked.

---

### 5.6.4 Misidentification finding

During evaluation of the one-to-many facial path, the system recorded attendance
for the wrong individual. A participant not enrolled in the system presented
their face and was identified as an enrolled participant to whom they are
closely related.

| Comparison | Similarity |
|---|---|
| Enrolled participant against own enrolled face | 0.69 – 0.80 |
| Sibling against the enrolled participant's face | 0.69 – 0.78 |
| Operating threshold at the time | 0.62 |

**The two distributions overlapped completely.** No threshold could admit the
genuine participant while excluding the sibling.

A second factor was identified. The matching function contained a margin
condition intended to refuse a decision when two individuals score closely. It
**had not been exercised**, because only one individual was enrolled and there
was no runner-up against which to compute a margin. The safeguard designed for
precisely this failure was inactive because the enrolled population was too
small to activate it.

**Two findings arise.** First, one-to-many facial identification with a small
enrolled population does not discriminate between similar individuals: with few
identities enrolled the comparison approximates *"does this face resemble the
enrolled one?"* rather than *"which of these people is this?"*, and most human
faces satisfy the former. Second, a margin-based safeguard cannot be validated
on a single-identity population — testing that omits the multi-identity case
leaves the safeguard untested while the system appears to work.

**Design response.** One-to-many identification is retained as the first
fallback, because a check-in requiring typing is one staff will avoid. But the
function now returns an identity only if the best match both exceeds the
threshold **and** beats the runner-up by a configured margin. Where either
fails it returns *ambiguous*, naming nobody, and the system requests the staff
number and performs one-to-one verification against the asserted identity.

**Confirmatory trial.** Both siblings were then enrolled simultaneously, the
model replaced, and the threshold and margin set to the values above. Each
presented twenty times.

| Outcome | Occurrences | Proportion |
|---|---|---|
| Correct identification, margin satisfied | 33 | 82.5% |
| *Ambiguous*, staff number requested, verification succeeded | 7 | 17.5% |
| **Incorrect identification** | **0** | **0.0%** |

In all seven ambiguous cases the correct sibling was the highest-scoring
candidate, but the other scored within 0.10, so the function named nobody. **The
system does not now distinguish the siblings reliably; it recognises that it
cannot, and asks.** Those are different claims, and only the second is supported
by the data. Under the earlier design those seven would have been resolved by
taking the highest score — the exact operation that produced the false
acceptance.

### 5.6.5 Adverse conditions and presentation attacks

| Condition | Presentations | Successful | Rate |
|---|---|---|---|
| Fingerprint, normal | 210 | 196 | 93.3% |
| Fingerprint, dampened | 42 | 27 | 64.3% |
| Fingerprint, dried after hand rub | 42 | 35 | 83.3% |
| Face, normal illumination | 220 | 215 | 97.7% |
| Face, ~80 lux | 44 | 39 | 88.6% |

**Dampness is the dominant failure condition** — a hardware property, since
moisture bridges the ridge valleys, and not correctable in software. Its
significance here is that clinical staff sanitise their hands many times per
shift and arrive at the station having just done so. Reduced illumination
degraded facial matching without defeating it, and the five failures were
refusals rather than misidentifications: the system became less able to
recognise people in poor light, not more likely to recognise the wrong one.

| Attack | Attempts | Rejected | Mean liveness score |
|---|---|---|---|
| Printed photograph | 10 | 10 | 0.09 |
| Photograph on a phone screen | 10 | 10 | 0.14 |
| Live face (control) | 40 | 0 | 0.88 |

Against a threshold of 0.55, artefacts and live faces are widely separated and
every artefact was rejected before any embedding was computed. **Twenty attempts
support a weaker claim than the table suggests:** by the rule of three the upper
bound is approximately 15%. The measurements show the stage functions against
two common attack types; they do not establish a detection rate in the sense of
ISO/IEC 30107-3 (ISO, 2023), which requires a far larger and more varied attack
set, including the three-dimensional artefacts catalogued by Ramachandra and
Busch (2017).

**The fingerprint device performs no liveness detection**, established from the
recovered interface — no presentation attack function is exposed and no liveness
indication returned. No fingerprint spoofing trial was conducted because there
is nothing to measure. This is reported as a limitation, not an untested pass.

### 5.6.6 Access control results

Each test ran against a live database using the credentials of an account
holding the stated role, not by calling application code with checks disabled —
these policies are enforced by the database, and testing them through the
application would show only that the application asks politely.

| Test | Expected | Observed |
|---|---|---|
| Supervisor reads biometric templates | No rows | 0 rows |
| Supervisor reads another department's staff | No rows | 0 rows |
| Direct insert into attendance | Denied | `permission denied for table attendance` |
| Direct update of a check-in time | Denied | `permission denied for table attendance` |
| Attendance function, invalid or absent credential | Rejected | Rejected, logged |
| Attendance function, valid credential | Recorded | Recorded, logged |
| Anonymous client reads staff | No rows | 0 rows |

All behaved as specified. The two refused writes are the significant results:
the prohibition on writing attendance directly is enforced by the database, not
by the absence of a button in the interface. **A privilege withheld at the point
of the grant cannot be recovered by an attacker who controls the browser.**

### 5.6.7 Performance and usability

| Measure | Value |
|---|---|
| Mean fingerprint identification / face verification time | 1.31 s / 2.14 s |
| Mean end-to-end check-in, fingerprint / fallback | 2.9 s / 4.6 s |
| Mean enrolment duration per staff member | 4 min 12 s |
| Mean presentation attempts per successful check-in | 1.18 |
| Check-ins by fingerprint / face / staff number | 92.7% / 7.3% / 1.4% |
| TAM: perceived usefulness / ease of use (mean) | 4.41 / 4.32 |

Both TAM constructs were measured on a five-point scale across 22 respondents.
The lowest-scoring item was ease of use in the facial fallback, where
participants were uncertain where to look and how long to hold still — an
interface finding rather than a recognition one. Both paths meet NFR-3
(check-in within five seconds), though the fallback's margin is narrow and
dominated by model inference on a CPU.

## 5.7 Discussion of Results

**RQ1 — weaknesses of current practice.** The eight problems in Section 4.3
correspond closely to those in Section 2.4, with one exception. Prior studies
describe manual registers as producing incorrect data. What was observed here is
narrower and more troubling: the register produces data that is *not obviously
incorrect*. An entry recording an arrival at 07:00 is indefensible only if
someone knows the person arrived at 07:40, and nobody does once the pay period
closes. The record is not wrong so much as carrying no evidence of its own
reliability.

**RQ2 — combining the two modalities.** The serial architecture worked on both
counts. 92.7% of check-ins completed on fingerprint alone at 2.9 seconds; a
parallel architecture would have imposed the slower path on every transaction to
improve an error rate already below the sample's confidence interval — the
throughput advantage Marcialis et al. (2024) establish for serial fusion. On
coverage, one participant of twenty-two could not enrol at all and 6.7% of
presentations failed to acquire, rising to 35.7% with a damp fingertip. Ross and
Jain (2003) identify coverage of individuals one modality cannot serve as a
principal benefit; this study observed that case rather than asserting it. In a
hospital the condition that most degrades fingerprint capture — wet hands — is
the condition infection control requires, so the second modality is an
operational requirement of the setting rather than a refinement.

**RQ3 — architecture for browser-based biometrics.** The finding that no browser
API can reach the device constrains a class of systems, not just this one. The
consequence is a local bridge — an extra component and an extra failure mode, as
TC29 showed — but the bridge holds no privilege: it captures and reports, and
the authority to record attendance stays behind a credential it does not hold,
verified in 5.6.6. The security model is unchanged by its existence.

**RQ4 — preventing misattribution.** This is the central finding, and three
things about it matter. It was **observed, not hypothesised** — had the sample
contained only visually dissimilar volunteers the failure would not have
occurred, the safeguard would have stayed untested, and this thesis would have
reported a clean result for a system carrying a latent defect. It was a
**property of the matching mode, not a defect of the code**, as Jain et al.
(2004) predict for identification and Sami et al. (2022) document specifically
for high-similarity face pairs, and as the measured distributions confirm. And the **safeguard was
inactive because the test population was too small**, which is a lesson about
testing as much as about design: a safeguard depending on the state of the data
cannot be validated against data lacking that state. The response trades
convenience for correctness — six keystrokes against a payroll record
attributed to an absent person — which is the asymmetric loss of Section 2.3.3
made concrete.

**RQ5 — accuracy and threshold selection.** Both thresholds came from the
measured distributions, not from vendor defaults or figures published for other
populations. Comparison with Section 2.4 must be careful: accuracies there range
from 95% to above 99% but derive from different population sizes, sensors,
conditions and matching modes, with several reporting verification accuracy
while describing an identification system. What can be said is narrower and more
useful for deployment — on this population, under these conditions, no false
acceptance was observed in 215 impostor comparisons, an upper bound of
approximately 1.4% at 95% confidence.

**Comparison with the existing system.**

| Problem | Status | Evidence |
|---|---|---|
| P1 Identity not verified | Resolved | No path records attendance without a biometric match |
| P2 Times self-reported | Resolved | Times set by the database clock, not supplied by the caller |
| P3 No link to roster | Resolved | Every record carries its shift; unscheduled attendance is flagged |
| P4 Departure entries omitted | **Partially** | Recorded when presented, but cannot be compelled |
| P5 Retrospective information only | Resolved | Live view updates as records are written |
| P6 Records alterable | Resolved | No role holds INSERT or UPDATE; approval annotates without altering times |
| P7 Manual transcription | Resolved | Export produces payroll-ready CSV directly |
| P8 No exception handling | Resolved | Events classified at recording, queued for review with the reason |

**P4 is the honest exception.** A member of staff who leaves without presenting
a finger leaves no departure record, and no technical measure available to this
system prevents that. The improvement over the paper register is that the
omission is visible the same day and attributable to a specific person and
shift.
