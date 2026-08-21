# CHAPTER TWO: LITERATURE REVIEW

## 2.1 Introduction

This chapter reviews the knowledge relevant to designing a multimodal biometric
attendance system for hospital staff: the concepts and terms on which the study
depends (2.2), the theories framing it (2.3), prior implementations and their
reported outcomes (2.4), the gap this study addresses (2.5), and the conceptual
framework derived from the review (2.6).

## 2.2 Conceptual Review

### 2.2.1 Attendance management and biometric recognition

Attendance systems fall into three generations: manual paper registers,
token-based systems using cards or personal identification numbers, and
biometric systems identifying individuals by physiological characteristics. The
defining weakness of the first two is that they authenticate **a token or a
mark, not a person** — a signature can be forged, a card lent, a PIN shared.
Akinduyite et al. (2013) identify impersonation and proxy attendance as the
persistent failures of paper-based methods, and demonstrate that a biometric
alternative removes them, reporting a false acceptance rate of 0% across 117
participants together with a 76% reduction in transaction time. In healthcare
the consequences of an unreliable record extend beyond payroll, since attendance
data evidences staffing levels and informs the allocation of scarce personnel in
settings where absenteeism is itself substantial (Munyaneza et al., 2024).

Jain et al. (2004) define biometric recognition as automated identification
based on physiological or behavioural characteristics, and establish seven
criteria a characteristic must satisfy: universality, distinctiveness,
permanence, collectability, performance, acceptability and circumvention
resistance. **No single characteristic satisfies all seven optimally**, which is
the foundational argument for combining modalities.

A biometric system operates in two phases. During *enrolment*, samples become a
compact mathematical representation — a *template* for fingerprints, an
*embedding* for faces — stored against the individual. During *recognition*, a
fresh sample is converted the same way and compared, producing a similarity
score to which a threshold is applied (Jain et al., 2004). Templates are not
reversible into the original sample, which matters for data protection:
compromise of a template database is materially less severe than compromise of
an image database, although Jain et al. (2008) caution that templates remain
personal data and that their protection is itself an open research problem,
since a compromised template cannot be reissued in the way a password can.

### 2.2.2 Fingerprint recognition

Fingerprint recognition is the most widely deployed modality, owing to low
sensor cost, mature algorithms and public familiarity (Maltoni et al., 2009). It
relies on *minutiae* — ridge endings and bifurcations — whose relative positions
and orientations form a distinctive pattern. Optical sensors, the most common
and least expensive class, image the ridge pattern by reflected light and are
therefore sensitive to the condition of the skin surface: dry, wet, worn or
damaged fingertips reduce ridge contrast and degrade the resulting template
(Maltoni et al., 2009).

The literature recognises **failure to enrol (FTE)**, the proportion of a
population for whom no usable template can be captured, and **failure to acquire
(FTA)** at recognition time. Crucially, **these failures are not uniformly
distributed across a population.** Galbally et al. (2024), in an operational
study of almost 16,000 subjects, demonstrate measurable variability in
fingerprint recognition performance across population segments defined by age
and other demographic factors, with quality falling markedly in groups whose
ridge detail is worn. The groups affected are those whose occupation or
physiology degrades ridge detail — manual labourers, older adults, and, of
direct relevance to this study, healthcare workers, whose repeated hand-washing
and use of alcohol-based sanitiser erode ridge definition.

To make sample quality measurable rather than a matter of judgement, Tabassi et
al. (2004) developed the NIST Fingerprint Image Quality (NFIQ) metric, which
classifies a captured image into one of five quality levels using a neural
network over eleven image features. The practical value of such a metric is that
it allows a system to reject a poor capture **at enrolment**, rather than
discovering the problem at every subsequent recognition attempt.

### 2.2.3 Facial recognition

Schroff et al. (2015) introduced **FaceNet**, which learns a mapping from face
images directly to a Euclidean space where distance corresponds to face
similarity, trained using a triplet loss. This established the *embedding*
paradigm that dominates contemporary systems: rather than comparing images, the
system compares fixed-length vectors, and similarity is computed by a simple
distance metric. Deng et al. (2019) subsequently proposed **ArcFace**,
introducing an additive angular margin into the loss function to increase the
separation between classes in the embedding space, achieving state-of-the-art
accuracy on standard benchmarks.

