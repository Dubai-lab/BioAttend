# CHAPTER SIX: CONCLUSION AND RECOMMENDATIONS

## 6.1 Introduction

This chapter summarises the findings of the study, draws conclusions against the
objectives stated in Chapter One, offers recommendations to the institutions and
practitioners for whom the work is relevant, and identifies directions for
further research.

## 6.2 Summary of Findings

The study set out to design, implement and evaluate a multimodal biometric
attendance and shift management system for hospital staff. The findings are
summarised against each specific objective.

### 6.2.1 Objective 1 — Examination of existing practice

Analysis of the manual paper register in use established eight distinct
weaknesses (Section 4.3). The most significant is that the register
authenticates a signature rather than a person, making proxy attendance possible
and undetectable from the record itself. Three further weaknesses proved
equally consequential in practice: recorded times are self-reported and
therefore unverifiable; the register is maintained separately from the shift
roster, so a recorded time cannot be classified as punctual, late or
unscheduled; and information reaches management only after collection and
transcription, providing no view of staffing during a shift.

### 6.2.2 Objective 2 — Multimodal architecture

A serial multimodal architecture was designed in which fingerprint recognition
is primary and facial recognition provides a fallback invoked only on failure of
the primary path. The serial configuration was selected over parallel fusion on
throughput grounds: hospital shift changes concentrate arrivals into a short
window, and requiring two biometric presentations from every staff member
imposes a cost on the whole population to serve a minority.

> **[TO COMPLETE]** — State what proportion of transactions in testing required
> the fallback path, and whether any participant was unable to enrol on
> fingerprint. If no participant failed to enrol, say so — an absence of
> observed exclusion is a finding, and asserting a benefit that was not observed
> would be unsupported.

### 6.2.3 Objective 3 — Implementation

The system was implemented as a working web application integrated with a
commercial fingerprint device and a standard camera, comprising an
administrative console, a check-in station interface, a local device bridge and
a managed database. Twenty-nine functional requirements were specified and
implemented.

Two implementation findings emerged that were not anticipated at design time.

First, **no browser interface can communicate with a fingerprint device that
enumerates as a mass storage class device**. The initial architecture assumed
direct browser-to-device communication and was invalidated by this finding,
requiring a local bridge process. The bridge was designed to hold no authority,
so the additional component does not weaken the security model.

Second, the device was supplied without a programming interface specification,
and **its interface was recovered empirically**. The recovered signatures,
including a return code that appears in no published documentation for the
protocol family, are documented in Section 5.2.3.

### 6.2.4 Objective 4 — Safeguards against misattribution

Two safeguards were designed and implemented.

**Attendance authority resides in the database.** No browser-facing role holds
permission to insert an attendance record; the only path is a server-side
function requiring a credential belonging to a registered check-in station.
Possession of the application's public key is therefore insufficient to fabricate
an attendance record.

**Ambiguous biometric comparisons are refused rather than resolved.** Where two
enrolled individuals score within a configured margin of one another, the
matching function returns no identity and the system requires identity to be
asserted by other means.

The necessity of the second safeguard was demonstrated empirically. During
evaluation, one-to-many facial identification matched an unenrolled individual
to a closely related enrolled participant. Examination of the logged scores
established that the genuine and impostor similarity distributions overlapped
completely, so that no threshold could separate them. A margin condition
intended to prevent exactly this outcome was found to be inactive, because only
one individual was enrolled with facial biometrics and there was consequently no
second candidate against which to compute a margin.

This produced two findings of general applicability:

1. One-to-many facial identification with a small enrolled population does not
   reliably discriminate between similar individuals, because the comparison
   effectively asks whether a face resembles the enrolled one rather than which
   of several people it is.

2. A margin-based safeguard cannot be validated on a single-identity population.
   Testing that omits the multi-identity case leaves the safeguard untested while
   the system appears to function correctly.

The design was revised so that one-to-many identification returns an identity
only when the best match both exceeds a similarity threshold and beats the
runner-up by a margin. Where either condition fails, the system requests the
staff number and performs one-to-one verification against that asserted
identity. Speed is preserved for the common case; the decision is refused
precisely where it cannot be made safely.

### 6.2.5 Objective 5 — Evaluation

> **[TO COMPLETE]** — Summarise here, in three or four sentences: the number of
> participants and attempts; the observed accuracy for each modality; the
> threshold selected and the basis for selecting it; and the outcome of the
> presentation attack trials. Refer to the tables in Section 5.6 rather than
> repeating them.

## 6.3 Conclusion

The study demonstrates that a multimodal biometric attendance system combining
fingerprint and facial recognition can be implemented using commercially
available hardware and web technologies, and can produce attendance records that
are attributable to individuals and validated against scheduled shifts.

Three conclusions are drawn.

**First, multimodality in an attendance system is best understood as a coverage
measure rather than an accuracy measure.** The literature commonly justifies
multimodal biometrics by improved accuracy through fusion. In the hospital
context the more consequential benefit is population coverage: providing a route
for staff whose primary biometric fails persistently rather than occasionally.
Because hand condition in clinical work is an occupational characteristic and
not a random event, single-modality systems exclude the same individuals
repeatedly, and that exclusion is typically absorbed by informal manual override
which reintroduces the weakness the system was adopted to remove.

