/**
 * Node 01, Embedding.
 *
 * Content mapped from docs/embedding-node-content.md, captured from a live
 * novice walkthrough (K, July 2026). The L2 snags are the exact questions a real
 * beginner asked, in the order they asked them. They are not invented, and their
 * wording should not be tidied into headings, recognising your own confusion is
 * the whole mechanism.
 */

import { embed } from '../../model/embedding';
import { CONTEXT, C_DIM, VOCAB } from '../../model/toyModel';
import { SOURCES } from '../sources';
import type { ConceptNode, NumberBlock } from '../schema';

/**
 * The worked example. Every value here is computed by /src/model at call time,
 * so the Run control genuinely re-derives them. Nothing below is a literal.
 */
function computeEmbedding(input: string): NumberBlock {
  const result = embed(input);

  return {
    caption: 'Each letter becomes numbers, gets a seat stamp, and the two are added.',
    totalDims: C_DIM,
    footnote:
      `Vocabulary ${VOCAB.join(' ')} · ${result.tokens.length} of ${CONTEXT} seats used · ` +
      `${result.freeSeats} left for the answer to be written into.`,
    groups: result.tokens.map((t) => ({
      id: `${t.letter}-${t.seat}`,
      label: `${t.letter} @ seat ${t.seat}`,
      sublabel: `token id ${t.tokenId}`,
      rows: [
        {
          label: `token "${t.letter}"`,
          role: 'token' as const,
          values: t.tokenVec,
          sourceOf: (d: number) =>
            `token table row ${t.tokenId} ("${t.letter}"), dimension ${d}. ` +
            `Same for every "${t.letter}" wherever it sits.`,
        },
        {
          label: `seat ${t.seat}`,
          role: 'position' as const,
          values: t.posVec,
          sourceOf: (d: number) =>
            `position table row ${t.seat}, dimension ${d}. ` +
            `Same for whatever letter lands on seat ${t.seat}.`,
        },
        {
          label: 'input embed',
          role: 'input' as const,
          values: t.inputVec,
          sourceOf: (d: number) =>
            `token "${t.letter}" dim ${d} (${t.tokenVec[d]}) + seat ${t.seat} dim ${d} ` +
            `(${t.posVec[d]}) = ${t.inputVec[d]}`,
        },
      ],
    })),
  };
}

