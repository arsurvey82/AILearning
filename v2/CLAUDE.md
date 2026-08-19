# LLM Learner — Build Instructions for Claude Code

> **How to use this file:** put it at the repo root (rename to `CLAUDE.md` so Claude Code auto-loads it, or keep this name and start with *"Read CLAUDE-BUILD-INSTRUCTIONS.md and implement Milestone 1"*). Build **one milestone at a time**, stop at each acceptance gate (§10), and do not start the next milestone until the current one passes. Two companion docs are the source of truth for design and content: `llm-universe-design-spec.md` (v4) and `embedding-node-content.md`. If anything here conflicts with them, they win on intent; ask before diverging.

---

## 1. What you are building

An interactive, explorable web app that teaches how an LLM works, from the ground up, to a **smart non-expert**. The pedagogy has three laws, learned from watching a real novice:

1. **One idea at a time.** Never a wall of text. The surface is calm; depth is opt-in.
2. **Real data, always.** Every number shown is *computed*, never faked. A single tiny toy model is threaded through the whole app.
3. **Depth on demand.** Each concept is a stack of layers (L0→L4). The learner chooses how far to fall. The common wrong-turns are pre-loaded as "snag" cards (harvested from real playtests, not invented).

Two co-equal views, one toggle: a **Map** (zoomable overview — "where am I") and a **Notebook** (linear walkthrough — "teach me this stretch"). See `design-spec §1, §11`.

**This is a learning UX product. UX quality is a first-class acceptance criterion, not polish.** A correct-but-clunky build fails.

## 2. Non-negotiables (guardrails)

- **Symbolic core is the source of truth.** The toy-model math is real, deterministic TypeScript. It must never be produced by an LLM. (design-spec §12)
- **AI only ever re-explains; it never computes or asserts a fact.** The optional AI layer is grounded in verified node content. No key required for full function.
- **Single-source content.** All teaching content lives in typed data files (§5), never hardcoded in components. One node's content is authored once and rendered by a generic renderer.
- **No shells.** A node without a real example + populated snags is not "done."
- **Accessibility is required, not optional** (§7.7). Keyboard-navigable, screen-reader-labeled, WCAG AA contrast, `prefers-reduced-motion` honored.
- **Ships static.** No mandatory backend. Deployable to any static host.

## 3. Tech stack

Use unless you have a strong reason; note swaps in the PR.

- **Vite + React + TypeScript** (strict).
- **State:** local component state + a small store (Zustand) for `currentView`, `focusNodeId`, `openLayer`, `runInput`. No Redux.
- **Styling:** CSS with **design tokens as CSS custom properties** (§7.6). Tailwind is acceptable if tokens are preserved; otherwise plain CSS modules.
- **Map rendering:** HTML5 **Canvas 2D** (nodes, orbits, particles, camera transform). Keep it in a self-contained `<MapCanvas>` with a documented render loop.
- **Notebook + dossier + snag cards:** React DOM (accessible, selectable text).
- **Math:** plain TS in `/src/model` — no libraries needed for M1.
- **Optional AI:** a thin `AIAdapter` interface (§9); default `NullAdapter` (fully functional offline).
- **Tests:** Playwright for screenshot + interaction checks; Vitest for the model math.
- **Lint/format:** ESLint + Prettier; TS strict, no `any` in `/src/model` or `/src/content`.

## 4. Repo structure

```
/src
  /model        # symbolic core: toy model, forward pass, RNG-seeded weights  (PURE, TESTED)
    toyModel.ts
    embedding.ts
    forward.ts        # M2+: attention etc.
  /content      # typed teaching content — the single source of truth
    schema.ts         # types (§5)
    nodes/
      embedding.ts     # from embedding-node-content.md, mapped to schema
  /engine       # generic renderers (content-agnostic)
    Dossier.tsx        # renders any node's L0–L4 + snags
    LayerExpander.tsx
    SnagCard.tsx
    RunControl.tsx
    NumberGrid.tsx     # hover-probe vectors/matrices
  /map
    MapCanvas.tsx
    camera.ts
  /notebook
    Notebook.tsx
    Cell.tsx
  /ai
    AIAdapter.ts       # interface + NullAdapter + (optional) fetch adapter
  /ui
    tokens.css         # §7.6 design tokens
    ViewToggle.tsx, Breadcrumb.tsx, ProgressRail.tsx
  App.tsx
/tests
```

## 5. Content schema (the anti-shell contract)

All content is data. Author once; a generic component renders it. Types:

```ts
type NodeId = string;

interface ConceptNode {
  id: NodeId;
  title: string;            // "Embedding"
  tag: string;              // "core stage"
  track: 'model' | 'build' | 'operations';
  order: number;            // position in its notebook track
  color: string;            // token name, e.g. 'blue'
  L0_oneLiner: string;      // always visible
  L0_analogy: string;       // "name tag + seat number, carried together"
  L1: { prose: string; example: WorkedExample };
  L2_snags: Snag[];         // the playtested cards
  L3_atScale: ScaleNote[];
  L4_underHood?: string;    // real math/code, markdown
  prereqs: NodeId[];        // "needs first"  → highlighted blue on map
  leadsTo: NodeId[];        // "unlocks next" → highlighted green on map
  related: NodeId[];        // inline cross-links
}

interface WorkedExample {         // rendered by <NumberGrid>, values come from /model (REAL)
  caption: string;
  compute: (input: string) => NumberBlock;   // pulls from symbolic core, never static
}
interface Snag { q: string; a: string; }       // q = the exact learner question
interface ScaleNote { label: string; here: string; gpt2?: string; llama?: string; }
```

Rules: `WorkedExample.compute` **must call the symbolic core** so numbers update with the Run control. A snag's `q` is phrased as the learner would ask it ("Isn't position 3 an A?"), not as a heading.

## 6. Symbolic core — the toy model (real math)

Spec: `design-spec §2`. Sorts 3 letters; vocab `A B C` (ids 0,1,2); example input `C B A B B C`; **embedding dim C = 48**; **context/seats = 11**; 2 heads × dim-2; 2 layers (heads/layers are M2).

For M1 (Embedding only) implement in `/src/model`:
- Seeded deterministic weights (use a small seeded PRNG; **label them "illustrative"** in UI): `tokenTable: number[3][48]`, `posTable: number[11][48]`.
- `tokenize(str) → number[]` (letters→ids), `positions(n) → number[]`.
- `embed(input): { tokenVec, posVec, inputVec }[]` where `inputVec = tokenVec + posVec` (elementwise). This is the real computation the Embedding node displays; the **Run control** re-invokes it on new input.
- Unit-test: same letter → same token vector regardless of seat; same seat → same pos vector regardless of letter; input = sum. (These tests encode the two "why separate tables" facts.)
- **M2 note:** when Attention lands, prefer importing real nanoGPT sort-model weights so the forward pass genuinely sorts; until then weights are illustrative and must be labeled as such.

## 7. UX & interaction spec  ← weight this as heavily as content

### 7.1 The two views (co-equal, one toggle)
- Persistent segmented control: **Map ⇄ Notebook**. State in store; both mount, transition ~250ms.
- **Land on Map** (orientation first). A map node → click opens that node in Notebook. A notebook cell → "◉ show on map" recenters the map there. (design-spec §1)

### 7.2 Map behavior
- Zoomable/pannable Canvas. Nodes = glowing bodies; child concepts nest inside (semantic zoom / "box in box").
- **Camera pins to the focused node** (no drift). Ease scale ~250ms; position exact.
- **State on every node:** available (bright) · prerequisite-of-selection (blue rim) · leads-to (green rim) · visited (subtle check). Selecting a node highlights its `prereqs` blue and `leadsTo` green — this is the wordless "what do I need / what's next."
- Minimal text on the map (labels only when a node is large enough). Numbers live in the Notebook, not here.

### 7.3 Notebook behavior — the depth expander (core interaction)
Each node renders as a **Cell** showing **L0 by default** (one-liner + analogy). Below it, four calm expanders, collapsed:
`▸ Show me (L1)` · `▸ Common snags (L2)` · `▸ At scale (L3)` · `▸ Under the hood (L4)`
- Expanders animate open (height, ~200ms, reduced-motion: instant). Only the layers the user opens are shown — **surface stays calm.**
- **L2 snags** render as a list of question chips; tapping one expands *just that answer* inline. These are the field-tested questions — the learner recognizes their own confusion and self-serves.
- Always-visible footer line: **"Needs: [prereqs] · Unlocks: [leadsTo]"** as buttons. No dead ends. (This is the fix for "I don't know why I'm here or what's next.")
- Prev / Next move through the track in forward-pass order; a **ProgressRail** shows how far in.

### 7.4 Worked numbers — `<NumberGrid>`
- Render vectors/matrices as cells; **monospace, tabular-nums.** Show a **slice** of big vectors (first 6 of 48) with a trailing `…` and a "show all" toggle — never dump 48 by default (calm surface).
- **Hover/focus a cell → tooltip** with its exact value and *where it came from* ("token 'B' dim 3 + seat 3 dim 3").
- Color the three roles distinctly (token vec / position vec / input vec) using categorical tokens; never color-only — always labeled.

### 7.5 The Run control
- An input for the letters (default `C B A B B C`, validated to vocab). Changing it **re-runs the symbolic core** and every visible number updates live. Show a subtle recompute pulse. This is the interactive playground, threaded through — not bolted on.