**Second, the operating mode of a biometric subsystem matters more than its
reported accuracy.** The same facial recognition models, unchanged, produced a
misidentification in one-to-many operation and reliable verification in
one-to-one operation. The determining factor was not model quality but the
question the system asked of it. Applied biometric systems should therefore
establish identity by the most reliable means available and use weaker
modalities to verify rather than to identify.

**Third, a biometric system's behaviour under uncertainty is a design decision,
not a technical detail.** A system that returns the nearest match when
comparisons are ambiguous will, in an attendance context, silently attribute a
record to the wrong person — an error that is not detected at the time and may
never be detected at all. Refusing to decide is a legitimate and, for records of
this kind, preferable outcome. The threshold and margin governing that refusal
express a policy about which of two asymmetric errors is more damaging, and
should be set deliberately rather than inherited from a vendor default.

The study also concludes that integrating commercial biometric hardware into
modern web applications remains substantially more difficult than the
availability of such hardware suggests, owing to absent documentation and to
browser security models that — correctly — prevent direct access to devices of
this class.

## 6.4 Recommendations

### 6.4.1 To hospital management

1. **Do not deploy a single-modality biometric attendance system in a clinical
   environment.** Hand hygiene practice degrades fingerprint quality
   systematically, and a proportion of staff will be excluded. Provide a
   designed second path rather than allowing an informal manual override to
   develop.

2. **Integrate attendance capture with rostering.** A timestamp without shift
   context cannot support the decisions attendance data is collected to inform.

3. **Establish a documented exception process.** Late arrivals, unscheduled
   attendance and missing check-outs will occur. A system that records and flags
   them, with named supervisor approval, produces a defensible record; one that
   refuses them produces staff who work around it.

4. **Obtain and record informed consent before biometric capture, and enforce it
   technically.** Making consent a precondition in the software rather than an
   instruction in a procedure ensures it cannot be omitted under time pressure.

5. **Restrict access to biometric records to the smallest role that requires
   it.** Supervisors require attendance data, not templates.

### 6.4.2 To system developers

1. **Verify device interface assumptions against the operating system's device
   registry** rather than inferring from vendor library contents or port names.
   Vendor libraries commonly support several models with different transports.

2. **Enforce access control at the database rather than in the application.**
   Interface-level restrictions are presentation; a second client bypasses them.

3. **Log every biometric attempt, including refusals.** Refused attempts are the
   only source of false rejection data and the only evidence available when a
   staff member disputes that the system failed them.

4. **Test biometric safeguards with a population large enough to activate
   them.** A margin-based safeguard tested against one enrolled identity is not
   tested at all.

5. **Select matching thresholds from measured distributions**, not from vendor
   defaults or published figures obtained on different hardware and populations.

### 6.4.3 To policymakers

1. Institutions deploying biometric systems for workforce management should be
   required to provide an alternative process for individuals unable to enrol, so
   that biometric failure does not become a barrier to employment or payment.

2. Guidance on biometric data handling in health institutions should address
   staff data explicitly, as existing guidance concentrates predominantly on
   patient identification.

## 6.5 Suggestions for Future Work

**Longitudinal deployment.** The system was evaluated over a short period with a
small sample. Deployment across a full hospital staff over several months would
establish whether accuracy holds as the enrolled population grows, and would
quantify the proportion of staff requiring the fallback path — the figure that
determines whether the multimodal design is justified in practice.

**Template ageing.** Fingerprint quality among healthcare workers is expected to
degrade over time with continued hand hygiene practice. A longitudinal study
could establish the rate of degradation and inform a re-enrolment schedule,
which no reviewed study currently provides.

**Contactless identity assertion.** The fallback path requires a staff number to
be typed. A radio-frequency identification badge would assert identity without
contact or typing while preserving the one-to-one verification model, and would
be a modest hardware addition.

**Fingerprint liveness detection.** The device used provides no presentation
attack detection. Evaluating software-based liveness detection on the captured
image, or the cost-benefit of sensors with integrated detection, would address a
vulnerability this study documents but does not resolve.

**Departmental scoping of identification.** Restricting one-to-many facial
search to the staff member's own department reduces the candidate population
substantially and would be expected to improve discrimination. This was designed
into the matching function but not evaluated.

**Comparative modality study.** A controlled comparison of fingerprint, face and
their combination on the same population, under hospital lighting and hand
conditions, would provide the modality selection guidance currently absent from
the literature for this specific environment.

**Integration with payroll and workforce planning.** The system produces
validated attendance data but does not act on it. Integration with payroll
computation and with staffing-level monitoring would realise the operational
benefit the data makes possible.

## 6.6 Chapter Summary

This chapter summarised the study's findings against its five objectives, drew
three conclusions concerning multimodality as a coverage measure, the primacy of
operating mode over model accuracy, and the treatment of behaviour under
uncertainty as a design decision. Recommendations were offered to hospital
management, developers and policymakers, and seven directions for further
research were identified.
