# CHAPTER ONE: INTRODUCTION

## 1.1 Background of the Study

Accurate records of who was present, and when, sit underneath almost everything a
hospital does. Payroll is calculated from them. Shift handovers depend on them.
When a ward is short-staffed at three in the morning, the record of who was
rostered and who actually arrived is the only evidence available afterwards.
Unlike most workplaces, a hospital cannot absorb an unnoticed absence: a nurse
who does not appear for a night shift leaves patients without care, not merely
work undone.

This matters more acutely in settings where health workers are already scarce.
Rwanda has approximately 10.5 physicians, nurses and midwives per 10,000
population, against a World Health Organization threshold of 44.5 per 10,000
considered necessary to deliver essential health services (WHO, 2016;
[CITE: PEPFAR Rwanda HRH evaluation, NCBI]). Where staffing is already a
quarter of the recommended level, every hour of unrecorded absence is
proportionally more damaging than it would be in a well-resourced system.

The problem is compounded by weak attendance monitoring. Studies of Rwandan
public health facilities have identified absenteeism as a recurring performance
problem, alongside the phenomenon of "ghost workers" — individuals who draw a
public-sector salary while being largely absent from their posts
([CITE: Rwanda health worker performance study]). Research at the University
Teaching Hospital of Kigali specifically examined employee absenteeism as a
measurable operational concern ([CITE: CHUK absenteeism study, 2020]). These are
not failures of individual conscience so much as failures of measurement: a
system that cannot reliably establish presence cannot manage it.

### 1.1.1 The limits of conventional attendance systems

Most hospitals in the region still record attendance by one of three means: a
paper register signed on arrival, a card or PIN-based clock, or a manual
timesheet compiled by a supervisor. Each shares a defining weakness — none of
them verifies that the person recorded is the person present.

A paper register can be signed by a colleague. A card can be handed over. A PIN
can be shared. This substitution is common enough in workforce management
literature to have its own name: **buddy punching**. Research by Nucleus Research
found that approximately 19% of employees participate in buddy punching, and
that 74% of employers experience payroll losses as a result, amounting to around
2.2% of gross payroll ([CITE: Nucleus Research, via Asure Software]). The
American Payroll Association estimates employers lose an average of 4.5 hours
per employee per week to time theft in its various forms
([CITE: American Payroll Association]).

Applied to a hospital, the loss is not primarily financial. If a shift is
recorded as covered when it was not, the deficit surfaces as delayed medication
rounds, unobserved patients and a handover that never happened.

### 1.1.2 Biometric identification as a response

Biometric systems address substitution directly by binding the attendance record
to a physical characteristic that cannot readily be transferred. A fingerprint
cannot be lent to a colleague in the way a card can. Fingerprint recognition in
particular has become the most widely deployed biometric modality for workforce
attendance, owing to low sensor cost, fast matching and general public
familiarity ([CITE: biometrics adoption review]).

However, fingerprint recognition alone is an incomplete solution in a clinical
setting, for reasons specific to the work. Hospital staff wash their hands
dozens of times per shift and use alcohol-based sanitiser repeatedly. Both
degrade the ridge detail on which optical fingerprint sensors depend. Staff wear
gloves, sustain cuts and burns, and occasionally have hands bandaged. The result
is a population in which a minority of individuals fail to enrol or fail to
match consistently — and, critically, that minority is not random. The same
people fail every morning.

This motivates a **multimodal** approach, in which a second biometric modality
provides an alternative path to identification. Facial recognition is a natural
complement: it is contactless, requires no additional hardware beyond a webcam,
and its failure modes (lighting, occlusion, pose) are largely uncorrelated with
those of fingerprint recognition. Where a fingerprint fails because a hand is
bandaged, a face is unaffected.

### 1.1.3 The present study

This study designs, implements and evaluates a biometric attendance and shift
management system for hospital staff, combining fingerprint and facial
recognition, and integrating attendance capture with shift rostering so that a
recorded arrival can be evaluated against the shift the staff member was
actually scheduled to work.

The system was developed as a working software artefact rather than a
specification, using a commercially available optical fingerprint module, a
standard webcam, and a web-based architecture accessible from ordinary hospital
computers. It was implemented and tested against real hardware, and the
evaluation reported in Chapter Five is based on measurements taken from that
implementation.

---

> **[DIAGRAM 1.1]** — Conceptual overview of the proposed system: staff at a
> kiosk, the two biometric modalities, and the resulting attendance record
> validated against a shift roster. A simple block diagram is sufficient here;
> detailed architecture appears in Chapter Four.

---

## 1.2 Problem Statement

Hospitals require attendance records that are accurate, attributable to a
specific individual, and linked to the shift that individual was scheduled to
work. Existing methods in most facilities satisfy none of these requirements
reliably.

