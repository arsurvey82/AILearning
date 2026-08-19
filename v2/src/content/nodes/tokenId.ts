/**
 * Node, Token ID.
 *
 * The whole lesson is one correction: an ID is an ADDRESS, not a QUANTITY.
 * The worked example proves it rather than asserting it, it puts each token's
 * ID next to the actual length of the vector that ID points at, so you can see
 * for yourself that the two have no relationship.
 */

import { embed } from '../../model/embedding';
import { VOCAB, round2, tokenTable } from '../../model/toyModel';
import { SOURCES } from '../sources';
import type { ConceptNode, NumberBlock } from '../schema';

/** Euclidean length of a vector. A real, computed property of the row. */
function magnitude(v: readonly number[]): number {
  return round2(Math.sqrt(v.reduce((s, x) => s + x * x, 0)));
}

function computeTokenIds(input: string): NumberBlock {
  const { tokens } = embed(input);

  return {
    caption: 'An ID is an address. Compare it with the actual size of what it points at.',
    totalDims: tokens.length,
    unit: 'tokens',
    footnote:
      `The IDs run ${VOCAB.map((l, i) => `${l}=${i}`).join(', ')}. ` +
      `Notice the two rows do not move together. A bigger ID does not mean a bigger anything.`,
    groups: [
      {
        id: 'ids',
        label: 'Your input as IDs',
        sublabel: tokens.map((t) => t.letter).join(' ') || '(empty)',
        rows: [
          {
            label: 'token ID',
            role: 'token',
            values: tokens.map((t) => t.tokenId),
            sourceOf: (d) =>
              `"${tokens[d]?.letter}" lives in slot ${tokens[d]?.tokenId} of the vocabulary. ` +
              `This is a row number, chosen arbitrarily when the vocabulary was built.`,
          },
          {
            label: 'length of that row',
            role: 'neutral',
            values: tokens.map((t) => magnitude(t.tokenVec)),
            sourceOf: (d) => {
              const t = tokens[d];
              return (
                `Row ${t?.tokenId} of the token table has length ${magnitude(t?.tokenVec ?? [])} ` +
                `across its 48 numbers. That length has nothing to do with the ID being ${t?.tokenId}.`
              );
            },
          },
        ],
      },
    ],
  };
}

export const tokenIdNode: ConceptNode = {
  id: 'token-id',
  title: 'Token ID',
  tag: 'core stage',
  track: 'model',
  order: 1,
  color: 'orange',
  status: 'complete',
  parent: 'transformer',

  L0_oneLiner:
    'Each piece\'s slot number in the vocabulary. It is an address that says which row to fetch, not a value, not a size, not a rank.',
  L0_analogy:
    'A seat number in a theatre. Seat 42 tells you where to look; it tells you nothing about the person sitting there.',

  L1: {
    prose: [
      '**Look up, don\'t compute.** The vocabulary is a list. `A` is at position 0, `B` at 1, `C` at 2. Tokenization gives you the piece; this step gives you where it lives.',
      '**Counting starts at zero.** The first slot is 0, not 1. This is the single most common place beginners are off by one, and it comes back at the next step, with seats.',
      '**The number is arbitrary.** If the vocabulary had been built in a different order, `C` might be 0. Nothing would change; every table would just be shuffled to match.',
      '**So arithmetic on IDs is meaningless.** `C` is 2 and `A` is 0, but `C` is not "twice" anything, and `B` is not "between" them in any real sense. The numbers below show it: ID and size move independently.',
    ],
    example: { caption: 'IDs beside what they actually point at.', compute: computeTokenIds },
  },

  L2_snags: [
    {
      q: 'Index vs token ID, same thing?',
      a: 'Same thing. "Token index" and "token ID" are two names for one number: the piece\'s slot in the vocabulary. "Index" just means "which one in a list, counting from 0".',
    },
    {
      q: 'If C is 2 and A is 0, is C bigger than A?',
      a: 'No. The IDs are addresses, not amounts. Look at the two rows above. The ID and the actual length of the row it points at have no relationship at all. You could renumber the whole vocabulary and the model would work identically once its tables were shuffled to match.',
    },
    {
      q: 'Why not skip this and go straight to numbers that mean something?',
      a: 'Because the meaning lives in a table, and a table needs a row number to look into it. The ID is how you *reach* the meaningful numbers. It is one step, not a wasted one.',
    },
    {
      q: 'Do two different words ever get the same ID?',
      a: 'Never. The vocabulary is a list of unique entries, so the mapping is one-to-one. But the same *word* can produce different IDs depending on context, because "cat" and " cat" (with a leading space) are usually separate entries.',
    },
    {
      q: 'Is the ID what gets fed into the model?',
      a: 'Not quite. The IDs are what the model receives, but the very first thing it does is use each ID to fetch a row of numbers from a table. Those rows are what actually flow through the network. That fetch is the next step, Embedding.',
    },
  ],

  L3_atScale: [
    {
      label: 'Highest possible ID',
      here: '2',
      gpt2: '50,256',
      llama: '128,255',
      note: 'One less than the vocabulary size, because counting starts at zero.',
      source: SOURCES.llama3Config,
    },
    {
      label: 'What holds the rows',
      here: `${VOCAB.length} × 48 table`,
      gpt2: '50,257 × 768',
      llama: '128,256 × 4,096',
      note: `Here that is ${tokenTable.length * 48} numbers. For Llama-3 it is 525,336,576.`,
      source: SOURCES.llama3Config,
    },
    {
      label: 'Special IDs',
      here: 'none',
      gpt2: 'end-of-text',
      llama: 'begin/end-of-text, padding, chat-role markers',
      note: 'Real vocabularies reserve slots for tokens that are never typed by a user. They mark where a turn starts and stops.',
    },
  ],

  L4_underHood: `The IDs are just integers into the first axis of the embedding matrix.

\`\`\`python
ids = tokenizer.encode("C B A B B C")   # -> [2, 1, 0, 1, 1, 2]
x   = wte[ids]                          # gather rows -> shape [T, C]
\`\`\`

\`wte\` has shape \`[vocab, C]\`. Indexing it with a list of IDs is a **gather**, not a matrix multiply, although mathematically it is equivalent to multiplying by a one-hot matrix, which is why you sometimes see it drawn that way. Frameworks implement the gather because multiplying by a mostly-zero matrix would waste almost all of the work.

Because it is a gather, the ID's numeric value is never involved in any arithmetic. It is consumed entirely as an index and then thrown away.`,

  checkpoint: {
    question: '`C` has ID 2 and `A` has ID 0. Is `C` therefore *bigger* than `A`?',
    options: [
      {
        text: 'Yes, 2 is greater than 0',
        feedback:
          'The arithmetic is right and the conclusion is not. An ID is an address, not a quantity. Open Show me above: the ID and the actual length of the row it points at move completely independently.',
        snagQ: 'If C is 2 and A is 0, is C bigger than A?',
      },
      {
        text: 'No. The ID is just a row number, chosen arbitrarily',
        correct: true,
        feedback:
          'Exactly. Build the vocabulary in a different order and C might be 0, with nothing else changing once the tables are shuffled to match. The number is a place to look, not a value.',
      },
      {
        text: 'Only within the same vocabulary',
        feedback:
          'Not even then. Ordering inside one vocabulary carries no meaning either. The slots were assigned when the vocabulary was built, not learned, so neighbouring IDs need have nothing in common.',
        snagQ: 'Why not skip this and go straight to numbers that mean something?',
      },
    ],
  },

  prereqs: ['tokenization'],
  leadsTo: ['embedding'],
  related: ['tokenization'],
};
