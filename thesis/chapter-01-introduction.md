# CHAPTER ONE: INTRODUCTION

## 1.1 Background of the Study

Accurate records of who was present, and when, sit underneath almost everything
a hospital does. Payroll is calculated from them, shift handovers depend on
them, and when a ward is short-staffed at three in the morning the record of who
was rostered and who actually arrived is the only evidence available afterwards.
Unlike most workplaces, a hospital cannot absorb an unnoticed absence: a nurse
who does not appear for a night shift leaves patients without care, not merely
work undone.

This matters more acutely where health workers are already scarce. Rwanda has
approximately 10.5 physicians, nurses and midwives per 10,000 population against
a World Health Organization threshold of 44.5 (WHO, 2016; [CITE: PEPFAR Rwanda
HRH evaluation]). Where staffing is a quarter of the recommended level, every
hour of unrecorded absence is proportionally more damaging. Studies of Rwandan
public health facilities identify absenteeism as a recurring performance
problem, alongside "ghost workers" who draw a salary while largely absent from
their posts ([CITE: Rwanda health worker performance study]; [CITE: CHUK
absenteeism study, 2020]). These are not failures of individual conscience so
much as failures of measurement: a system that cannot reliably establish
presence cannot manage it.

Most hospitals in the region still record attendance by a paper register, a card
or PIN clock, or a supervisor's timesheet. Each shares a defining weakness —
**none verifies that the person recorded is the person present**. A register can
be signed by a colleague, a card handed over, a PIN shared. The workforce
literature calls this *buddy punching* and reports that roughly 19% of employees
participate in it, costing around 2.2% of gross payroll ([CITE: Nucleus
Research]). Applied to a hospital the loss is not primarily financial: if a
shift is recorded as covered when it was not, the deficit surfaces as delayed
medication rounds, unobserved patients and a handover that never happened.

Biometric systems address substitution directly, binding the record to a
characteristic that cannot readily be transferred. But fingerprint recognition
alone is incomplete in a clinical setting, for reasons specific to the work.
Hospital staff wash their hands dozens of times per shift and use alcohol-based
sanitiser repeatedly; both degrade the ridge detail optical sensors depend on.
Staff wear gloves, sustain cuts and burns, and occasionally have hands bandaged.
The result is a minority who fail to enrol or fail to match consistently — and
**that minority is not random. The same people fail every morning.**

This motivates a **multimodal** approach. Facial recognition is a natural
complement: contactless, requiring no hardware beyond a webcam, and with failure
modes (lighting, occlusion, pose) largely uncorrelated with those of
fingerprint recognition. Where a fingerprint fails because a hand is bandaged, a
face is unaffected.

This study designs, implements and evaluates such a system, integrating
attendance capture with shift rostering so that a recorded arrival can be
evaluated against the shift the staff member was actually scheduled to work. It
was developed as a working artefact rather than a specification, using a
commercial optical fingerprint module, a standard webcam and a web-based
architecture, and tested against real hardware.

---

> **[DIAGRAM 1.1]** — Conceptual overview: staff at a station, the two biometric
> modalities, and the resulting attendance record validated against a shift
> roster. A simple block diagram; detailed architecture appears in Chapter Four.

---

## 1.2 Problem Statement

Hospitals require attendance records that are accurate, attributable to a
specific individual, and linked to the shift that individual was scheduled to
work. Existing methods in most facilities satisfy none of these reliably.

Manual and token-based systems cannot establish that the person recorded is the
person present. Where biometric systems have been introduced they are typically
**single-modality** — almost always fingerprint — creating a category of staff
who cannot use the system at all. Because hand condition in clinical work is a
persistent occupational characteristic rather than a transient one, these staff
are excluded repeatedly rather than occasionally, and are commonly handled by an
informal manual override that reintroduces the original weakness.

Most systems also record arrival times without reference to scheduling. A
timestamp alone does not distinguish a nurse arriving punctually for a night
shift from one arriving eight hours late for a morning shift.

A less-examined problem concerns misidentification. Systems that identify a
person from a biometric sample alone degrade in accuracy as the enrolled
population grows and may attribute a record to the wrong individual. In an
attendance system this failure is particularly damaging because it is **silent**:
the record appears valid, and the error surfaces only in payroll or in a
dispute, if at all.

**The problem this study addresses is therefore the absence of an attendance
system for hospital staff that simultaneously: (i) verifies identity
biometrically rather than by token, (ii) provides a functioning alternative for
staff whose primary biometric fails, (iii) validates each recorded event against
the staff member's scheduled shift, and (iv) refuses to record an attendance
event when identity cannot be established with confidence, rather than
attributing it to the closest match.**

## 1.3 Research Objectives

**General.** To design, implement and evaluate a biometric attendance and shift
management system for hospital staff using fingerprint and facial recognition,
producing records that are verifiable, attributable and validated against
scheduled shifts.

**Specific.**

1. To examine existing attendance practices and identify their weaknesses with
   respect to identity verification, inclusiveness and shift validation.
