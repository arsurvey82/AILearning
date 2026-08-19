/**
 * The toy model. The single tiny model threaded through the whole app.
 *
 * design-spec §2 / CLAUDE.md §6. Everything the learner sees is computed from
 * here. No number in this app is ever typed by hand into content, and no number
 * is ever produced by an LLM (CLAUDE.md §2, first guardrail).
 *
 * Task: sort letters. Vocabulary A B C -> ids 0 1 2.
 * Embedding size C = 48. Context (seats) = 11.
 *
 * Why 11 seats: the toy holds a 6-letter input AND writes the 6-letter sorted
 * answer into the same row, so it needs roughly 11 slots. This is the fact
 * behind the "why 11 seats?" snag, so the constant has to actually be 11.
 */

import trained from './weights.json';

export const VOCAB = ['A', 'B', 'C'] as const;
export type Letter = (typeof VOCAB)[number];

/** Embedding size. Every token becomes this many numbers. */
export const C_DIM = 48;

/** Context window: how many seats exist in the row. */
export const CONTEXT = 11;

/** The default input, from the field-tested walkthrough in docs/embedding-node-content.md. */
export const DEFAULT_INPUT = 'C B A B B C';

/**
 * These weights are DETERMINISTIC BUT ILLUSTRATIVE, seeded pseudo-random, not
 * trained. The arithmetic on screen is genuinely computed; the values it starts
 * from are not the product of learning. The UI must say so.
 *
 * CLAUDE.md §6 (M2 note): when Attention lands, swap in real nanoGPT sort-model
 * weights so the forward pass genuinely sorts, and drop this flag.
 */
/**
 * No longer true, and this is the whole point of the migration.
 *
 * These tables used to be seeded random, honestly labelled as illustrative. The
 * cost was hidden but total: random projections attend to everything about
 * equally, so the attention grid a learner studied came out flat near 20% and
 * had no structure in it to notice or explain. A page teaching attention was
 * showing noise.
 *
 * They are now the trained weights of a model that genuinely sorts letters, so
 * the rows are lopsided in ways that correspond to the task.
 */
export const WEIGHTS_ARE_ILLUSTRATIVE = false;

/** Held-out accuracy of the model these tables come from. */
export const SORT_ACCURACY = (trained as { sort_accuracy_held_out: number }).sort_accuracy_held_out;


/** Two decimal places, so numbers stay readable in a grid and sums stay exact. */
export function round2(n: number): number {
  return Math.round(n * 100) / 100;
}


/**
 * wte, the token table. One row per vocabulary entry: [vocab, C] = [3, 48].
 * "What you are." Same letter always yields this same row, whatever seat it sits in.
 */
export const tokenTable: readonly number[][] = (trained as { wte: number[][] }).wte;

/**
 * wpe, the position table. One row per seat: [context, C] = [11, 48].
 * "Where you sit." Same seat always yields this same row, whatever letter lands on it.
 *
 * Deliberately smaller in magnitude than the token vectors: position is a nudge
 * to the meaning, not a replacement for it. Real models behave this way too, and
 * it makes the sum visibly "the letter, tilted" rather than mush.
 */
export const posTable: readonly number[][] = (trained as { wpe: number[][] }).wpe;

/** Read a table row, failing loudly rather than yielding undefined. */
export function tableRow(table: readonly number[][], index: number, label: string): number[] {
  const r = table[index];
  if (!r) {
    throw new RangeError(`${label}: index ${index} is outside 0..${table.length - 1}`);
  }
  return r;
}

/** Is this character part of the toy vocabulary? */
export function isLetter(ch: string): ch is Letter {
  return (VOCAB as readonly string[]).includes(ch);
}
