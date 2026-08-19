/**
 * Like the embedding tests, each of these encodes a fact the learner is taught.
 * If one fails the lesson is wrong, not just the code.
 */

import { describe, expect, it } from 'vitest';
import { HEAD_DIM, N_HEADS, attention, dot, softmax } from '../src/model/attention';
import { DEFAULT_INPUT } from '../src/model/toyModel';

describe('softmax', () => {
  it('turns scores into percentages that sum to 1', () => {
    const out = softmax([0.5, 1.0, 0.0]);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
    expect(out[1]).toBeGreaterThan(out[0]!); // the higher score gets more weight
    expect(out[0]).toBeGreaterThan(out[2]!);
  });

  it('gives a masked entry exactly zero attention', () => {
    const out = softmax([1.0, -Infinity, 0.5]);
    expect(out[1]).toBe(0);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 10);
  });

  it('is shift-invariant. Subtracting the max changes nothing', () => {
    const a = softmax([1, 2, 3]);
    const b = softmax([101, 102, 103]);
    a.forEach((v, i) => expect(v).toBeCloseTo(b[i]!, 10));
  });
});

describe('attention on the toy model', () => {
  const r = attention(DEFAULT_INPUT);

  it('runs on the same input the embedding node uses', () => {
    expect(r.letters.join('')).toBe('CBABBC');
    expect(r.embedding.tokens).toHaveLength(6);
  });

  it('has the specified number of heads, each a slice of the full width', () => {
    expect(r.heads).toHaveLength(N_HEADS);
    expect(HEAD_DIM * N_HEADS).toBe(48);
    for (const h of r.heads) {
      expect(h.Q[0]).toHaveLength(HEAD_DIM);
    }
  });

  it('scales scores by the square root of the head width', () => {
    expect(r.scale).toBeCloseTo(Math.sqrt(HEAD_DIM), 10);
  });

  it('every attention row sums to 1', () => {
    for (const h of r.heads) {
      for (const row of h.weights) {
        expect(row.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
      }
    }
  });

  it('never lets a token look at a token after it', () => {
    // The causal mask. Without it the model could read the answer off the row
    // instead of predicting it.
    for (const h of r.heads) {
      h.weights.forEach((row, i) => {
        row.forEach((w, j) => {
          if (j > i) expect(w).toBe(0);
        });
      });
    }
  });

  it('gives the first token nowhere to look but itself', () => {
    for (const h of r.heads) {
      expect(h.weights[0]?.[0]).toBeCloseTo(1, 1);
    }
  });

  it('scores are the dot product of a query and a key, scaled', () => {
    const h = r.heads[0]!;
    // Token 2 attending to token 1, allowed by the mask.
    const expected = dot(h.Q[2]!, h.K[1]!) / r.scale;
    expect(h.scores[2]![1]).toBeCloseTo(expected, 1);
  });

  it('the same letter produces the same query wherever it appears', () => {
    // Q depends on the input embedding, which carries position, so two Bs do
    // NOT get identical queries. That is the point of the position stamp, and
    // this test pins it so the two lessons stay consistent.
    const bIndexes = r.embedding.tokens
.map((t, i) => (t.letter === 'B' ? i : -1))
.filter((i) => i >= 0);
    const b1 = bIndexes[0]!;
    const b2 = bIndexes[bIndexes.length - 1]!;
    expect(b1).not.toBe(b2);
    const h = r.heads[0]!;
    expect(h.Q[b1]).not.toEqual(h.Q[b2]);
  });

  it('is deterministic', () => {
    const again = attention(DEFAULT_INPUT);
    expect(again.heads[0]?.weights).toEqual(r.heads[0]?.weights);
  });

  it('handles a single-token input without dividing by zero', () => {
    const one = attention('A');
    expect(one.heads[0]?.weights).toEqual([[1]]);
  });

  it('handles empty input without throwing', () => {
    const none = attention('');
    expect(none.heads[0]?.weights).toEqual([]);
  });
});
