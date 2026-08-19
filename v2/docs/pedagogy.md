# Pedagogy and UX decisions, and what they rest on

Every design choice below is traceable to a finding rather than to taste. Where
a decision is taste, it says so.

This exists because "make it more engaging" is how learning tools acquire
animation that demos well and teaches worse. Each entry names what was
**ruled out** as well as what was chosen. A principle that forbids nothing is
decoration.

---

## 1. Depth on demand, L0 → L4

**Rests on:** Cognitive Load Theory (Sweller). Working memory is narrow, and
instructional design either spends it on the material (germane) or wastes it on
the presentation (extraneous).

**Decision:** L0 always visible; L1 to L4 collapsed until asked for. Only what the
learner opens is rendered. Hidden layers are not in the DOM, the tab order, or
the accessibility tree.

**Ruled out:** showing everything and letting people scroll past. That spends
attention on filtering before any learning starts.

---

## 2. Worked examples, computed live

**Rests on:** the worked-example effect (Sweller & Cooper), for novices,
studying a worked solution beats attempting the problem, because problem-solving
search consumes the capacity that schema-building needs.

**Decision:** every number is computed by the symbolic core from the input in
the Run box. No content file contains a literal value; a test enforces it.

**Ruled out:** hand-written illustrative numbers. They drift from the code, and
a learner who spots the drift stops trusting everything else.

---

## 3. Segmenting, the animation is learner-paced

**Rests on:** Mayer's segmenting principle. Learner-paced presentation beats
system-paced; the *pauses between segments* are what allow the previous one to
be processed. A meta-analysis of the segmenting effect supports this across
media.

**Decision:** `AttentionArcs` steps one query token at a time, on click. **There
is no autoplay and no timeline.** Stepping forward is the only way anything
moves.

**Ruled out:** an animated loop of attention flowing. It would look better in a
screenshot and give the learner no control over pace, which is the one variable
the research says matters most.

