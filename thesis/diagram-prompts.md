# Ready-to-paste diagram prompts

One prompt per figure. Paste into an AI drawing tool, or use as a specification
if drawing by hand in draw.io.

**Before you start, three notes.**

**Charts must come from your data, not a drawing tool.** Figures 5.2, 5.3 and
5.4 plot measurements you have collected. Build those in Excel from the
exported CSV. A drawn approximation of real data is misrepresentation, and an
examiner can tell the difference immediately.

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

## Figure 2.2 — Conceptual framework

> Draw a conceptual framework diagram in the standard
> independent–moderating–dependent layout.
>
> **Top, centred:** rectangle "HOSPITAL CONTEXT (Moderating variables)"
> containing: occupational hand condition; ambient lighting; shift structure
> including shifts crossing midnight; enrolled population size; staff attitudes
> toward biometric monitoring.
>
> **Bottom left:** rectangle "SYSTEM DESIGN CHARACTERISTICS (Independent
> variables)" containing: biometric modality configuration (unimodal vs. serial
> multimodal); matching mode (identification vs. verification); decision policy
> under ambiguity (nearest match vs. refusal); shift-context validation;
> station authorisation.
>
> **Bottom right:** rectangle "ATTENDANCE RECORD QUALITY (Dependent variables)"
> containing: attribution accuracy; inclusiveness; shift validity; integrity;
> throughput.
>
> **Arrows:** a thick horizontal arrow from bottom-left to bottom-right box; a
> vertical arrow from the top box pointing **down onto the middle of that
> horizontal arrow**, not into either box, labelled "moderates".
>
> Beneath, in italics: "Theoretical lenses: Task–Technology Fit (Goodhue &
> Thompson, 1995); Technology Acceptance Model (Davis, 1989)".
>
> Plain white background, thin black borders, minimal or no fill, left-aligned
> text in boxes. Academic figure, not an infographic.

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

## Figure 5.1 — Interface recovery process

> Draw a flowchart of an empirical reverse-engineering process.
>
> Start: "Hypothesis from equivalent Android binding" → "Call function with
> candidate signature" → decision diamond "Result?" with three branches:
> - "Access violation **writing** low address" → "Argument is an out-parameter
>   pointer"
> - "Access violation **reading** the passed value" → "Argument is a
>   dereferenced pointer, not an integer"
> - "Plausible return code" → "Signature confirmed"
>
> The first two branches loop back to "Revise hypothesis" → "Call function with
> candidate signature". The third proceeds to end node "Verified signature".
>
> **A side panel listing the five probes:** device enumeration; open-function
> argument shape; command-function argument shape; search-function output
> pointers; undocumented return code.
>
> Plain white, thin black lines.

---

## Figure 5.1b — Deployment topology

> Draw a deployment diagram with two clearly separated zones.
>
> **Zone 1, "Cloud":** a node "Static web application (Vercel)" and a node
> "PostgreSQL database and authentication (Supabase)".
>
> **Zone 2, "Kiosk PC (hospital)":** a node "Browser" containing "Console and
> kiosk interface" and "Liveness detection"; a node "Fingerprint bridge
> (32-bit Python)"; a node "Face recognition service (64-bit Python,
> InsightFace)". Two attached devices: "Fingerprint reader (USB)" and "Camera
> (USB)".
>
> **Connections:** Browser → Cloud labelled "HTTPS — public internet"; Browser
> → both local services labelled "HTTP — loopback only"; services → devices
> labelled "USB".
>
> **Annotate the loopback connections** with a note: "Requires local network
> access permission, granted once per machine."
>
> **Draw a dividing line** between the zones labelled "public internet /
> local machine".
>
> Plain, technical, no 3D.

---

## Figures 5.2, 5.3, 5.4 — build these in Excel, not with a drawing tool

These plot data you have measured. Drawing an approximation would be
misrepresenting results.

**Figure 5.2 — Fingerprint score distributions.** Histogram, two series
(genuine, impostor) from the exported attempts CSV. X: match score. Y: count.
Vertical line at the operating threshold.

**Figure 5.3 — Face similarity distributions.** Histogram or scatter, three
series: genuine, sibling, unrelated impostor. Vertical line at the threshold.
If you can produce this for both the original model and ArcFace, present them
side by side — that before-and-after is your strongest single result.

**Figure 5.4 — FAR/FRR against threshold.** Line chart, two series. X:
threshold 0 to 1. Y: error rate %. FAR falls as threshold rises, FRR rises.
Mark the crossing point as the Equal Error Rate, and mark your selected
operating threshold with a label explaining why it sits to the right of the
EER.

To build 5.4: in Excel, list candidate thresholds in a column (0.30, 0.35,
0.40 … 0.95), then for each compute
`FAR = COUNTIF(impostor_scores, ">="&threshold) / COUNT(impostor_scores)` and
`FRR = COUNTIF(genuine_scores, "<"&threshold) / COUNT(genuine_scores)`.
Plot both columns against the threshold column.
