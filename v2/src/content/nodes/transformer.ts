/**
 * The transformer internals.
 *
 * Six of these nodes have REAL worked examples, not just diagrams: Query, Key,
 * Value, Scores, Softmax weights and Weighted sum are each one slice of the
 * computation already implemented in /src/model/attention.ts. So a learner who
 * opens Query sees the actual query vectors for the input still sitting in the
 * Run box. The same continuity the spine has, one level deeper.
 */

import { HEAD_DIM, N_HEADS, attention, dot, softmax } from '../../model/attention';
import { round2 } from '../../model/toyModel';
import { outline } from '../outline';
import { SOURCES } from '../sources';
import type { ConceptNode, NumberBlock } from '../schema';

const labelsOf = (input: string) =>
  attention(input).embedding.tokens.map((t) => `${t.letter}@${t.seat}`);

/** Q, K or V across both heads, per token. */
function projectionBlock(
  input: string,
  which: 'Q' | 'K' | 'V',
  caption: string,
  explain: (label: string, d: number, head: number) => string,
): NumberBlock {
  const r = attention(input);
  const labels = labelsOf(input);

  return {
    caption,
    totalDims: HEAD_DIM,
    unit: 'dimensions',
    footnote: `Each head is ${HEAD_DIM} wide; ${N_HEADS} heads side by side make the full 48.`,
    groups: r.embedding.tokens.map((_token, i) => ({
      id: `t${i}`,
      label: labels[i] ?? '',
      sublabel: `from its input embedding`,
      rows: r.heads.map((h) => ({
        label: `head ${h.head + 1}`,
        role: h.head === 0 ? ('token' as const) : ('position' as const),
        values: h[which][i] ?? [],
        sourceOf: (d: number) => explain(labels[i] ?? '', d, h.head + 1),
      })),
    })),
  };
}

/* ------------------------------------------------------------------ */

