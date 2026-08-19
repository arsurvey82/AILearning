# LLM Learner. Design Specification v4 (notebook + map + depth-on-demand)
*Design-first blueprint · Micro Learner project · for K · supersedes v1/v2/v3*

**v4 changelog:** added §11 *Depth-on-demand* (the rabbit-hole-as-feature layer model, seeded from a live playtest), §12 *Hybrid intelligence* (symbolic core + optional AI), and §13 *Revised scope* (one-deep-node-first). Read §11 to §13 first; they refine everything above.

> This is the build contract. It folds in the bbycroft-style **notebook** approach K liked, on top of the v2 decisions (real content, worked examples, cross-links, full build pipeline, corrected concept model).

---

## 0. The core idea in one paragraph

A learner walks a **real process, one step at a time, on a single tiny model**, watching real numbers move, then flips to a **map** whenever they want to see where they are or roam. The **notebook** (linear, narrated cells) and the **map** (zoom-out overview) are **co-equal, one-tap toggle** views of the same content. On-screen data is kept **small on purpose** (a 4-number vector, not 4096), with a **"at scale" callout** on each step telling you what the same thing looks like in GPT-2 / Llama-3 and what it costs to build for real.

This directly fixes every v1 complaint: order & "what next" come free from the notebook; substance comes from one real model threaded end-to-end; interlinks + the map handle roaming; nothing is a shell.

---

## 1. Two co-equal views, one toggle

| | **NOTEBOOK view** | **MAP view** |
|---|---|---|
| Feels like | Jupyter / bbycroft walkthrough | the universe, but as an orientation aid |
| Job | *learn the flow*. Read cells top-to-bottom | *see where you are & jump* |
| Motion | Next / Prev / scroll through cells | pan/zoom nested bodies, click to enter |
| Data shown | one operation's real numbers | almost none, just structure + "you are here" |

- **One toggle** (a segmented control, always visible) flips between them; **⌘/tap a map node → opens that notebook cell**; **each cell has a "◉ show on map" chip** → flips to the map centered there. "Easy to move in and out, as needed" = this toggle + these two jump affordances.
- Default landing = **Map** (the big picture), because seeing the whole shape first is the orientation; then dive into the Notebook to learn a stretch.

---

## 2. The one tiny toy model (threaded through everything)

Everything runs on a **deliberately tiny model** so every number is visible and real. Mirrors nanoGPT/bbycroft's "sorting" demo.

- **Task:** sort 3 letters. Input `C A B` → output `A B C`. (Trivial task = the *mechanics* are the star, not the task.)
- **Vocabulary:** `A, B, C` → IDs `0, 1, 2` (tiny embedding table: 3 rows).
- **Embedding dim:** **4** (so every vector is 4 numbers, fully shown).
- **Depth:** 2 attention heads (dim 2 each), 2 layers. enough to show multi-head + stacking, small enough to read.
- **Real math:** the forward pass is **computed live in JavaScript** from a small embedded set of weights, so numbers are genuine and **update when you change the input** (the "Run" control). Weights are either a tiny trained set or hand-tuned so the sort actually works, decided at build time; either way the arithmetic on screen is real.

**Why this matters:** the *same* input `C A B` flows from cell 1 to the last cell. That continuity is what makes bbycroft feel like a notebook and ours didn't.

---

## 3. The "at scale" callout (on every relevant cell)

A small, consistent side-note that answers "okay, but what about a real model?", K's "add nuances for larger."

> **Example callout (Embedding step):**
> *Here:* dim **4**, table **3×4 = 12 numbers.*
> *GPT-2 small:* dim **768.**  *Llama-3-8B:* dim **4096**, table **128,256 × 4096 ≈ 525 million numbers.**
> *To build those:* trained on **15T tokens**, thousands of GPUs, weeks, millions of dollars.

So the learner always holds both: the tiny thing they can see, and the honest scale of the real thing.

---

## 4. Cell anatomy (the notebook's atom)

Each cell = one operation / concept. Structure:

```
┌───────────────────────────────────────────────┐
│  ▸ cell title            [◉ show on map]        │
│  PROSE: 1-3 plain sentences (the "why")         │
│  ┌─ live visual ─────────────────────────────┐  │
│  │ real numbers for THIS step, hover to probe │  │
│  └────────────────────────────────────────────┘  │
│  🔎 at scale: here 4 · GPT-2 768 · Llama 4096   │
│  ↑ needs: [Vector] [Softmax]   ↓ next: [Values] │
│  ↔ related: [RoPE] [GQA]        (all clickable)  │
│           [ ‹ Prev ]   [ Next › ]                │
└───────────────────────────────────────────────┘
```