The paradigm's practical significance for system design is that embeddings are
ordinary numeric vectors and can therefore be compared anywhere — in a browser,
an application server, or inside a database using vector similarity operators.
This contrasts sharply with proprietary fingerprint templates, which can
typically be compared only by the vendor's own matching algorithm.

Facial recognition nonetheless remains sensitive to conditions absent from
curated benchmark datasets. Huang et al. (2007) assembled the Labeled Faces in
the Wild database precisely to expose this gap, collecting more than 13,000
images under no constraint other than detectability, and established
unconstrained illumination, pose and occlusion as the conditions under which
reported laboratory accuracy does not hold.

Performance also degrades measurably for individuals of high inter-personal
similarity. Sami et al. (2022) benchmark this directly, characterising identical
twins and look-alikes as **the hardest cases presented to facial recognition
tools**, and demonstrating a correlation between an independent measure of
facial similarity and the comparison scores returned by recognition systems.
Their finding is the theoretical basis for the sampling decision described in
Section 3.4 of this study and for the failure reported in Section 5.6.4.

### 2.2.4 Multimodal biometrics

The limitations of individual modalities motivate **multibiometric** systems.
Ross and Jain (2003) provide the foundational treatment of information fusion in
biometrics, developed comprehensively in Ross et al. (2006); Jain et al. (1999)
demonstrated an early multimodal system combining fingerprint, face and speech.

Ross and Jain (2003) identify three principal benefits: improved accuracy
through the combination of independent evidence; **increased population
coverage**, since individuals unable to present one modality may present
another; and increased resistance to spoofing, since an attacker must defeat
several modalities at once. Fusion may occur at sensor, feature, score or
decision level, with score-level fusion the most common in practice, offering a
favourable balance between information richness and practicality (Ross & Jain,
2003).

A further architectural distinction concerns **serial (cascaded)** versus
**parallel** operation. In parallel operation all modalities are acquired and
fused for every transaction; in serial operation one is attempted first and a
second invoked only if the first fails or is inconclusive. Marcialis et al.
(2024) develop a theoretical framework for serial fusion and conclude that it
exhibits advantages over the widely adopted parallel approaches, notably in
average acquisition time and user burden — a consideration of direct relevance
where many staff arrive within a short window.

### 2.2.5 Verification versus identification

This distinction is fundamental to the present study and is frequently
underemphasised in applied literature.

**Verification (one-to-one matching)** answers *"is this person who they claim to
be?"* An identity is asserted by some other means — a card, a staff number, a
username — and the sample is compared against the stored template for that one
individual. **Identification (one-to-many matching)** answers *"who is this
person?"* The sample is compared against every stored template and the best
match returned, or none.

Jain et al. (2004) establish that identification is the substantially harder
problem and that error rates degrade as the size of the enrolled database grows:
as more individuals are enrolled, the probability that some impostor's template
lies closer to the probe than the genuine template increases. **In an
identification system the false acceptance rate is therefore a function of
population size, whereas in verification it is not.** The design consequence is
direct: a system that must scale and that cannot tolerate misattribution should
establish identity by a non-biometric means where possible and use biometrics to
verify it, rather than relying on biometric identification alone.

### 2.2.6 Presentation attacks and liveness detection

A **presentation attack**, colloquially *spoofing*, is an attempt to subvert a
biometric system by presenting an artefact rather than a live characteristic.
The relevant international standard is ISO/IEC 30107-3, which defines
presentation attack detection terminology and the methodology for testing and
reporting detection performance (International Organization for Standardization
[ISO], 2023).

