/**
 * The guardrail on the narration layer.
 *
 * CLAUDE.md §2: the symbolic core is the source of truth and the AI never
 * computes. That rule only holds if the text handed to the model contains the
 * core's real output. If the grounding ever drifts from what `/src/model`
 * produced, the model would be quoting a number the page does not show, and
 * nobody reading the answer could tell.
 *
 * So these assert equality against the core rather than checking shape.
 */

import { describe, expect, it } from 'vitest';
import { stageGrounding } from '../src/ai/stageGrounding';
import { attention } from '../src/model/attention';
import { embed } from '../src/model/embedding';
import { forward } from '../src/model/forward';
import { DEFAULT_INPUT } from '../src/model/toyModel';

const IN = DEFAULT_INPUT;

describe('stageGrounding', () => {
  it('gives the real token IDs, not a description of them', () => {
    const g = stageGrounding('token-id', IN)!;
    const ids = embed(IN).tokens.map((t) => t.tokenId).join(', ');
    expect(g).toContain(ids);
  });

  it('gives the real Q, K and V for head 1', () => {
    const g = stageGrounding('attention', IN)!;
    const h = attention(IN).heads[0]!;

    // First row of each projection, formatted exactly as the grounding does.
    for (const m of [h.Q, h.K, h.V]) {
      const row = m[0]!.slice(0, 6).map((x) => x.toFixed(2)).join(', ');
      expect(g).toContain(row);
    }
  });

  it('gives the real attention weights, including the masked zeros', () => {
    const g = stageGrounding('attention', IN)!;
    const a = attention(IN);
    const w = a.heads[0]!.weights;

    // Row 0 can only look at itself, so it is 1.00 followed by zeros. If the
    // causal mask were dropped this row would change first.
    expect(w[0]![0]).toBeCloseTo(1, 6);
    expect(g).toContain(`${a.letters[0]}0=1.00`);
    expect(g).toContain(`${a.letters[1]}1=0.00`);
  });

  it('gives the real probabilities, and they still sum to 1', () => {
    const g = stageGrounding('softmax', IN)!;
    const f = forward(IN);
    expect(f.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    for (const [i, p] of f.probs.entries()) {
      expect(g).toContain(`${'ABC'[i]}=${(p * 100).toFixed(1)}%`);
    }
  });

  it('tracks the Run control. A different input gives different numbers', () => {
    const a = stageGrounding('attention', 'C B A B B C');
    const b = stageGrounding('attention', 'A A A');
    expect(a).not.toEqual(b);
  });

  it('tells the model the numbers are final', () => {
    const g = stageGrounding('embedding', IN)!;
    expect(g).toMatch(/do not recompute/i);
  });

  it('returns nothing for a stage with no numeric state, rather than filler', () => {
    expect(stageGrounding('kubeflow', IN)).toBeUndefined();
  });
});