Fields per cell (the anti-shell content record): `title · prose · liveVisual(realNumbers) · analogy · atScale · needs[] · next[] · related[] · realWorldCaseStudy`.

---

## 5. The three notebooks (tracks), reachable from the map

The map shows three "continents"; each is its own linear notebook.

**① FORWARD PASS. *how it thinks*** (the inference walk; primary track)
Input `C A B` → Tokenize → Token-embed → Position-embed → **Input-embed** → [Block: RMSNorm → Attention (Q·K → softmax → ·V) → residual → MLP (up → SwiGLU → down) → residual] ×2 → Final norm → Unembed → **Softmax → next-token probabilities** → predicted letter.

**② BUILD. *how it's made*** (the training pipeline; K's "full build pipeline")
Gather data → Train tokenizer → **Pretraining** (predict-next-token, cross-entropy loss, backprop, AdamW) → SFT → **Alignment** (RLHF/DPO/GRPO) → Evaluation → Deploy prep (quantize/distill) → Continual/new training. Each cell: *in → out · what changed vs last step · at-scale cost.*

**③ OPERATIONS, *how it's run*** (the infra)
Build infra: Feast · Kubeflow · MLflow. Serve infra: AIBrix · vLLM · Agent layer · Monitoring. Each links to the model concept and build stage it serves.

Cross-track links: the Forward-Pass "Attention" cell links to Build's "Pretraining" (where those weights came from) and Operations' "vLLM" (what serves it at scale).

---

## 6. Two fully-worked cells (real toy numbers, judge the depth)

### Cell, **Input embedding** (Forward Pass)
- **prose:** Each letter becomes numbers (token-embed), gets a seat stamp (position-embed), and the two are **added** → the vector that enters Block 0.
- **analogy:** name tag (*what you are*) + seat number (*where you sit*), carried together.
- **live visual (real):** input `C A B`, dim 4, 
  ```
  C @pos0:  wte[C] [ 0.20,-0.50, 0.90, 0.30]  +  wpe0 [ 0.10, 0.00, 0.05,-0.05]  =  [ 0.30,-0.50, 0.95, 0.25]
  A @pos1:  wte[A] [ 0.90, 0.10,-0.20, 0.40]  +  wpe1 [ 0.00, 0.10,-0.05, 0.05]  =  [ 0.90, 0.20,-0.25, 0.45]
  B @pos2:  wte[B] [-0.30, 0.80, 0.20,-0.10]  +  wpe2 [-0.10, 0.05, 0.00, 0.10]  =  [-0.40, 0.85, 0.20, 0.00]
  ```
- **at scale:** dim 4 → GPT-2 768 → Llama-3 4096; table 3×4 here vs ~525M numbers in Llama-3.
- **needs:** Token ID, Vector, Lookup table · **next:** Attention · **related:** RoPE (a different way to do the "seat stamp")
- **real world:** nanoGPT calls these tables `wte` + `wpe`; GPT-2 adds them exactly like this; Llama swaps the position table for RoPE inside attention.

### Cell. **Attention score (Q·K → softmax)** (Forward Pass)
- **prose:** Each letter asks a question (Query) and offers a tag (Key); their dot product = how much it should listen to the other; softmax turns those into % attention.
- **live visual (real, using head-1, dim 2 slices):**
  ```
  Q(A) = [1.0, 0.0]     K(C) = [0.5, 1.0] → Q·K = 0.50
                        K(A) = [1.0, 0.2] → Q·K = 1.00
                        K(B) = [0.0, 1.0] → Q·K = 0.00
  softmax([0.50, 1.00, 0.00]) ≈ [0.31, 0.51, 0.19]
  → letter A spends 51% of its attention on itself, 31% on C, 19% on B
  ```
- **at scale:** here 2 heads; GPT-2 = 12, GPT-3 = 96; real models divide scores by √(head-dim) for stability.
- **needs:** Input embedding, Dot product, Softmax · **next:** Weighted sum of Values · **related:** GQA, MLA, FlashAttention
- **real world:** the variant chosen (MHA/GQA/MLA) is purely about shrinking the Key/Value memory when this runs at scale in vLLM.

---

## 7. Interaction model

1. **Toggle** notebook ⇄ map anytime (segmented control).
2. In **notebook**: Prev/Next or scroll; hover any number to see its exact value + where it came from; cross-link chips jump (and switch track if needed).
3. In **map**: pan/zoom the three continents; click any body → opens its notebook cell.
4. **Run control**: change the input letters → whole notebook re-computes with new real numbers.
5. **Progress dots**: a thin per-track progress rail so "what's next" and "how far in am I" are always visible.
6. **Keep it uncluttered**: only the active cell's numbers are on screen; everything else is one tap away.

---

## 8. Visual & technical direction