export const embeddingNode: ConceptNode = {
  id: 'embedding',
  title: 'Embedding',
  tag: 'core stage',
  track: 'model',
  order: 2,
  color: 'blue',
  status: 'complete',
  // Sits inside The Transformer, between Token ID and the repeated Layer.
  parent: 'transformer',

  L0_oneLiner:
    'Turn each token into numbers, stamp it with its position, add the two. That combined vector is what enters the model.',
  L0_analogy: 'A name tag (what you are) + a seat number (where you sit), carried together.',

  L1: {
    prose: [
      '**Input**, the letters as ID numbers: `C B A B B C → 2 1 0 1 1 2`. Just addresses; meaningless alone.',
      '**Token embed**. Look up the *letter* → its meaning-vector (48 numbers).',
      '**Position embed**. Look up the *seat* → its position-vector (48 numbers).',
      '**Input embed**. **add** the two → the vector that enters the model.',
    ],
    example: {
      caption: 'Real toy numbers, pick a letter to inspect.',
      compute: computeEmbedding,
    },
  },

  // The only set harvested from watching a real beginner (K, July 2026).
  // Everything else in the app anticipates questions rather than reporting them.
  snagsPlaytested: true,
  L2_snags: [
    {
      q: 'What does "48 numbers" mean?',
      a: 'How many numbers describe one token. Like a colour = 3 numbers (R, G, B); a token\'s meaning = 48 numbers. No single number *is* the meaning, the whole set is. They are learned, not human-labelled.',
    },
    {
      q: "What's a seat?",
      a: 'One slot, or position, in the input row. The row of boxes at the top *is* the seats; each box = one seat = one position.',
    },
    {
      q: 'Why 11 columns/seats?',
      a: '11 is the model\'s maximum capacity, its *context window*. This toy needs room to hold the 6 input letters *and* write the 6-letter sorted answer into the same row, so about 11 seats. Empty seats are where the output gets written.',
    },
    {
      q: 'Index vs token ID, same thing?',
      a: 'Same thing. "Token index" and "token ID" are two names for one number: the letter\'s slot in the vocabulary (A=0, B=1, C=2). "Index" just means "which one in a list, counting from 0".',
    },
    {
      q: 'Isn\'t position 3 an A?',
      a: 'No, computers count from 0. In `C B A B B C`, A is the *3rd letter* but sits at *position 2*. Position 3 is the *4th letter*, which is a B. The rule: position = (human count) − 1.',
    },
    {
      q: 'Why two separate tables (token + position)?',
      a: 'Because "what letter" and "which seat" are independent facts. Storing them separately means learning 3 letters + 11 seats = 14 vectors, then *adding* to get any combination. Fusing them would need vocabulary × positions entries, astronomical at real scale.',
    },
    {
      q: 'Input vs Input Embed, what\'s the difference?',
      a: '*Input* is the letters as bare IDs, one number each. *Input Embed* is the same letters after embedding, 48 numbers each. Literally "input, embedded". Input Embed is what enters the transformer *blocks*.',
    },
    {
      q: 'Is an LLM "a machine"?',
      a: 'No, it\'s a **model**: a mathematical *function* with billions of tunable numbers, fitted to data. Nothing mechanical is happening; it is arithmetic all the way down.',
    },
  ],

  L3_atScale: [
    {
      label: 'Embedding size',
      here: '48',
      gpt2: '768',
      llama: '4,096',
      note: 'Llama-3-8B\'s token table alone is 128,256 × 4,096 = 525,336,576 numbers.',
      source: SOURCES.llama3Config,
    },
    {
      label: 'Context window (seats)',
      here: '11',
      gpt2: '1,024',
      llama: '8,192',
      // Corrected 2026-08-05. This previously read 128,000, which is Llama 3.1
      //, a later release. Llama 3's config.json states max_position_embeddings
      // 8192, and Meta's announcement says the models were trained on
      // sequences of 8,192 tokens.
      note: 'Llama 3.1 later raised this to 128,000, and frontier long-context models now reach ~1,000,000 tokens ≈ 750,000 words.',
      source: SOURCES.llama3Config,
    },
    {
      label: 'What one token is',
      here: 'one letter',
      gpt2: 'a word or word-piece',
      llama: 'a word or word-piece',
      note: '"cat" is 1 token; "unhappiness" is roughly 3.',
    },
    {
      label: 'When the sizes are set',
      here: 'before training',
      note: 'These sizes are chosen *before* training. Learning tunes the values in the slots, never the number of slots. A bigger model is a bigger form, built up front.',
    },
  ],

  L4_underHood: `The two tables are ordinary learned weight matrices.

- token table \`wte\`, shape \`[vocab, C]\`, here \`[3, 48]\`
- position table \`wpe\`, shape \`[context, C]\`, here \`[11, 48]\`

The whole stage is one line:

\`\`\`python
x = wte[token_ids] + wpe[positions]
\`\`\`

which is exactly what minGPT and nanoGPT do. The output is a \`T × C\` matrix. T tokens across, C dimensions tall.

Both tables are *learned*: they start random and are tuned by training, like every other weight in the network.

GPT-2 uses this learned position table. Llama drops \`wpe\` entirely and swaps in **RoPE**, which injects position by *rotating* the Q and K vectors inside attention instead of adding a vector here. Same job, different place in the pipeline.`,

  // The distractor here is the exact off-by-one K actually made, the one
  // snag in this whole app that was harvested rather than anticipated.
  checkpoint: {
    question: 'In `C B A B B C`, which letter is sitting at **position 3**?',
    options: [
      {
        text: '`A`, it is the third letter',
        feedback:
          'This is the off-by-one, and it is the most common trip on this node. Counting starts at 0, so A is the *third letter* but sits at *position 2*. The rule: position = human count − 1.',
        snagQ: "Isn't position 3 an A?",
      },
      {
        text: '`B`, position 3 is the fourth letter',
        correct: true,
        feedback:
          'Right. Counting starts at 0, so position 3 is the fourth letter along, which is a B. Open the Run control and hover seat 3 in the grid to see it.',
      },
      {
        text: 'It depends which table you look in',
        feedback:
          'No. The position is fixed by where the letter sits in the row, and both tables are consulted with that same number. What differs is *which* table: the letter picks a row in the token table, the seat picks a row in the position table.',
        snagQ: 'Why two separate tables (token + position)?',
      },
    ],
  },

  prereqs: ['token-id', 'vector'],
  leadsTo: ['attention'],
  related: ['tokenization'],
};