Known attack vectors differ by modality. Matsumoto et al. (2002) demonstrated
that artificial "gummy" fingers, made from inexpensive and readily available
gelatin, were accepted at extremely high rates by eleven fingerprint devices
using optical or capacitive sensors, including moulds made from latent prints
lifted from a glass surface — a result that remains the standard reference for
the vulnerability of optical fingerprint sensors. For facial systems,
Ramachandra and Busch (2017) survey the field comprehensively, cataloguing
printed photographs, images displayed on an electronic screen, video replay and
three-dimensional masks as the established attack instruments, and classifying
countermeasures as hardware-based (capacitive, thermal or multispectral
sensing), software-based (texture, reflectance, micro-motion or depth analysis)
or challenge–response.

The low-cost optical fingerprint modules commonly deployed in attendance systems
frequently provide no liveness detection at all, which — given the effectiveness
Matsumoto et al. (2002) demonstrated against precisely this sensor class —
represents an under-acknowledged vulnerability in such deployments.

### 2.2.7 Shift management and data protection

Attendance data acquires operational meaning only in relation to an expected
schedule. The rostering literature, developed largely around nurse scheduling,
addresses the assignment of personnel to shifts subject to coverage, skill mix,
legal constraints and preference; Burke et al. (2004) survey the field and
characterise nurse rostering as a complex scheduling problem affecting hospital
personnel daily worldwide. One technical consideration recurs in any system
built on such a roster: **night shifts cross the calendar day boundary**, so an
event belonging to a shift running 23:00 to 07:00 must be attributed to the
shift's own date rather than the calendar date of the event, or the record
splits across two days and any analysis over it is distorted.

Biometric data is treated as a special category of personal data under most
contemporary frameworks, because it is uniquely identifying and, unlike a
password, cannot be reissued if compromised (Jain et al., 2008). Rwanda's Law
No. 058/2021 relating to the protection of personal data and privacy classifies
biometric data as sensitive personal data and requires clear and unambiguous
consent before processing (Republic of Rwanda, 2021). The design principles
following from this are: store templates rather than raw images; obtain informed
consent before capture; provide an alternative process for individuals who
decline; restrict access to the minimum necessary roles; and be able to
demonstrate that consent was obtained.

## 2.3 Theoretical Review

### 2.3.1 Technology Acceptance Model

Davis (1989) explains adoption of information technology through two constructs:
**perceived usefulness**, the degree to which a person believes a system will
enhance their performance, and **perceived ease of use**, the degree to which
they believe using it will be effortless. These jointly influence attitude
toward use, which in turn influences behavioural intention and actual use
(Davis et al., 1989).

The model is directly relevant here because biometric attendance systems are
frequently resisted by the staff subject to them. Where a system is perceived as
surveillance rather than record-keeping, or fails often enough to make clocking
in effortful, adoption suffers regardless of technical accuracy. It informs two
decisions in this study: keeping the normal check-in path to a single action
with no typing, card or password; and providing a fallback path, since a staff
member for whom the primary modality repeatedly fails experiences the system as
unusable irrespective of its aggregate accuracy.

### 2.3.2 Task–Technology Fit

Goodhue and Thompson (1995) hold that a technology improves individual
performance only when its capabilities match the requirements of the task.
Utilisation alone is insufficient; a system may be used and still fail to
improve performance if it is poorly matched to the work.

Task–Technology Fit directs attention to the specific characteristics of the
hospital environment rather than to attendance technology in the abstract: staff
whose hand condition is degraded by clinical hygiene practice (Galbally et al.,
2024), shifts that begin before dawn and cross midnight (Burke et al., 2004),
corridors with variable lighting (Huang et al., 2007), and consequences of error
that are operational rather than merely financial. **A single-modality
fingerprint system exhibits poor task–technology fit in this environment despite
being technically adequate elsewhere** — the fit is degraded specifically by the
hand-hygiene requirements of the clinical task. This is the theoretical
justification for the multimodal design.

### 2.3.3 Biometric decision theory

Beyond the behavioural theories, the study rests on the statistical decision
theory underlying biometric matching, formalised by Jain et al. (2004).

