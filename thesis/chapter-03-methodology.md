# CHAPTER THREE: RESEARCH METHODOLOGY

## 3.1 Introduction

This chapter describes the methods used to design, build and evaluate the
proposed system. It sets out the research approach and its justification, the
methodology followed in developing the software, the tools and technologies
employed, the study population and sampling strategy, the instruments and
procedures used to collect data, the methods used to test the system and analyse
the results, and the ethical considerations governing the handling of biometric
data.

Because the study produces a functioning software artefact rather than testing a
hypothesis about an existing phenomenon, the methodology has two halves: a
design and construction method for the artefact, and an empirical method for
evaluating it.

## 3.2 Research Design and Approach

The study adopts a **Design Science Research (DSR)** approach, supplemented by
an **experimental evaluation** of the resulting artefact and a **descriptive
survey** of user perception. The overall design is therefore **mixed-method**:
quantitative data from recognition trials and system logs is combined with
qualitative data from observation and open questionnaire responses.

Design science is appropriate where the contribution is the creation and
evaluation of an artefact addressing an identified problem rather than the
explanation of an existing phenomenon (Hevner et al., 2004). Hevner et al.
require that the research produce a purposeful artefact addressing a relevant
problem, that it be rigorously evaluated, and that it contribute to the
knowledge base. This study satisfies each: the artefact is a multimodal
biometric attendance system; the problem is the inability of existing methods to
verify identity, include staff whose biometrics fail, and validate attendance
against shifts; the evaluation is reported in Chapter Five; and the contribution
includes both the architecture and the documented recovery of an undocumented
device interface.

**The quantitative component** measures recognition accuracy, error rates and
transaction times under controlled conditions. **The qualitative component**
captures the difficulties participants encountered and their perceptions of the
system, which the quantitative data cannot express. Neither alone would answer
the research questions: accuracy figures say nothing about whether staff will
use the system, and perception data says nothing about whether it identifies
them correctly.

## 3.3 System Development Methodology

Construction followed an **iterative and incremental** methodology rather than a
sequential (waterfall) model. This choice was not incidental but was
necessitated by two conditions of the project.

**Hardware behaviour was undocumented.** The fingerprint device was supplied
without a programming interface specification for the target platform, so its
interface had to be established empirically. The design could not be finalised
before implementation began, which a sequential model requires.

**A design assumption failed during evaluation.** Testing of the facial
recognition subsystem revealed a misidentification that invalidated the initial
matching design, requiring the architecture to be revised mid-project. A
sequential methodology offers no mechanism to accommodate such a finding once
the design phase has closed.

Development therefore proceeded in **eight increments**, each a complete pass
through the same five activities, with the outcome of each informing the next:

| Activity | What it produced in each increment |
|---|---|
| Requirements gathering | The functions and constraints that increment would satisfy, drawn from the analysis in Chapter Four |
| System analysis and design | Data models, interface designs and processing logic, expressed in UML and data flow notation |
| Implementation | Working code integrated with the existing system |
| Testing | Unit, integration and functional tests for the new behaviour, plus regression over earlier increments |
| Evaluation | A judgement on whether the increment behaved as designed, and what the next must address |

Two increments produced findings that falsified a prior design decision and
forced a return to design rather than progression to the next increment. These
are the feedback paths shown in Figure 3.1, and they are reported in full in
Sections 5.2.1 and 5.6.3. The eight increments and their outcomes are tabulated
in Section 5.2.

---

> **[DIAGRAM 3.1]** — Iterative development cycle: Design → Implement → Test →
> Evaluate, with a feedback arrow returning to Design. Annotate the two
> iterations where findings forced a design change: device interface discovery,
> and face matching mode revision.

---

## 3.4 Tools and Technologies Used

The following tools and technologies were used to develop, test and deploy the
system. Selection was governed by three constraints: the application had to run
in an ordinary browser on hospital machines; access control had to be
enforceable below the application layer; and the fingerprint device required a
32-bit library that cannot be loaded by a 64-bit process.