Manual and token-based systems cannot establish that the person recorded is the
person present, leaving them open to proxy attendance. Where biometric systems
have been introduced, they are typically **single-modality** — almost always
fingerprint — which creates a category of staff who cannot use the system at all
because their fingerprints do not read reliably. Because hand condition in
clinical work is a persistent occupational characteristic rather than a
transient one, these staff are excluded repeatedly rather than occasionally,
and are commonly handled by an informal manual override that reintroduces the
original weakness.

Furthermore, most attendance systems record arrival times without reference to
scheduling. A timestamp alone does not distinguish a nurse arriving punctually
for a night shift from one arriving eight hours late for a morning shift.
Without the roster as context, the record cannot support the operational
decisions it is supposed to inform.

A less-examined problem concerns misidentification. Systems that attempt to
identify a person from a biometric sample alone (one-to-many identification)
degrade in accuracy as the enrolled population grows, and may attribute a
record to the wrong individual. In an attendance system this failure is
particularly damaging, because it is silent: the record appears valid, and the
error surfaces only in payroll or in a dispute, if at all.

**The problem this study addresses is therefore the absence of an attendance
system for hospital staff that simultaneously: (i) verifies identity
biometrically rather than by token, (ii) provides a functioning alternative for
staff whose primary biometric fails, (iii) validates each recorded event against
the staff member's scheduled shift, and (iv) refuses to record an attendance
event when identity cannot be established with confidence, rather than
attributing it to the closest match.**

## 1.3 Research Objectives

### 1.3.1 General Objective

To design, implement and evaluate a biometric attendance and shift management
system for hospital staff that uses fingerprint and facial recognition to
produce attendance records which are verifiable, attributable and validated
against scheduled shifts.

### 1.3.2 Specific Objectives

1. To examine the existing attendance management practices in hospital settings
   and identify their specific weaknesses with respect to identity verification,
   inclusiveness and shift validation.

2. To design a multimodal biometric attendance architecture in which fingerprint
   recognition serves as the primary identification method and facial
   recognition provides a secondary path for staff whose fingerprints do not
   read reliably.

3. To implement the designed system as a functioning web-based application
   integrated with a fingerprint recognition device and a standard camera,
   including staff enrolment, shift rostering, attendance capture and
   administrative reporting.

4. To design and implement safeguards that prevent the system from attributing
   an attendance record to the wrong staff member, and that prevent attendance
   from being recorded from outside an authorised check-in station.

5. To evaluate the accuracy, usability and operational suitability of the
   implemented system through testing with human participants, and to determine
   appropriate matching thresholds from measured data rather than assumed
   values.

## 1.4 Research Questions

1. What weaknesses characterise current hospital staff attendance practices with
   respect to identity verification, staff inclusion and shift validation?

2. How can fingerprint and facial recognition be combined in an attendance
   system such that each modality compensates for the failure modes of the
   other?

3. What architecture allows a web-based attendance system to interface with
   biometric hardware while keeping biometric data and attendance authority
   under controlled access?

4. What mechanisms prevent a biometric attendance system from recording an
   attendance event against the wrong staff member, and how effective are they
   when tested against difficult cases?

5. What levels of recognition accuracy does the implemented system achieve, and
   what matching thresholds are appropriate given the measured distribution of
   match scores?

## 1.5 Scope of the Study

**Functional scope.** The study covers staff enrolment (biographic details,
fingerprint templates and facial descriptors), shift roster management,
biometric check-in and check-out, exception handling and supervisor approval,
administrative reporting and data export, and system configuration. It
implements role-based access for hospital administrators and departmental
supervisors.

**Biometric scope.** Two modalities are implemented: fingerprint recognition
using an optical sensor module, and facial recognition using a standard webcam
with pretrained recognition models. No biometric models were trained as part of
this study; pretrained models were used and are cited in Chapter Five.

**Population scope.** The system is designed for hospital staff — clinical,
allied health, support and administrative. Patients are explicitly out of scope.
The design assumes a staff population in the low hundreds, consistent with a
district or general hospital.

**Geographical and institutional scope.** The system was designed with reference
to a general hospital setting in Rwanda, and shift structures follow the
standard three-shift rotation (morning, evening, night) common to hospitals in
the region.

**Out of scope.** The study does not address payroll calculation, leave
management, patient records, or clinical workflow. It does not implement iris or
voice recognition. It does not address the legal or regulatory process of
obtaining institutional approval to process biometric data in a live hospital,
although the technical and procedural requirements of informed consent are
implemented and discussed.

## 1.6 Significance of the Study

**To hospital administration.** The system provides attendance records that are
attributable to individuals and validated against rosters, supporting accurate
payroll, evidence-based staffing decisions and the identification of persistent
absence patterns that manual registers obscure.

**To health workers.** By providing a second biometric modality, the system
includes staff whose fingerprints do not read reliably — a group typically
handled by informal exceptions under single-modality systems. It also protects
staff from being incorrectly recorded as absent when they were present.