**Sources:**
- [A Meta-analysis of the Segmenting Effect](https://link.springer.com/article/10.1007/s10648-018-9456-4), *Educational Psychology Review*
- [Effects of segmentation and pacing on procedural learning by video](https://www.sciencedirect.com/science/article/abs/pii/S0747563217306829)
- [Segmentation effects on cognitive load and retention](https://pmc.ncbi.nlm.nih.gov/articles/PMC10759450/), PMC

---

## 4. Signaling and dual coding, arcs *and* numbers

**Rests on:** Mayer's signaling principle (highlight the essential material) and
the multimedia principle / dual coding (Paivio), words plus pictures beat
either alone.

**Decision:** the active token's arcs are drawn at full strength and the rest
recede; every arc carries its percentage as text; the number grid stays directly
below, showing the same selection. Arcs and grid share one selection in the
store so they can never disagree.

**Ruled out:** replacing the grid with the diagram. The diagram is the second
channel, not a substitute, and it is the channel a screen reader cannot use,
which is why the grid is the accessible primary and the SVG is `aria-hidden`
with a live text summary beside it.

---

## 5. Practised mode removes support, expertise reversal

**Rests on:** the expertise reversal effect (Kalyuga and colleagues). Novices
learn better under high-assistance instruction; **experts learn better under
low-assistance instruction.** Guidance that raises a beginner's gains *lowers*
an expert's, because it duplicates what their prior knowledge already supplies.
For advanced learners, *eliminating* redundant representations and worked-out
steps outperformed providing them.

**Decision:** a two-state control. `Learning` shows analogies and slices numbers
to six; `Practised` hides analogies and shows twelve. The lesson content is
untouched, only scaffolding changes. The control explains itself on demand.

**This is the answer to "novice to expert".** Progression is the app showing
*less*, not more.

**Ruled out:** inferring expertise from click behaviour. A wrong guess produces
exactly the mismatch the effect describes, so the learner chooses explicitly.

**Sources:**
- [Expertise Reversal Effect and Its Implications for Learner-Tailored Instruction](https://link.springer.com/article/10.1007/s10648-007-9054-3), *Educational Psychology Review*
- [A cornerstone of adaptivity. a meta-analysis of the expertise reversal effect](https://www.sciencedirect.com/science/article/pii/S0959475225000660)
- [Expertise reversal effect and its instructional implications](https://link.springer.com/article/10.1007/s11251-009-9102-0), *Instructional Science*

---

## 6. Slice six, not forty-eight

**Rests on:** Miller's classic finding that immediate memory holds roughly seven
items, plus cognitive load theory. A row you can take in at a glance costs
nothing; forty-eight numbers cost a scan.

**Decision:** six columns by default, twelve once practised, `show all` always
available.

**Ruled out:** showing the full vector because it is "more honest". The full
count is stated in words on every grid. the information is not hidden, only
the rendering is bounded.

---

## 7. Retrieval practice, checkpoints

**Rests on:** the testing effect (Roediger & Karpicke, 2006). *"Testing is a
powerful means of improving learning, not just assessing it."* Alternating study
and test produced the best retention, and feedback strengthens the benefit
further.

**Decision:** one checkpoint on each of the four spine nodes, after the study
material. Three things make it retrieval rather than a quiz:

- **Every distractor is a real misconception**, lifted from that node's snag
  cards. Embedding's wrong answer is the exact off-by-one K made in the July
  2026 playtest. the one misconception in this app that was observed rather
  than predicted.
- **A wrong answer opens the card that answers it**, rather than just being
  marked. Feedback is the multiplier the research identifies, and this costs no
  new content.
- **It is never a gate.** Opt-in, skippable, and Next works regardless. A quiz
  that blocks progress gets guessed at instead of thought about, which converts
  retrieval practice into an obstacle.

**Ruled out:** scoring, streaks, or any progress that depends on answering
correctly. The benefit is in the act of retrieving; a score turns attention
toward the score.

**Sources:**
- [Test-enhanced learning: taking memory tests improves long-term retention](https://pubmed.ncbi.nlm.nih.gov/16507066/), Roediger & Karpicke
- [The critical role of retrieval practice in long-term retention](https://pubmed.ncbi.nlm.nih.gov/20951630/)
- [Test-enhanced learning in undergraduate science courses](https://pmc.ncbi.nlm.nih.gov/articles/PMC4477741/), PMC

---

## 8. UX laws applied

Classical results, cited by their original papers. Applied where they change a
decision, not as decoration.

| Law | Origin | What it changed here |
|---|---|---|
| **Hick's Law**. choice time grows with the number of options | Hick 1952; Hyman 1953 | 64 nodes on the map is paralysing on arrival, so there is one prominent entry point: *Walk the forward pass*. Roaming stays available; it is not the default. |
| **Miller's Law**. ~7 items in immediate memory | Miller 1956 | Six columns per row by default; flow diagrams cap nested parts. |
| **Fitts's Law**. acquisition time depends on target size and distance | Fitts 1954 | Step controls sit adjacent to the thing they step; token chips are full-height targets rather than text links. |
| **Jakob's Law**. users expect familiar patterns | Nielsen | Breadcrumbs, Prev/Next, expanders behave conventionally. No novel navigation to learn before learning the subject. |
| **Von Restorff effect**. the distinct item is remembered | von Restorff 1933 | Exactly one thing is highlighted at a time: the active token, the selected node's rim, the open snag. |
| **Doherty threshold**. engagement holds when response is under ~400 ms | IBM, 1982 | Every interaction is local computation; the toy model runs in microseconds. The only network call in the product is the optional AI box. |
| **Tesler's Law**. complexity is conserved, not eliminated | Tesler | The subject is genuinely complex, so the design chooses *where* complexity lives: in optional depth, not in the default surface. |

---

## 9. What is taste, not evidence

Stated plainly so it is not mistaken for grounding:

- The dark-first palette and the starfield map.
- The specific wording of every snag answer.
- Arcs rather than a heat-map matrix for attention, both are defensible; arcs
  were chosen because a matrix reads as a table and the point is that attention
  is *routing*.
- Three continents rather than another top-level split.

---

## 10. The tier this cannot reach

Everything above is design grounded in general findings. Whether *this* material
works for *these* learners is an empirical question about this artifact, and no
citation settles it. That is `docs/playtest-protocol.md`, and it is the only
validation tier still entirely open.