A matcher produces a similarity score *s* for a comparison. Genuine comparisons
(same person) and impostor comparisons (different people) each produce a
distribution of scores, and these distributions overlap; the degree of overlap
determines the achievable accuracy of the system. A threshold *t* converts the
score into a decision, yielding two error types: the **False Acceptance Rate
(FAR)**, the proportion of impostor comparisons with *s ≥ t* that are
incorrectly accepted, and the **False Rejection Rate (FRR)**, the proportion of
genuine comparisons with *s < t* that are incorrectly rejected. The two are
inversely related — raising *t* reduces FAR and increases FRR — and the **Equal
Error Rate (EER)**, at which they are equal, is commonly reported as a
single-figure summary of system accuracy (Jain et al., 2004). The relationship
is illustrated in Figure 2.1.

The theory carries an implication frequently overlooked in applied work: **the
choice of threshold is not a technical optimum but a policy decision** about
which error is more damaging. For hospital attendance a false rejection
inconveniences a staff member who tries again, while a false acceptance places a
wrong name in a permanent record and may conceal an absence. The two are not
symmetric, and the threshold should not be set as though they were.

---

> **[DIAGRAM 2.1]** — Genuine and impostor score distributions with threshold *t*
> marked, showing the FAR and FRR regions.

---

## 2.4 Empirical Review

**Fingerprint attendance systems** are widely reported in educational and
organisational settings. Akinduyite et al. (2013) provide one of the more
rigorous evaluations, comparing a fingerprint system against a paper register
across 117 participants and reporting 97.4% accuracy, a false acceptance rate of
0%, a false rejection rate of 2.6%, and a mean transaction time of 4.29 seconds
against 18.48 seconds for the manual process. A common limitation across this
literature is that most evaluations emphasise administrative benefit and user
perception while providing little quantitative accuracy data, and few report
failure-to-enrol rates measured in deployment at all.

**Face-based attendance systems** have received substantial attention,
particularly for classroom use where one camera may record many individuals.
Dhanush Gowda et al. (2020) present a representative implementation and report
the advantages consistently claimed for the modality — contactless operation and
no specialised hardware — alongside the limitations equally consistently
reported: sensitivity to illumination and degradation with pose variation.
Several such studies acknowledge vulnerability to photographic spoofing without
implementing any countermeasure, despite the availability of the detection
methods surveyed by Ramachandra and Busch (2017).

**Multimodal attendance systems** are comparatively rare. Where implemented,
fingerprint and face is the usual pairing, and reported accuracy exceeds either
modality alone, consistent with the fusion benefits established by Ross and Jain
(2003). However, the reviewed implementations predominantly use **parallel**
fusion, requiring both modalities for every transaction. Serial architectures —
invoking the second only on failure of the first — are little examined in this
application domain, despite the theoretical advantages Marcialis et al. (2024)
establish and the throughput argument that applies wherever many users arrive
within a short window.

**Biometrics in healthcare** concentrates overwhelmingly on *patient*
identification, addressing duplicate records and misidentification as patient
safety concerns. Staff-facing systems are discussed mainly in terms of access
control to restricted areas rather than attendance. The occupational degradation
of fingerprint quality among healthcare workers is acknowledged in the sensor
literature (Maltoni et al., 2009; Galbally et al., 2024) but is rarely treated as
a design constraint in attendance studies. This study treats it as the primary
motivation for multimodality.

## 2.5 Research Gap

The reviewed literature establishes that biometric attendance systems reduce
proxy attendance relative to manual and token-based systems (Akinduyite et al.,
2013), that multimodal systems outperform unimodal ones (Ross & Jain, 2003), and
that identification is inherently less accurate than verification (Jain et al.,
2004). Four gaps nonetheless emerge.

**First, the exclusion problem is under-addressed.** Failure to enrol and
failure to acquire are acknowledged as aggregate statistics, but the literature
rarely addresses the operational consequence that these failures concentrate in
the same individuals repeatedly (Galbally et al., 2024). In a hospital, where
hygiene practice systematically degrades fingerprint quality, this produces a
category of staff effectively excluded from the system. Few implementations
provide a designed alternative path; most rely on undocumented manual override,
which reintroduces the integrity weakness the biometric system was adopted to
eliminate.

**Second, serial multimodal architectures are largely unexamined in attendance
contexts.** Existing implementations predominantly require both modalities for
every transaction, incurring an acquisition cost on every staff member to
address a failure affecting a minority. The alternative is theoretically
established (Marcialis et al., 2024) but empirically under-reported in this
domain.

