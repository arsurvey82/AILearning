/**
 * Node, Tokenization.
 *
 * The worked example deliberately contrasts two numbers that are easy to
 * confuse: the character code a computer *already has* for a letter, and the
 * vocabulary slot tokenization *assigns* to it. Seeing them side by side
 * answers "why not just use the character codes?" without a paragraph.
 */

import { parseInput, tokenize } from '../../model/embedding';
import { VOCAB } from '../../model/toyModel';
import { SOURCES } from '../sources';
import type { ConceptNode, NumberBlock } from '../schema';

function computeTokenization(input: string): NumberBlock {
  const parsed = parseInput(input);
  const ids = tokenize(parsed.letters);

  return {
    caption: 'The computer already has a number for each letter. Tokenization assigns a different one.',
    totalDims: parsed.letters.length,
    unit: 'pieces',
    footnote:
      `${parsed.letters.length} piece${parsed.letters.length === 1 ? '' : 's'} · vocabulary is ${VOCAB.join(', ')} ` +
      `(${VOCAB.length} slots)` +
      (parsed.ignored.length ? ` · ignored ${parsed.ignored.map((c) => `"${c}"`).join(', ')}` : ''),
    groups: [
      {
        id: 'pieces',
        label: 'The whole input, piece by piece',
        sublabel: parsed.letters.join(' ') || '(empty)',
        rows: [
          {
            label: 'character code',
            role: 'neutral',
            values: parsed.letters.map((l) => l.charCodeAt(0)),
            sourceOf: (d) =>
              `Piece ${d} is "${parsed.letters[d]}". Its character code is ${parsed.letters[d]?.charCodeAt(0)}, ` +
              `that number came from Unicode decades ago and says nothing about meaning.`,
          },
          {
            label: 'vocabulary slot',
            role: 'token',
            values: ids,
            sourceOf: (d) =>
              `Piece ${d} ("${parsed.letters[d]}") sits in slot ${ids[d]} of this model's ${VOCAB.length}-entry vocabulary. ` +
              `The model chose this numbering; nothing outside the model uses it.`,
          },
        ],
      },
    ],
  };
}

export const tokenizationNode: ConceptNode = {
  id: 'tokenization',
  title: 'Tokenization',
  tag: 'core stage',
  track: 'model',
  order: 0,
  color: 'orange',
  status: 'complete',
  parent: 'transformer',

  L0_oneLiner: 'Chop the text into pieces the model has a slot for. Nothing has become numbers yet, this is just cutting.',
  L0_analogy:
    'Cutting a sentence along seams the model was built to recognise, like a jigsaw that only accepts its own pieces.',

  L1: {
    prose: [
      '**The vocabulary is fixed before training.** This toy knows exactly three pieces: `A`, `B`, `C`. A real model knows 50,000 to 200,000.',
      '**Cutting means matching.** Walk the text and take the longest piece the vocabulary recognises. Here every piece is one letter, so it looks trivial, in a real model `unhappiness` comes apart as `un` / `happi` / `ness`.',
      '**Anything unrecognised has nowhere to go.** Type a `Z` into the Run box above and watch it get dropped: the model has no slot for it, so it cannot enter at all.',
      '**Character codes already exist and are not the answer.** Your computer has had a number for `C` since Unicode, it is 67. The model ignores it completely and uses its own slot instead.',
    ],
    example: { caption: 'Real pieces from your input.', compute: computeTokenization },
  },

  L2_snags: [
    {
      q: 'Why not just use the character codes the computer already has?',
      a: 'Because they encode *which symbol*, not *which thing the model knows*. Unicode numbers letters by historical accident, 67 for C, 66 for B. The model needs slots into its own learned table, and it needs one slot per meaningful piece, which is often several letters long rather than one.',
    },
    {
      q: 'Is a token the same as a word?',
      a: 'No. A token is usually a word *or a piece of one*. Common words get their own slot; rare ones get split. "cat" is 1 token; "unhappiness" is roughly 3. Spaces usually ride along at the start of a token rather than getting their own.',
    },
    {
      q: 'Why does the vocabulary have to be fixed in advance?',
      a: 'Because the embedding table has one row per slot, and the table\'s shape is decided before training starts. Adding a word later would mean adding a row that has never been trained, it would hold random numbers.',
    },
    {
      q: 'What happens to a character the model has never seen?',
      a: 'In this toy it is dropped and the Run box tells you. Real tokenizers avoid the problem by including every single byte as a fallback slot, so worst case a strange character becomes several near-meaningless byte tokens rather than vanishing.',
    },
    {
      q: 'Does the same text always produce the same tokens?',
      a: 'For one tokenizer, yes. It is deterministic, no learning happens at this step. But different models tokenize differently, so the same sentence can be 18 tokens for one model and 23 for another. That is why token counts and prices differ between providers.',
    },
  ],

  L3_atScale: [
    {
      label: 'Vocabulary size',
      here: '3',
      gpt2: '50,257',
      llama: '128,256',
      note: 'vocab_size in each model\'s config. Meta states the larger vocabulary "encodes language much more efficiently".',
      source: SOURCES.llama3Announcement,
    },
    {
      label: 'What one piece is',
      here: 'one letter',
      gpt2: 'word or word-piece',
      llama: 'word or word-piece',
      note: 'English averages roughly 0.75 words per token, so 1,000 tokens is about 750 words.',
    },
    {
      label: 'How the vocabulary is chosen',
      here: 'hand-picked',
      gpt2: 'learned from the corpus (BPE)',
      llama: 'learned from the corpus (BPE)',
      note: 'Byte-Pair Encoding starts from single bytes and repeatedly merges the most frequent adjacent pair into a new slot, until it has as many slots as the budget allows.',
    },
  ],

  L4_underHood: `Real tokenizers use **Byte-Pair Encoding** or a close relative.

Training the tokenizer is a separate, cheap step that happens *before* the model trains:

- start with one slot per byte (256 slots, so nothing is ever unrepresentable)
- count every adjacent pair in the corpus, merge the most frequent pair into a new slot
- repeat until you reach the vocabulary budget

Encoding then replays those merges greedily over new text.

\`\`\`python
# what the toy does, in one line
ids = [VOCAB.index(ch) for ch in text if ch in VOCAB]
\`\`\`

The byte fallback is why a real tokenizer never truly fails on unknown input. Worst case, a character it has never seen becomes several individual byte tokens.`,

  checkpoint: {
    question: 'You type a `Z` into the Run box. What happens to it?',
    options: [
      {
        text: 'It gets its character code, 90, and carries on',
        feedback:
          'The character code exists, but the model never uses it. Tokenization assigns a slot in *its own* vocabulary, and Z has no slot here, so the code is irrelevant either way.',
        snagQ: 'Why not just use the character codes the computer already has?',
      },
      {
        text: 'It is dropped, because there is no slot for it',
        correct: true,
        feedback:
          'Right, and the Run box tells you it was ignored. Real tokenizers dodge this by including every raw byte as a fallback slot, so a strange character becomes several byte tokens rather than vanishing.',
      },
      {
        text: 'A new slot is added to the vocabulary for it',
        feedback:
          'The vocabulary is fixed before training and can never grow afterwards. A new slot would mean a new row in the embedding table that no training ever touched. Random numbers pretending to be a meaning.',
        snagQ: 'Why does the vocabulary have to be fixed in advance?',
      },
    ],
  },

  prereqs: [],
  leadsTo: ['token-id'],
  related: ['train-tokenizer', 'embedding'],
};