### 7.6 Visual system (design tokens — use these exact values)
Dark is primary; also ship a validated light theme via `[data-theme]`. Put in `tokens.css`:
```
--surface:#1a1a19; --plane:#0d0d0d; --ink:#fff; --ink-2:#c3c2b7; --muted:#898781;
--border:rgba(255,255,255,.10); --grid:#2c2c2a;
--blue:#3987e5; --violet:#9085e9; --aqua:#199e70; --orange:#d95926;
--yellow:#c98500; --magenta:#d55181; --green:#2a9d2a;
--good:#0ca30c; --warn:#fab219; --serious:#ec835a; --crit:#d03b3b;
/* light theme: --surface:#fcfcfb; --plane:#f9f9f7; --ink:#0b0b0b; --ink-2:#52514e; --blue:#2a78d6; ... */
```
Type: system UI sans everywhere; `tabular-nums` only for aligned numbers. Hairline borders, recessive grid, generous whitespace. Categorical hues assigned in fixed order, never color-alone (pair with label/shape). (These are validated for contrast + colorblind-safety; don't invent new hues.)

### 7.7 Motion, responsive, accessibility (all required)
- **Motion:** ease-out, 200–300ms; nothing that blocks reading; **`prefers-reduced-motion` → transitions become instant, orbit animation pauses.**
- **Responsive:** map + notebook stack on narrow screens; toggle stays reachable; number grids scroll horizontally, never overflow.
- **Keyboard:** every node, expander, snag, cross-link, and Run input reachable and operable by keyboard; visible focus rings; Esc collapses / zooms out.
- **Screen reader:** semantic headings per layer; ARIA on the canvas map with a parallel list/landmark of nodes; number grids have text alternatives.
- **Contrast:** WCAG AA. Status colors always ship with icon+label.

### 7.8 Microcopy tone
Warm, plain, second person, no jargon-without-a-gloss. Snag answers ≤ 4 sentences. Never condescending; never a wall.

## 8. Milestone 1 content — Embedding

Map `embedding-node-content.md` into `/src/content/nodes/embedding.ts` exactly:
- L0 one-liner + "name tag + seat" analogy.
- L1 prose + `compute` wired to `model/embedding.ts` (real numbers, Run-reactive).
- **L2 snags — all eight, verbatim intent:** what's "48 numbers"? · what's a seat? · why 11 seats? · index vs token ID? · isn't position 3 an A? (off-by-one) · why two separate tables? · Input vs Input Embed? · is an LLM "a machine"?
- L3 at-scale: 48→768→4096; 11→128k→1M (≈750k words); token≈word/word-piece; sizes chosen pre-training.
- L4 under-the-hood: `wte`/`wpe`, `x = wte[ids] + wpe[pos]`, `T×C`, learned tables, GPT-2 learned-pos vs Llama RoPE.
- `leadsTo: ['attention']` (node may be a stub in M1).

## 9. Optional AI layer (design-spec §12)

```ts
interface AIAdapter { ask(nodeContext: string, question: string): Promise<string>; available: boolean; }
```
- Default export `NullAdapter` (`available:false`) → the "ask anything" box shows "add a key to ask freely," app fully works without it.
- Optional `FetchAdapter`: user pastes their own API key (stored in memory only, never bundled). Prompt is **grounded**: system message = "You may only re-explain the following verified lesson content in simpler terms. Do not introduce new facts or compute numbers." + the node's L0–L4 text.
- Never route the symbolic math through AI.

## 10. Milestones & acceptance gates

**Milestone 1 — engine + Embedding (build this first, then STOP).** Done when:
- [ ] Map ⇄ Notebook toggle works; lands on Map; node click opens the notebook cell; "show on map" returns.
- [ ] Embedding node renders L0 by default; all four expanders work; **all 8 snags** present and each opens inline.
- [ ] Worked example shows **real computed** token+position→input numbers; **Run control** changes input and every number updates.
- [ ] `<NumberGrid>` slices big vectors, hover-probe tooltips show value + source.
- [ ] "Needs / Unlocks" footer + ProgressRail present; no dead ends.
- [ ] Design tokens applied; dark + light both pass AA contrast.
- [ ] Keyboard-operable end to end; `prefers-reduced-motion` respected; no console errors.
- [ ] Vitest: the "same letter→same vector / same seat→same vector / sum" tests pass.
- [ ] Playwright: screenshot Map, Notebook-L0, each expanded layer, a snag open, and a post-Run state — all render cleanly, no overflow.

**Milestone 2 —** clone the node pattern to **Attention** (playtest its own snags first), consider real nanoGPT weights, extend the forward pass.
**Milestone 3 —** optional AI layer (§9), Build & Operations tracks.

## 11. How to verify (every milestone)
Run the app, take Playwright full-page screenshots of each state above, and **look at them** for label collisions, overflow, contrast, and calm. Run Vitest for the model. Fix before declaring done. The bar: a curious beginner can open Embedding, understand it at L0, and dig to L4 and back **without ever feeling lost or buried.**

---
*Source-of-truth docs in this repo: `llm-universe-design-spec.md` (v4), `embedding-node-content.md`. Build to the pedagogy in §1; treat UX (§7) as acceptance criteria, not decoration.*
