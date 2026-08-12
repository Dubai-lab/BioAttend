# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Introduction

This chapter describes the methods used to design, implement and evaluate the
proposed system. Because the study produces a functioning software artefact
rather than testing a hypothesis about an existing phenomenon, the methodology
combines a design science approach for construction with quantitative and
qualitative methods for evaluation.

## 3.2 Research Design

The study adopts a **Design Science Research** approach, supplemented by an
**experimental evaluation** of the resulting artefact and a **descriptive
survey** of user perception.

Design science is appropriate where the contribution is the creation and
evaluation of an artefact addressing an identified problem rather than the
explanation of an existing phenomenon (Hevner, March, Park & Ram, [CITE: verify
— MIS Quarterly, 2004]). Hevner et al. require that the research produce a
purposeful artefact addressing a relevant problem, that it be rigorously
evaluated, and that it contribute to the knowledge base. This study satisfies
each: the artefact is a multimodal biometric attendance system; the problem is
the inability of existing methods to verify identity, include staff whose
biometrics fail, and validate attendance against shifts; the evaluation is
reported in Chapter Five; and the contribution includes both the architecture
and the documented recovery of an undocumented device interface.

Construction followed an **iterative and incremental** approach rather than a
sequential model. This was not incidental but necessitated by two conditions.
**Hardware behaviour was undocumented** — the device was supplied without a
programming interface specification for the target platform, so its interface
had to be established empirically and the design could not be finalised before
implementation began. And **a design assumption failed during evaluation** —
testing of the facial subsystem revealed a misidentification that invalidated
the initial matching design, requiring revision mid-project. A sequential
methodology offers no mechanism to accommodate such a finding.

---

> **[DIAGRAM 3.1]** — Iterative development cycle: Design → Implement → Test →
> Evaluate, with a feedback arrow returning to Design. Annotate the two
> iterations where findings forced a design change: device interface discovery,
> and face matching mode revision.

---

## 3.3 Study Area and Population

The study was conducted with reference to a general hospital setting in Rwanda,
assuming characteristics typical of district and general hospitals in the
region: a staff population in the low hundreds spanning clinical, allied health,
support and administrative roles; organisation into clinical departments
alongside diagnostic and administrative units; a three-shift daily rotation of
morning (07:00–15:00), evening (15:00–23:00) and night (23:00–07:00); and
departmental supervisors responsible for their own staff, with hospital-wide
oversight held by human resources.

The target population comprises **hospital staff whose attendance must be
recorded** together with the **administrative personnel who manage that record**:
clinical and support staff as the subjects of attendance recording, including
those whose hand condition is degraded by clinical hygiene practice;
departmental supervisors who roster staff and review exceptions; and
administrators responsible for enrolment, biometric capture, configuration and
reporting. Patients are excluded.

Development and testing were carried out in a controlled setting rather than
within an operating hospital, for the reasons in Section 3.7.

## 3.4 Sampling and Sample Size

**Purposive (non-probability) sampling** was used. Participants were selected on
availability and capacity to exercise the system's functions rather than
randomly, which is appropriate for design science evaluation, where the object
is to test an artefact's behaviour under identifiable conditions rather than to
generalise a population parameter.

A **deliberate inclusion criterion** was applied in addition: the sample was
constructed to include at least one pair of closely related individuals of
similar facial appearance. This was not incidental. Facial recognition error
concentrates in cases of high inter-personal similarity, and **a sample of
visually dissimilar participants cannot reveal the misidentification failure
mode the study set out to examine.** Including a sibling pair is a form of
adversarial or worst-case sampling, chosen so the system was tested against the
condition most likely to defeat it.

The sample comprised **22 participants**, each to be enrolled with both
modalities, including **one sibling pair**. Whether every participant could in
fact be enrolled on both is a result rather than a premise and is reported in
Section 5.6.2.

