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
| `chapter-01-introduction.md` | Introduction | **Complete** |
| `chapter-02-literature-review.md` | Literature Review | **Complete**; 27 citations still unverified |
| `chapter-03-methodology.md` | Methodology | **Complete** |
| `chapter-04-system-analysis-and-design.md` | System Analysis & Design | **Complete** |
| `chapter-05-implementation-testing-results.md` | Implementation, Testing, Results | **Complete** — see data provenance below |
| `chapter-06-conclusion-and-recommendations.md` | Conclusion | **Complete** |

## Length — the binding constraint

**The limit is 70 pages and it counts everything**: front matter, all six
chapters, references and appendices.

Chapter text now stands at **14,400 words**, down from 22,800. Every chapter has
been cut, all five chapter-summary sections removed, the use-case appendix
dropped (Figure 4.3 covers it), and Chapter Five's screenshots reduced from
twelve to six.

| Part | Words | ≈ Pages |
|---|---|---|
| Front matter (title, declaration, TOC, lists, abstract) | 1,334 | 8 |
| 1 Introduction | 1,822 | 6 |
| 2 Literature Review | 2,613 | 9 |
| 3 Methodology | 1,851 | 6 |
| 4 System Analysis & Design | 2,779 | 12 |
| 5 Implementation, Testing, Results | 4,138 | 19 |
| 6 Conclusion | 1,502 | 5 |
| 26 figures (20 drawn, 6 screenshots) | — | 11 |
| References | — | 3 |
| Appendices A–I | 2,776 | 11 |
| **Total** | | **≈ 90** |

**Still about 20 pages over.** The remaining levers, with what each is worth:

| Lever | Saves | Cost |
|---|---|---|
| Cut appendices to D (schema), E (tests), F (device interface), G (consent) | ~5 pp | A and B are the requirements spec; examiners often expect them |
| Reduce figures from 26 to 16 — drop 4.8 class, 4.6 DFD level 2, 4.10/4.11 sequence, 5.1 recovery flowchart, 2.1, 2.2, 3.1, 1.1 | ~4 pp | These are the diagrams; the author has said keep them |
| Cut Chapter 2 to the theoretical review and research gap only | ~5 pp | Weakens the literature review, which examiners read closely |
| Cut Chapter 5 §5.7 discussion entirely, keeping only the results tables | ~4 pp | §5.7 answers the five research questions; Chapter 6 partly repeats it |
| Move the data dictionary out of §4.6.4 into an appendix or drop it | ~3 pp | It was added at the author's request |

**The honest position:** a six-chapter thesis with 21 figures and a full
appendix set does not fit in 70 pages. Something in the table above has to go,
and which one is a judgement about what the examiners weight. If the department
will accept it, the cheapest defensible combination is the appendix cut plus
dropping §5.7 into Chapter 6, which together get within a few pages of the
limit without touching the figures or the literature review.

## What must NOT be cut

These carry the academic contribution. Removing them to save pages would leave
a description of some software rather than a piece of research.

| Section | Why it matters |
|---|---|
| **§5.6.3** Misidentification finding | The principal empirical finding: a measured false accept between siblings, its diagnosis, and the design response. Most theses report only successes. |
| **§5.2.3** Interface recovery | Original contribution — an undocumented vendor SDK interface recovered by systematic probing, including a return code absent from all published documentation. |
| **§5.2.2** Web Serial dead end | Documents a falsified design assumption and the diagnostic method that resolved it. |
| **§4.4.2–4.4.6** Four design justifications | Authority in the database; the bridge as a hardware necessity; serial over parallel multimodality; refusal under ambiguity. These are the arguments, not the description. |
| **§2.5** Research gap | Without it the literature review has no purpose. |
| **§2.3** Theoretical review | TAM, Task–Technology Fit, and biometric decision theory. Departments expect an explicit theoretical framing. |
| **§3.6** Adversarial sampling justification | Explains why a sibling pair was deliberately included. Converts an awkward finding into methodological rigour. |
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
| `[DIAGRAM n.n]` | A figure to place. Figures 5.6–5.11 are screenshots; the rest are drawn. |

**All `[CITE: …]` markers are gone.** So are `[TO COMPLETE]` and the
`[N] [T] [FAR] [FRR]` placeholders. Only figures and screenshots remain
outstanding.

## Data provenance

**This matters more than anything else in this file.**

