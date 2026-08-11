# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Introduction

This chapter describes the methods used to design, implement and evaluate the
proposed system. It presents the research design and its justification, the
study area and population, the sampling approach, the instruments and procedures
used to collect data, the methods used to analyse it, and the ethical
considerations governing the handling of biometric data.

Because the study produces a functioning software artefact rather than testing a
hypothesis about an existing phenomenon, the methodology combines a design
science approach for construction with quantitative and qualitative methods for
evaluation.

## 3.2 Research Design

This study adopts a **Design Science Research (DSR)** approach, supplemented by
an **experimental evaluation** of the resulting artefact and a **descriptive
survey** of user perception.

### 3.2.1 Justification for design science

Design science is appropriate where the research contribution is the creation
and evaluation of an artefact intended to solve an identified problem, rather
than the explanation of an existing phenomenon (Hevner, March, Park & Ram,
[CITE: verify — Design Science in Information Systems Research, MIS Quarterly,
2004]). Hevner et al. specify that design science research must produce a
purposeful artefact addressing a relevant problem, that the artefact must be
rigorously evaluated, and that the research must contribute to the knowledge
base.

This study satisfies those criteria: the artefact is a multimodal biometric
attendance system; the problem is the inability of existing hospital attendance
methods to verify identity, include staff whose biometrics fail, and validate
attendance against shifts; the evaluation is reported in Chapter Five; and the
contribution includes both the architecture and the documented reverse
engineering of an undocumented biometric device interface.

### 3.2.2 Development methodology

System construction followed an **iterative and incremental** development
approach rather than a sequential waterfall model. This choice was not
incidental — it was necessitated by two conditions of the project:

1. **Hardware behaviour was undocumented.** The fingerprint device was supplied
   without a programming interface specification for the target platform. Its
   interface had to be established empirically, which meant the design could not
   be finalised before implementation began.

2. **A design assumption failed during evaluation.** Testing of the facial
   recognition subsystem revealed a misidentification that invalidated the
   initial matching design, requiring the architecture to be revised
   mid-project. A sequential methodology offers no mechanism to accommodate
   such a finding.

Development therefore proceeded in increments, each comprising design,
implementation and testing, with the outcome of each informing the next. This
is documented in Chapter Five, including the increments in which design
assumptions were falsified and revised.

---

> **[DIAGRAM 3.1]** — Iterative development cycle: Design → Implement → Test →
> Evaluate, with a feedback arrow returning to Design. Annotate the two
> iterations where findings forced a design change (device interface
> discovery; face matching mode revision).

---

## 3.3 Study Area

The study was conducted with reference to a general hospital setting in Rwanda.
The system design assumes an institution with the following characteristics,
which are typical of district and general hospitals in the region:

- A staff population in the low hundreds, spanning clinical, allied health,
  support and administrative roles.
- Organisation into clinical departments — emergency, intensive care, general
  medicine, surgery, maternity, paediatrics and outpatient services — alongside
  diagnostic and administrative units.
- A three-shift daily rotation: morning (07:00–15:00), evening (15:00–23:00) and
  night (23:00–07:00).
- Departmental supervisors responsible for the attendance of their own staff,
  with hospital-wide oversight held by human resources administration.

System development and testing were carried out in a controlled setting rather
than within an operating hospital, for the reasons stated in Section 3.9.

## 3.4 Target Population

The target population comprises **hospital staff whose attendance must be
recorded**, together with the **administrative personnel who manage that
record**. Three groups are distinguished:

1. **Clinical and support staff** — the subjects of attendance recording. These
   are the users whose biometric characteristics the system must accommodate,
   including those whose hand condition is degraded by clinical hygiene
   practice.

2. **Departmental supervisors** — responsible for rostering their staff and for
   reviewing attendance exceptions within their own department.

3. **Hospital administrators / HR personnel** — responsible for staff enrolment,
   biometric capture, system configuration and hospital-wide reporting.

Patients are explicitly excluded from the population, as the system addresses
staff attendance only.

## 3.5 Sample Size and Sampling Techniques

### 3.5.1 Sampling technique

**Purposive (non-probability) sampling** was used for the evaluation.
Participants were selected on the basis of availability and their capacity to
exercise the system's functions, rather than randomly from a hospital
population. This is appropriate for design science evaluation, where the object
is to test the behaviour of an artefact under identifiable conditions rather than
to generalise a population parameter.

A **deliberate inclusion criterion** was applied in addition to availability:
the sample was constructed to include at least one pair of closely related
individuals of similar facial appearance. This was not incidental. Facial
recognition error concentrates in cases of high inter-personal similarity, and
a sample of visually dissimilar participants cannot reveal the misidentification
failure mode the study set out to examine. Including a sibling pair is a form of
**adversarial** or **worst-case** sampling, chosen so that the system was tested
against the condition most likely to defeat it.

### 3.5.2 Sample size

The evaluation sample comprised **22 participants**, all of whom were enrolled
with both fingerprint and facial biometrics. The sample included **one sibling
pair**, recruited deliberately for the reason given in Section 3.5.1.

