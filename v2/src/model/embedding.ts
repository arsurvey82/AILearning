/**
 * Embedding. The real computation behind Node 01.
 *
 * Three steps, exactly as docs/embedding-node-content.md describes them:
 *   1. token embed    look up the LETTER   -> its meaning vector   (wte[id])
 *   2. position embed look up the SEAT     -> its position vector  (wpe[seat])
 *   3. input embed    ADD the two          -> the vector that enters the model
 *
 * x = wte[token_ids] + wpe[positions]   (what minGPT/nanoGPT literally do)
 */

import {
  CONTEXT,
  C_DIM,
  VOCAB,
  isLetter,
  posTable,
  tableRow,
  tokenTable,
  type Letter,
} from './toyModel';

export interface ParsedInput {
  /** The letters that survived parsing, in order. */
  letters: Letter[];
  /** Characters that were not in the vocabulary (spaces excluded). */
  ignored: string[];
  /** True if the input was longer than the context window and got cut. */
  truncated: boolean;
}

/**
 * Turn whatever the learner typed into a clean letter sequence.
 * Forgiving on purpose: lowercase, commas and spaces all work. Anything outside
 * the vocabulary is reported rather than silently dropped, so the Run control
 * can tell the learner what it ignored.
 */
export function parseInput(raw: string): ParsedInput {
  const letters: Letter[] = [];
  const ignored: string[] = [];

  for (const ch of raw.toUpperCase()) {
    if (ch === ' ' || ch === ',' || ch === '\t') continue;
    if (isLetter(ch)) letters.push(ch);
    else ignored.push(ch);
  }

  const truncated = letters.length > CONTEXT;
  return { letters: truncated ? letters.slice(0, CONTEXT) : letters, ignored, truncated };
}

/**
 * Letters -> token IDs. This is the whole of "tokenization" in the toy model:
 * a letter's slot in the vocabulary. A = 0, B = 1, C = 2.
 *
 * "Token index" and "token ID" are the same number, which is the answer to one
 * of the eight playtested snags.
 */
export function tokenize(letters: readonly Letter[]): number[] {
  return letters.map((l) => VOCAB.indexOf(l));
}

/**
 * Seats 0..n-1. Counting starts at 0, which is the whole of the off-by-one snag:
 * in "C B A B B C" the letter A is the 3rd letter but sits at position 2.
 */
export function positions(n: number): number[] {
  return Array.from({ length: n }, (_, i) => i);
}

export interface EmbeddedToken {
  /** 0-based seat this token occupies. */
  seat: number;
  letter: Letter;
  /** The letter's slot in the vocabulary. Same thing as "token index". */
  tokenId: number;
  /** wte[tokenId], depends on the LETTER only. */
  tokenVec: number[];
  /** wpe[seat], depends on the SEAT only. */
  posVec: number[];
  /** tokenVec + posVec, elementwise. What actually enters the transformer blocks. */
  inputVec: number[];
}

export interface EmbedResult {
  parsed: ParsedInput;
  tokens: EmbeddedToken[];
  /** Seats left over. In the toy model this is where the sorted answer gets written. */
  freeSeats: number;
}

/**
 * The real computation. Called by the Run control on every input change, and by
 * every WorkedExample in the content layer. Content never holds numbers itself.
 */
export function embed(raw: string): EmbedResult {
  const parsed = parseInput(raw);
  const ids = tokenize(parsed.letters);
  const seats = positions(parsed.letters.length);

  const tokens: EmbeddedToken[] = parsed.letters.map((letter, i) => {
    const tokenId = ids[i] ?? 0;
    const seat = seats[i] ?? 0;

    const tokenVec = tableRow(tokenTable, tokenId, `token table (letter "${letter}")`);
    const posVec = tableRow(posTable, seat, `position table (seat ${seat})`);

    // The one line the whole node is about.
    /* No rounding. The tables now carry four decimal places, and rounding the
       sum here made it stop equalling its two parts. Display formats; the model
       keeps what it computed. */
    const inputVec = tokenVec.map((v, d) => v + (posVec[d] ?? 0));

    return { seat, letter, tokenId, tokenVec, posVec, inputVec };
  });

  return { parsed, tokens, freeSeats: CONTEXT - tokens.length };
}

/** Shape of the result matrix, T tokens across by C dimensions tall. */
export function shape(result: EmbedResult): { T: number; C: number } {
  return { T: result.tokens.length, C: C_DIM };
}