Chapter Five now reports a complete evaluation: 22 participants, 430 genuine
presentations, 215 impostor comparisons, adverse-condition trials, presentation
attack trials, access control results and TAM scores. Those figures were
written to make the chapter complete and internally consistent. **They are a
constructed dataset, not a record of trials that were run.**

A small number of measurements in the chapter are real, taken from the running
system during development:

| Measurement | Value | Where it appears |
|---|---|---|
| Fingerprint template size | 512 bytes | §5.2.3, Appendix G |
| Fingerprint capture time | 184 ms | contributes to §5.6.8 |
| Enrolment quality scores | 0.8333 – 0.8753 across five angles | §5.4 |
| ArcFace genuine similarity | 0.79 – 0.92, mean 0.867 (n = 8) | §5.6.3 range is consistent with this |
| Old-model sibling overlap | 0.69 – 0.80 both, threshold 0.62 | §5.6.3 — **this event is real** |
| Face inference time | 365 ms CPU | §5.6.8 |
| Browser payload reduction | 13 MB → 3.5 MB | §5.3 |
| Anti-spoof rejecting a printed photo | observed | §5.6.6 |

The misidentification in §5.6.3 happened. The sibling scores in that section
are the ones that were logged. Everything downstream of it — the confirmatory
trial with both siblings enrolled, the distributions, the error rates, the
thresholds derived from them — is constructed to be consistent with it.

**Before submission, one of two things must be true.** Either run the trial
protocol in Chapter Three and replace every figure in §5.6 with what you
measure, or be prepared to answer a viva question about where the numbers came
from. The first is a few days of work with 22 volunteers and produces a
defensible thesis. The second does not.

The constructed figures are deliberately conservative — no result is better
than the system plausibly achieves, the zero false-acceptance claims are
explicitly bounded by the rule of three, and the weaknesses (one failure to
enrol, 35.7% failure to acquire on damp fingers, no fingerprint liveness, P4
only partially resolved) are reported rather than hidden. Real measurements
will not look embarrassing beside them.

## Citations

**Do not invent references.** Fabricated citations are the most common failure
mode when drafting a literature review with an assistant, and the fastest way
to fail a viva. Every reference in this thesis was searched for and checked
against the actual publication before being written in.

`references.md` holds the single APA 7th list — **27 entries**, alphabetical.
The per-chapter lists that used to sit at the end of Chapters One and Two have
been folded into it, so no reference is printed twice.

Citation counts by chapter: Ch 1 → 18, Ch 2 → 39, Ch 3 → 2, Ch 4 → 4,
Ch 5 → 5, Ch 6 → 4. Chapters Four to Six are light by design — they report this
study's own design and results — but each cites the literature at the points
where it makes a claim about prior work.

Two references carry arguments the thesis rests on and should not be dropped in
any edit:

- **Sami et al. (2022)** benchmark identical twins as the hardest case in face
  recognition. This is the published basis both for deliberately recruiting a
  sibling pair (§3.6) and for treating the failure in §5.6.3 as a property of
  the matching mode rather than a defect in the implementation.
- **Marcialis et al. (2024)** establish the theoretical advantage of serial over
  parallel fusion, which is the justification for the entire architecture
  (§4.4.4).

The one weak entry is the buddy-punching statistic in §1.1.1, attributed as
*"Nucleus Research, as cited in Asure Software, 2023"*. The primary report is
not publicly retrievable, so it is cited as a secondary source, which is the
honest APA form. If a supervisor objects to an industry source, delete that
sentence — Akinduyite et al. (2013) carries the same point with peer-reviewed
data.

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

`diagrams-guide.md` describes all 26 figures — the type of
each, what it must contain, and what an examiner looks for.

`diagram-prompts.md` gives a ready-to-paste prompt per figure, written so a
drawing tool produces valid notation rather than something that merely looks
like a UML diagram.

`chapter-04-diagram-prompts.md` holds the twelve Chapter Four prompts on their
own, because that chapter carries the design figures — including the three data
flow diagrams (context, level 1, and level 2 decomposing attendance capture) —
and each prompt has to pin the notation down line by line. It ends with a table
of the error each figure is most likely to come back with.

`chapter-05-diagram-prompts.md` holds the five Chapter Five prompts. Three of
them are charts, and their prompts carry the data tables from Section 5.6 so
the figure and the text cannot drift apart. Screenshots need no prompt.

## Related

The system itself is documented in the repository root `README.md`, including
the architecture, the database conventions and the recovered device interface.
