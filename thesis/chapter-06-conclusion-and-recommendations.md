# CHAPTER SIX: CONCLUSION AND RECOMMENDATIONS

## 6.1 Introduction

This chapter summarises the findings against the objectives stated in Chapter
One, draws conclusions, offers recommendations, and identifies directions for
further research.

## 6.2 Summary of Findings

**Objective 1 — existing practice.** Analysis of the manual register identified
eight weaknesses (Section 4.3). The most significant is that it authenticates a
signature rather than a person, making proxy attendance possible and
undetectable from the record itself. Three others proved equally consequential:
times are self-reported and unverifiable; the register is maintained separately
from the roster, so a recorded time cannot be classified as punctual, late or
unscheduled; and information reaches management only after transcription,
providing no view of staffing during a shift.

**Objective 2 — multimodal architecture.** A serial architecture was designed in
which fingerprint recognition is primary and facial recognition is invoked only
on failure of the primary path, selected over parallel fusion on throughput
grounds. In testing, 92.7% of check-ins completed on fingerprint alone and 7.3%
required the fallback, confirming that the cost of the second modality falls on
a minority of transactions. One participant of twenty-two could not be enrolled
on fingerprint at any acceptable quality and used the facial path exclusively.
That case, with a failure-to-acquire rate rising to 35.7% on damp fingertips,
converts the inclusiveness argument from an assertion into an observation.

**Objective 3 — implementation.** The system was implemented as a working web
application integrated with a commercial fingerprint device and a standard
camera, comprising a console, a check-in station, a local bridge and a managed
database, satisfying twenty-nine functional requirements. Two findings emerged
that were not anticipated at design time. First, **no browser interface can
communicate with a fingerprint device that enumerates as mass storage**, which
invalidated the initial architecture and required a local bridge; the bridge was
designed to hold no authority, so the additional component does not weaken the
security model. Second, the device was supplied without an interface
specification and **its interface was recovered empirically**, including a
return code appearing in no published documentation for the protocol family.

**Objective 4 — safeguards.** Two were implemented. **Attendance authority
resides in the database**: no browser-facing role holds insert permission, and
the only path is a server-side function requiring a registered station's
credential, so possession of the application's public key is insufficient to
fabricate a record. **Ambiguous comparisons are refused rather than resolved**:
where two enrolled individuals score within a configured margin, the function
names nobody and the system requires identity to be asserted by other means.

The necessity of the second was demonstrated empirically. During evaluation,
one-to-many facial identification matched an unenrolled individual to a closely
related enrolled participant; the genuine and impostor distributions overlapped
completely, so no threshold could separate them. The margin condition intended
to prevent exactly this was inactive, because only one identity was enrolled and
there was no runner-up against which to compute a margin. Two findings of
general applicability follow: one-to-many identification with a small enrolled
population does not reliably discriminate between similar individuals, and a
margin-based safeguard cannot be validated on a single-identity population.

**Objective 5 — evaluation.** The system was evaluated with 22 participants over
430 genuine presentations and 215 impostor comparisons, under normal conditions
and under damp-fingertip and low-illumination conditions representative of
hospital use. No false acceptance was observed in either modality at the
selected operating points — an upper bound of approximately 1.4% at 95%
confidence — with false rejection of 4.1% for fingerprint and 2.3% for face.
Both thresholds were selected from the measured distributions, the facial one
set deliberately above the equal error rate of 0.632 because a false acceptance
costs more here than a false rejection. Every printed and screen-displayed
photograph was rejected by the anti-spoofing stage before any comparison,
although twenty attack attempts support only a weak bound, and the fingerprint
device offers no liveness detection at all.

## 6.3 Conclusion

The study demonstrates that a multimodal biometric attendance system combining
fingerprint and facial recognition can be implemented using commercially
available hardware and web technologies, producing attendance records that are
attributable to individuals and validated against scheduled shifts. Three
conclusions are drawn.

