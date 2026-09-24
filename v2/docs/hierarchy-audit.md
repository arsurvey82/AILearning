# Hierarchy audit

What the current site shows about how concepts contain each other, come before
each other, and lead into each other. Written after reading the code, before
touching it.

## The four surfaces a reader can hit

The site presents concepts through four separate widgets, and each renders a
different slice of the data.

1. Dig panel (`src/glossary/Dig.tsx`). Opens when a reader clicks a
   `[[term]]` chip inside prose. Sources from `src/glossary/terms.ts`, which
   holds 22 entries.
2. Notebook (`src/notebook/Notebook.tsx` and the generic
   `src/engine/Dossier.tsx`). Opens when a reader picks a concept from the
   map or from a chip. Sources from the 67 `ConceptNode` entries.
3. Map (`src/map/MapCanvas.tsx`). Nested cosmos: bodies orbiting bodies,
   with a focused body showing parent, siblings, children, and grandchildren.
   Sources from the same 67 concept nodes.
4. ModelScene (`src/scene/ModelScene.tsx`). A 3D stack of tensor slabs for
   the forward pass. Sources from `FORWARD_PASS` and the real numbers the toy
   model computes.

Two data hierarchies, two rendering paths. Everything below is about the seam
between them.

## Two data axes, defined once

`src/content/schema.ts` and `src/content/index.ts` name the two axes clearly.

- Containment: `parent`, and the derived `childrenOf`, `pathTo`, `siblingsOf`.
- Order: `prereqs` and `leadsTo`, and the derived `FORWARD_PASS` spine.

The glossary carries neither. Terms only carry `see`, which is a flat
cross-link. No parent, no children, no prereqs, no leadsTo.

## The eight concepts, one by one

### transformer

Dig panel shows: plain (one line), an origin fix dated 2017 with an arxiv
source, and `see` chips for attention, position-table, and context-window.
Nothing about what sits inside the transformer, and nothing about what the
transformer requires.

Notebook shows: full node. L0, L1 with a five-step flow diagram (Tokenize,
Embed, Block x N, Unembed, Sample), three snags, three at-scale rows, an
L4 code snippet, plus a crumbs trail and an "Inside The Transformer" chip
list of children. Footer says Needs is empty (start here) and Unlocks is
empty (end of the built path). That last pair is the felt dead end below.

Map shows: transformer as a body with six children orbiting inside it
(embedding, tokenization, token-id, layer, unembedding, the-loop). Prereqs
and leadsTo highlight rims when focused. Nothing shows for this node
because both lists are empty.

ModelScene shows: the whole scene is the transformer. No slab is named
transformer, and no camera flight targets it. The reader does not know the
scene and the concept refer to the same object.

### attention

Dig panel shows: plain, more, origin fix 2014 with an arxiv source, `see`
chips for dot-product and transformer. Nothing about the six children
(query, key, value, scores, weights, weighted-sum) that carry the actual
mechanics.

Notebook shows: full node with a real worked example (live numbers on the
Run input), the attention-arcs visual, three snags, plus an "Inside
Attention" chip list of the six children. Needs is embedding, Unlocks is
mlp.

Map shows: attention as a body inside layer, with the six children orbiting
inside it. Rims show embedding blue and mlp green when attention is focused.

### mlp

Dig panel shows: nothing. `mlp` is not in the glossary. A `[[mlp]]` chip in
prose would render as a broken-link mark. The rule that catches broken
chips holds, but the reader who searches this word by clicking has no
answer here.

Notebook shows: full concept node. Live in `src/content/nodes/transformer.ts`
under `id: 'mlp'`. Three children (up-projection, activation,
down-projection) render as inside chips.

Map shows: mlp as a body inside layer, with three children orbiting inside.

### vector

Dig panel shows: plain, not, and `see` chips for component, dimension,
distance-idea. No origin. No `more`. Nothing about the many places a
vector appears in the model.

Notebook shows: full node. Sits inside `linalg` under `foundations`. No
children. Needs is empty, Unlocks is empty. The concept node reads as a
reference entry, which is honest, but a reader coming from the map has no
next step from here.

Map shows: vector as a leaf inside linalg, inside foundations, inside model.

### embedding

Dig panel shows: plain, not, more, `see` chips for token, vector,
token-table, distance-idea. No origin on the glossary entry.

Notebook shows: full node with a real worked example, snags, at-scale
rows, Needs is token-id and vector, Unlocks is attention. Crumbs trail up
to transformer, then model, then llm. No children.

Map shows: embedding as a leaf inside transformer. Blue rim on token-id
and vector when embedding is focused, green rim on attention.

### token

Dig panel shows: plain, not, more, `see` chips for token-id, vocabulary,
subword. No origin.

Notebook shows: nothing directly. There is no concept node with `id:
'token'`. There is `tokenization` (the process) and `token-id` (the slot
number). A reader who clicks a `token` chip on the map has nowhere to go,
because it is not on the map at all.

Map shows: nothing. The word does not correspond to a body.

### layer

Dig panel shows: nothing. `layer` is not in the glossary.

Notebook shows: full concept node, `id: 'layer'`, title "Transformer Layer
xN". Flow diagram of Stream in, Norm+Attention+add, Norm+MLP+add, Stream
out. Needs is embedding, Unlocks is unembedding. Five children (attention,
mlp, residual, normalization, rope) render as inside chips.