**To the health system.** In contexts of acute health worker shortage, reliable
presence data supports better allocation of scarce personnel and provides an
evidential basis for addressing absenteeism and ghost-worker phenomena
documented in the literature.

**To the field of applied biometrics.** The study contributes a documented
account of integrating an undocumented commercial biometric device into a
modern web application, including the reverse-engineering of its programming
interface (Chapter Five). It also contributes an empirically grounded treatment
of a specific failure mode — the misattribution of identity under one-to-many
facial matching — including a measured instance of the failure and the design
change made in response.

**To future researchers and developers.** The complete system, its database
schema, access control model and evaluation data are documented in sufficient
detail to be replicated or extended.

## 1.7 Limitations of the Study

1. **Scale of testing.** The system was evaluated with a limited number of
   participants over a short period, rather than deployed across a full hospital
   staff over months. Accuracy figures should be read as indicative of system
   behaviour under controlled conditions, not as operational statistics from a
   live deployment.

2. **Single hardware configuration.** One model of fingerprint sensor and one
   camera were used. Results may differ with sensors of different resolution or
   sensing technology.

3. **Environmental conditions.** Facial recognition is sensitive to
   illumination. Testing was conducted under available indoor lighting rather
   than across the range of conditions found in hospital corridors at different
   hours.

4. **No live hospital deployment.** The system was tested with volunteer
   participants rather than in an operating hospital, as deploying a biometric
   system in a live clinical setting requires institutional ethical approval and
   an implementation period beyond the scope of this study.

5. **Browser dependency.** The implementation requires a Chromium-based browser
   on a desktop operating system for the check-in station, owing to the browser
   APIs required for camera access and local device communication.

6. **Fingerprint matching is performed by the device firmware.** The proprietary
   matching algorithm of the sensor module could not be inspected or modified,
   so the fingerprint accuracy reported reflects the device's performance rather
   than an algorithm designed in this study.

## 1.8 Definition of Key Terms

**Biometrics** — The automated recognition of individuals based on measurable
physiological or behavioural characteristics.

**Template** — A compact mathematical representation of a biometric sample,
stored in place of the original image. A fingerprint template in this system
occupies 512 bytes and cannot be reversed into a fingerprint image.

**Embedding (facial descriptor)** — A fixed-length vector of numbers computed
from a face image, such that vectors from the same person lie close together in
the vector space. This system uses 1,024-dimensional embeddings.

**Enrolment** — The process of capturing a person's biometric samples and
storing the resulting templates or embeddings against their record.

**Verification (one-to-one matching)** — Confirming a claimed identity by
comparing a fresh sample against the stored template of one specific person.
Answers the question *"is this the person they claim to be?"*

**Identification (one-to-many matching)** — Determining identity by comparing a
fresh sample against all stored templates. Answers *"who is this?"* Less
accurate than verification, and degrades as the enrolled population grows.

**False Acceptance Rate (FAR)** — The proportion of impostor attempts
incorrectly accepted as genuine.

**False Rejection Rate (FRR)** — The proportion of genuine attempts incorrectly
rejected.

**Multimodal biometrics** — The use of two or more biometric modalities within
one system, so that the weaknesses of one are compensated by another.

**Presentation attack (spoofing)** — An attempt to deceive a biometric system
using an artefact such as a printed photograph, a screen displaying an image, or
an artificial fingerprint.

**Liveness detection / anti-spoofing** — Techniques that determine whether a
biometric sample originates from a live person rather than an artefact.

**Buddy punching** — The practice of one employee recording attendance on behalf
of another who is absent.

**Kiosk** — In this system, a designated computer with attached biometric
hardware, registered with the server and authorised to record attendance.

**Row Level Security (RLS)** — A database mechanism that restricts which rows a
given user may read or modify, enforced by the database itself rather than by
application code.

**Shift window** — The bounded period around a scheduled shift during which the
system accepts a check-in or check-out.

## 1.9 Organisation of the Study

**Chapter One** introduces the problem, states the objectives and research
questions, and defines the scope and significance of the study.

**Chapter Two** reviews conceptual, theoretical and empirical literature on
biometric identification, multimodal systems and workforce attendance
management, and identifies the gap this study addresses.

**Chapter Three** describes the research methodology, including the research
design, population, sampling, data collection instruments, analysis methods and
ethical considerations.

**Chapter Four** analyses the existing attendance system, specifies the
requirements of the proposed system, and presents its design through use case,
entity-relationship, class, activity and sequence models together with the
database design.

**Chapter Five** documents the implementation, the technologies used, the user
interfaces, the testing conducted and the results obtained, and discusses those
results against the research questions.

**Chapter Six** summarises the findings, draws conclusions, offers
recommendations and identifies directions for future work.
