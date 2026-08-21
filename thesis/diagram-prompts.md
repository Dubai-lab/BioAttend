# Ready-to-paste diagram prompts

One prompt per figure. Paste into an AI drawing tool, or use as a specification
if drawing by hand in draw.io.

**Before you start, three notes.**

**Charts carry data, not decoration.** Figures 5.3, 5.4 and 5.5 plot the
measurements reported in Section 5.6. Their prompts contain the exact data
tables, so the chart that comes back is the one the text describes. If you
re-run the trials, rebuild these in Excel from your own exported CSV rather
than redrawing them — a chart that disagrees with its own results table is the
first thing an examiner will notice.

**UML notation is not decorative.** Where a figure is specified as a UML
diagram, the prompt states the notation explicitly (hollow triangle for
generalisation, crow's foot for cardinality, diamond decision nodes). Tools
often produce something that looks plausible but is not valid UML. Check the
output against the notation named in the prompt.

**Every figure needs a caption and a mention in the text.** A figure nobody
references reads as padding.

---

## Figure 1.1 — Conceptual overview

> Draw a simple three-stage block diagram for the opening chapter of a thesis.
>
> **Left:** an icon of a person, labelled "Hospital staff member".
> **Centre:** two stacked boxes labelled "Fingerprint reader" and "Camera",
> grouped inside a larger box labelled "Check-in station".
> **Right:** a box labelled "Attendance record", with a smaller box beneath it
> labelled "Validated against shift roster" connected by a short upward arrow.
>
> Arrows left to right between the three stages.
>
> Style: clean, minimal, plain white background, thin lines, no colour beyond a
> single accent. This is an introductory overview, not a technical
> architecture — keep it deliberately simple.

---

## Figure 2.1 — Genuine and impostor score distributions

> Draw a clean academic figure showing two overlapping probability distribution
> curves on a single set of axes.
>
> **X-axis:** "Match score", 0 to 1. **Y-axis:** "Frequency".
>
> **Left curve:** bell curve centred at about 0.3, labelled "Impostor
> comparisons". **Right curve:** bell curve centred at about 0.75, labelled
> "Genuine comparisons". The curves must **visibly overlap** between roughly
> 0.45 and 0.6 — the overlap is the most important feature.
>
> **A vertical dashed line** at about 0.55, labelled "Threshold t".
>
> **Shade and label two regions:** the impostor curve to the **right** of the
> line as "False Acceptance (FAR)", and the genuine curve to the **left** of
> the line as "False Rejection (FRR)".
>
> Below the axis, a horizontal double-headed arrow labelled "Moving t right
> reduces FAR and increases FRR".
>
> Two distinguishable colours, darker tones for the shaded regions, a legend.
> Plain white background, thin black axes, no 3D.

---

## Figure 3.1 — Iterative development cycle

> Draw a circular process diagram with four stages arranged clockwise:
> "Design", "Implement", "Test", "Evaluate", connected by curved arrows, with a
> return arrow from Evaluate back to Design closing the loop.
>
> **Two callout boxes** attached to the return arrow with leader lines:
> - "Iteration 2 — device interface assumption falsified"
> - "Iteration 6 — face matching mode revised after false accept"
>
> Plain white background, thin lines, one accent colour. Academic figure.

---

## Figures 4.1 to 4.12 — Chapter Four

Chapter Four carries twelve figures, including three data flow diagrams. Their
prompts live in a file of their own, because each one is long and the notation
has to be pinned down line by line:

**See `chapter-04-diagram-prompts.md`.**

| Figure | Type |
|---|---|
| 4.1 | Activity diagram — existing manual process |
| 4.2 | System architecture |
| 4.3 | Use case diagram |
| 4.4 | Context diagram (DFD level 0) |
| 4.5 | Data flow diagram, level 1 |
| 4.6 | Data flow diagram, level 2 (process 3.0) |
| 4.7 | Entity Relationship Diagram |
| 4.8 | Class diagram |
| 4.9 | Activity diagram — attendance recording |
| 4.10 | Sequence diagram — fingerprint check-in |
| 4.11 | Sequence diagram — fallback path |
| 4.12 | Interface wireframes |

---

## Figures 5.1 to 5.5 — Chapter Five

Chapter Five carries two diagrams and three charts. The charts plot the
measured results of Section 5.6, so their prompts contain the actual data
tables and must be reproduced exactly.

**See `chapter-05-diagram-prompts.md`.**

| Figure | Type |
|---|---|
| 5.1 | Flowchart — interface recovery process |
| 5.2 | Deployment topology |
| 5.3 | Histogram — fingerprint score distributions |
| 5.4 | Histogram — facial similarity distributions, sibling series marked |
| 5.5 | Line chart — FAR and FRR against threshold |

Figures 5.6 to 5.11 are screenshots of the running system and need no prompt.