| Tool / Technology | Purpose |
|---|---|
| Visual Studio Code | Development environment for all source code |
| React 18.3 with TypeScript 5.9 | Building the administrative console and check-in station interfaces; static typing prevents a class of error in code handling biometric identifiers |
| Vite 5.4 | Build tooling and code splitting, used to isolate the machine-learning runtime from the main bundle |
| Tailwind CSS 4.0 | Interface styling, with design tokens defined once and applied across two very different interface densities |
| Supabase (PostgreSQL) | Database, authentication, and row-level security policies enforcing access control in the database rather than the application |
| pgvector | Vector similarity search, allowing facial comparison to run server-side so the station never receives biometric data |
| InsightFace `buffalo_l` (ArcFace) | Computing 512-dimension facial embeddings |
| @vladmandic/human 3.3.6 | Liveness and anti-spoofing checks in the browser, gating capture before any embedding is computed |
| Python 3.13 (32-bit) with `ctypes` | The local bridge service binding to the vendor's 32-bit fingerprint library; `ctypes` requires no compilation step, which was essential while the interface signatures were still being established |
| Vercel | Hosting the built application as a static site |
| Git and GitHub | Version control and change history |

Two provenance statements are made explicitly here, because the distinction is
frequently blurred in project reporting.

**The facial recognition models are pretrained and were not trained as part of
this study.** The system computes embeddings using published models and compares
them; no model weights were modified. The accuracy attributable to those models
is a property of the published work (Deng et al., 2019), not a contribution of
this study.

**Fingerprint matching is performed by the device firmware.** The template
format is proprietary and the matching algorithm is neither published nor
inspectable. The fingerprint accuracy reported in Chapter Five therefore
characterises the device, not an algorithm written for this research.

## 3.5 Study Area and Target Population

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
reporting. Patients are excluded, as the system addresses staff attendance only.

Development and testing were carried out in a controlled setting rather than
within an operating hospital, for the reasons given in Section 3.10.

## 3.6 Sampling and Sample Size

**Purposive (non-probability) sampling** was used. Participants were selected on
availability and capacity to exercise the system's functions rather than
randomly, which is appropriate for design science evaluation, where the object
is to test an artefact's behaviour under identifiable conditions rather than to
generalise a population parameter.

A **deliberate inclusion criterion** was applied in addition: the sample was
constructed to include at least one pair of closely related individuals of
similar facial appearance. This was not incidental. Facial recognition error
concentrates in cases of high inter-personal similarity, with identical twins
and look-alikes representing the hardest cases presented to such systems (Sami
et al., 2022), and **a sample of visually dissimilar participants cannot reveal
the misidentification failure mode the study set out to examine.** Including a
sibling pair is a form of adversarial or worst-case sampling, chosen so the
system was tested against the condition most likely to defeat it.

The sample comprised **22 participants**, each to be enrolled with both
modalities, including **one sibling pair**. Whether every participant could in
fact be enrolled on both is a result rather than a premise, and is reported in
Section 5.6.1.

