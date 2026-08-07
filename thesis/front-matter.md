University of Lay Adventists of Kigali
KIGALI CAMPUS

FACULTY OF Information System Management
DEPARTMENT OF INFORMATION SYSTEM AND MANAGEMENT
ACADEMIC YEAR: 2026-2027

A dissertation submitted to the Faculty of Computing and Information Sciences in partial fulfillment of academic requirements for the award of a Bachelor's degree in Software Engineering.

BY: 
Reg N0: 

SUPERVISOR: 

Kigali, April 2026


# FRONT MATTER

> Placed before Chapter One, in this order. Page numbering for front matter is
> conventionally lower-case roman (i, ii, iii …), with Arabic numbering
> beginning at Chapter One. Confirm against your university's format guide.

---

## DECLARATION

> **Personal statement — fill in and sign.** Universities differ in wording;
> if yours supplies a prescribed form, use that instead of this one.

I, **[FULL NAME]**, registration number **[REGISTRATION NUMBER]**, declare that
this thesis titled **"Biometric Hospital Staff Attendance and Shift Management
System Using Fingerprint and Facial Recognition"** is my own original work and
has not been presented for the award of a degree in this or any other
university. All sources of information and material used have been duly
acknowledged and referenced.

**Student**

Name: **[FULL NAME]**

Signature: ............................................

Date: ............................................

---

### Supervisor's Approval

This thesis has been submitted for examination with my approval as the
university supervisor.

Name: **[SUPERVISOR'S NAME AND TITLE]**

Signature: ............................................

Date: ............................................

> **[ADD]** — If your department requires a Head of Department or second
> supervisor signature block, add it here in the same format.

---

## DEDICATION

I dedicate this dissertation to Almighty God for His guidance, strength, and wisdom throughout this academic journey. His grace has sustained me through every challenge and triumph.
I also dedicate this work to my family for their unwavering support, encouragement, and belief in my abilities. Your sacrifices and prayers have been my greatest source of motivation.
To my mentor and supervisor, thank you for your invaluable guidance and mentorship that shaped this research.
May this work contribute meaningfully to the field of software engineering and inspire others to pursue excellence.


## ACKNOWLEDGEMENT

> **Personal — write this yourself.** The skeleton below shows the conventional
> order: supervisor, department and institution, technical or practical help,
> participants, family. Keep it to one page.

I wish to express my sincere gratitude to my supervisor, **[SUPERVISOR'S NAME]**,
for [specific guidance you actually received] throughout this study.

My appreciation goes to the **[DEPARTMENT NAME]**, **[UNIVERSITY NAME]**, and to
the academic staff whose instruction prepared me for this work.

I am grateful to **[NAME / INSTITUTION]** for [access, hardware, advice, or
whatever practical help was given].

I thank the participants who volunteered for the system evaluation and gave
their consent for biometric data to be collected for that purpose. Their
willingness made the accuracy testing in this study possible.

Finally, I thank my family and friends for their support and encouragement
throughout this project.

> **A note worth acting on:** if a specific person helped you test the system —
> for instance by participating in the recognition trials — naming them here is
> both courteous and evidence that the testing described in Chapter Three
> actually took place.

---

## ABSTRACT

> Written from the completed chapters. **Figures marked `[X]` must be filled
> from your results before submission.** Target length is 250–350 words; check
> your university's limit.

Accurate staff attendance records underpin payroll, shift handover and staffing
decisions in hospitals, yet most facilities still rely on manual paper registers
that authenticate a signature rather than a person. This weakness permits proxy
attendance, produces self-reported times that cannot be verified, and yields
records that carry no reference to the shift a staff member was scheduled to
work. The problem is consequential in settings of acute health workforce
shortage, where Rwanda records approximately 10.5 physicians, nurses and
midwives per 10,000 population against a World Health Organization threshold of
44.5.

This study designed, implemented and evaluated a multimodal biometric attendance
and shift management system combining fingerprint and facial recognition. A
design science methodology was adopted, with iterative development and
experimental evaluation. The system was implemented as a web application
integrated with a commercial optical fingerprint module and a standard camera,
using a managed relational database in which access control and attendance
authority are enforced by the database rather than the client application.

The architecture employs serial rather than parallel multimodality: fingerprint
recognition is primary, and facial recognition is invoked only when the
fingerprint path fails — protecting throughput at shift change while providing a
route for staff whose fingerprints do not read reliably, a population
characteristic of clinical work owing to hand hygiene practice.

Evaluation with **[N]** participants across **[T]** recognition attempts yielded
**[FAR]** false acceptance and **[FRR]** false rejection at the selected
operating threshold, which was determined from the measured score distributions
rather than adopted from vendor defaults.

A significant finding emerged during evaluation: one-to-many facial
identification matched an unenrolled individual to a closely related enrolled
participant, with genuine and impostor similarity distributions overlapping
completely such that no threshold separated them. A margin-based safeguard
intended to prevent this was found inactive because only one identity was
enrolled. The system was consequently redesigned so that facial recognition
performs one-to-one verification against an asserted identity rather than
one-to-many identification.

The study concludes that multimodality in attendance systems is best understood
as a population coverage measure rather than an accuracy measure; that the
operating mode of a biometric subsystem matters more than its reported accuracy;
and that a system's behaviour under uncertainty is a design decision, since
returning the nearest match when a comparison is ambiguous silently attributes a
record to the wrong person.

**Keywords:** biometric attendance, multimodal biometrics, fingerprint
recognition, facial recognition, hospital workforce management, shift
management, false acceptance, one-to-one verification.

---

## LIST OF ABBREVIATIONS AND ACRONYMS

| Abbreviation | Meaning |
|---|---|
| API | Application Programming Interface |
| CSV | Comma-Separated Values |
| DET | Detection Error Trade-off |
| DSR | Design Science Research |
| EER | Equal Error Rate |
| ERD | Entity Relationship Diagram |
| FAR | False Acceptance Rate |
| FRR | False Rejection Rate |
| FTA | Failure to Acquire |
| FTE | Failure to Enrol |
| HR | Human Resources |
| HTTP / HTTPS | Hypertext Transfer Protocol (Secure) |
| ISO/IEC | International Organization for Standardization / International Electrotechnical Commission |
| NFIQ | NIST Fingerprint Image Quality |
| NIST | National Institute of Standards and Technology |
| RLS | Row Level Security |
| RPC | Remote Procedure Call |
| SDK | Software Development Kit |
| SQL | Structured Query Language |
| TAM | Technology Acceptance Model |
| TTF | Task–Technology Fit |
| UI | User Interface |
| USB | Universal Serial Bus |
| UML | Unified Modeling Language |
| WHO | World Health Organization |

---

## OTHER FRONT MATTER TO ASSEMBLE

These are generated once the document is compiled in Word or LaTeX, and are
listed here so none is forgotten:

- **Title page** — university format, usually prescribed
- **Table of Contents** — generate from headings; do not type by hand
- **List of Figures** — the diagrams marked throughout Chapters 1–5
- **List of Tables** — the requirement, test case and results tables
- **List of Appendices** — questionnaire, observation form, consent form,
  database schema, selected source code

> **Tip:** if you are writing in Word, apply the built-in Heading 1 / Heading 2
> styles to the chapter and section headings. The Table of Contents, List of
> Figures and List of Tables then generate and renumber automatically. Typing
> them manually guarantees they will be wrong by the time you submit.