Sample size was set by the requirements of the measurements rather than by a
power calculation. Two considerations govern it. First, **error rates computed
from few trials carry wide confidence intervals**: where no error is observed in
*n* trials, the 95% upper bound is approximately 3/*n*, so twenty trials support
no claim stronger than "below 15%". Figures precise enough to report require
several hundred comparisons. Second, **impostor comparisons must be generated
deliberately** — they do not arise in ordinary use, where everyone presenting is
genuine.

The resulting design, as planned rather than as achieved:

| Trial type | Composition | Comparisons |
|---|---|---|
| Genuine | 22 participants × 10 attempts across two sessions | 220 |
| Impostor | 22 participants × 5 comparisons against other identities | 110 |
| Presentation attack — printed photograph | 10 attempts | 10 |
| Presentation attack — image on a screen | 10 attempts | 10 |
| Adverse — damp and dry fingertips | 22 participants × 2 | 44 |
| Adverse — reduced illumination | 22 participants × 2 | 44 |

Genuine trials were spread across **two sessions on separate days** so the
figures reflect day-to-day variation in lighting, hand condition and
presentation rather than a single favourable moment. The sibling pair
contributed an additional focused set, each presenting against the other's
enrolled identity, producing the comparison on which the discrimination margin
in Chapter Five is based.

## 3.5 Data Collection

Four categories of data were collected.

**System-generated performance data** is the principal quantitative source.
Every recognition attempt, successful or not, is written to a log recording the
modality, the match score, the decision and its reason — an objective record of
system behaviour that does not depend on participant recall or observer
judgement. This was designed into the system specifically to support the
evaluation.

**Controlled recognition trials** comprised genuine trials (an enrolled
participant presenting their own biometric, measuring false rejection), impostor
trials (matching against a different enrolled individual, measuring false
acceptance), presentation attack trials, and adverse condition trials.

**Observation** recorded what the log does not: enrolment duration, presentation
attempts before success, and points at which participants hesitated or needed
instruction. Notes were taken on a structured form (Appendix H).

**A questionnaire** measured perceived usefulness and perceived ease of use
following the Technology Acceptance Model (Davis, 1989), on a five-point Likert
scale (Appendix I).

| Instrument | Data collected | Purpose |
|---|---|---|
| System attempt log | Modality, score, decision, reason, timestamp | Accuracy measurement (FAR, FRR, distributions) |
| Attendance records | Times, method, status against roster | Shift validation accuracy |
| Trial protocol sheet | Trial type, participant, expected and observed outcome | Comparison of expected against actual behaviour |
| Observation form | Enrolment duration, attempts per success, difficulty | Usability and throughput |
| TAM questionnaire | Perceived usefulness and ease of use | User acceptance |
| Threshold sweep export | Score for every comparison | Determination of operating threshold from data |

## 3.6 Data Analysis

**Descriptive statistics.** Match scores were summarised by modality using mean,
standard deviation, minimum and maximum, reported separately for genuine and
impostor comparisons.

**Error rates.** For each candidate threshold *t*, FAR(*t*) is the proportion of
impostor comparisons scoring ≥ *t*, and FRR(*t*) the proportion of genuine
comparisons scoring < *t*.

**Threshold determination.** Rather than adopting a threshold from the
literature or the vendor, FAR and FRR were computed across the range of observed
scores, the **Equal Error Rate** identified, and the operating threshold
selected deliberately **above** the EER — accepting a higher false rejection
rate for a lower false acceptance rate. The justification for this asymmetry is
in Section 2.3.3: a false rejection inconveniences a staff member who retries,
whereas a false acceptance places an incorrect name in a permanent record.

**Separation analysis.** For the closely-related pair, the margin between the
genuine score and the nearest impostor score was computed specifically, since
that margin rather than the absolute score determines whether the system can
distinguish the two individuals at all.

**FTE and FTA** were computed as the proportion of participants for whom no
usable template could be captured, and the proportion of presentations producing
no usable sample. **Throughput** was computed as mean and median transaction
time per recognition path.

**Qualitative data** — observation notes and open questionnaire responses — was
analysed by thematic coding into recurring themes of ease of use, perceived
fairness, privacy concern and confidence.

**Functional verification** mapped each requirement to one or more test cases
with defined preconditions, inputs and expected outputs, addressing both
positive cases (the system performs the required function) and negative cases
(it correctly refuses invalid operations), the latter being of particular
importance for access control and shift window logic.

## 3.7 Ethical Considerations

Biometric data is uniquely identifying and, unlike a password, cannot be
reissued if compromised. Its collection therefore imposes obligations beyond
those of ordinary personal data.

**Informed consent.** No sample was captured without prior informed consent.
Participants were told what would be captured and why; that templates rather
than images would be stored and cannot be reversed into a fingerprint or
photograph; who could access the data; how long it would be retained and how
destroyed; and that participation was voluntary and withdrawable without
consequence. **Consent is enforced by the system itself** rather than by
procedure alone: the enrolment interface prevents capture until three distinct
consent conditions are recorded. The blank form is in Appendix G.

**Data minimisation.** The system stores templates and embeddings only. No
fingerprint image is retained after extraction and no facial photograph is
stored at any point, which limits the harm arising from any compromise of the
database.

**Access control.** Biometric records are restricted to administrators;
departmental supervisors have none, enforced at the database level by row-level
security rather than by application logic, so it cannot be bypassed by an
alternative client.

**Purpose limitation and anonymity.** No attendance record generated during
testing was used for any employment, disciplinary or payroll purpose.
Participants are identified by code (P1, P2, …); the closely-related pair is
identified only by their relationship, which is material to interpreting the
result.

**Right to withdraw.** The system implements deletion of biometric records
independently of attendance history, so withdrawal of consent does not require
destruction of the operational record.

**Institutional approval.** Ethical clearance was obtained from the Faculty of
Information System Management, University of Lay Adventists of Kigali, prior to
any collection. Because the evaluation used volunteers rather than an operating
hospital, no health facility review was required; a live deployment would
additionally require the hospital's own governance approval and registration of
the processing activity under Rwanda's data protection framework — a point
carried into the recommendations in Chapter Six.

**Data security.** Data was stored in a managed database with access restricted
by authenticated role, credentials held in configuration excluded from version
control, and the audit facility redacts biometric payloads so the audit trail
does not become a secondary, less protected copy of the biometric data.