- **Notebook:** clean, high-contrast card column; **monospace for all numbers** so they read as data; the active operation highlighted; generous whitespace (the "not too much data" rule).
- **Map:** the dark starfield/nested-bodies aesthetic, but stripped to structure + "you are here", no number soup.
- **Tech:** one **self-contained HTML** file. Content lives in a structured `NODES`/`CELLS` data model; the toy-model forward pass is real JS math. Canvas for the map, HTML/CSS for the notebook. No build step (Vite unnecessary. single file is the correct shipping format here).
- **Accuracy:** all "at scale" figures get a verification pass at build time.

---

## 9. Build phases

- **Phase 1. Forward-Pass notebook + map + toggle**, toy model threaded, real numbers live, every cell with prose/analogy/at-scale/links. *(This is the gut-check deliverable.)*
- **Phase 2. Build & Operations notebooks** added as two more tracks on the map.
- **Phase 3. Run control + hover-probe + 2-3 richer playground cells** (tokenizer, attention slider).

---

## 10. Sign-off checklist (redline before I build)

- [ ] Toy model = "sort A/B/C", dim 4, 2 heads, 2 layers, OK, or want a different tiny task?
- [ ] Default landing = Map, then dive to Notebook, OK?
- [ ] Phase 1 first (Forward Pass only) for a navigation gut-check, then 2 & 3, OK?
- [ ] Depth level of §6 cells feels right, richer / simpler?

---

## 11. Depth-on-demand, the rabbit hole is the feature

**The insight (from a live playtest):** a novice doesn't learn a concept linearly. They learn it as a *tree of "wait, what? why?" questions*, each digging one layer deeper. Observed, verbatim, learning Embedding:
> embedding → what's a seat? → why 11? → index vs token ID? → isn't position 3 an A? → why 48 numbers? → why two separate tables? → what if it's a million?

That branching **is** the rabbit hole, and it's the feature, not a mess to flatten. v1's universe let you go down (box-in-box) but every box was empty. The fix is **depth on demand, real content at every level, common wrong-turns pre-loaded.**

**Every concept node is a stack of layers; the learner chooses how far to fall:**

| Layer | What it holds | Always shown? |
|---|---|---|
| **L0 · one-liner** | the idea + an analogy ("name tag + seat, added") | yes |
| **L1 · plain + tiny real example** | the actual toy numbers | 1 tap |
| **L2 · common snags** | the *exact* questions real learners ask, as tap-to-open cards | 1 tap |
| **L3 · at scale** | GPT-2 768 / Llama 4096 / 1M context nuance | 1 tap |
| **L4 · under the hood** | the real matrix math + code (`wte`, `wpe`, shapes) | 1 tap |

Simple on top; deep underneath, but only if *you* dig. That's the universe K liked, except every planet now has real ground beneath it.

**Playtested snags principle:** L2 cards are not invented. they're harvested from watching real novices trip. Embedding's snags (seat? · why 11? · index-vs-ID? · off-by-one · why-48? · why-two-tables? · input-vs-input-embed?) are already captured in `claude/embedding-node-content.md`. Every future node gets the same treatment: walk a beginner through it, log where they stumble, those become the cards.

## 12. Hybrid intelligence, symbolic core + optional AI

Don't build the depth as pure bulk (shell risk) *or* pure live-AI (fragile, costly, can hallucinate the math). Split it:

**Layer A, Symbolic / computed (always on; offline; free; the source of truth)**
- The toy forward pass is *real JS math*. deterministic, correct, never hallucinates.
- Authored L0 to L4 content + snag cards ship in the file.

**Layer B, Optional AI (bring-your-own-key; graceful fallback)**
- A "still confused? ask anything" box per node. Unmatched questions go to an LLM **grounded** in that node's *verified* content + real numbers, so it re-explains ground truth, not invention.
- No key → tool is fully functional on Layer A alone. Key → the infinite tail unlocks.

**The guardrail:** truth stays symbolic, **AI only ever re-explains; it never computes or asserts a fact.** The mechanics can't be corrupted by a loose answer because they're calculated, not spoken. Reliable bones, infinite reach. Ships self-contained (no key baked in).

## 13. Revised scope, one deep node first

Building all nodes to L0 to L4 at once = the shell trap again. Instead:

- **Milestone 1:** the engine (map ⇄ notebook toggle, layer expander, symbolic toy-math) + **Embedding fully built to L0 to L4** from `embedding-node-content.md`, as the template. Ship it, feel the depth, confirm the pattern.
- **Milestone 2:** clone the pattern to the next nodes (Attention next), each playtested for its own snags.
- **Milestone 3:** optional AI layer (§12) + Build/Operations tracks.

One *complete* planet beats fifty empty ones.