**First, multimodality in an attendance system is best understood as a coverage
measure rather than an accuracy measure.** The literature commonly justifies it
by improved accuracy through fusion. In a hospital the more consequential
benefit is population coverage — a route for staff whose primary biometric fails
persistently rather than occasionally. Because hand condition in clinical work
is an occupational characteristic and not a random event, single-modality
systems exclude the same individuals repeatedly, and that exclusion is typically
absorbed by an informal manual override which reintroduces the weakness the
system was adopted to remove.

**Second, the operating mode of a biometric subsystem matters more than its
reported accuracy.** The same models, unchanged, produced a misidentification in
one-to-many operation and reliable verification in one-to-one operation. The
determining factor was not model quality but the question the system asked of
it. Applied systems should establish identity by the most reliable means
available and use weaker modalities to verify rather than to identify.

**Third, a system's behaviour under uncertainty is a design decision, not a
technical detail.** A system returning the nearest match when comparisons are
ambiguous will, in an attendance context, silently attribute a record to the
wrong person — an error not detected at the time and possibly never detected at
all. Refusing to decide is a legitimate and, for records of this kind,
preferable outcome. The threshold and margin governing that refusal express a
policy about which of two asymmetric errors is more damaging, and should be set
deliberately rather than inherited from a vendor default.

The study also concludes that integrating commercial biometric hardware into
modern web applications remains substantially more difficult than the
availability of such hardware suggests, owing to absent documentation and to
browser security models that — correctly — prevent direct access to devices of
this class.

## 6.4 Recommendations

**To hospital management.** Do not deploy a single-modality biometric attendance
system in a clinical environment: hand hygiene degrades fingerprint quality
systematically, and a proportion of staff will be excluded — provide a designed
second path rather than allowing an informal override to develop. Integrate
attendance capture with rostering, since a timestamp without shift context
cannot support the decisions the data is collected to inform. Establish a
documented exception process: a system that records and flags late arrivals,
unscheduled attendance and missing check-outs with named supervisor approval
produces a defensible record, while one that refuses them produces staff who
work around it. Obtain informed consent before capture and **enforce it
technically**, so it cannot be omitted under time pressure. Restrict biometric
records to the smallest role that requires them — supervisors need attendance
data, not templates.

**To system developers.** Verify device interface assumptions against the
operating system's device registry rather than inferring from vendor library
contents or port names, since vendor libraries commonly support several models
with different transports. Enforce access control at the database rather than in
the application, because interface-level restrictions are presentation and a
second client bypasses them. Log every biometric attempt including refusals —
they are the only source of false rejection data and the only evidence when a
staff member disputes that the system failed them. **Test safeguards with a
population large enough to activate them**: a margin-based safeguard tested
against one enrolled identity is not tested at all. Select thresholds from
measured distributions, not from vendor defaults or figures obtained on
different hardware and populations.

**To policymakers.** Institutions deploying biometric systems for workforce
management should be required to provide an alternative process for individuals
unable to enrol, so that biometric failure does not become a barrier to
employment or payment. Guidance on biometric data handling in health
institutions should address staff data explicitly, as existing guidance
concentrates predominantly on patient identification.

## 6.5 Suggestions for Future Work

**Longitudinal deployment** across a full hospital over several months would
establish whether accuracy holds as the enrolled population grows, and quantify
the proportion of staff requiring the fallback — the figure that determines
whether the multimodal design is justified in practice.

**Template ageing.** Fingerprint quality among healthcare workers is expected to
degrade with continued hygiene practice. A longitudinal study could establish
the rate and inform a re-enrolment schedule, which no reviewed study provides.

**Contactless identity assertion.** The fallback requires a staff number to be
typed. An RFID badge would assert identity without contact while preserving the
one-to-one verification model.

**Fingerprint liveness detection.** The device provides none. Evaluating
software-based detection on the captured image, or the cost-benefit of sensors
with integrated detection, would address a vulnerability this study documents
but does not resolve.

**Departmental scoping of identification.** Restricting one-to-many facial
search to the staff member's own department reduces the candidate population
substantially and would be expected to improve discrimination. This was designed
into the matching function but not evaluated.

**Integration with payroll and workforce planning.** The system produces
validated attendance data but does not act on it.
