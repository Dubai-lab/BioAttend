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

Evaluation with 22 participants across 645 recognition comparisons yielded no
observed false acceptance in either modality at the selected operating
thresholds — an upper bound of approximately 1.4% at 95% confidence — with
false rejection of 4.1% for fingerprint and 2.3% for face. Both thresholds were
determined from the measured score distributions rather than adopted from
vendor defaults, and the facial threshold was set deliberately above the equal
error rate because the two error types carry asymmetric costs. One participant
could not be enrolled on fingerprint at all and used the facial path
exclusively.

A significant finding emerged during evaluation: one-to-many facial
identification matched an unenrolled individual to a closely related enrolled
participant, with genuine and impostor similarity distributions overlapping
completely such that no threshold separated them. A margin-based safeguard
intended to prevent this was found inactive because only one identity was
enrolled. The system was consequently redesigned to require both a similarity
threshold and a margin over the runner-up before naming anyone, and to fall
back to one-to-one verification against an asserted identity whenever either
condition fails.

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
| CDN | Content Delivery Network |
| CPU | Central Processing Unit |
| CSV | Comma-Separated Values |
| DET | Detection Error Trade-off |
| DFD | Data Flow Diagram |
| DSR | Design Science Research |
| EER | Equal Error Rate |
| ERD | Entity Relationship Diagram |
| FAR | False Acceptance Rate |
| FR | Functional Requirement |
| FRR | False Rejection Rate |
| FTA | Failure to Acquire |
| FTE | Failure to Enrol |
| HR | Human Resources |
| HTTP / HTTPS | Hypertext Transfer Protocol (Secure) |
| ISO/IEC | International Organization for Standardization / International Electrotechnical Commission |
| NFIQ | NIST Fingerprint Image Quality |
| NFR | Non-Functional Requirement |
| NIST | National Institute of Standards and Technology |
| RFID | Radio-Frequency Identification |
| RLS | Row Level Security |
| RPC | Remote Procedure Call |
| SDK | Software Development Kit |
| SQL | Structured Query Language |
| TAM | Technology Acceptance Model |
| TTF | Task–Technology Fit |
| UC | Use Case |
| UI | User Interface |
| USB | Universal Serial Bus |
| UML | Unified Modeling Language |
| WHO | World Health Organization |

---

## LIST OF FIGURES

*Twenty-six figures. Numbers are final; captions below are the wording to use.
Screenshots are numbered as figures, because that is what they are — a separate
"Screenshot 5.1" alongside "Figure 5.1" would collide.*

| Figure | Caption |
|---|---|
| 1.1 | Conceptual overview of the proposed system |
| 2.1 | Genuine and impostor score distributions with threshold *t* |
| 3.1 | Iterative development cycle |
| 4.1 | Activity diagram of the existing manual attendance process |
| 4.2 | System architecture |
| 4.3 | Use case diagram |
| 4.4 | Context diagram (data flow diagram, level 0) |
| 4.5 | Data flow diagram, level 1 |
| 4.6 | Data flow diagram, level 2: decomposition of Capture attendance |
| 4.7 | Entity-relationship diagram |
| 4.8 | Class diagram of the application service layer |
| 4.9 | Activity diagram for attendance recording |
| 4.10 | Sequence diagram: check in by fingerprint |
| 4.11 | Sequence diagram: facial fallback path |
| 4.12 | Interface wireframes: console and check-in station |
| 5.1 | Device interface recovery process |
| 5.2 | Deployment topology |
| 5.3 | Fingerprint genuine and impostor score distributions |
| 5.4 | Facial genuine and impostor similarity distributions |
| 5.5 | False acceptance and false rejection rates against threshold |
| 5.6 | Administrative console, overview page |
| 5.7 | Staff enrolment, fingerprint capture step |
| 5.8 | Staff enrolment, facial capture step |
| 5.9 | Live attendance view |
| 5.10 | Check-in station, successful check-in |
| 5.11 | Check-in station, scan refused outside the shift window |

## LIST OF TABLES

*Number these in Word as you place them; the list below is what exists.*

| Chapter | Tables |
|---|---|
| 2 | Conceptual framework variables |
| 3 | Increment activities; trial design; data collection instruments; tools and technologies |
| 4 | Problems with the existing system; actors; data flow processes and stores |
| 5 | Development increments; functional test failures; fingerprint accuracy; facial accuracy; misidentification scores; confirmatory trial; adverse conditions; presentation attacks; access control; performance and usability; comparison against the eight problems |
| 6 | — |
| Appendices | Functional requirements; non-functional requirements; database schema; access control matrix; functional test cases; recovered device interface |

## OTHER FRONT MATTER TO ASSEMBLE

Generated once the document is compiled in Word or LaTeX:

- **Title page** — university format, usually prescribed
- **Table of Contents** — generate from headings; do not type by hand
- **List of Appendices** — A to I

> **Tip:** apply Word's built-in Heading 1 / Heading 2 styles to the chapter and
> section headings. The Table of Contents, List of Figures and List of Tables
> then generate and renumber automatically. Typing them by hand guarantees they
> will be wrong by the time you submit.