export const transformerNodes: ConceptNode[] = [
  {
    ...outline({
      id: 'transformer',
      title: 'The Transformer',
      tag: 'the architecture',
      color: 'orange',
      order: 2,
      track: 'model',
      parent: 'model',
      L0_oneLiner:
        'Where the maths actually flows. Text in at one end, one predicted token out the other, and then the whole thing runs again.',
      L0_analogy:
        'An assembly line that produces exactly one word, then puts everything back on the belt and runs again for the next.',
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Everything before the blocks is preparation.** Tokenize, look up IDs, fetch and stamp vectors. No thinking has happened yet.',
        '**The block is the model.** One block mixes tokens (attention) then thinks about each alone (feed-forward). Stack it dozens of times and that repetition is the entire architecture.',
        '**Everything after the blocks is readout.** Project the final vector onto the vocabulary, softmax, pick one.',
        '**Then the whole thing runs again.** The predicted token is appended to the input and the model starts over. It has no memory between passes, the text is the memory.',
      ],
      flow: {
        caption: 'One complete pass. It produces exactly one token.',
        steps: [
          { id: 'a', label: 'Tokenize + IDs', kind: 'input', sub: 'text becomes slot numbers' },
          { id: 'b', label: 'Embed', kind: 'stage', sub: 'meaning + position, added' },
          {
            id: 'c',
            label: 'Block × N',
            kind: 'stage',
            sub: 'the repeated part',
            parts: [
              { id: 'att', label: 'Attention', sub: 'tokens mix', kind: 'stage' },
              { id: 'ff', label: 'Feed-forward', sub: 'each thinks alone', kind: 'stage' },
              { id: 'res', label: 'Residual + norm', sub: 'plumbing that keeps it trainable', kind: 'control' },
            ],
          },
          { id: 'd', label: 'Unembed', kind: 'stage', sub: 'one score per vocabulary slot' },
          { id: 'e', label: 'Sample', kind: 'output', sub: 'one token' },
        ],
        loop: 'Append that token to the input and run the entire pass again for the next one.',
        note: 'Nothing persists between passes except the text itself. That is what "stateless" means here.',
      },
    },
    L2_snags: [
      {
        q: 'Why stack the same block instead of making one big clever one?',
        a: 'Because depth composes. Early blocks resolve local things like grammar; later ones work on longer-range structure built from what earlier blocks produced. One enormous block cannot build on its own output the way a stack can.',
      },
      {
        q: 'Does each block do a different job?',
        a: 'They have identical structure and completely different learned weights, and in practice they specialise, but nobody assigns those roles. It emerges from training.',
      },
      {
        q: 'Where in here is the "understanding"?',
        a: 'Nowhere in particular, which is the honest answer. Attention decides what is relevant, the feed-forward layers hold most of the learned facts, and the depth of the stack is what turns that into behaviour. No single box is the clever one.',
      },
    ],
    L3_atScale: [
      {
        label: 'Blocks stacked',
        here: '2',
        gpt2: '12',
        llama: '32',
        source: SOURCES.llama3Config,
      },
      { label: 'Vector width', here: '48', gpt2: '768', llama: '4,096', source: SOURCES.gpt2Config },
      {
        label: 'Passes for one answer',
        here: ', ',
        llama: 'one per token generated',
        note: 'A 500-word answer is roughly 650 complete passes through every block.',
      },
    ],
    L4_underHood: `\`\`\`python
x = wte[ids] + wpe[pos]
for block in blocks:
    x = x + attention(norm(x))      # mix
    x = x + mlp(norm(x))            # think
logits = norm(x) @ wte.T            # readout, often tied to the input table
\`\`\`

Two details worth noticing. \`x = x + ...\` rather than \`x = ...\` is the residual stream, each block *adds to* the running state instead of replacing it. And \`wte.T\` reuses the embedding table transposed for the readout, which saves a large matrix and ties the two directions together.`,
    prereqs: [],
  },

  /* ---------------- the repeated block ---------------- */

  {
    ...outline({
      id: 'layer',
      title: 'Transformer Layer ×N',
      tag: 'repeated block',
      color: 'orange',
      order: 3,
      track: 'model',
      parent: 'transformer',
      L0_oneLiner:
        'The block that gets stacked. Two organs. Attention mixes tokens, feed-forward thinks about each one alone. Wrapped in plumbing that keeps deep stacks trainable.',
      L0_analogy:
        'A meeting then desk work. Everyone confers, then everyone goes away and processes what they heard.',
      prereqs: ['embedding'],
      leadsTo: ['unembedding'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Attention is the only place tokens interact.** Everywhere else in the whole model, each position is processed completely independently.',
        '**Feed-forward is where most of the parameters live.** Roughly two thirds of a block\'s weights, and most of the stored facts.',
        '**Normalisation goes before each organ.** It keeps the numbers in a usable range so the stack can be deep without exploding or vanishing.',
        '**Residual connections wrap both.** Each organ *adds to* the stream rather than replacing it, which is what lets gradients reach the early layers at all.',
      ],
      flow: {
        caption: 'Inside one block. Note that both organs add to the stream rather than replacing it.',
        steps: [
          { id: 'in', label: 'Stream in', kind: 'input', sub: 'T × 48' },
          {
            id: 'mix',
            label: 'Norm → Attention → add',
            kind: 'stage',
            sub: 'the only cross-token step',
            parts: [
              { id: 'n1', label: 'LayerNorm', sub: 'centre and rescale', kind: 'control' },
              { id: 'at', label: 'Attention', sub: 'tokens look at tokens', kind: 'stage' },
              { id: 'r1', label: '+ residual', sub: 'add back into the stream', kind: 'control' },
            ],
          },
          {
            id: 'think',
            label: 'Norm → MLP → add',
            kind: 'stage',
            sub: 'per token, independently',
            parts: [
              { id: 'n2', label: 'LayerNorm', sub: 'centre and rescale again', kind: 'control' },
              { id: 'mlp', label: 'Feed-forward', sub: 'up → curve → down', kind: 'stage' },
              { id: 'r2', label: '+ residual', sub: 'add back', kind: 'control' },
            ],
          },
          { id: 'out', label: 'Stream out', kind: 'output', sub: 'same shape, T × 48' },
        ],
        loop: 'Shape in equals shape out, which is precisely why the block can be stacked.',
        note: 'That shape-preserving property is the whole trick. Any number of blocks compose without adapters between them.',
      },
    },
    L2_snags: [
      {
        q: 'Why does the shape have to stay the same?',
        a: 'So blocks compose. If a block changed the width you would need a different block for every position in the stack, and you could not simply choose to make the model deeper.',
      },
      {
        q: 'Why normalise before each organ instead of after?',
        a: 'Pre-norm leaves the residual path clean. The stream flows from input to output without normalisation in the way, so gradients reach early layers intact. Post-norm was the original design and is measurably harder to train deep.',
      },
      {
        q: 'If feed-forward has most of the parameters, why is attention the famous part?',
        a: 'Because it was the new idea. Feed-forward layers predate transformers by decades. Attention is what replaced recurrence, and it is why the whole sequence can be processed in parallel during training.',
      },
    ],
    L3_atScale: [
      { label: 'Blocks', here: '2', gpt2: '12', llama: '32', source: SOURCES.llama3Config },
      {
        label: 'Parameter split per block',
        here: ', ',
        llama: '~1/3 attention, ~2/3 feed-forward',
        note: 'The famous part is the smaller part.',
      },
    ],
    L4_underHood: `\`\`\`python
def block(x):
    x = x + attn(rmsnorm(x))
    x = x + mlp(rmsnorm(x))
    return x
\`\`\`

Four lines. Everything else in a transformer is this, repeated, plus what happens at each end.`,
  },

  /* ---------------- attention internals (real numbers) ---------------- */

  {
    ...outline({
      id: 'query',
      title: 'Query (Q)',
      tag: 'attention',
      color: 'magenta',
      order: 0,
      track: 'model',
      parent: 'attention',
      L0_oneLiner: '"What am I looking for?", each token\'s vector multiplied by a learned Q matrix.',
      L0_analogy: 'The question you walk into the room already holding.',
      prereqs: ['embedding'],
      leadsTo: ['attention-scores'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One matrix multiply, nothing more.** The token\'s 48-number input vector times a learned 48×24 matrix gives a 24-number query.',
        '**Learned means the model chose what to ask about.** Nobody specified that queries should encode grammatical role or topic; whatever lowers the loss is what `Wq` became.',
        '**Each head asks a different question.** Two heads, two different `Wq` matrices, two different queries from the same token, which is the whole reason to have more than one head.',
        '**The query is used once and discarded.** Unlike Keys and Values, nothing later reads it, which is why it is never cached at serving time.',
      ],
      flow: {
        caption: 'One token in, one question out. The same shape happens for K and V, with different learned matrices.',
        steps: [
          { id: 'x', label: 'The token\'s input vector', kind: 'input', sub: '48 numbers. Token table plus position table' },
          {
            id: 'wq',
            label: 'Multiply by Wq',
            kind: 'stage',
            sub: 'a learned 48 × 24 matrix, one per head',
            parts: [
              { id: 'h1', label: 'Head 1 · Wq', sub: 'learned separately', kind: 'stage' },
              { id: 'h2', label: 'Head 2 · Wq', sub: 'a different question from the same token', kind: 'stage' },
            ],
          },
          { id: 'q', label: 'The query vector', kind: 'output', sub: '24 numbers, "what am I looking for"' },
          { id: 'use', label: 'Used once, then dropped', kind: 'store', sub: 'nothing downstream reads it, so it is never cached at serving time' },
        ],
        note: 'Nothing here is hand-designed. Wq is whatever lowered the loss during training; "the question a token asks" is an interpretation of the result, not an instruction given to it.',
      },
      example: {
        caption: 'The real queries for whatever is in the Run box.',
        compute: (input) =>
          projectionBlock(
            input,
            'Q',
            'Each token\'s question, in both heads. Same input vector, two learned matrices.',
            (label, d, head) =>
              `Dimension ${d} of ${label}'s query in head ${head}: its input embedding dotted with column ${d} of that head's Wq. The two heads differ because their matrices were learned separately.`,
          ),
      },
    },
    L2_snags: [
      {
        q: 'Why does the query need its own matrix? Why not use the vector directly?',
        a: 'Because what a token *is* and what it is *looking for* are different things. A pronoun is not looking for another pronoun. The matrix is what lets the model turn "I am this" into "I want that".',
      },
      {
        q: 'Why are the two heads different if the input is identical?',
        a: 'Different learned matrices. Same input, different projections, so different questions, one head might end up tracking grammatical agreement while another tracks subject matter. Neither was assigned that job.',
      },
      {
        q: 'Why is the query not cached when Keys and Values are?',
        a: 'Because it is only used on the pass that creates it. The current token asks its question once and is done; Keys and Values are what *later* tokens read, so they have to persist.',
      },
    ],
    L3_atScale: [
      { label: 'Query width', here: String(HEAD_DIM), gpt2: '64', llama: '128' },
      { label: 'Wq size per head', here: `48 × ${HEAD_DIM}`, gpt2: '768 × 64', llama: '4,096 × 128' },
    ],
    L4_underHood: `\`\`\`python
Q = x @ Wq          # [T, C] @ [C, head_dim] -> [T, head_dim]
\`\`\`

In practice all heads' \`Wq\` are stored as one \`[C, n_heads * head_dim]\` matrix and the result is reshaped, one large multiply is far faster on a GPU than several small ones, and the maths is identical.`,
  },

  {
    ...outline({
      id: 'key',
      title: 'Key (K)',
      tag: 'attention',
      color: 'magenta',
      order: 1,
      track: 'model',
      parent: 'attention',
      L0_oneLiner: '"What do I offer?". The tag each token holds up for other tokens\' queries to match against.',
      L0_analogy: 'The label on the folder, written so that whoever is searching can find it.',
      prereqs: ['embedding'],
      leadsTo: ['attention-scores'],
      related: ['kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Same operation as the query, different matrix.** Input vector times a learned 48×24 `Wk`.',
        '**Its job is to be findable, not to be found.** The query says what I want; the key says what I am, phrased for matching.',
        '**Once computed it never changes.** Causal masking means nothing later can affect an earlier token, so token 3\'s key is identical on every subsequent pass.',
        '**Which is exactly why it is cached.** That immutability is what makes the KV cache correct rather than merely convenient.',
      ],
      flow: {
        caption: 'Identical machinery to the query, with one consequence that changes how serving works.',
        steps: [
          { id: 'x', label: 'The token\'s input vector', kind: 'input', sub: 'the same 48 numbers the query started from' },
          { id: 'wk', label: 'Multiply by Wk', kind: 'stage', sub: 'a learned 48 × 24 matrix, one per head' },
          { id: 'k', label: 'The key vector', kind: 'output', sub: '24 numbers. "here is what I am, phrased for matching"' },
          {
            id: 'cache',
            label: 'Kept, not discarded',
            kind: 'store',
            sub: 'nothing later can change an earlier token, so this key is identical on every future pass',
            parts: [
              { id: 'why', label: 'Why that matters', sub: 'recomputing it would give the same answer, so it is stored instead', kind: 'store' },
              { id: 'kv', label: 'This is the KV cache', sub: 'half of it; the values are the other half', kind: 'store' },
            ],
          },
        ],
        note: 'The causal mask is what makes this safe. Without it, a later token could change an earlier one\'s context and the cached key would be stale.',
      },
      example: {
        caption: 'The real keys for whatever is in the Run box.',
        compute: (input) =>
          projectionBlock(
            input,
            'K',
            'Each token\'s tag, in both heads. These are the values that get cached at serving time.',
            (label, d, head) =>
              `Dimension ${d} of ${label}'s key in head ${head}. Computed once and never recomputed. Nothing later in the sequence can change it, which is what makes caching it safe.`,
          ),
      },
    },
    L2_snags: [
      {
        q: 'What is the difference between a key and a value, really?',
        a: 'The key is what you match on; the value is what you get if the match wins. A library catalogue card is the key, the book is the value. Splitting them means the model can be found for one reason and contribute something else entirely.',
      },
      {
        q: 'Why is it safe to cache keys?',
        a: 'Because of the causal mask. Token 3 can only ever be influenced by tokens 0-3, and those are fixed once produced. Without masking, as in an encoder. Every key would change whenever anything changed, and caching would be wrong.',
      },
      {
        q: 'Why do Llama-style models have fewer key heads than query heads?',
        a: 'Grouped-query attention. The KV cache is the memory bottleneck at serving time, so several query heads share one set of keys and values. It cuts the cache several-fold for a small quality cost. A serving optimisation, not an intelligence one.',
      },
    ],
    L3_atScale: [
      { label: 'Key heads', here: String(N_HEADS), gpt2: '12 (one per query head)', llama: '8 (shared by 32)' },
      {
        label: 'Cached per token',
        here: 'negligible',
        llama: '~128 KB across all layers',
        note: 'Keys and values together. This is the number that makes long context expensive.',
      },
    ],
    L4_underHood: `\`\`\`python
K = x @ Wk
cache.keys[layer].append(K[-1])    # only the newest token is new
\`\`\`

At generation time only the last token's key is computed; every earlier one is read from the cache. That is what turns generation from quadratic into linear in the number of tokens produced.`,
  },

  {
    ...outline({
      id: 'value',
      title: 'Value (V)',
      tag: 'attention',
      color: 'magenta',
      order: 2,
      track: 'model',
      parent: 'attention',
      L0_oneLiner: '"What do I pass along if chosen?". The content a token contributes when another token attends to it.',
      L0_analogy: 'The contents of the folder, as opposed to the label on it.',
      prereqs: ['embedding'],
      leadsTo: ['weighted-sum'],
      related: ['kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**The third projection, from the same input vector.** A learned 48×24 `Wv`.',
        '**Values are what actually move.** Scores and weights only decide *how much*; the value is the substance being mixed.',
        '**Being found and being useful are separate.** A token can be highly attended to for what its key says, and contribute something quite different through its value.',
        '**Cached alongside the keys.** Same immutability argument, same cache, hence "KV cache" as one thing.',
      ],
      flow: {
        caption: 'The third projection. Keys decide who gets picked; values are what the picking actually delivers.',
        steps: [
          { id: 'x', label: 'The token\'s input vector', kind: 'input', sub: 'the same 48 numbers again, three projections, one source' },
          { id: 'wv', label: 'Multiply by Wv', kind: 'stage', sub: 'a learned 48 × 24 matrix, one per head' },
          { id: 'v', label: 'The value vector', kind: 'output', sub: '24 numbers. The substance that gets carried away if this token is attended to' },
          { id: 'cache', label: 'Cached with the keys', kind: 'store', sub: 'same immutability argument, this is the V in "KV cache"' },
        ],
        note: 'Being found and being useful are separate jobs. A token can be strongly attended to because of its key and still contribute something quite different through its value.',
      },
      example: {
        caption: 'The real values for whatever is in the Run box.',
        compute: (input) =>
          projectionBlock(
            input,
            'V',
            'What each token will contribute if attended to. These get blended in proportion to the attention weights.',
            (label, d, head) =>
              `Dimension ${d} of ${label}'s value in head ${head}. If another token spends 30% of its attention on ${label}, 30% of this number lands in that token's output.`,
          ),
      },
    },
    L2_snags: [
      {
        q: 'Why not just pass the input vector along instead of projecting it?',
        a: 'Because then what a token contributes would be forced to equal what it is. The projection lets the model contribute a transformed version. The aspect of itself that is relevant to being attended to.',
      },
      {
        q: 'Do the value vectors get modified as they are blended?',
        a: 'No. They are scaled by the attention weights and added. Nothing rewrites a value; the blend is a weighted average, which is why the output is always a mixture of things that were already present.',
      },
    ],
    L3_atScale: [
      { label: 'Value width', here: String(HEAD_DIM), gpt2: '64', llama: '128' },
      {
        label: 'Shared with keys?',
        here: 'no',
        llama: 'yes, under GQA',
        note: 'Keys and values are grouped together, so sharing halves the cache twice over.',
      },
    ],
    L4_underHood: `\`\`\`python
V = x @ Wv
out = A @ V         # [T, T] @ [T, head_dim] -> [T, head_dim]
\`\`\`

Because \`A\`'s rows sum to 1, every output row is a convex combination of value rows. It can never be larger than the largest value or smaller than the smallest. Attention interpolates; it does not extrapolate.`,
  },

  {
    ...outline({
      id: 'attention-scores',
      title: 'Scores = Q·K',
      tag: 'attention',
      color: 'magenta',
      order: 3,
      track: 'model',
      parent: 'attention',
      L0_oneLiner:
        'Dot every query against every key to get a grid of match strengths, then divide by √(head width) to keep the numbers sane.',
      L0_analogy: 'Every question held up against every label, scored for how well they match.',
      prereqs: ['query', 'key', 'dot-product'],
      leadsTo: ['attention-weights'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One number per pair.** The dot product of a query and a key: large when they point the same way, near zero when unrelated, negative when opposed.',
        '**That makes a T×T grid.** Every token against every token, which is why cost grows with the *square* of the sequence length.',
        '**Then divide by √(head width).** Dot products over 24 dimensions come out large; over 128 they come out much larger. The divisor makes the spread roughly the same whatever the head width.',
        '**Without it softmax saturates.** Large scores make softmax output almost entirely one token, gradients vanish, and the model stops learning to attend at all.',
      ],
      flow: {
        caption: 'Where Q and K finally meet. Every token is compared against every token, which is where the quadratic cost comes from.',
        steps: [
          {
            id: 'pair',
            label: 'Take one query and one key',
            kind: 'input',
            sub: 'the looking token\'s Q, the looked-at token\'s K',
          },
          {
            id: 'dot',
            label: 'Dot product',
            kind: 'stage',
            sub: 'multiply matching dimensions and add, one number saying how well they line up',
            parts: [
              { id: 'big', label: 'Large', sub: 'pointing the same way', kind: 'stage' },
              { id: 'zero', label: 'Near zero', sub: 'unrelated', kind: 'stage' },
              { id: 'neg', label: 'Negative', sub: 'opposed', kind: 'stage' },
            ],
          },
          {
            id: 'grid',
            label: 'Repeat for every pair',
            kind: 'stage',
            sub: 'a T × T grid. This is the step whose cost grows with the square of the sequence',
          },
          {
            id: 'scale',
            label: 'Divide by √(head width)',
            kind: 'stage',
            sub: 'without it the numbers grow with head width, softmax saturates, and gradients vanish',
          },
          {
            id: 'mask',
            label: 'Mask the future',
            kind: 'control',
            sub: 'anything to the right of the diagonal is set to −∞, so it becomes exactly zero after softmax',
          },
          { id: 'out', label: 'Scaled, masked scores', kind: 'output', sub: 'still raw numbers, not yet a split' },
        ],
      },
      example: {
        caption: 'The raw dot products and what scaling does to them.',
        compute: (input) => {
          const r = attention(input);
          const h = r.heads[0];
          const labels = labelsOf(input);
          return {
            caption: `Head 1. Raw match strength, then the same number divided by √${HEAD_DIM}.`,
            totalDims: labels.length,
            unit: 'tokens',
            footnote: `√${HEAD_DIM} = ${r.scale.toFixed(2)}. Masked pairs never get a raw score at all. The token is simply not allowed to look.`,
            groups: labels.map((qLabel, i) => ({
              id: `q${i}`,
              label: `${qLabel} asking`,
              sublabel: `against each token it may see`,
              rows: [
                {
                  label: 'raw Q·K',
                  role: 'neutral' as const,
                  values: labels.map((_, j) =>
                    j > i ? -Infinity : round2(dot(h?.Q[i] ?? [], h?.K[j] ?? [])),
                  ),
                  sourceOf: (d: number) =>
                    d > i
                      ? `${qLabel} may not look at ${labels[d]}, it comes later.`
                      : `${qLabel}'s query dotted with ${labels[d]}'s key, all ${HEAD_DIM} dimensions summed.`,
                },
                {
                  label: `÷ √${HEAD_DIM}`,
                  role: 'input' as const,
                  values: h?.scores[i] ?? [],
                  sourceOf: (d: number) =>
                    d > i
                      ? `Masked, so it stays at -inf and softmax will give it exactly 0.`
                      : `The raw score divided by ${r.scale.toFixed(2)}. This is what softmax actually receives.`,
                },
              ],
            })),
          };
        },
      },
    },
    L2_snags: [
      {
        q: 'What does a negative score mean?',
        a: 'The query and key point in roughly opposite directions. Actively unrelated rather than merely unrelated. After softmax it becomes a small positive weight, because softmax cannot output a negative. Attention can ignore, never subtract.',
      },
      {
        q: 'Why √(head width) rather than the width itself?',
        a: 'Because a dot product of two random vectors with independent components grows like the square root of the dimension, not linearly. Dividing by √d is what makes the spread of scores roughly constant across head widths.',
      },
      {
        q: 'Is this grid what makes long context expensive?',
        a: 'Yes. It is T×T, so doubling the context quadruples this grid. Every "efficient attention" method is an attack on that square. FlashAttention avoids materialising it, sparse patterns skip parts of it.',
      },
    ],
    L3_atScale: [
      // Corrected 2026-08-05: was 128,000², which is Llama 3.1, not Llama 3.
      {
        label: 'Grid size',
        here: '6 × 6',
        gpt2: 'up to 1,024²',
        llama: 'up to 8,192²',
        note: 'Llama 3.1 raised the context to 128,000, which makes this grid over 240× larger again.',
        source: SOURCES.llama3Config,
      },
      {
        label: 'Scale divisor',
        here: `√${HEAD_DIM}`,
        gpt2: '√64 = 8',
        llama: '√128 ≈ 11.3',
      },
    ],
    L4_underHood: `\`\`\`python
S = Q @ K.transpose(-2, -1) / math.sqrt(head_dim)
S = S.masked_fill(causal_mask, float("-inf"))
\`\`\`

FlashAttention's contribution is never storing \`S\` at all: it fuses the score, mask, softmax and value-blend into one kernel that works in tiles, keeping only the running softmax statistics. Same result, memory that grows linearly instead of quadratically.`,
  },

  {
    ...outline({
      id: 'attention-weights',
      title: 'Softmax weights',
      tag: 'attention',
      color: 'magenta',
      order: 4,
      track: 'model',
      parent: 'attention',
      L0_oneLiner:
        'Turn each row of scores into percentages that sum to 1. How much attention this token pays to each token it can see.',
      L0_analogy: 'Dividing a fixed budget. More to one place necessarily means less to another.',
      prereqs: ['attention-scores', 'softmax'],
      leadsTo: ['weighted-sum'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Exponentiate, then normalise.** Raise e to each score, then divide each by the total. That is the whole of softmax.',
        '**Exponentiating exaggerates.** A score twice as large does not get twice the weight, it gets exponentially more. Small gaps in score become large gaps in attention.',
        '**Dividing by the total forces a budget.** Rows sum to exactly 1, so attention is always shared out, never created.',
        '**And it disposes of the mask for free.** e raised to minus infinity is 0, so masked tokens get exactly zero weight with no special case anywhere in the code.',
        '**One row at a time.** Softmax runs across each row independently. Every token divides up its own budget, and rows do not compete with one another.',
      ],
      flow: {
        caption: 'One row of scores becomes one token\'s spending plan.',
        steps: [
          { id: 'row', label: 'One row of scaled scores', kind: 'input', sub: 'what this token thought of every token it is allowed to see' },
          { id: 'exp', label: 'Raise e to each one', kind: 'stage', sub: 'gaps get exaggerated. Twice the score is far more than twice the weight' },
          { id: 'mask', label: 'Masked entries fall out here', kind: 'control', sub: 'e to the power of −∞ is 0, so the mask needs no special case in the code' },
          { id: 'sum', label: 'Add them up', kind: 'stage', sub: 'the row total, about to become the denominator' },
          { id: 'div', label: 'Divide each by the total', kind: 'stage', sub: 'which forces the row to sum to exactly 1' },
          { id: 'out', label: 'A percentage split', kind: 'output', sub: 'a fixed budget. More to one token necessarily means less to another' },
        ],
        loop: 'Every row runs this independently. Rows never compete with each other; each token divides up its own budget.',
      },
      example: {
        caption: 'Softmax, one step at a time, on the real scores.',
        compute: (input) => {
          const r = attention(input);
          const h = r.heads[0];
          const labels = labelsOf(input);
          return {
            caption: 'Head 1. The scaled score, e to that power, and the result after dividing by the row total.',
            totalDims: labels.length,
            unit: 'tokens',
            footnote: 'The last row always sums to 1.00, hover along it and add them up.',
            groups: labels.map((qLabel, i) => {
              const scores = h?.scores[i] ?? [];
              const exps = scores.map((s) => (Number.isFinite(s) ? round2(Math.exp(s)) : 0));
              const total = exps.reduce((a, b) => a + b, 0);
              return {
                id: `w${i}`,
                label: `${qLabel} dividing its attention`,
                sublabel: `total of e^score = ${total.toFixed(2)}`,
                rows: [
                  {
                    label: 'scaled score',
                    role: 'neutral' as const,
                    values: scores,
                    sourceOf: (d: number) =>
                      Number.isFinite(scores[d] ?? 0)
                        ? `What softmax receives for ${labels[d]}.`
                        : `Masked. ${qLabel} may not look at ${labels[d]}.`,
                  },
                  {
                    label: 'e ^ score',
                    role: 'position' as const,
                    values: exps,
                    sourceOf: (d: number) =>
                      Number.isFinite(scores[d] ?? 0)
                        ? `e^${scores[d]} = ${exps[d]}. Exponentiating is what turns a small score gap into a large attention gap.`
                        : `e^(-inf) = 0 exactly. This is how the mask enforces itself with no special case.`,
                  },
                  {
                    label: 'divided by total',
                    role: 'input' as const,
                    values: softmax(scores).map((v) => round2(v)),
                    sourceOf: (d: number) =>
                      `${exps[d]} ÷ ${total.toFixed(2)} = ${round2(softmax(scores)[d] ?? 0)}. ${qLabel} gives ${((softmax(scores)[d] ?? 0) * 100).toFixed(0)}% of its attention to ${labels[d]}.`,
                  },
                ],
              };
            }),
          };
        },
      },
    },
    L2_snags: [
      {
        q: 'Why exponentiate at all? Why not just divide the scores by their total?',
        a: 'Two reasons. Scores can be negative, and dividing negatives by a total gives nonsense weights. And exponentiating sharpens. It lets the model express a strong preference, which plain normalisation cannot.',
      },
      {
        q: 'Can a token pay zero attention to something?',
        a: 'Only if masked. Softmax outputs are strictly positive otherwise, so an unmasked token always gets *some* weight, however tiny. Attention can approach ignoring, and only masking truly forbids.',
      },
      {
        q: 'What is attention entropy?',
        a: 'How spread out a row is. Low entropy means the token is focused on one place; high means it is hedging across many. Heads differ systematically, and it is one of the more interpretable things you can measure inside a model.',
      },
    ],
    L3_atScale: [
      {
        label: 'Rows per layer per head',
        here: '6',
        llama: 'one per token, up to 8,192',
      },
      {
        label: 'Numerical guard',
        here: 'subtract the row max',
        llama: 'same',
        note: 'e^1000 overflows; e^(1000−1000) does not. The result is identical, which is why every implementation does it.',
      },
    ],
    L4_underHood: `\`\`\`python
S = S - S.max(dim=-1, keepdim=True).values   # identical result, no overflow
A = S.exp()
A = A / A.sum(dim=-1, keepdim=True)
\`\`\`

The subtraction is mathematically invisible. It cancels in the division, and practically essential. Without it a single large score overflows to infinity and the whole row becomes NaN.`,
  },

  {
    ...outline({
      id: 'weighted-sum',
      title: 'Weighted sum of V',
      tag: 'attention',
      color: 'magenta',
      order: 5,
      track: 'model',
      parent: 'attention',
      L0_oneLiner:
        'Blend the values in proportion to the attention weights. Each token walks away carrying a mixture of everyone it listened to.',
      L0_analogy: 'Mixing paint by the percentages you just decided on.',
      prereqs: ['attention-weights', 'value'],
      leadsTo: ['mlp'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Multiply and add, nothing else.** Each value vector scaled by its attention weight, all summed.',
        '**The result is a convex combination.** Because the weights sum to 1, the output can never exceed the range of the values that went in. Attention interpolates; it never extrapolates.',
        '**This is the output of one head.** Both heads produce one of these, they are concatenated back to full width, and one more learned matrix mixes across them.',
        '**Then it is added to the residual stream** rather than replacing it, so the token keeps what it was as well as what it heard.',
      ],
      flow: {
        caption: 'The payoff. Weights decided how much; this is where the substance actually moves.',
        steps: [
          { id: 'w', label: 'The weights for one token', kind: 'input', sub: 'a row that sums to 1' },
          { id: 'v', label: 'Every visible token\'s value vector', kind: 'input', sub: 'the substance available to be mixed' },
          { id: 'scale', label: 'Scale each value by its weight', kind: 'stage', sub: 'a token with weight 0 contributes nothing at all' },
          { id: 'add', label: 'Add them together', kind: 'stage', sub: 'one 24-number vector. What this token walked away with' },
          {
            id: 'heads',
            label: 'Concatenate the heads',
            kind: 'stage',
            sub: 'both heads did this separately; their outputs are joined back to full width',
            parts: [
              { id: 'wo', label: 'Then multiply by Wo', sub: 'one more learned matrix, to mix across the heads', kind: 'stage' },
            ],
          },
          {
            id: 'res',
            label: 'Add to the residual stream',
            kind: 'output',
            sub: 'added, not substituted. The token keeps what it was as well as what it heard',
          },
        ],
        note: 'Because the weights sum to 1, the output can never leave the range of the values that went in. Attention interpolates between things already present; it cannot invent something outside them.',
      },
      example: {
        caption: 'The blend, and what came out of it.',
        compute: (input) => {
          const r = attention(input);
          const h = r.heads[0];
          const labels = labelsOf(input);
          return {
            caption: 'Head 1. Each token\'s own value, and the blend it walks away with.',
            totalDims: HEAD_DIM,
            unit: 'dimensions',
            footnote:
              'The output always sits inside the range of the values that were mixed. A weighted average cannot escape its inputs.',
            groups: labels.map((label, i) => ({
              id: `o${i}`,
              label,
              sublabel: `attending to ${i + 1} token${i === 0 ? '' : 's'}`,
              rows: [
                {
                  label: 'own value',
                  role: 'position' as const,
                  values: h?.V[i] ?? [],
                  sourceOf: (d: number) => `Dimension ${d} of ${label}'s own value vector, before any mixing.`,
                },
                {
                  label: 'blended output',
                  role: 'input' as const,
                  values: h?.out[i] ?? [],
                  sourceOf: (d: number) =>
                    `Dimension ${d} of every visible token's value, each multiplied by ${label}'s attention to it, summed.`,
                },
              ],
            })),
          };
        },
      },
    },
    L2_snags: [
      {
        q: 'Why does the first token\'s output equal its own value?',
        a: 'Because it attends 100% to itself. There is nothing before it and the mask forbids looking ahead. A weighted average with a single weight of 1 is just that value. It falls out of the maths rather than being special-cased.',
      },
      {
        q: 'Does this replace the token\'s meaning?',
        a: 'No. It is added to the residual stream, not substituted for it. The token keeps everything it already carried and gains what it heard. That is why deep stacks accumulate rather than overwrite.',
      },
      {
        q: 'What happens to the two heads\' outputs?',
        a: 'Concatenated side by side back to the full width, then multiplied by one more learned matrix. That final projection is what lets information found by different heads be combined rather than merely sitting next to each other.',
      },
    ],
    L3_atScale: [
      { label: 'Per-head output width', here: String(HEAD_DIM), gpt2: '64', llama: '128' },
      { label: 'After concatenation', here: '48', gpt2: '768', llama: '4,096' },
    ],
    L4_underHood: `\`\`\`python
head_out = A @ V                       # [T, head_dim] per head
concat   = cat(all_heads, dim=-1)      # [T, C]
out      = concat @ Wo                 # one more learned matrix
x        = x + out                     # into the residual stream
\`\`\`

\`Wo\` is easy to overlook and does real work: without it the heads' outputs would sit in fixed disjoint slices of the vector, and nothing could combine what two different heads found.`,
  },

  /* ---------------- feed-forward ---------------- */

  {
    ...outline({
      id: 'mlp',
      title: 'Feed-Forward (MLP)',
      tag: 'thinking / memory',
      color: 'violet',
      order: 1,
      track: 'model',
      parent: 'layer',
      L0_oneLiner:
        'After mixing, each token thinks alone. Two matrix multiplies with a curve between them, and this is where most facts are physically stored.',
      L0_analogy: 'Going back to your desk after the meeting to actually process what you heard.',
      prereqs: ['attention'],
      leadsTo: ['residual'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Every token, independently.** No token looks at any other here. Attention already did the mixing; this is per-position work.',
        '**Expand, bend, contract.** Up to roughly 4× the width, apply a nonlinearity, come back down. That is the entire structure.',
        '**The curve is the point.** Without a nonlinearity the two multiplies collapse into a single linear map, and the whole depth of the network would be equivalent to one layer.',
        '**This is where facts live.** A useful way to see it: the up-projection is a set of keys detecting patterns, and the down-projection is the values recalled when they fire. Roughly two thirds of the model\'s parameters are here.',
      ],
      flow: {
        caption: 'Wide in the middle, same width at both ends.',
        steps: [
          { id: 'in', label: 'Token vector', kind: 'input', sub: '48 wide' },
          { id: 'up', label: 'Up-projection', kind: 'stage', sub: '48 → ~192' },
          { id: 'act', label: 'Nonlinearity', kind: 'control', sub: 'the bend, SwiGLU or GELU' },
          { id: 'down', label: 'Down-projection', kind: 'stage', sub: '~192 → 48' },
          { id: 'out', label: 'Added to the stream', kind: 'output', sub: 'residual again' },
        ],
        note: 'The wide middle is where the capacity is. Most of the model\'s parameters sit in these two matrices.',
      },
    },
    L2_snags: [
      {
        q: 'Why expand and then immediately contract?',
        a: 'The wide middle is the working space. More dimensions means more distinct patterns can be detected separately before being compressed back. Going straight across at constant width has far less capacity for the same shape.',
      },
      {
        q: 'What does "facts are stored here" actually mean?',
        a: 'Interpretability work suggests the up-projection rows behave like pattern detectors and the down-projection columns like the content recalled when one fires. Editing specific down-projection weights can change specific factual associations, which is suggestive, though the picture is not complete.',
      },
      {
        q: 'If attention is what made transformers famous, why does this have more parameters?',
        a: 'Because attention is cheap in parameters and expensive in compute. The T×T grid costs time, not weights. The feed-forward layers are the reverse. Fame tracked the new idea, not the parameter count.',
      },
    ],
    L3_atScale: [
      { label: 'Expansion factor', here: '~4×', gpt2: '4×', llama: '~3.5× with SwiGLU' },
      { label: 'Middle width', here: '~192', gpt2: '3,072', llama: '14,336' },
      {
        label: 'Share of block parameters',
        here: ', ',
        llama: '~2/3',
        note: 'Two large matrices per block, versus attention\'s four smaller ones.',
      },
    ],
    L4_underHood: `\`\`\`python
def mlp(x):
    return down(act(up(x)))     # [C] -> [4C] -> [4C] -> [C]
\`\`\`

SwiGLU splits the up-projection in two and uses one half to gate the other:

\`\`\`python
def swiglu(x):
    return down(silu(x @ W_gate) * (x @ W_up))
\`\`\`

That is three matrices instead of two, which is why models using it drop the expansion factor from 4 to about 3.5 to keep the parameter count comparable.`,
  },

  {
    ...outline({
      id: 'up-projection',
      title: 'Up-projection',
      tag: 'mlp',
      color: 'violet',
      order: 0,
      track: 'model',
      parent: 'mlp',
      L0_oneLiner: 'A matrix multiply that expands the vector to roughly 4× width, room to compute in.',
      L0_analogy: 'Spreading your papers across a big table before you start sorting them.',
      leadsTo: ['activation'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One multiply, one shape change.** 48 numbers in, roughly 192 out, via a learned matrix.',
        '**Each output dimension is a learned detector.** It fires when the incoming vector matches the pattern its row encodes.',
        '**Wider means more patterns can be separated** before the nonlinearity decides which ones survive.',
        '**Nothing is "understood" yet.** This is projection into a bigger space; the selection happens next.',
      ],
      flow: {
        caption: 'The expansion.',
        steps: [
          { id: 'x', label: 'x', kind: 'input', sub: '48' },
          { id: 'w', label: 'W_up', kind: 'stage', sub: '48 × 192 learned' },
          { id: 'h', label: 'hidden', kind: 'output', sub: '192, one value per detector' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Why 4× specifically?',
        a: 'Empirical, not derived. It was what the original transformer used and it has held up as a good capacity-per-parameter trade. Models with gated activations use around 3.5× to keep the total similar.',
      },
      {
        q: 'Is this the same kind of matrix as Wq or Wk?',
        a: 'Same operation, different purpose. Q/K/V project into spaces built for *comparing tokens*. This projects into a space built for *detecting patterns in one token*. Nothing about the multiply differs.',
      },
    ],
    L3_atScale: [
      { label: 'Output width', here: '~192', gpt2: '3,072', llama: '14,336' },
      { label: 'Parameters', here: '~9k', gpt2: '~2.4M per layer', llama: '~59M per layer' },
    ],
    L4_underHood: `\`\`\`python
h = x @ W_up        # [C] @ [C, 4C] -> [4C]
\`\`\`

Reading \`W_up\` by columns is what makes the detector view concrete: column *j* is the pattern that output dimension *j* responds to, and the multiply is that column dotted with the token's vector.`,
  },

  {
    ...outline({
      id: 'activation',
      title: 'Activation (SwiGLU)',
      tag: 'mlp',
      color: 'violet',
      order: 1,
      track: 'model',
      parent: 'mlp',
      L0_oneLiner:
        'The nonlinear curve. Without it, stacking layers would collapse into one big linear map and depth would buy nothing.',
      L0_analogy: 'The bend in the pipe. Without it everything runs straight through and nothing sorts.',
      prereqs: ['up-projection'],
      leadsTo: ['down-projection'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Applied to each number independently.** No mixing, no shape change, just a curve applied element by element.',
        '**It is the only reason depth works.** Two matrix multiplies in a row are equivalent to one. Put a nonlinearity between them and they are not, and the stack gains real expressive power.',
        '**It decides what survives.** Values that do not clear the curve are suppressed, so only patterns that fired strongly pass through to the down-projection.',
        '**SwiGLU adds a gate.** Half the expanded vector controls how much of the other half passes. Learned gating rather than a fixed curve, and it measurably works better.',
      ],
      flow: {
        caption: 'A gate learned from the same input that it gates.',
        steps: [
          { id: 'x', label: 'x', kind: 'input', sub: '48' },
          {
            id: 'two',
            label: 'Two projections',
            kind: 'stage',
            sub: 'from the same vector',
            parts: [
              { id: 'g', label: 'gate = x·W_gate', sub: 'through a curve', kind: 'control' },
              { id: 'u', label: 'up = x·W_up', sub: 'the content', kind: 'stage' },
            ],
          },
          { id: 'mul', label: 'silu(gate) × up', kind: 'stage', sub: 'element by element' },
          { id: 'out', label: 'gated hidden', kind: 'output' },
        ],
        note: 'The gate is computed from the same token, so the model learns what to let through based on what came in.',
      },
    },
    L2_snags: [
      {
        q: 'Why does linear-on-linear collapse?',
        a: 'Because (xA)B equals x(AB), and AB is just another matrix. A hundred stacked linear layers are mathematically one linear layer, the depth is entirely wasted. The nonlinearity is what breaks that identity.',
      },
      {
        q: 'What was wrong with ReLU?',
        a: 'Nothing fatal, and it is still used. Its flat zero region means a unit stuck negative gets no gradient and can stop learning. Smooth curves like GELU and SiLU avoid that and train slightly better, which at this scale is worth the extra arithmetic.',
      },
      {
        q: 'Why is gating better than a plain curve?',
        a: 'Because the amount let through becomes learned and input-dependent rather than fixed. Empirically it improves quality enough that most recent models use a gated variant, even though it costs a third matrix.',
      },
    ],
    L3_atScale: [
      { label: 'Common choice', here: 'SwiGLU', gpt2: 'GELU', llama: 'SwiGLU' },
      { label: 'Matrices needed', here: '3', gpt2: '2', llama: '3' },
    ],
    L4_underHood: `\`\`\`python
silu(z) = z * sigmoid(z)
swiglu(x) = down( silu(x @ W_gate) * (x @ W_up) )
\`\`\`

\`silu\` is smooth and, unlike ReLU, slightly negative for small negative inputs, so a unit that drifts negative still receives gradient and can recover rather than dying permanently.`,
  },

  {
    ...outline({
      id: 'down-projection',
      title: 'Down-projection',
      tag: 'mlp',
      color: 'violet',
      order: 2,
      track: 'model',
      parent: 'mlp',
      L0_oneLiner: 'A matrix multiply back down to the original width, ready to rejoin the residual stream.',
      L0_analogy: 'Gathering the sorted papers back into one folder.',
      prereqs: ['activation'],
      leadsTo: ['residual'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Back to 48, so the block\'s output matches its input.** That shape match is what lets blocks stack.',
        '**Its columns are what gets recalled.** If the up-projection rows are detectors, these columns are the content written back when a detector fires.',
        '**The result is added, not substituted.** It joins the residual stream alongside everything already there.',
      ],
      flow: {
        caption: 'The contraction, and where the result goes.',
        steps: [
          { id: 'h', label: 'gated hidden', kind: 'input', sub: '~192' },
          { id: 'w', label: 'W_down', kind: 'stage', sub: '192 × 48 learned' },
          { id: 'add', label: '+ residual stream', kind: 'output', sub: 'back to 48' },
        ],
      },
    },
    L2_snags: [
      {
        q: 'Is information lost coming back down?',
        a: 'Compressed rather than lost, 192 numbers become 48. But the residual stream still carries everything the token had before, so the block only has to contribute what it added, not re-encode the whole token.',
      },
      {
        q: 'Why does this matrix get singled out in interpretability work?',
        a: 'Because its columns are the closest thing to "what gets written back" when a pattern fires. Some fact-editing techniques target exactly these weights, which is suggestive about where associations live.',
      },
    ],
    L3_atScale: [
      { label: 'Shape', here: '~192 × 48', gpt2: '3,072 × 768', llama: '14,336 × 4,096' },
    ],
    L4_underHood: `\`\`\`python
out = h @ W_down     # [4C] @ [4C, C] -> [C]
x   = x + out        # residual
\`\`\`

Note the block never sees its own previous output directly. It sees the stream, which is the accumulation of every block so far. Each block contributes an increment.`,
  },

  /* ---------------- plumbing ---------------- */

  {
    ...outline({
      id: 'residual',
      title: 'Residual stream',
      tag: 'plumbing',
      color: 'orange',
      order: 2,
      track: 'model',
      parent: 'layer',
      L0_oneLiner:
        'A shared bus every organ reads from and writes back to. It is why very deep stacks can train at all.',
      L0_analogy:
        'A conveyor belt running the length of the factory. Each station adds to what is on it rather than replacing the tray.',
      prereqs: ['mlp'],
      leadsTo: ['normalization'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Every block adds; none replaces.** `x = x + attention(x)`, not `x = attention(x)`. The distinction is the whole idea.',
        '**So there is a clean path from input to output.** Information can travel the entire depth untouched if no block modifies it.',
        '**And gradients can travel back the same way.** Without it, the gradient is multiplied by every layer\'s Jacobian on the way back and vanishes long before it reaches the early layers.',
        '**It behaves like shared memory.** Blocks write features into it and later blocks read them. A useful frame for reasoning about what deep models are doing.',
      ],
      flow: {
        caption: 'The bus, and two blocks writing to it.',
        steps: [
          { id: 'emb', label: 'Embedding writes', kind: 'input', sub: 'the stream starts here' },
          {
            id: 'b1',
            label: 'Block 1',
            kind: 'stage',
            sub: 'reads the stream, adds to it',
            parts: [
              { id: 'a1', label: '+ attention', sub: 'increment', kind: 'stage' },
              { id: 'm1', label: '+ feed-forward', sub: 'increment', kind: 'stage' },
            ],
          },
          {
            id: 'b2',
            label: 'Block 2',
            kind: 'stage',
            sub: 'sees everything written so far',
            parts: [
              { id: 'a2', label: '+ attention', sub: 'increment', kind: 'stage' },
              { id: 'm2', label: '+ feed-forward', sub: 'increment', kind: 'stage' },
            ],
          },
          { id: 'read', label: 'Unembed reads', kind: 'output', sub: 'the accumulated stream' },
        ],
        note: 'Delete every block and the stream still carries the embedding to the output. That intact path is what makes depth trainable.',
      },
    },
    L2_snags: [
      {
        q: 'Why does adding rather than replacing fix vanishing gradients?',
        a: 'Because the derivative of x + f(x) with respect to x is 1 + f′(x). That 1 is a direct route for the gradient. With replacement it is only f′(x), and multiplying many small numbers together across dozens of layers drives it to zero.',
      },
      {
        q: 'Does the stream just get bigger and bigger?',
        a: 'Its magnitude does tend to grow with depth, which is part of why normalisation is applied before each organ reads it. The stream itself is left alone; only what the organs see is rescaled.',
      },
      {
        q: 'Is this specific to transformers?',
        a: 'No. It came from ResNets in vision, which is where the name comes from. It is one of the most broadly useful ideas in deep learning, and transformers inherited it rather than inventing it.',
      },
    ],
    L3_atScale: [
      {
        label: 'Stream width',
        here: '48',
        gpt2: '768',
        llama: '4,096',
        source: SOURCES.gpt2Config,
      },
      {
        label: 'Writes into it',
        here: '4',
        gpt2: '24',
        llama: '64',
        note: 'Two per block. Attention and feed-forward, so this is twice the layer count: 12 and 32 respectively.',
        source: SOURCES.llama3Config,
      },
    ],
    L4_underHood: `\`\`\`python
x = x + attn(norm(x))
x = x + mlp(norm(x))
\`\`\`

Note what is *not* normalised: \`x\` itself. Normalisation is applied to what the organs read, so the residual path stays a clean sum from embedding to output. That is the pre-norm arrangement, and it is why modern models train stably at depths the original post-norm design struggled with.`,
  },

  {
    ...outline({
      id: 'normalization',
      title: 'Normalization (LayerNorm)',
      tag: 'plumbing',
      color: 'orange',
      order: 3,
      track: 'model',
      parent: 'layer',
      L0_oneLiner:
        'Rescales the numbers before each organ reads them, so they never explode or vanish. Housekeeping that makes training possible.',
      L0_analogy: 'Levelling the volume between tracks so the mix stays audible.',
      prereqs: ['residual'],
      // Last step inside the block; the pipeline continues at the readout.
      leadsTo: ['unembedding'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Divide by the vector\'s own size.** Compute the root-mean-square of its components and divide through, so the result has a consistent magnitude.',
        '**Then scale by a learned gain.** One learned number per dimension, so the model can decide which dimensions matter more after normalising.',
        '**Applied before each organ, not after.** Pre-norm keeps the residual path unnormalised, which is what makes very deep stacks stable.',
        '**RMSNorm drops the mean-centring.** LayerNorm subtracts the mean first; RMSNorm skips it, works essentially as well, and is cheaper.',
      ],
      flow: {
        caption: 'Two steps: make the size consistent, then let the model reweight.',
        steps: [
          { id: 'v', label: 'Vector', kind: 'input', sub: 'any magnitude' },
          { id: 'mu', label: '− mean', kind: 'stage', sub: 'centre on zero' },
          { id: 'rms', label: '÷ spread', kind: 'stage', sub: 'consistent size' },
          { id: 'g', label: '× gain, + bias', kind: 'control', sub: 'two learned per dimension' },
          { id: 'out', label: 'To the organ', kind: 'output' },
        ],
        note: 'Only what the organ reads is normalised. The residual stream itself passes through untouched.',
      },
    },
    L2_snags: [
      {
        q: 'What actually goes wrong without it?',
        a: 'Magnitudes drift as depth increases. Too large and softmax saturates and gradients vanish; too small and the signal disappears into numerical noise. Either way the deep layers stop learning.',
      },
      {
        q: 'Why do some models drop the mean subtraction?',
        a: 'Empirically the re-centring turned out to contribute little of the benefit, the rescaling was doing the work. Removing it saves a pass over the vector, which at scale is worth having for free. That variant is RMSNorm. The model on this page keeps the centring, because its weights were trained with it, and swapping one for the other silently changes every number afterwards.',
      },
      {
        q: 'Is this the same as normalising input data?',
        a: 'Same instinct, different place. That happens once, before training. This happens inside the model, at every layer, on every forward pass, because magnitudes drift as the signal moves through the stack.',
      },
    ],
    L3_atScale: [
      { label: 'Common choice', here: 'LayerNorm', gpt2: 'LayerNorm', llama: 'RMSNorm' },
      {
        label: 'Learned parameters',
        here: '48',
        gpt2: '768 × 2',
        llama: '4,096',
        note: 'One gain per dimension, so this equals the model dimension. LayerNorm also learns a bias, hence GPT-2\'s ×2.',
        source: SOURCES.llama3Config,
      },
    ],
    L4_underHood: `\`\`\`python
def rmsnorm(x, g, eps=1e-6):
    return x / sqrt(mean(x**2) + eps) * g
\`\`\`

\`eps\` is not decoration. An all-zero vector would divide by zero without it, and that is reachable in practice at initialisation.`,
  },

  {
    ...outline({
      id: 'rope',
      title: 'Positional (RoPE)',
      tag: 'plumbing',
      color: 'orange',
      order: 4,
      track: 'model',
      parent: 'layer',
      L0_oneLiner:
        'Injects word order by rotating Q and K, so "dog bites man" and "man bites dog" are not the same to the model.',
      L0_analogy: 'Turning each clock hand by an amount that depends on where the word sits.',
      related: ['embedding', 'query', 'key'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Attention has no inherent order.** Dot products do not care about sequence. Shuffle the tokens and the raw mechanism gives the same answers.',
        '**The learned position table you met at Embedding is one fix.** GPT-2 adds a per-seat vector at the start and lets it flow through.',
        '**RoPE is the other, and it acts later.** Instead of adding at the input, it *rotates* the Q and K vectors by an angle proportional to position, inside attention.',
        '**Rotation makes the score depend on relative distance.** Because rotating both vectors by their positions leaves the dot product depending on the *difference*, which is what actually matters for language.',
        '**And it extrapolates better.** A learned table has one row per trained position and nothing beyond; a rotation is defined for any position, which is why long-context extension work concentrates here.',
      ],
      flow: {
        caption: 'Two ways to inject order, where each one acts.',
        steps: [
          {
            id: 'learned',
            label: 'Learned table',
            kind: 'store',
            sub: 'GPT-2 · added once at the input',
          },
          { id: 'vs', label: 'or', kind: 'control', sub: 'the modern choice' },
          {
            id: 'rope',
            label: 'RoPE',
            kind: 'stage',
            sub: 'rotates Q and K inside every layer',
            parts: [
              { id: 'ang', label: 'Angle ∝ position', sub: 'different rate per dimension pair', kind: 'control' },
              { id: 'rot', label: 'Rotate Q and K', sub: 'before the dot product', kind: 'stage' },
            ],
          },
          { id: 'score', label: 'Score depends on distance', kind: 'output', sub: 'relative, not absolute' },
        ],
        note: 'The Values are not rotated, only what is used for matching. Position affects who you look at, not what you get.',
      },
    },
    L2_snags: [
      {
        q: 'Why does rotating make the score relative?',
        a: 'Rotating one vector by angle a and another by angle b leaves their dot product depending only on a − b. So a query at position 10 and a key at position 7 give the same score as positions 100 and 97. The model learns distance rather than absolute place.',
      },
      {
        q: 'Why rotate at every layer instead of once at the input?',
        a: 'Because the residual stream gets rewritten by every block, and an added positional signal degrades as it goes. Applying the rotation inside attention means position is precise wherever it is actually used.',
      },
      {
        q: 'How do models get extended to longer contexts than they were trained on?',
        a: 'Mostly by adjusting these rotation frequencies. Slowing them so trained positions cover a longer span, then briefly fine-tuning. That is why context extension is possible at all with RoPE and awkward with a learned table.',
      },
    ],
    L3_atScale: [
      { label: 'Method', here: 'learned table', gpt2: 'learned table', llama: 'RoPE' },
      {
        label: 'Positions supported',
        here: '11',
        gpt2: '1,024, hard limit',
        llama: '8,192, extendable by retuning frequencies',
        note: 'GPT-2\'s n_positions is 1,024 and cannot be exceeded. Llama 3\'s max_position_embeddings is 8,192; Llama 3.1 reached 128,000 largely by adjusting these rotation frequencies.',
        source: SOURCES.llama3Config,
      },
    ],
    L4_underHood: `Each pair of dimensions is treated as a 2D point and rotated:

\`\`\`python
theta_i = 10000 ** (-2i / d)
angle   = position * theta_i
q[2i], q[2i+1] = rotate(q[2i], q[2i+1], angle)
\`\`\`

Different dimension pairs rotate at very different rates. Fast pairs resolve nearby positions precisely, slow pairs distinguish far-apart ones. It is the same idea as the hands of a clock covering seconds through hours.`,
  },

  /* ---------------- readout ---------------- */

  {
    ...outline({
      id: 'unembedding',
      title: 'Unembedding → Logits',
      tag: 'core stage',
      color: 'orange',
      order: 4,
      track: 'model',
      parent: 'transformer',
      L0_oneLiner:
        'A final matrix multiply turns the last token\'s vector into one raw score for every slot in the vocabulary.',
      L0_analogy: 'Comparing your finished sentence against every word in the dictionary, and scoring the fit.',
      prereqs: ['layer'],
      leadsTo: ['logits'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**Only the last position matters for prediction.** Every token has a vector, but only the final one is used to predict what comes next.',
        '**Multiply it by a [C, vocab] matrix.** Out comes one number per vocabulary slot. The raw score for that token being next.',
        '**Each output is a dot product with that token\'s row.** Which is to say: how well does the final vector match the direction of this word?',
        '**Usually the embedding table, transposed.** The same matrix that turned IDs into vectors, run backwards. It saves a very large matrix and ties the two directions together.',
      ],
      flow: {
        caption: 'From one vector to a score for every possible next token.',
        steps: [
          { id: 'last', label: 'Final vector', kind: 'input', sub: 'last position only, 48 wide' },
          { id: 'norm', label: 'Final norm', kind: 'control', sub: 'one last rescale' },
          { id: 'proj', label: '× wte transposed', kind: 'stage', sub: '48 × vocabulary' },
          { id: 'logits', label: 'Logits', kind: 'output', sub: 'one raw score per slot' },
        ],
        note: 'During training every position is unembedded at once. All of them are being taught to predict their own next token in parallel.',
      },
    },
    L2_snags: [
      {
        q: 'Why is only the last position used?',
        a: 'At generation time, because that is the only one whose next token is unknown. During training all positions are used simultaneously. Every position is a training example, which is what makes pretraining so efficient.',
      },
      {
        q: 'What does tying the weights actually mean?',
        a: 'Using the same matrix for input embedding and output projection, transposed. It saves a large matrix, for Llama-3, hundreds of millions of parameters, and encodes a reasonable prior: a token\'s input direction and its output direction should be related.',
      },
      {
        q: 'Why "logits" rather than probabilities?',
        a: 'Because they are unnormalised. They can be negative, they do not sum to anything, and only their relative sizes carry meaning. Softmax is what turns them into probabilities, and that is the next step.',
      },
    ],
    L3_atScale: [
      {
        label: 'Logits produced',
        here: '3',
        gpt2: '50,257',
        llama: '128,256',
        note: 'One per vocabulary slot. Vocab_size in each model\'s config.',
        source: SOURCES.llama3Config,
      },
      {
        label: 'Matrix size',
        here: '48 × 3',
        gpt2: '768 × 50,257',
        llama: '4,096 × 128,256',
        note: 'Model dimension × vocabulary. Often the largest single matrix in the model, and free when weights are tied.',
        source: SOURCES.gpt2Config,
      },
    ],
    L4_underHood: `\`\`\`python
logits = rmsnorm(x[:, -1]) @ wte.T     # [C] @ [C, vocab] -> [vocab]
\`\`\`

Sampling only ever needs the last position, but a naive implementation computes all of them and discards the rest. At long context that is a meaningful waste, which is why serving engines slice before the multiply rather than after.`,
  },

  {
    ...outline({
      id: 'the-loop',
      title: 'The Loop',
      tag: 'core stage',
      color: 'orange',
      order: 5,
      track: 'model',
      parent: 'transformer',
      L0_oneLiner:
        'Append the new token to the input and run the whole thing again. The model is stateless, the text is its only memory.',
      L0_analogy:
        'Someone with no short-term memory who is handed the full transcript before every sentence they speak.',
      prereqs: ['sampling'],
      related: ['kv-cache'],
    }),
    status: 'complete',
    snagsPlaytested: false,
    L1: {
      prose: [
        '**One pass produces one token.** Everything you have walked through, start to finish, yields a single word-piece.',
        '**Then it starts over with that token appended.** Nothing carries over inside the model. The extended text is the entire state.',
        '**Which is what "stateless" means.** Send the same conversation twice and the model is identical both times. It has no idea it has seen you before.',
        '**The KV cache is a speed optimisation, not memory.** It avoids recomputing earlier tokens\' Keys and Values; it changes no output. Drop it and you get identical text, slowly.',
        '**It stops on a stop token or a limit.** The model emits an end-of-text token, or the caller\'s maximum is reached.',
      ],
      flow: {
        caption: 'The outer loop. Everything else on this map happens inside one arrow.',
        steps: [
          { id: 'text', label: 'Text so far', kind: 'input', sub: 'prompt + everything generated' },
          { id: 'pass', label: 'One full forward pass', kind: 'stage', sub: 'the whole model' },
          { id: 'tok', label: 'One token', kind: 'output', sub: 'sampled from the distribution' },
          { id: 'app', label: 'Append', kind: 'control', sub: 'it becomes part of the input' },
        ],
        loop: 'Until a stop token is produced or the length limit is hit.',
        note: 'This is why generation cannot be parallelised across tokens, and why answer length maps almost linearly onto time and cost.',
      },
    },
    L2_snags: [
      {
        q: 'If it is stateless, how does it remember what I said earlier?',
        a: 'It does not. The whole conversation is resent on every single turn. What feels like memory is the transcript being included in the prompt each time, which is also why long conversations get more expensive rather than cheaper.',
      },
      {
        q: 'Does the KV cache count as memory?',
        a: 'No, and it is worth being precise. It stores intermediate arithmetic to avoid recomputing it, and produces bit-identical output either way. Delete it mid-conversation and nothing changes except speed.',
      },
      {
        q: 'Why can it not write the whole answer at once?',
        a: 'Because each token is chosen given all the previous ones, including the ones it just wrote. Token 50 depends on token 49, which did not exist a moment ago. That sequential dependency is inherent, not an implementation limit.',
      },
      {
        q: 'What makes it stop?',
        a: 'Either it produces an end-of-text token. A real vocabulary slot it learned to emit when a response is complete, or the caller\'s token limit is reached. The second is a hard cut and is why answers sometimes end mid-sentence.',
      },
    ],
    L3_atScale: [
      { label: 'Passes per answer', here: ', ', llama: 'one per token' },
      {
        label: 'Cost shape',
        here: ', ',
        llama: 'linear in output length',
        note: 'Plus one prefill over the whole prompt, which is why long prompts cost once and long answers cost repeatedly.',
      },
    ],
    L4_underHood: `\`\`\`python
while True:
    logits = model(ids)[-1]
    next_id = sample(logits)
    ids.append(next_id)
    if next_id == EOS or len(ids) >= max_len:
        break
\`\`\`

Everything else on this map. Every projection, every score, every normalisation, happens inside \`model(ids)\`. One line of this loop is one complete journey through the architecture.`,
  },
];
