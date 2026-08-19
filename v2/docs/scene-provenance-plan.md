# Plan: making the model scene explain how values move

Status: proposed, not built. Written 2026-08-09.

## The problem

A reader looked at the 3D scene and said it does not show how values pass between
layers, and that the distinction between a store of vectors and the moving parts
of the model is unclear.

That reading is correct, and the cause is specific. The scene draws three
different kinds of thing in one visual grammar.

The residual stream holds activations. It is memory: T vectors, one per token,
and it changes every time the input changes. The unembedding matrix holds
weights. It is the learned function, and it never changes no matter what you
type. Today both render as filled slabs of the same kind, so a reader cannot
answer "is this data or is this the machine" by looking.

The second cause is that the operation is drawn as empty space. The gap between
two slabs is where a matrix multiply happens. That is the actual work, and it is
currently nothing at all.

The third cause is that no value carries its history. You can read a number off
a face. You cannot see why it holds that number. That is the question the reader
asked, and it has an exact answer:

    out[t][j] = sum over k of in[t][k] * W[k][j]

## The approach

Do not draw wires. Wires between every pair of cells produce a hairball that
teaches nothing, and they also misdescribe the model: the connection is
arithmetic, not a physical link.

Instead, make the operation selectable and make provenance the primary
interaction. Select one output cell and the scene answers, exactly, which input
cells produced it and by how much.

## Data plan

Add a computation graph over the existing symbolic core. The numbers still come
from src/model, which stays the source of truth. The graph only records which
numbers fed which.

    Tensor = {
      id
      kind: 'activation' | 'weight' | 'constant'
      rows, cols
      data
    }

    Op = {
      kind: 'matmul' | 'add' | 'softmax' | 'rmsnorm' | 'silu' | 'gather'
      inputs, output
      provenance(row, col) -> Contribution[]
    }

    Contribution = { tensorId, row, col, value, weight, product }

The provenance function carries the design. For a matrix multiply it returns row
r of the left operand paired with column c of the right operand, which for the
toy model is 48 pairs. For an add it returns two cells. For softmax it returns
the whole row with normalised weights. For the embedding gather it returns the
token table row and the position table row.

The `kind` field is what lets the renderer draw activations and weights
differently, so the visual distinction is derived from the data rather than
hand-assigned per block.

## Maths plan

One invariant governs everything and gets enforced by tests: the contributions
must sum to the output, for every operation kind, over randomised inputs.

This matters more than it sounds. The failure mode for a visual like this is
looking plausible while being wrong, and a reader has no way to detect it. The
sum check makes that failure loud.

Two operations need honest handling rather than a tidy fan-in.

RMSNorm depends on a single cell and also on the entire row, through one scalar.
Show it as exactly that. Pretending it is a clean per-cell operation would teach
the wrong thing about why normalisation is a whole-row concern.

Softmax contributions are exp(x_i) divided by the row sum. Masked cells then
appear as true zero rather than as small numbers, which is worth showing because
it is the reason the causal mask needs no special case in the code.

## Decision: no backpropagation

Walking backward through provenance means asking which inputs produced this
value. It needs no new mathematics and it answers the reader's question.

Walking backward through gradients is real backpropagation. The toy model is
small enough to implement it, but it is a separate and substantially larger
build, and it only pays off if the training path should show learning happening.

Decision: provenance only. Do not implement a backward pass. Do not draw
anything that resembles gradient flow, because a visual that looks like
backpropagation but is not would be worse than having none.

## UX plan

### Three visual grammars

Activations render as solid slabs painted with their values. They change when
the input changes.

Weights render as an open lattice frame, desaturated, labelled as learned and
fixed. They never change when the input changes.

Operations render as a labelled joint sitting in the gap between slabs, showing
the operator itself. They stop being empty space.

A small persistent legend names all three. Three swatches, three words.

### Interaction ladder

The surface stays calm by default and reveals structure only when asked, which
follows the same progressive-disclosure rule the notebook already uses.

By default the scene shows slabs and joints with no connecting lines at all.

Hovering a slab lights it, lights the operations that touch it, and shows its
shape.

Clicking a cell enters provenance mode. In the 3D scene, the contributing row
lights along one slab and the contributing column lights along the weight slab,
and the two converge on the selected cell. That picture is the dot product, and
it is the true answer to how a value gets from one layer to the next.

At the same moment the notebook pane shows the arithmetic:

    0.42 = 0.31 x 0.90 + (-0.20) x 0.40 + ...

with the largest eight terms listed and the remainder summarised as a count and
a percentage of the total. The split layout already exists; this uses both panes
as one instrument rather than two views of the same thing.

Walking back steps the selection to its largest contributor, leaving a
breadcrumb of the trail. That gives a reader the history of a single number
across several layers, which is the strongest available answer to how the model
carries information forward.

### Animation

Movement runs on a step, never on a loop. One packet travels the selected
provenance path when the reader advances. Autoplay stays off by default, which
is consistent with the learner-paced rule already applied to the pipeline walk
and the attention arcs.

## Clarity plan

Part of this problem is vocabulary, and the current wording contributes to it.

Stop calling the residual stream neurons. It is a stream of vectors, and calling
it anything else invites the confusion the reader hit.

Reserve the word neuron for the MLP hidden units, where the term is standard and
defensible, since each unit has an activation and a nonlinearity.

Call the weight matrices the learned function.

Add a node that answers "where are the neurons here?" directly. The reader hit
this confusion in practice, which is exactly how the existing snag cards were
harvested, so it belongs in the content rather than only in a legend.

## Evaluation plan

Automated checks:

Provenance sums equal outputs, per operation kind, over randomised inputs.

Weights do not change when the input changes, and activations do. This asserts
that the visual grammar tells the truth rather than merely looking consistent.

End to end: select a cell in the post-attention residual, walk back three steps,
and assert the breadcrumb names the attention output and the stream.

Human checks, using the existing playtest protocol. Three tasks, one per
confusion:

  Point at where this number came from.
  Which of these boxes change when I type a different input?
  Where are the neurons?

Pass means a novice answers all three unaided.

## Staging

Phase 1. Computation graph and provenance, with tests. Nothing visible changes.
Everything else depends on it.

Phase 2. Three visual grammars and the legend. This is the smallest change that
resolves the store versus neurons confusion.

Phase 3. Click a cell to see its contributors, with the arithmetic in the
notebook pane.

Phase 4. Walk back, with a breadcrumb trail.

Phase 5. Operation joints and step animation along the selected path.

Phases 1 to 3 together answer the reader's question. Phases 4 and 5 make the
answer easier to explore.

## Risks

The provenance readout for a 48-term dot product is long. Mitigation: show the
largest terms and summarise the tail, and state the tail's share so the reader
knows what was omitted rather than assuming they saw everything.

Lighting a row and a column across two slabs may be hard to read at some orbit
angles. Mitigation: when provenance mode is entered, ease the camera to an angle
where both strips are visible, and let the reader override it.

The graph adds a layer between the model and the renderer, which risks the
numbers drifting from src/model. Mitigation: the graph stores references to
values the core computed rather than recomputing anything, and the sum check
would fail if that ever stopped being true.
