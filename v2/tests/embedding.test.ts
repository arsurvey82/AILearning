/**
 * These tests are not routine coverage. CLAUDE.md §6 specifies them because
 * each one encodes a fact the learner is being taught:
 *
 *   same letter  -> same token vector, whatever the seat   |  "what you are"
 *   same seat    -> same position vector, whatever letter  |  "where you sit"
 *   input        =  the two, added                         |  the node's whole point
 *
 * If one of these ever fails, the lesson is wrong, not just the code.
 */

import { describe, expect, it } from 'vitest';
import { embed, parseInput, positions, tokenize } from '../src/model/embedding';
import { CONTEXT, C_DIM, DEFAULT_INPUT, posTable, tokenTable, VOCAB } from '../src/model/toyModel';

describe('tables', () => {
  it('token table is [vocab, C] and position table is [context, C]', () => {
    expect(tokenTable).toHaveLength(VOCAB.length);
    expect(posTable).toHaveLength(CONTEXT);
    for (const row of tokenTable) expect(row).toHaveLength(C_DIM);
    for (const row of posTable) expect(row).toHaveLength(C_DIM);
  });

  it('is deterministic across calls', () => {
    const a = embed(DEFAULT_INPUT);
    const b = embed(DEFAULT_INPUT);
    expect(a.tokens.map((t) => t.inputVec)).toEqual(b.tokens.map((t) => t.inputVec));
  });
});

describe('why two separate tables', () => {
  it('same letter gives the same token vector regardless of seat', () => {
    // "B" appears at seats 1, 3 and 4 in "C B A B B C".
    const { tokens } = embed(DEFAULT_INPUT);
    const bs = tokens.filter((t) => t.letter === 'B');
    expect(bs.length).toBeGreaterThan(1);
    expect(bs.map((t) => t.seat)).not.toEqual(bs.map(() => bs[0]!.seat)); // genuinely different seats
    for (const b of bs) expect(b.tokenVec).toEqual(bs[0]!.tokenVec);
  });

  it('same seat gives the same position vector regardless of letter', () => {
    const seat0OfC = embed('C A A')!.tokens[0]!;
    const seat0OfA = embed('A C C')!.tokens[0]!;
    expect(seat0OfC.letter).not.toBe(seat0OfA.letter);
    expect(seat0OfC.posVec).toEqual(seat0OfA.posVec);
  });

  it('input embedding is the elementwise sum of the two', () => {
    const { tokens } = embed(DEFAULT_INPUT);
    for (const t of tokens) {
      for (let d = 0; d < C_DIM; d++) {
        expect(t.inputVec[d]).toBeCloseTo(t.tokenVec[d]! + t.posVec[d]!, 10);
      }
    }
  });

  it('two tables cost vocab + context vectors, not vocab x context', () => {
    // The arithmetic behind the snag answer: 3 + 11 = 14, not 3 * 11 = 33.
    expect(tokenTable.length + posTable.length).toBe(14);
    expect(tokenTable.length * posTable.length).toBe(33);
  });
});

describe('token ids and seats', () => {
  it('maps letters to their vocabulary slot', () => {
    expect(tokenize(['C', 'B', 'A', 'B', 'B', 'C'])).toEqual([2, 1, 0, 1, 1, 2]);
  });

  it('counts seats from zero, so the 3rd letter sits at position 2', () => {
    const { tokens } = embed(DEFAULT_INPUT);
    const a = tokens.find((t) => t.letter === 'A');
    expect(a?.seat).toBe(2); // A is the 3rd letter of "C B A B B C"
    expect(tokens[3]?.letter).toBe('B'); // position 3 is the 4th letter, a B
    expect(positions(4)).toEqual([0, 1, 2, 3]);
  });
});

describe('input parsing', () => {
  it('ignores spaces and accepts lowercase', () => {
    expect(parseInput('c b a').letters).toEqual(['C', 'B', 'A']);
  });

  it('reports characters outside the vocabulary instead of hiding them', () => {
    const p = parseInput('A B Z 9');
    expect(p.letters).toEqual(['A', 'B']);
    expect(p.ignored).toEqual(['Z', '9']);
  });

  it('truncates at the context window and says so', () => {
    const p = parseInput('A'.repeat(CONTEXT + 5));
    expect(p.letters).toHaveLength(CONTEXT);
    expect(p.truncated).toBe(true);
  });

  it('leaves free seats for the answer to be written into', () => {
    const r = embed(DEFAULT_INPUT); // 6 letters in an 11-seat row
    expect(r.tokens).toHaveLength(6);
    expect(r.freeSeats).toBe(5);
  });
});