**Third, misattribution is treated as an accuracy statistic rather than a design
requirement.** The literature reports false acceptance rates but seldom examines
what a system should *do* when a comparison is ambiguous. The prevailing
implicit behaviour is to return the closest match, which in an attendance system
silently attributes a record to the wrong person. Given the difficulty Sami et
al. (2022) document for high-similarity face pairs, the alternative — refusing
to decide and requiring identity to be asserted by other means — is a design
question the applied literature has not addressed.

**Fourth, attendance capture is commonly decoupled from shift scheduling.** Most
reviewed implementations record timestamps without reference to the roster,
leaving interpretation to downstream manual processes, despite the maturity of
the rostering literature itself (Burke et al., 2004). Systems that validate an
event against the scheduled shift — distinguishing punctual arrival, late
arrival within grace, arrival outside any window and unscheduled attendance —
are not well represented.

**This study addresses these four gaps** by implementing a serial multimodal
attendance system in which fingerprint identification is primary and facial
recognition provides a designed fallback, in which ambiguous comparisons are
refused rather than resolved to the nearest match, and in which every recorded
event is validated against the staff member's scheduled shift.

## 2.6 Conceptual Framework

The framework derived from this review relates system design characteristics to
attendance record quality outcomes, moderated by the conditions of the hospital
setting.

| Independent — design | Moderating — hospital context | Dependent — record quality |
|---|---|---|
| Modality configuration (unimodal vs serial multimodal) | Occupational condition of staff hands | Attribution accuracy |
| Matching mode (identification vs verification) | Ambient lighting at check-in locations | Inclusiveness |
| Decision policy under ambiguity (nearest match vs refusal) | Shift structure, including shifts crossing midnight | Shift validity |
| Shift-context validation (present vs absent) | Enrolled population size | Integrity |
| Station authorisation (any device vs registered station) | Staff attitudes toward biometric monitoring | Throughput |

**Theoretical lens.** Task–Technology Fit (Goodhue & Thompson, 1995) explains how
the moderating hospital conditions determine whether a given design
configuration produces the intended outcomes. The Technology Acceptance Model
(Davis, 1989) explains staff willingness to use the system, mediated principally
by perceived ease of use, which the design addresses by minimising the actions
required for a normal check-in.

---

## References cited in this chapter

*(APA 7th edition. These entries are reproduced in the thesis References
section.)*

Akinduyite, C. O., Adetunmbi, A. O., Olabode, O. O., & Ibidunmoye, E. O. (2013).
Fingerprint-based attendance management system. *Journal of Computer Sciences
and Applications, 1*(5), 100–105. https://doi.org/10.12691/jcsa-1-5-4

Burke, E. K., De Causmaecker, P., Vanden Berghe, G., & Van Landeghem, H. (2004).
The state of the art of nurse rostering. *Journal of Scheduling, 7*(6), 441–499.
https://doi.org/10.1023/B:JOSH.0000046076.75950.0b

Davis, F. D. (1989). Perceived usefulness, perceived ease of use, and user
acceptance of information technology. *MIS Quarterly, 13*(3), 319–340.
https://doi.org/10.2307/249008

Davis, F. D., Bagozzi, R. P., & Warshaw, P. R. (1989). User acceptance of
computer technology: A comparison of two theoretical models. *Management
Science, 35*(8), 982–1003. https://doi.org/10.1287/mnsc.35.8.982

Deng, J., Guo, J., Xue, N., & Zafeiriou, S. (2019). ArcFace: Additive angular
margin loss for deep face recognition. *Proceedings of the IEEE/CVF Conference
on Computer Vision and Pattern Recognition*, 4690–4699.

Dhanush Gowda, H. L., Vishal, K., Keertiraj, B. R., Dubey, N. K., & Pooja, M. R.
(2020). Face recognition based attendance system. *International Journal of
Engineering Research & Technology, 9*(6), 761–764.

