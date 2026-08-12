# Chapter Five — diagram prompts

Five figures. Screenshots 5.1–5.12 are captures from the running system and
need no prompt.

Two of these are diagrams and three are charts, and they are different jobs.
Figures 5.1 and 5.2 describe a process and a topology — any drawing tool will
do. **Figures 5.3, 5.4 and 5.5 plot the measured results of Section 5.6**, so
the numbers are given in the prompts and must appear exactly as stated. If you
re-run the trials, regenerate these from your own exported CSV rather than
redrawing them.

---

## Figure 5.1 — Interface recovery process

> Draw a flowchart of an empirical reverse-engineering process, laid out
> vertically, with a feedback loop.
>
> Start node: **"Vendor DLL with no published interface"**.
>
> Then, in sequence:
> 1. Rectangle: **"Read the Android SDK binding for the same device"**
> 2. Rectangle: **"Form hypothesis: Windows signature matches Android"**
> 3. Rectangle: **"Probe: call function with hypothesised arguments"**
> 4. Diamond: **"Result?"** with three labelled outgoing branches:
>    - **"Access violation writing"** → rectangle *"Argument is an out-pointer —
>      pass a buffer"*
>    - **"Access violation reading"** → rectangle *"Argument is dereferenced —
>      pass a pointer, not a value"*
>    - **"Plausible return code"** → rectangle *"Alignment confirmed"*
> 5. The two fault branches feed a rectangle **"Revise hypothesis"**, which
>    loops back with an arrow to step 3. **Label this return arrow "5 probes"**.
> 6. The confirmed branch continues to: rectangle **"Verify against live
>    hardware"** → end node **"Interface recovered and documented"**.
>
> **Add a callout box** attached to step 2 reading: *"Windows signature =
> Android signature plus a leading context pointer."*
>
> **Add a second callout** attached to step 6 reading: *"Return code 0x1B is
> undocumented in every published source."*
>
> Notation: rectangles for steps, diamond for the classification, rounded
> capsules for start and end. Plain white background, thin black lines, one
> accent colour on the feedback loop only.

---

## Figure 5.2 — Deployment topology

> Draw a deployment diagram with two clearly separated regions and one
> connection crossing between them.
>
> **Left region, a large box labelled "HOSPITAL PREMISES — check-in station"**,
> containing:
> - A box "Windows PC"
> - Inside it, three stacked boxes: "Browser (kiosk interface)", "Fingerprint
>   bridge — localhost:8321", "Face service — localhost:8322"
> - Two peripheral icons attached to the PC: "Fingerprint reader (USB)" and
>   "Camera (USB)"
>
> Draw the internal connections as **solid lines labelled "loopback — never
> leaves the machine"**.
>
> **Right region, a large box labelled "CLOUD — single region"**, containing:
> - A box "Static site hosting (CDN)"
> - A box "Managed PostgreSQL + authentication"
> - A solid line between them
>
> **One connection crosses between the regions**: from "Browser" to the cloud
> region. Draw it as a **thick line labelled "HTTPS — public internet"**, and
> make it visually distinct from every internal line.
>
> **Add a legend** with two entries: a thin line for *"local only"* and a thick
> line for *"crosses the public internet"*.
>
> **Add a note box** reading: *"Biometric samples are captured, compared and
> discarded on the local machine. Only an identifier and a match score cross
> the boundary."*
>
> Plain white background, thin black lines, one accent colour for the crossing
> connection. No 3D, no gradients, no cloud clip-art.

---

## Figure 5.3 — Fingerprint score distributions

> Draw a **grouped histogram** with two series on a shared horizontal axis.
>
> **Horizontal axis:** "Match score (device scale, 0–100)", from 0 to 100, with
> gridlines every 10.
> **Vertical axis:** "Number of comparisons".
>
> **Series 1 — "Impostor comparisons (n = 105)"**, in a light grey or blue:
>
> | Score range | Count |
> |---|---|
> | 0–5 | 18 |
> | 5–10 | 27 |
> | 10–15 | 24 |
> | 15–20 | 17 |
> | 20–25 | 11 |
> | 25–30 | 6 |
> | 30–35 | 2 |
>
> **Series 2 — "Genuine attempts (n = 196)"**, in a darker or contrasting
> colour:
>
> | Score range | Count |
> |---|---|
> | 40–45 | 3 |
> | 45–50 | 5 |
> | 50–55 | 9 |
> | 55–60 | 14 |
> | 60–65 | 18 |
> | 65–70 | 21 |
> | 70–75 | 26 |
> | 75–80 | 30 |
> | 80–85 | 28 |
> | 85–90 | 22 |
> | 90–95 | 15 |
> | 95–100 | 5 |
>
> **Draw a vertical dashed line at score 45**, labelled **"Operating threshold
> = 45"**.
>
> **Shade the region between 34 and 41** in a pale tint and label it **"No
> comparison of either type falls in this band"**.
>
> Include a legend. Plain white background, no 3D bars, no drop shadows.
> Academic figure, printable in greyscale — so the two series must differ in
> more than colour alone (use a fill pattern on one).

