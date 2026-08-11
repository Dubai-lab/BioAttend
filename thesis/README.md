# Thesis — working guide

Written report for **"Biometric Hospital Staff Attendance and Shift Management
System Using Fingerprint and Facial Recognition"**, a final-year dissertation
for a BSc in Software Engineering, University of Lay Adventists of Kigali.

This file exists so that anyone picking the work up — including an assistant
reading the repository cold — can act on it without re-deriving context.

## Files

| File | Chapter | State |
|---|---|---|
| `front-matter.md` | Declaration, dedication, acknowledgement, abstract, abbreviations | Abstract written; personal sections are the author's to write |
| `chapter-01-introduction.md` | Introduction | Drafted |
| `chapter-02-literature-review.md` | Literature Review | Drafted; **27 citations unverified** |
| `chapter-03-methodology.md` | Methodology | Drafted; 2 data slots |
| `chapter-04-system-analysis-and-design.md` | System Analysis & Design | **Complete** |
| `chapter-05-implementation-testing-results.md` | Implementation, Testing, Results | Drafted; 6 data slots |
| `chapter-06-conclusion-and-recommendations.md` | Conclusion | Drafted; 2 data slots |

## Current situation

**Length.** Approximately 86 pages at Times New Roman 12pt, 1.5 line spacing,
before any diagrams or screenshots are inserted.

**Target.** 45–50 pages of text, so that the document lands at roughly 60–65
pages once the diagrams and screenshots are added. So roughly **35 pages must
come out**, which is substantial — this is restructuring, not tightening.

**Check first:** whether the university counts front matter, references and
appendices toward the limit. If it does not, moving tables to appendices is the
single highest-leverage change and costs nothing.

## What must NOT be cut

These carry the academic contribution. Removing them to save pages would leave
a description of some software rather than a piece of research.

| Section | Why it matters |
|---|---|
| **§5.6.4** Misidentification finding | The principal empirical finding: a measured false accept between siblings, its diagnosis, and the design response. Most theses report only successes. |
| **§5.2.3** Interface recovery | Original contribution — an undocumented vendor SDK interface recovered by systematic probing, including a return code absent from all published documentation. |
| **§5.2.2** Web Serial dead end | Documents a falsified design assumption and the diagnostic method that resolved it. |
| **§4.4.2–4.4.6** Four design justifications | Authority in the database; the bridge as a hardware necessity; serial over parallel multimodality; refusal under ambiguity. These are the arguments, not the description. |
| **§2.5** Research gap | Without it the literature review has no purpose. |
| **§2.3** Theoretical review | TAM, Task–Technology Fit, and biometric decision theory. Departments expect an explicit theoretical framing. |
| **§3.5.1** Adversarial sampling justification | Explains why a sibling pair was deliberately included. Converts an awkward finding into methodological rigour. |
| **§1.2** Problem statement (four-part) | The fourth clause — refusing rather than guessing — is what makes the study distinctive and is traceable through every later chapter. |

## Where the length actually is

Ordered by how much can be removed for how little loss.

**1. Move to appendices (~20 pages, no content lost)**

- §5.5.2 — the 28-row functional test case table
- §4.5.1 — the 29 functional requirements table
- §4.5.2 — the 12 non-functional requirements table
- §4.6.1 — the 15 use cases list and the UC6 specification
- §4.6.2 — the database table listings
- §4.6.3 — the access control matrix

Replace each with two or three sentences summarising what it shows, plus a
reference: *"The full requirements specification is presented in Appendix B."*

**2. Compress without removing (~8 pages)**

- §2.2.1 and §2.2.8 — conceptual background that restates common knowledge
- §2.4 — the empirical review repeats its conclusion in each subsection
- §5.4 — the interface description can be shorter once screenshots carry it
- §6.4 — the recommendations are longer than they need to be

**3. Genuinely removable (~5 pages)**

- Chapter summaries at the end of each chapter, if the department does not
  require them
- §1.9 organisation of the study, if a table of contents is present
- Repetition between §5.7 discussion and §6.2 findings — the same material is
  covered twice by design, and one can point at the other

## Markers still to fill

| Marker | Meaning |
|---|---|
| `[CITE: …]` | A real reference must be found. **27 in Chapter 2, 6 in Chapter 1.** |
| `[TO COMPLETE]` | Requires the author's measured data |
| `[DIAGRAM n.n]` | A figure to be drawn |
| `[SCREENSHOT n.n]` | A capture from the running system |
| `[N] [T] [FAR] [FRR]` | Participants, total attempts, false acceptance rate, false rejection rate |

## Citation policy

**Do not invent references.** Fabricated citations are the most common failure
mode when drafting a literature review with an assistant, and the fastest way
to fail a viva.

Ten verified references in APA 7th are listed at the end of
`chapter-02-literature-review.md`. Everything else marked `[CITE: …]` must be
sourced and verified by the author. Where a marker names an arXiv identifier or
an exact title, that is a lead, not a completed citation.

## Facts the writing depends on

Useful when editing, so claims are not accidentally altered.

- The fingerprint reader is a **USB mass-storage device** (`VID_2009/PID_7638`),
  not a serial port. No browser API can reach it; hence the local bridge.
- Fingerprint matching happens **in the device firmware**. The algorithm is
  proprietary and was not written for this study — reported accuracy
  characterises the device, not a contribution.
- Face models are **pretrained**. Nothing was trained in this study.
- The fingerprint device has **no liveness detection**. This is reported as a
  limitation, not tested and presented as a pass.
- The measured sibling similarity was **0.69–0.80 for both** the genuine person
  and the impostor, against a threshold of 0.62 at the time. The distributions
  overlapped completely.
- The margin safeguard **had not fired** during that test, because only one face
  was enrolled and there was no runner-up to compare against.
- The system as finally built retains **1:N face identification** gated by both
  a threshold and a margin, falling back to staff-number entry plus **1:1
  verification** when either condition fails. Earlier drafts described a
  stricter design; that has been corrected.

## Diagrams

`diagrams-guide.md` describes all 21 figures and 12 screenshots — the type of
each, what it must contain, and what an examiner looks for.

`diagram-prompts.md` gives a ready-to-paste prompt per figure, written so a
drawing tool produces valid notation rather than something that merely looks
like a UML diagram.

`chapter-04-diagram-prompts.md` holds the twelve Chapter Four prompts on their
own, because that chapter carries the design figures — including the three data
flow diagrams (context, level 1, and level 2 decomposing attendance capture) —
and each prompt has to pin the notation down line by line. It ends with a table
of the error each figure is most likely to come back with.

Figures 5.2, 5.3 and 5.4 are excluded from that: they plot measured data and
must be built in Excel from the exported CSV.

## Related

The system itself is documented in the repository root `README.md`, including
the architecture, the database conventions and the recovered device interface.