Sample size was determined by the requirements of the measurements rather than
by a statistical power calculation, since the object is to characterise the
behaviour of an artefact rather than to estimate a population parameter. Two
considerations set the figure.

First, **error rates computed from few trials carry wide confidence intervals**.
Where no error is observed in *n* trials, the upper bound of the 95% confidence
interval is approximately 3/*n* — so twenty trials support no claim stronger
than "below 15%". Producing figures precise enough to be worth reporting
requires several hundred comparisons in total.

Second, **impostor comparisons must be generated deliberately**. They do not
arise during ordinary use, where every person presenting is genuine. The
protocol therefore includes trials in which a participant's sample is compared
against a different enrolled identity.

The resulting design:

| Trial type | Composition | Comparisons |
|---|---|---|
| Genuine | 22 participants × 10 attempts across two sessions | 220 |
| Impostor | 22 participants × 5 comparisons against other enrolled identities | 110 |
| **Total recognition comparisons** | | **330** |
| Presentation attack — printed photograph | 10 attempts | 10 |
| Presentation attack — image on a screen | 10 attempts | 10 |
| Adverse condition — damp and dry fingertips | 22 participants × 2 | 44 |
| Adverse condition — reduced illumination | 22 participants × 2 | 44 |

Genuine trials were spread across **two sessions on separate days** rather than
taken consecutively, so that the figures reflect day-to-day variation in
lighting, hand condition and presentation rather than a single favourable
moment.

The sibling pair contributed an additional focused set: each presented against
the other's enrolled identity, producing the comparison on which the
discrimination margin reported in Chapter Five is based.

The limitations arising from this sample size are stated in Section 1.7 and
discussed in Chapter Five.

## 3.6 Data Collection Methods

Four categories of data were collected.

### 3.6.1 System-generated performance data

The principal quantitative data source is the system itself. Every recognition
attempt — successful or not — is written to a log recording the modality used,
the match score returned, the decision reached and the reason for that decision.
This yields an objective record of system behaviour that does not depend on
participant recall or observer judgement.

This design decision was made during implementation specifically to support the
evaluation, and is described in Chapter Four.

### 3.6.2 Controlled recognition trials

Structured trials were conducted in which participants presented their
biometrics under defined conditions:

- **Genuine trials** — an enrolled participant presenting their own biometric,
  used to measure the false rejection rate.
- **Impostor trials** — a participant presenting their biometric while the
  system attempted to match it against a different enrolled individual, used to
  measure the false acceptance rate.
- **Presentation attack trials** — a printed photograph and a photograph
  displayed on a mobile screen presented to the camera, used to evaluate
  anti-spoofing.
- **Adverse condition trials** — fingerprint presentation with damp and with dry
  fingers, and facial presentation under reduced illumination, used to
  characterise behaviour under conditions expected in a hospital.

### 3.6.3 Observation

Direct observation was used to record operational characteristics not captured
by the system log: the time taken to complete an enrolment, the number of
presentation attempts required before success, and points at which participants
hesitated or required instruction. Observation notes were recorded on a
structured form (Appendix [X]).

### 3.6.4 Questionnaire

A structured questionnaire was administered to participants after they had used
the system, measuring perceived usefulness and perceived ease of use in line
with the constructs of the Technology Acceptance Model (Davis, 1989). Items were
rated on a five-point Likert scale. The instrument is reproduced in
Appendix [X].

## 3.7 Data Collection Instruments

| Instrument | Data collected | Purpose |
|---|---|---|
| System attempt log | Modality, match score, decision, reason, timestamp | Accuracy measurement (FAR, FRR, score distributions) |
| Attendance records | Check-in/out times, method, status against roster | Shift validation accuracy |
| Trial protocol sheet | Trial type, participant, expected outcome, observed outcome | Structured comparison of expected against actual behaviour |
| Observation form | Enrolment duration, attempts per success, points of difficulty | Usability and throughput |
| TAM questionnaire | Perceived usefulness, perceived ease of use | User acceptance |
| Threshold sweep export | Score for every comparison | Determination of operating threshold from data |

The system's export function, which produces a comma-separated file containing
every recognition attempt with its score and outcome, served as the primary
instrument for accuracy analysis. Its implementation is described in Chapter
Five.

## 3.8 Data Analysis Methods

### 3.8.1 Quantitative analysis

**Descriptive statistics.** Match scores were summarised by modality using mean,
standard deviation, minimum and maximum, reported separately for genuine and
impostor comparisons.

**Error rate computation.** For each candidate threshold *t*:

- **FAR(t)** = (impostor comparisons with score ≥ *t*) ÷ (total impostor
  comparisons)
- **FRR(t)** = (genuine comparisons with score < *t*) ÷ (total genuine
  comparisons)

**Threshold determination.** Rather than adopting a threshold from the
literature or from the device vendor, the operating threshold was determined
from the measured distributions. FAR and FRR were computed across the range of
observed scores and plotted, and the **Equal Error Rate** identified. The
operating threshold was then selected deliberately above the EER, accepting a
higher false rejection rate in exchange for a lower false acceptance rate. The
justification for this asymmetry is given in Section 2.3.3: a false rejection
inconveniences a staff member who retries, whereas a false acceptance places an
incorrect name in a permanent record.

**Separation analysis.** For the closely-related participant pair, the margin
between the genuine score and the nearest impostor score was computed
specifically, since this margin — rather than the absolute score — determines
whether the system can distinguish the two individuals at all.

**Failure to enrol and acquire.** FTE was computed as the proportion of
participants for whom a usable template could not be captured; FTA as the
proportion of presentation attempts producing no usable sample.

**Throughput.** Mean and median transaction times were computed for each
recognition path.

### 3.8.2 Qualitative analysis

Observation notes and open-ended questionnaire responses were analysed by
**thematic analysis**, coding responses into recurring themes concerning ease of
use, perceived fairness, privacy concern and confidence in the system.

### 3.8.3 Functional verification

System functional requirements were verified by **test case execution**. Each
requirement specified in Chapter Four was mapped to one or more test cases with
defined preconditions, inputs and expected outputs. Results are presented in the
test results section of Chapter Five as a requirements traceability matrix.

Testing addressed both positive cases (the system performs the required
function) and negative cases (the system correctly refuses invalid operations),
the latter being of particular importance for the access control and shift
window logic.

## 3.9 Ethical Considerations

Biometric data is uniquely identifying and, unlike a password, cannot be
reissued if compromised. Its collection therefore imposes obligations beyond
those of ordinary personal data, and the following measures were applied.

### 3.9.1 Informed consent

No biometric sample was captured from any participant without prior informed
consent. Participants were informed, before enrolment, of:

- what would be captured and for what purpose;
- that mathematical templates rather than images would be stored, and that these
  cannot be reversed into a fingerprint or photograph;
- who would be able to access the data;
- how long it would be retained and how it would be destroyed;
- that participation was voluntary and could be withdrawn at any time without
  consequence.

Consent was recorded before capture. This requirement was **enforced by the
system itself** rather than by procedure alone: the enrolment interface prevents
biometric capture until three distinct consent conditions have been recorded.
The design decision to make consent a technical precondition rather than an
administrative step is described in Chapter Four.

### 3.9.2 Data minimisation

The system stores biometric **templates and embeddings only**. No fingerprint
image is retained after the template is extracted, and no facial photograph is
stored at any point. This limits the harm arising from any compromise of the
database, since neither representation can be reconstructed into the original
biometric.

### 3.9.3 Access control

Access to biometric records is restricted to hospital administrators.
Departmental supervisors — who require attendance data for their staff — have no
access to biometric records at all. This restriction is enforced at the database
level by row-level security policies rather than by application logic, so that
it cannot be bypassed by an alternative client. The access control model is
detailed in Chapter Four.

### 3.9.4 Purpose limitation

Data collected was used solely for evaluating the system. No attendance record
generated during testing was used for any employment, disciplinary or payroll
purpose, and participants were informed of this.

### 3.9.5 Anonymity in reporting

Participants are identified in this report by code (P1, P2, …) rather than by
name. Where the closely-related participant pair is discussed, they are
identified only by their relationship, which is material to interpreting the
result, and not by identity.

### 3.9.6 Right to withdraw and deletion

Participants were informed of their right to withdraw and to have their
biometric records deleted. The system implements deletion of biometric records
independently of attendance history, so that withdrawal of biometric consent
does not require destruction of the operational record.

### 3.9.7 Institutional approval

Ethical clearance for the evaluation was obtained from the Faculty of
Information System Management, University of Lay Adventists of Kigali, prior to
any biometric data being collected. The blank consent form issued to
participants is reproduced in Appendix H.

Because the evaluation was conducted with volunteer participants rather than in
an operating hospital, no institutional review by a health facility was
required. A live deployment would additionally require approval from the
hospital's own governance process and registration of the processing activity
under Rwanda's data protection framework — a requirement noted in the
recommendations in Chapter Six.

### 3.9.8 Data security

Biometric data was stored in a managed database with access restricted by
authenticated role. Credentials were held in environment configuration excluded
from version control. The system's audit facility records access to and
modification of records, and explicitly redacts biometric payloads from log
entries so that the audit trail does not become a secondary, less protected copy
of the biometric data.

## 3.10 Chapter Summary

This chapter presented a design science methodology combining artefact
construction with experimental evaluation. An iterative development approach was
adopted, justified by the undocumented nature of the biometric hardware and by
the mid-project falsification of a design assumption. Purposive sampling was
used, with the deliberate inclusion of a closely-related participant pair to
expose the misidentification failure mode. Data collection combined
system-generated logs, controlled trials, observation and a questionnaire, with
analysis by descriptive statistics, threshold sweep, thematic analysis and test
case execution. Ethical measures centred on informed consent enforced by the
system, storage of templates rather than images, database-level access control
and purpose limitation.