Galbally, J., Cepilovs, A., Blanco-Gonzalo, R., Ormiston, G., Miguel-Hurtado,
O., & Racz, I. S. (2024). *A large-scale operational study of fingerprint
quality and demographics* (arXiv:2409.19992). arXiv.
https://arxiv.org/abs/2409.19992

Goodhue, D. L., & Thompson, R. L. (1995). Task-technology fit and individual
performance. *MIS Quarterly, 19*(2), 213–236. https://doi.org/10.2307/249689

Huang, G. B., Ramesh, M., Berg, T., & Learned-Miller, E. (2007). *Labeled faces
in the wild: A database for studying face recognition in unconstrained
environments* (Technical Report 07-49). University of Massachusetts, Amherst.

International Organization for Standardization. (2023). *Information technology
— Biometric presentation attack detection — Part 3: Testing and reporting*
(ISO/IEC 30107-3:2023).

Jain, A. K., Hong, L., & Kulkarni, Y. (1999). A multimodal biometric system
using fingerprint, face and speech. *Proceedings of the Second International
Conference on Audio- and Video-based Biometric Person Authentication*, 182–187.

Jain, A. K., Nandakumar, K., & Nagar, A. (2008). Biometric template security.
*EURASIP Journal on Advances in Signal Processing, 2008*, Article 579416.
https://doi.org/10.1155/2008/579416

Jain, A. K., Ross, A., & Prabhakar, S. (2004). An introduction to biometric
recognition. *IEEE Transactions on Circuits and Systems for Video Technology,
14*(1), 4–20. https://doi.org/10.1109/TCSVT.2003.818349

Maltoni, D., Maio, D., Jain, A. K., & Prabhakar, S. (2009). *Handbook of
fingerprint recognition* (2nd ed.). Springer.
https://doi.org/10.1007/978-1-84882-254-2

Marcialis, G. L., Mastinu, P., & Roli, F. (2024). *Serial fusion of multi-modal
biometric systems* (arXiv:2401.13418). arXiv. https://arxiv.org/abs/2401.13418

Matsumoto, T., Matsumoto, H., Yamada, K., & Hoshino, S. (2002). Impact of
artificial "gummy" fingers on fingerprint systems. *Proceedings of SPIE, 4677*,
275–289. https://doi.org/10.1117/12.462719

Munyaneza, E., Rusingiza, E. K., Rugwizangoga, B., Munyarugerero, M.,
Mukarugema, D., Gasasira, J. D., Mbabazi, B., Twahirwa, T. S., Ndibagiza, O.,
Nyundo, M., Hategekimana, T., Nzanira, D., & Masaisa, F. (2024). Employee
absenteeism at the University Teaching Hospital of Kigali in Rwanda, 2020.
*Rwanda Public Health Bulletin, 5*(4).

Ramachandra, R., & Busch, C. (2017). Presentation attack detection methods for
face recognition systems: A comprehensive survey. *ACM Computing Surveys, 50*(1),
Article 8. https://doi.org/10.1145/3038924

Republic of Rwanda. (2021). *Law No. 058/2021 of 13/10/2021 relating to the
protection of personal data and privacy*. Official Gazette No. Special of
15/10/2021.

Ross, A., & Jain, A. K. (2003). Information fusion in biometrics. *Pattern
Recognition Letters, 24*(13), 2115–2125.
https://doi.org/10.1016/S0167-8655(03)00079-5

Ross, A., Nandakumar, K., & Jain, A. K. (2006). *Handbook of multibiometrics*.
Springer. https://doi.org/10.1007/0-387-33123-9

Sami, S. M., McCauley, J., Soleymani, S., Nasrabadi, N., & Dawson, J. (2022).
Benchmarking human face similarity using identical twins. *IET Biometrics,
11*(5), 459–475. https://doi.org/10.1049/bme2.12090

Schroff, F., Kalenichenko, D., & Philbin, J. (2015). FaceNet: A unified
embedding for face recognition and clustering. *Proceedings of the IEEE
Conference on Computer Vision and Pattern Recognition*, 815–823.

Tabassi, E., Wilson, C. L., & Watson, C. I. (2004). *Fingerprint image quality*
(NISTIR 7151). National Institute of Standards and Technology.