2. To design a multimodal architecture in which fingerprint recognition is
   primary and facial recognition provides a secondary path for staff whose
   fingerprints do not read reliably.
3. To implement the design as a working web application integrated with a
   fingerprint device and a standard camera, covering enrolment, rostering,
   attendance capture and administrative reporting.
4. To design and implement safeguards preventing the system from attributing a
   record to the wrong staff member, and preventing attendance being recorded
   from outside an authorised station.
5. To evaluate accuracy, usability and operational suitability through testing
   with human participants, determining matching thresholds from measured data
   rather than assumed values.

## 1.4 Research Questions

1. What weaknesses characterise current hospital attendance practices with
   respect to identity verification, staff inclusion and shift validation?
2. How can fingerprint and facial recognition be combined so that each modality
   compensates for the failure modes of the other?
3. What architecture allows a web-based attendance system to interface with
   biometric hardware while keeping biometric data and attendance authority
   under controlled access?
4. What mechanisms prevent a biometric attendance system from recording an event
   against the wrong staff member, and how effective are they against difficult
   cases?
5. What recognition accuracy does the implemented system achieve, and what
   thresholds are appropriate given the measured distribution of match scores?

## 1.5 Scope of the Study

The study covers staff enrolment, shift roster management, biometric check-in
and check-out, exception handling and supervisor approval, administrative
reporting and export, and role-based access for administrators and departmental
supervisors. Two modalities are implemented: fingerprint recognition using an
optical sensor module, and facial recognition using a standard webcam with
**pretrained** models — no models were trained in this study. The system is
designed for hospital staff, clinical and non-clinical, in a population of the
low hundreds consistent with a district or general hospital; patients are
explicitly out of scope. Shift structures follow the three-shift rotation common
to hospitals in the region.

**Out of scope:** payroll calculation, leave management, patient records,
clinical workflow, iris and voice recognition, and the regulatory process of
obtaining institutional approval to process biometric data in a live hospital —
though the technical and procedural requirements of informed consent are
implemented and discussed.

## 1.6 Significance of the Study

**To hospital administration**, the system provides records attributable to
individuals and validated against rosters, supporting accurate payroll and
evidence-based staffing decisions. **To health workers**, the second modality
includes staff whose fingerprints do not read reliably — a group typically
handled by informal exceptions — and protects them from being recorded absent
when present. **To the health system**, reliable presence data supports
allocation of scarce personnel and gives an evidential basis for addressing the
absenteeism and ghost-worker phenomena documented in the literature.

**To applied biometrics**, the study contributes a documented account of
integrating an undocumented commercial device into a modern web application,
including the recovery of its programming interface (Chapter Five), and an
empirically grounded treatment of a specific failure mode — misattribution under
one-to-many facial matching — including a measured instance of the failure and
the design change made in response.

## 1.7 Limitations of the Study

1. **Scale of testing.** Evaluated with a limited number of participants over a
   short period rather than deployed across a full hospital for months. Accuracy
   figures are indicative of behaviour under controlled conditions, not
   operational statistics from a live deployment.
2. **Single hardware configuration.** One fingerprint sensor and one camera.
   Results may differ with sensors of other resolution or sensing technology.
3. **Environmental conditions.** Testing was conducted under available indoor
   lighting rather than the full range found in hospital corridors.
4. **No live hospital deployment**, which would require institutional ethical
   approval and an implementation period beyond this study.
5. **Browser dependency.** The station requires a Chromium-based browser on a
   desktop operating system.
6. **Fingerprint matching is performed by the device firmware.** The proprietary
   algorithm could not be inspected or modified, so the reported fingerprint
   accuracy reflects the device rather than an algorithm designed here.

## 1.8 Definition of Key Terms

**Template** — a compact mathematical representation of a biometric sample,
stored in place of the original image. A fingerprint template here occupies 512
bytes and cannot be reversed into an image.

**Embedding** — a fixed-length vector computed from a face image, such that
vectors from the same person lie close together. This system uses
512-dimensional embeddings.

**Verification (one-to-one)** — confirming a claimed identity against the stored
template of one specific person. *"Is this the person they claim to be?"*

**Identification (one-to-many)** — determining identity by comparing against all
stored templates. *"Who is this?"* Less accurate than verification, and degrades
as the enrolled population grows.

**FAR / FRR** — the proportion of impostor attempts incorrectly accepted, and of
genuine attempts incorrectly rejected.

**Multimodal biometrics** — the use of two or more modalities in one system, so
the weaknesses of one are compensated by another.

**Presentation attack (spoofing)** — deceiving a biometric system with an
artefact such as a printed photograph or an artificial fingerprint. **Liveness
detection** determines whether a sample originates from a live person.

**Buddy punching** — one employee recording attendance for another who is
absent.

**Kiosk / check-in station** — a designated computer with attached biometric
hardware, registered with the server and authorised to record attendance.

**Row Level Security (RLS)** — a database mechanism restricting which rows a
user may read or modify, enforced by the database rather than by application
code.

**Shift window** — the bounded period around a scheduled shift during which the
system accepts a check-in or check-out.
