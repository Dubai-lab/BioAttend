# CHAPTER ONE: INTRODUCTION

## 1.1 Background of the Study

Accurate records of who was present, and when, sit underneath almost everything
a hospital does. Payroll is calculated from them, shift handovers depend on
them, and when a ward is short-staffed at three in the morning the record of who
was rostered and who actually arrived is the only evidence available afterwards.
Unlike most workplaces, a hospital cannot absorb an unnoticed absence: a nurse
who does not appear for a night shift leaves patients without care, not merely
work undone.

This matters more acutely where health workers are already scarce. The World
Health Organization (2016) established a threshold of 44.5 doctors, nurses and
midwives per 10,000 population as the density associated with attainment of the
health-related Sustainable Development Goals, superseding the earlier threshold
of 23 per 10,000 used for the Millennium Development Goals. Rwanda reported 10.5
doctors, nurses and midwives per 10,000 population in 2018, an increase from 8.8
in 2011 (National Academies of Sciences, Engineering, and Medicine [NASEM],
2020). At approximately a quarter of the recommended density, every hour of
unrecorded absence is proportionally more damaging than it would be in a
well-resourced system.

Absence is not a hypothetical concern in this setting. In a study of the
University Teaching Hospital of Kigali, the largest public referral hospital in
Rwanda, Munyaneza et al. (2024) found that 337 employees, or 38.3% of staff,
experienced absenteeism over the 2019 to 2020 period, and identified workload,
burnout and job dissatisfaction among the contributing factors. Absenteeism of
this magnitude is not principally a failure of individual conscience; it is a
failure of measurement. A system that cannot reliably establish presence cannot
manage it, and cannot distinguish authorised absence from unauthorised.

### 1.1.1 The limits of conventional attendance systems

Most hospitals in the region still record attendance by a paper register, a card
or PIN clock, or a supervisor's timesheet. Each shares a defining weakness:
**none verifies that the person recorded is the person present**. A register can
be signed by a colleague, a card handed over, a PIN shared. Akinduyite et al.
(2013) identify impersonation and proxy attendance as the persistent failures of
paper-based methods, and demonstrate empirically that a biometric alternative
removes them, reporting a false acceptance rate of 0% across 117 participants.
The workforce management literature terms the substitution *buddy punching*, and
industry surveys place employee participation at approximately 19%, with
associated losses of about 2.2% of gross payroll (Nucleus Research, as cited in
Asure Software, 2023).

Applied to a hospital, the loss is not primarily financial. If a shift is
recorded as covered when it was not, the deficit surfaces as delayed medication
rounds, unobserved patients and a handover that never happened.

### 1.1.2 Biometric identification and its limits in clinical work

Biometric systems address substitution directly, binding the record to a
characteristic that cannot readily be transferred. Jain et al. (2004) define
biometric recognition as automated identification from physiological or
behavioural characteristics, and establish that no single characteristic
satisfies all the criteria of a good biometric optimally, which is the
foundational argument for combining modalities. Fingerprint recognition has
become the most widely deployed modality for workforce attendance, and
Akinduyite et al. (2013) measured it as approximately 76% faster than a manual
register, at 4.29 seconds per user against 18.48 seconds.

Fingerprint recognition alone is nonetheless incomplete in a clinical setting,
for reasons specific to the work. Optical sensors depend on ridge contrast,
which degrades with the condition of the skin surface. Galbally et al. (2024),
in an operational study of almost 16,000 subjects, demonstrate measurable
variability in fingerprint recognition performance across population segments,
with quality falling markedly in groups whose ridge detail is worn. Hospital
staff wash their hands dozens of times per shift and use alcohol-based sanitiser
repeatedly; they wear gloves, sustain cuts and burns, and occasionally have
hands bandaged. The result is a minority who fail to enrol or fail to match
consistently, and **that minority is not random. The same people fail every
morning.**

This motivates a **multimodal** approach. Ross and Jain (2003) identify
increased population coverage as a principal benefit of multibiometric systems,
since an individual unable to present one modality may present another. Facial
recognition is a natural complement: contactless, requiring no hardware beyond a
webcam, and with failure modes largely uncorrelated with those of fingerprint
recognition. Where a fingerprint fails because a hand is bandaged, a face is
unaffected. Facial recognition accuracy has advanced substantially since Schroff
et al. (2015) introduced the embedding paradigm with FaceNet, and Deng et al.
(2019) improved class separation further with ArcFace.

This study designs, implements and evaluates such a system, integrating
attendance capture with shift rostering so that a recorded arrival can be
evaluated against the shift the staff member was actually scheduled to work. It
was developed as a working artefact rather than a specification, using a
commercial optical fingerprint module, a standard webcam and a web-based
architecture, and tested against real hardware. Because biometric data is
classified as sensitive personal data under Rwandan law and requires clear and
unambiguous consent before processing (Republic of Rwanda, 2021), consent was
implemented as a technical precondition of enrolment rather than an
administrative instruction.

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
person present (Akinduyite et al., 2013). Where biometric systems have been
introduced they are typically **single-modality**, almost always fingerprint,
creating a category of staff who cannot use the system at all. Because hand
condition in clinical work is a persistent occupational characteristic rather
than a transient one (Galbally et al., 2024), these staff are excluded
repeatedly rather than occasionally, and are commonly handled by an informal
manual override that reintroduces the original weakness.

Most systems also record arrival times without reference to scheduling. A
timestamp alone does not distinguish a nurse arriving punctually for a night
shift from one arriving eight hours late for a morning shift.

