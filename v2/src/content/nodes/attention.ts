/**
 * Node, Attention.
 *
 * The payoff node. It runs on the SAME input the three nodes before it used, so
 * a learner watching `C B A B B C` from tokenization onward sees it arrive here
 * as vectors and turn into percentages.
 *
 * The worked example shows the two rows that matter and nothing else: the raw
 * match scores (with the causal mask visible as -inf) and the softmax
 * percentages those become. The mask being visible is the point, it is the
 * reason this is prediction rather than lookup.
 */

import { HEAD_DIM, N_HEADS, attention } from '../../model/attention';
import { SOURCES } from '../sources';
import type { ConceptNode, NumberBlock } from '../schema';

function computeAttention(input: string): NumberBlock {
  const r = attention(input);
  const head = r.heads[0];
  const labels = r.embedding.tokens.map((t) => `${t.letter}@${t.seat}`);

  return {
    caption: `Head 1 of ${N_HEADS}. Each row is one token deciding how much to listen to each token so far.`,
    totalDims: labels.length,
    unit: 'tokens',
    footnote:
      `Scores are divided by √${HEAD_DIM} (${r.scale.toFixed(2)}) to keep them in a sane range. ` +
      `A score of -inf means the mask forbids that look; softmax turns it into exactly 0.`,
    groups: (head?.weights ?? []).map((wRow, i) => ({
      id: `q${i}`,
      label: `${labels[i]} is looking`,
      sublabel: `can see ${i + 1} of ${labels.length} token${labels.length === 1 ? '' : 's'}`,
      rows: [
        {
          label: 'match score',
          role: 'neutral',
          values: head?.scores[i] ?? [],
          sourceOf: (d) => {
            const s = head?.scores[i]?.[d];
            if (s !== undefined && !Number.isFinite(s)) {
              return `${labels[i]} may not look at ${labels[d]}, that token comes later. Masked to -inf, which softmax turns into exactly 0%.`;
            }
            return (
              `Query of ${labels[i]} dotted with the key of ${labels[d]}, divided by √${HEAD_DIM}. ` +
              `A bigger number means the question and the tag matched better.`
            );
          },
        },
        {
          label: 'attention',
          role: 'input',
          values: wRow,
          sourceOf: (d) =>
            `${labels[i]} spends ${((wRow[d] ?? 0) * 100).toFixed(0)}% of its attention on ${labels[d]}. ` +
            `This row sums to 1. Attention is always divided up, never created.`,
        },
      ],
    })),
  };
}