Map shows: layer as a body inside transformer, with five children orbiting
inside.

### model

Dig panel shows: nothing. `model` is not in the glossary.

Notebook shows: full concept node, `id: 'model'`. Three inside chips for
foundations, objects, and transformer. Needs is empty, Unlocks is build.

Map shows: model as a body inside llm, with three children orbiting.

## Children coverage across the 67 concepts

Sixteen concept nodes have visible children through the `parent` axis, and
the map plus the Notebook "Inside" list both render them.

- llm (children: model, build, operations, beyond)
- model (foundations, objects, transformer)
- foundations (linalg, calculus, probability)
- linalg (vector, matrix, matmul, dot-product)
- calculus (derivative, backprop, gradient-descent)
- probability (logits, softmax, sampling)
- objects (parameter, tensor, neuron, architecture)
- transformer (embedding, tokenization, token-id, layer, unembedding, the-loop)
- layer (attention, mlp, residual, normalization, rope)
- attention (query, key, value, attention-scores, attention-weights,
  weighted-sum)
- mlp (up-projection, activation, down-projection)
- build (gather-data, train-tokenizer, pretraining, sft, alignment,
  lora-dora, evaluation, deploy-prep, continual)
- operations (training-path, inference-path)
- training-path (feast, kubeflow, mlflow)
- inference-path (gpu, kv-cache, vllm, aibrix, agent-layer, monitoring,
  agentic, context-engineering, tool-design)
- beyond (diffusion, multimodal)

The other 51 concepts are leaves. Leaf here does not mean bad. Vector is a
leaf and it should be. Query, key, value are leaves and they should be. The
symptom to watch for is a leaf that reads like it needs a next step and
does not offer one, either because prereqs and leadsTo are empty or because
the concept is not on the spine.

Leaves with empty prereqs and empty leadsTo, that would feel like dead
ends inside the Notebook: transformer, tokenization, gpu, kv-cache,
inference-path, monitoring. Some of these have children, so the Notebook
sends the reader inside them through the "Inside" chip list. Others do
not, and the reader lands on a page with nothing to click next.

## Where prereqs and leadsTo actually render

Prereqs and leadsTo appear in three places.

1. Notebook footer, in `src/engine/Dossier.tsx`. "Needs" chips on the
   left, "Unlocks" chips on the right. Full weight: normal buttons with a
   coloured pill background, clickable. Empty lists print a hint line
   ("nothing, start here" or "end of the built path").
2. Map rims, in `src/map/MapCanvas.tsx`. Blue rim for prereqs, green rim
   for leadsTo, only while the concept is focused. Wordless, easy to miss
   until the reader knows what to look for.
3. Prev/Next arrows in the Notebook. When the concept is on
   `FORWARD_PASS`, the arrows follow the spine, not the parent's children
   list. Off the spine, the arrows walk siblings. Not the prereqs or
   leadsTo directly, though the spine order was built from them.

The Dig panel does not render prereqs or leadsTo at all. A reader who opens
the term "attention" from a `[[link]]` sees nothing about what attention
needs before it or what comes after it.

## The felt "no reason why it stops here" places

Six concrete stops the reader is likely to hit.

- Transformer, in the Notebook. Both prereqs and leadsTo are empty, so the
  footer reads "start here" on one side and "end of the built path" on the
  other. The reader who has walked from tokenization through the layer
  arrives at Transformer and sees no forward step in the footer. The
  "Inside The Transformer" chip list is what saves it, but the arrows and
  the footer do not point there.

- Model, in the Notebook. Prereqs is empty. Unlocks is build, which is
  correct but leaves the reader unclear whether they should read the
  Transformer subtree before going to Build. The order across the three
  continents is not stated anywhere the Notebook reads.

- Vector, in the Notebook. Both lists empty. Vector is reference and
  should be, but the Notebook offers no way back to where the reader
  came from except the browser back button and the crumbs trail.

- Any concept opened through a `[[term]]` chip. The Dig panel shows a
  short definition, an optional origin, and a few `see` chips. No parent,
  no children, no prereqs, no leadsTo. A reader who dug into "transformer"
  from the Start Here screen sees the four-hundred-word definition and
  three cross-links, and never learns that Transformer has a whole subtree.

- Terms that are not concept nodes: token, token-table, position-table,
  vocabulary, subword, distance-idea, one-hot, build-time, run-time,
  context-window, vector-store, scaling, backpropagation. Each is a
  glossary entry the reader can dig into, and each ends at the Dig panel.
  There is no bridge from the glossary to the concept map.

- Concept ids that are not glossary terms: mlp, layer, model, and every
  other concept whose id is not in `src/glossary/terms.ts`. A `[[mlp]]`
  chip in prose would render as a broken-link mark, so nobody writes one.
  A reader who wants to look up "mlp" from a term glossary cannot.

## Two hierarchies, one gap

The one-line summary of the audit. The Notebook and the map understand
containment, order, and the spine. The Dig panel understands cross-links
and origins. The two data hierarchies overlap on 8 of 67 concept ids and
14 of 22 term ids. Everything else the reader has to find twice, in two
places, with no bridge between them.