Sample size was set by the requirements of the measurements rather than by a
statistical power calculation. Two considerations govern it. First, **error
rates computed from few trials carry wide confidence intervals**: where no error
is observed in *n* trials, the upper bound of the 95% confidence interval is
approximately 3/*n*, so twenty trials support no claim stronger than "below
15%". Figures precise enough to be worth reporting require several hundred
comparisons in total. Second, **impostor comparisons must be generated
deliberately** — they do not arise in ordinary use, where everyone presenting is
genuine.

The resulting design, stated as planned rather than as achieved:

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

## 3.7 Data Collection Methods and Instruments

Four categories of data were collected.

**System-generated performance data** is the principal quantitative source.
Every recognition attempt, successful or not, is written to a log recording the
modality, the match score, the decision and its reason — an objective record of
system behaviour that does not depend on participant recall or observer
judgement. This logging was designed into the system specifically to support the
evaluation.

**Controlled recognition trials** were conducted under defined conditions.
*Genuine trials* had an enrolled participant present their own biometric, used
to measure false rejection. *Impostor trials* compared a participant's sample
against a different enrolled identity, used to measure false acceptance.
*Presentation attack trials* presented a printed photograph and a photograph
displayed on a mobile screen to the camera. *Adverse condition trials* repeated
fingerprint presentation with damp and with dried fingertips, and facial
presentation under approximately 80 lux, to characterise behaviour under
conditions expected in a hospital.

Each participant presented their own biometric on ten occasions across two
sessions per modality, and each participant's sample was compared against five
other enrolled identities. The sibling pair contributed ten further comparisons.
Attack trials comprised ten presentations of each artefact type, against forty
live presentations as a control.

**Observation** recorded what the log does not: enrolment duration, presentation
attempts before success, and points at which participants hesitated or needed
instruction. Notes were taken on a structured observation form recording
enrolment duration, fingers attempted, captures rejected for quality or
liveness, attempts to success per trial, and a checklist of difficulties
observed.

**A questionnaire** measured perceived usefulness and perceived ease of use
following the Technology Acceptance Model (Davis, 1989), on a five-point Likert
scale. Five items measured perceived usefulness (speed, accuracy, resistance
to attendance recorded in one's name, usefulness at work, and the value of
checking one's own record) and five measured perceived ease of use (ease of
learning, clarity of each step, effort required on each modality, and clarity of
the outcome shown), followed by three open questions.

| Instrument | Data collected | Purpose |
|---|---|---|
| System attempt log | Modality, score, decision, reason, timestamp | Accuracy measurement (FAR, FRR, distributions) |
| Attendance records | Times, method, status against roster | Shift validation accuracy |
| Trial protocol sheet | Trial type, participant, expected and observed outcome | Comparison of expected against actual behaviour |
| Observation form | Enrolment duration, attempts per success, difficulty | Usability and throughput |
| TAM questionnaire | Perceived usefulness and ease of use | User acceptance |
| Threshold sweep export | Score for every comparison | Determination of operating threshold from data |

The system's export function, which produces a comma-separated file containing
every recognition attempt with its score and outcome, served as the primary
instrument for accuracy analysis.

## 3.8 System Testing Methods

Testing was applied at four levels.

**Unit testing** exercised individual functions in isolation, particularly the
packet construction and parsing of the device protocol, and the window
computation for shifts crossing midnight.

**Integration testing** verified the paths between browser, bridge, device and
database end to end, using real hardware rather than simulated responses, since
the device's behaviour was itself the subject of investigation.

**Functional testing** executed each requirement specified in Chapter Four as
one or more test cases with defined preconditions, inputs and expected outputs.
Twenty-nine cases were defined, one or more per requirement; results are
reported in Section 5.5.

**Security testing** consisted of deliberate attempts to perform actions the
system is designed to prevent: recording attendance without a station
credential, accessing biometric records as a supervisor, and presenting
artefacts to the biometric sensors.

Functional cases fall into two groups, and the distinction matters. **Positive
cases** verify that the system performs a required function — enrolment
completes, a check-in is recorded, an export produces the expected columns.
**Negative cases verify that the system refuses what it should refuse** —
capture before consent is recorded, attendance submitted without a station
credential, a supervisor reading biometric records, a scan outside every shift
window, a photograph presented to the camera. A system that performs its
functions but fails to refuse invalid operations would satisfy the first group
entirely while being unfit for use, so the negative cases are the more
informative of the two here.

Access control tests were executed against a live database using the credentials
of an account holding the role under test, rather than by calling application
code with the checks disabled. These policies are enforced by the database, and
testing them through the application would demonstrate only that the application
asks politely.

Results of all testing are reported in Section 5.6.

## 3.9 Data Analysis Methods

**Descriptive statistics.** Match scores were summarised by modality using mean,
standard deviation, minimum and maximum, reported separately for genuine and
impostor comparisons.

**Error rate computation.** Following the decision-theoretic framework set out by
Jain et al. (2004), for each candidate threshold *t* the false acceptance rate
FAR(*t*) is the proportion of impostor comparisons scoring ≥ *t*, and the false
rejection rate FRR(*t*) is the proportion of genuine comparisons scoring < *t*.

**Threshold determination.** Rather than adopting a threshold from the
literature or from the device vendor, FAR and FRR were computed across the range
of observed scores and plotted, the **Equal Error Rate** identified, and the
operating threshold selected deliberately **above** the EER — accepting a higher
false rejection rate in exchange for a lower false acceptance rate. The
justification for this asymmetry is given in Section 2.3.3: a false rejection
inconveniences a staff member who retries, whereas a false acceptance places an
incorrect name in a permanent record.

**Separation analysis.** For the closely-related participant pair, the margin
between the genuine score and the nearest impostor score was computed
specifically, since that margin rather than the absolute score determines
whether the system can distinguish the two individuals at all.

**Failure to enrol and acquire.** FTE was computed as the proportion of
participants for whom no usable template could be captured; FTA as the
proportion of presentation attempts producing no usable sample.

**Throughput.** Mean and median transaction times were computed for each
recognition path.

**Qualitative analysis.** Observation notes and open-ended questionnaire
responses were analysed by **thematic analysis** following Braun and Clarke
(2006), coding responses into recurring themes concerning ease of use, perceived
fairness, privacy concern and confidence in the system.

## 3.10 Ethical Considerations

Biometric data is uniquely identifying and, unlike a password, cannot be
reissued if compromised (Jain et al., 2008). Rwanda's Law No. 058/2021
classifies it as sensitive personal data requiring clear and unambiguous consent
before processing (Republic of Rwanda, 2021). Its collection therefore imposes
obligations beyond those attaching to ordinary personal data.

**Informed consent.** No biometric sample was captured from any participant
without prior informed consent. Participants were told what would be captured
and for what purpose; that mathematical templates rather than images would be
stored, and that these cannot be reversed into a fingerprint or photograph; who
would be able to access the data; how long it would be retained and how
destroyed; and that participation was voluntary and could be withdrawn at any
time without consequence. **Consent is enforced by the system itself** rather
than by procedure alone: the enrolment interface prevents biometric capture
until three distinct consent conditions have been recorded. The blank form
issued to participants stated what would be captured, that templates rather
than images would be stored, who could access them, the retention period, and
the right to withdraw, and required a separate initial against each of the three
consent statements.

**Data minimisation.** The system stores biometric templates and embeddings
only. No fingerprint image is retained after the template is extracted and no
facial photograph is stored at any point, which limits the harm arising from any
compromise of the database.

**Access control.** Access to biometric records is restricted to administrators.
Departmental supervisors, who require attendance data for their staff, have no
access to biometric records at all. The restriction is enforced at the database
level by row-level security policies rather than by application logic, so it
cannot be bypassed by an alternative client.

**Purpose limitation.** Data collected was used solely for evaluating the
system. No attendance record generated during testing was used for any
employment, disciplinary or payroll purpose, and participants were informed of
this.

**Anonymity in reporting.** Participants are identified by code (P1, P2, …)
rather than by name. Where the closely-related participant pair is discussed,
they are identified only by their relationship, which is material to
interpreting the result, and not by identity.

**Right to withdraw and deletion.** Participants were informed of their right to
withdraw and to have their biometric records deleted. The system implements
deletion of biometric records independently of attendance history, so withdrawal
of biometric consent does not require destruction of the operational record.

**Institutional approval.** Ethical clearance for the evaluation was obtained
from the Faculty of Information System Management, University of Lay Adventists
of Kigali, prior to any biometric data being collected. Because the evaluation
was conducted with volunteer participants rather than in an operating hospital,
no institutional review by a health facility was required. A live deployment
would additionally require approval from the hospital's own governance process
and registration of the processing activity under Rwanda's data protection
framework — a requirement carried into the recommendations in Chapter Six.

**Data security.** Biometric data was stored in a managed database with access
restricted by authenticated role. Credentials were held in environment
configuration excluded from version control. The system's audit facility records
access to and modification of records, and explicitly redacts biometric payloads
from log entries so that the audit trail does not become a secondary, less
protected copy of the biometric data.