---

## Figure 5.4 — Facial similarity distributions

> Draw a **grouped histogram with three series** on a shared horizontal axis.
> This is the most important chart in the document, so give it a full column
> width and keep the third series clearly visible even though it is small.
>
> **Horizontal axis:** "Cosine similarity", from 0.0 to 1.0, gridlines every
> 0.1.
> **Vertical axis:** "Number of comparisons".
>
> **Series 1 — "Impostor, unrelated pairs (n = 100)"**, light grey:
>
> | Similarity | Count |
> |---|---|
> | 0.00–0.05 | 4 |
> | 0.05–0.10 | 7 |
> | 0.10–0.15 | 12 |
> | 0.15–0.20 | 18 |
> | 0.20–0.25 | 21 |
> | 0.25–0.30 | 16 |
> | 0.30–0.35 | 11 |
> | 0.35–0.40 | 7 |
> | 0.40–0.45 | 4 |
>
> **Series 2 — "Genuine (n = 220)"**, dark blue:
>
> | Similarity | Count |
> |---|---|
> | 0.60–0.65 | 2 |
> | 0.65–0.70 | 3 |
> | 0.70–0.75 | 9 |
> | 0.75–0.80 | 24 |
> | 0.80–0.85 | 61 |
> | 0.85–0.90 | 79 |
> | 0.90–0.95 | 42 |
>
> **Series 3 — "Impostor, sibling pair (n = 10)"**, in a strong contrasting
> colour such as red, drawn in front so it is not hidden:
>
> | Similarity | Count |
> |---|---|
> | 0.45–0.50 | 1 |
> | 0.50–0.55 | 2 |
> | 0.55–0.60 | 4 |
> | 0.60–0.65 | 3 |
>
> **Draw two vertical dashed lines:**
> - at 0.632, labelled **"Equal error rate"**
> - at 0.68, labelled **"Operating threshold"** — draw this one thicker
>
> **Add an annotation with a leader line pointing at the red series**, reading:
> *"Ten comparisons from one sibling pair. Unrelated impostors reach 0.438 at
> most; these reach 0.641."*
>
> Include a legend with all three series named. Plain white background, no 3D,
> no shadows. The red series must remain distinguishable in greyscale, so give
> it a distinct outline or hatch as well as its colour.

---

## Figure 5.5 — FAR and FRR against threshold

> Draw a **line chart with two curves** crossing each other.
>
> **Horizontal axis:** "Similarity threshold", from 0.40 to 0.90.
> **Vertical axis:** "Error rate (%)", from 0 to 14.
>
> **Curve 1 — "False acceptance rate (FAR)"**, descending from left to right:
>
> | Threshold | FAR (%) |
> |---|---|
> | 0.40 | 12.7 |
> | 0.45 | 9.1 |
> | 0.50 | 8.2 |
> | 0.55 | 6.4 |
> | 0.60 | 2.7 |
> | 0.632 | 0.9 |
> | 0.65 | 0.0 |
> | 0.68 | 0.0 |
> | 0.75 | 0.0 |
> | 0.85 | 0.0 |
> | 0.90 | 0.0 |
>
> **Curve 2 — "False rejection rate (FRR)"**, ascending from left to right:
>
> | Threshold | FRR (%) |
> |---|---|
> | 0.40 | 0.0 |
> | 0.45 | 0.0 |
> | 0.50 | 0.0 |
> | 0.55 | 0.0 |
> | 0.60 | 0.0 |
> | 0.632 | 0.9 |
> | 0.65 | 0.9 |
> | 0.68 | 2.3 |
> | 0.75 | 6.4 |
> | 0.85 | 45.0 |
> | 0.90 | 80.9 |
>
> Cap the vertical axis at 14% so the crossing region is legible; the FRR curve
> runs off the top of the plot beyond about 0.78. **Do not rescale the axis to
> fit the tail** — doing so flattens the crossing region to a single pixel and
> destroys the point of the chart.
>
> **Mark the crossing point** at (0.632, 0.9%) with a hollow circle, labelled
> **"EER = 0.9% at threshold 0.632"**.
>
> **Draw a vertical dashed line at 0.68**, labelled **"Selected operating point
> — FAR 0.0%, FRR 2.3%"**.
>
> **Add a short annotation** beneath the operating point reading: *"Set above
> the EER deliberately: a false acceptance costs more than a false rejection."*
>
> Smooth lines, distinct markers on each series, legend included. Plain white
> background, no 3D. Greyscale-safe: use a solid line for one curve and a
> dashed line for the other.

---

## Checking the output

| Figure | Most common error to check for |
|---|---|
| 5.1 | The feedback loop drawn as a straight path, losing the iteration |
| 5.2 | Internal and crossing connections drawn identically |
| 5.3 | The 34–41 gap closed up by auto-binning |
| 5.4 | The 10-comparison sibling series rendered invisible behind the others |
| 5.5 | The vertical axis auto-scaled to 80%, flattening the crossing to nothing |