export const attentionNode: ConceptNode = {
  id: 'attention',
  title: 'Attention',
  tag: 'mixing / routing',
  track: 'model',
  order: 0,
  color: 'magenta',
  status: 'complete',
  parent: 'layer',

  L0_oneLiner:
    'Every token looks at the tokens before it and decides how much of each one to take. The result is a percentage split that always adds up to 1.',
  L0_analogy:
    'Each token asks a question, every earlier token holds up a tag, and attention is how loudly each answer comes through.',

  L1: {
    prose: [
      '**Three copies of every token.** Each input vector is multiplied by three learned matrices to make a **Query** (what am I looking for?), a **Key** (what do I offer?) and a **Value** (what do I pass on if chosen?).',
      '**Matching is a dot product.** Dot one token\'s Query against another\'s Key and you get one number: how well they match. Do it for every pair and you have a grid.',
      '**Divide by √(head width).** Without it the scores grow with the width of the head and softmax turns into a hard maximum, one token would take everything.',
      '**Mask the future.** A token may not look at tokens after it. Those scores are set to minus infinity, which softmax turns into exactly zero. This is why the model must *predict* rather than read ahead.',
      '**Softmax, then blend.** Turn each row of scores into percentages that sum to 1, then add up the Values in those proportions. Each token walks away carrying a mix of everyone it listened to.',
    ],
    // Arcs first (the routing, seen), then the grid (the routing, counted).
    // Mayer's multimedia principle: two channels beat either alone.
    visual: 'attention-arcs',
    example: { caption: 'Real attention on your input.', compute: computeAttention },
  },

  L2_snags: [
    {
      q: 'Why does the first row always show 100%?',
      a: 'Because the first token has nowhere else to look. The mask forbids looking forward and there is nothing behind it, so all of its attention lands on itself. This is not a bug and it is not special-cased. It falls out of softmax over a row with one allowed entry.',
    },
    {
      q: 'What does -inf mean in the score row?',
      a: 'It is the mask. Before softmax runs, every score for a token that comes later is replaced with minus infinity. Softmax raises e to the power of each score, and e to the minus infinity is 0, so those tokens get exactly zero attention, with no special case needed in the code.',
    },
    {
      q: 'Why can\'t a token look at the ones after it?',
      a: 'Because the model is trained to predict the next token, and every position is being trained at once. If position 2 could see position 3, it would be handed the answer it is supposed to guess. The mask is what keeps training honest.',
    },
    {
      q: 'Why divide by the square root of anything?',
      a: 'Dot products grow with the number of dimensions you sum over. Left alone, scores in a 24-wide head come out large, softmax becomes almost a hard maximum, and gradients vanish. Dividing by √(head width) keeps the spread roughly constant no matter how wide the head is.',
    },
    {
      q: 'Are Query, Key and Value three different things, or three views of one thing?',
      a: 'Three views. Each starts from the same input vector and is multiplied by a different learned matrix. The split matters because asking, advertising, and delivering are different jobs. What a token wants to find is not the same as what it wants to be found by.',
    },
    {
      q: 'Does each row really have to add up to 1?',
      a: 'Yes, and that is the whole job of softmax. Attention divides a fixed budget rather than creating importance. If a token pays more attention to one neighbour it must pay less to another. Hover along a row above and the numbers add to 1.00.',
    },
    {
      q: 'What is a "head", and why more than one?',
      a: 'A head is one complete copy of this whole procedure on a narrower slice of the vector. Running several in parallel lets different heads specialise, one might track grammatical agreement while another tracks which noun a pronoun refers to. Their outputs are stitched back together side by side.',
    },
    {
      q: 'Is this where the model "understands" the sentence?',
      a: 'It is where tokens finally get to affect each other. Up to now every token has been processed alone. But it is mixing, not thinking. The thinking-alone step is the feed-forward layer that follows, and the whole block repeats dozens of times.',
    },
  ],

  L3_atScale: [
    {
      label: 'Heads',
      here: String(N_HEADS),
      gpt2: '12',
      llama: '32 query, 8 key/value',
      note: 'More heads means more things the model can track at once. Llama 3 uses grouped-query attention, so four query heads share each key/value head.',
      source: SOURCES.llama3Config,
    },
    {
      label: 'Width per head',
      here: String(HEAD_DIM),
      gpt2: '64',
      llama: '128',
      note: 'Head width × head count = the full embedding width, so the heads exactly partition the vector: 768 ÷ 12 = 64, and 4,096 ÷ 32 = 128.',
      source: SOURCES.gpt2Config,
    },
    {
      label: 'Size of the score grid',
      here: '6 × 6',
      gpt2: 'up to 1,024 × 1,024',
      llama: 'up to 8,192 × 8,192',
      // Corrected 2026-08-05: was 128,000², which is Llama 3.1's context.
      note: 'The grid grows with the SQUARE of the context length, at Llama 3.1\'s 128,000 that is over 240× more cells than Llama 3\'s 8,192. This is the single reason long context is expensive, and why FlashAttention and paged KV caches exist.',
      source: SOURCES.llama3Config,
    },
    {
      label: 'Variant used',
      here: 'plain multi-head',
      gpt2: 'multi-head (MHA)',
      llama: 'grouped-query (GQA)',
      note: 'Meta adopted GQA across both the 8B and 70B sizes specifically to improve inference efficiency. Sharing Keys and Values across heads shrinks the serving memory; it is not about intelligence.',
      source: SOURCES.llama3Announcement,
    },
  ],

  L4_underHood: `One head, in full:

\`\`\`python
Q = x @ Wq          # [T, head_dim]
K = x @ Wk
V = x @ Wv

S = Q @ K.T / math.sqrt(head_dim)     # [T, T]
S = S.masked_fill(causal_mask, -inf)  # a token may not see the future
A = softmax(S, dim=-1)                # rows now sum to 1
out = A @ V                           # [T, head_dim]
\`\`\`

Multi-head is this same block run \`n_heads\` times on separate slices, concatenated back to \`[T, C]\` and passed through one more learned matrix.

Two consequences worth holding on to:

- \`S\` is \`T × T\`, so **compute and memory grow with the square of the sequence length**. Everything called "efficient attention" is an attack on that square.
- At generation time the Keys and Values of earlier tokens never change, so they are cached. That cache. The **KV cache**. Is usually what fills a GPU's memory in production, not the weights.`,

  checkpoint: {
    question:
      'The very first token\'s attention row reads **100%** on itself, every time. Why?',
    options: [
      {
        text: 'It is special-cased. The code handles the first token separately',
        feedback:
          'No, and this matters: there is no special case anywhere. It falls out of the maths. Softmax over a row with exactly one allowed entry can only return 1 for that entry.',
        snagQ: 'Why does the first row always show 100%?',
      },
      {
        text: 'The first token is the most important one in the sequence',
        feedback:
          'Attention weight is not importance, it is a budget being divided. The first token spends everything on itself because it has nowhere else to spend it, not because it matters most.',
        snagQ: 'Does each row really have to add up to 1?',
      },
      {
        text: 'Nothing comes before it, and the mask forbids looking ahead',
        correct: true,
        feedback:
          'Exactly. One allowed entry, and softmax rows always sum to 1, so that entry gets all of it. Step the arcs to the second token and watch the budget start being shared.',
      },
    ],
  },

  prereqs: ['embedding'],
  leadsTo: ['mlp'],
  related: ['softmax', 'dot-product', 'kv-cache', 'vllm'],
};