A less-examined problem concerns misidentification. Jain et al. (2004) establish
that one-to-many identification degrades in accuracy as the enrolled population
grows, so a system identifying a person from a biometric sample alone may
attribute a record to the wrong individual. In an attendance system this failure
is particularly damaging because it is **silent**: the record appears valid, and
the error surfaces only in payroll or in a dispute, if at all.

**The problem this study addresses is therefore the absence of an attendance
system for hospital staff that simultaneously: (i) verifies identity
biometrically rather than by token, (ii) provides a functioning alternative for
staff whose primary biometric fails, (iii) validates each recorded event against
the staff member's scheduled shift, and (iv) refuses to record an attendance
event when identity cannot be established with confidence, rather than
attributing it to the closest match.**

## 1.3 Research Objectives

**General objective.** To design, implement and evaluate a biometric attendance
and shift management system for hospital staff using fingerprint and facial
recognition, producing records that are verifiable, attributable and validated
against scheduled shifts.

**Specific objectives.**

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
**pretrained** models (Deng et al., 2019); no models were trained in this study.
The system is designed for hospital staff, clinical and non-clinical, in a
population of the low hundreds consistent with a district or general hospital;
patients are explicitly out of scope. Shift structures follow the three-shift
rotation common to hospitals in the region.

**Out of scope:** payroll calculation, leave management, patient records,
clinical workflow, iris and voice recognition, and the regulatory process of
obtaining institutional approval to process biometric data in a live hospital,
though the consent requirements of Rwandan data protection law (Republic of
Rwanda, 2021) are implemented and discussed.

## 1.6 Significance of the Study

**To hospital administration**, the system provides records attributable to
individuals and validated against rosters, supporting accurate payroll and
evidence-based staffing decisions. Given absenteeism of the magnitude reported
by Munyaneza et al. (2024) at a comparable Rwandan referral hospital, a
measurement instrument is a precondition of any management response.

**To health workers**, the second modality includes staff whose fingerprints do
not read reliably, a group Ross and Jain (2003) identify as the principal
beneficiaries of multimodal design and that single-modality deployments
typically handle by informal exception. It also protects staff from being
recorded absent when they were present.

**To the health system**, reliable presence data supports the allocation of
scarce personnel in a context where workforce density stands at roughly a
quarter of the WHO (2016) threshold (NASEM, 2020).

**To applied biometrics**, the study contributes a documented account of
integrating an undocumented commercial device into a modern web application,
including the recovery of its programming interface (Chapter Five), and an
empirically grounded treatment of a specific failure mode — misattribution under
one-to-many facial matching — including a measured instance of the failure and
the design change made in response.

## 1.7 Limitations of the Study

1. **Scale of testing.** The system was evaluated with a limited number of
   participants over a short period rather than deployed across a full hospital
   for months. Accuracy figures are indicative of behaviour under controlled
   conditions, not operational statistics from a live deployment.
2. **Single hardware configuration.** One fingerprint sensor and one camera were
   used. Results may differ with sensors of other resolution or sensing
   technology.
3. **Environmental conditions.** Testing was conducted under available indoor
   lighting rather than the full range of conditions found in hospital
   corridors.
4. **No live hospital deployment**, which would require institutional ethical
   approval and an implementation period beyond the scope of this study.
5. **Browser dependency.** The check-in station requires a Chromium-based
   browser on a desktop operating system.
6. **Fingerprint matching is performed by the device firmware.** The proprietary
   algorithm could not be inspected or modified, so the reported fingerprint
   accuracy reflects the device rather than an algorithm designed here.

## 1.8 Definition of Key Terms

**Template.** A compact mathematical representation of a biometric sample,
stored in place of the original image; templates are not reversible into the
original sample (Jain et al., 2004). A fingerprint template in this system
occupies 512 bytes.

**Embedding.** A fixed-length vector computed from a face image such that
vectors from the same person lie close together in the vector space (Schroff et
al., 2015). This system uses 512-dimensional embeddings.

**Verification (one-to-one matching).** Confirming a claimed identity against
the stored template of one specific person: *"is this the person they claim to
be?"* (Jain et al., 2004).

**Identification (one-to-many matching).** Determining identity by comparing
against all stored templates: *"who is this?"* Less accurate than verification,
and degrades as the enrolled population grows (Jain et al., 2004).

**False Acceptance Rate (FAR) and False Rejection Rate (FRR).** The proportion
of impostor attempts incorrectly accepted, and of genuine attempts incorrectly
rejected, respectively.

**Failure to enrol (FTE).** The proportion of a population for whom no usable
biometric template can be captured (Galbally et al., 2024).

**Multimodal biometrics.** The use of two or more modalities within one system
so that the weaknesses of one are compensated by another (Ross & Jain, 2003).

**Presentation attack (spoofing).** An attempt to deceive a biometric system
using an artefact such as a printed photograph or an artificial fingerprint.
**Liveness detection** determines whether a sample originates from a live
person.

**Buddy punching.** The practice of one employee recording attendance on behalf
of another who is absent.

**Kiosk / check-in station.** A designated computer with attached biometric
hardware, registered with the server and authorised to record attendance.

**Row Level Security (RLS).** A database mechanism restricting which rows a
given user may read or modify, enforced by the database itself rather than by
application code.

**Shift window.** The bounded period around a scheduled shift during which the
system accepts a check-in or check-out.
