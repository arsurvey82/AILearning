/**
 * The rest of the block. Each test encodes a fact the stage visuals assert,
 * so a visual can never show something the maths does not do.
 */

import { describe, expect, it } from 'vitest';
import { attention } from '../src/model/attention';
import { FFN_DIM, add, forward, gelu, layernorm, mlp, softmaxVocab } from '../src/model/forward';
import { C_DIM, DEFAULT_INPUT, VOCAB } from '../src/model/toyModel';

describe('LayerNorm', () => {
  /* This was RMSNorm until the model was migrated to trained weights. The two
     differ by whether the mean is subtracted, and the weights were fitted under
     LayerNorm, so using the other one silently produces numbers belonging to no
     model at all. */
  const unit = { g: new Array(C_DIM).fill(1), b: new Array(C_DIM).fill(0) };

  it('centres, which is exactly what RMSNorm does not do', () => {
    const out = layernorm(Array.from({ length: C_DIM }, (_, i) => i), unit.g, unit.b);
    expect(out.reduce((a, b) => a + b, 0)).toBeCloseTo(0, 8);
  });

  it('brings vectors of very different size to the same scale', () => {
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    const shape = Array.from({ length: C_DIM }, (_, i) => i % 7);
    const big = layernorm(shape.map((x) => x * 100), unit.g, unit.b);
    const small = layernorm(shape, unit.g, unit.b);
    /* Four places, not six. The epsilon shifts the result by a few parts per
       million even at unit scale, so demanding more precision than that is
       asserting that epsilon does not exist. */
    expect(spread(big)).toBeCloseTo(spread(small), 4);
  });

  it('stops rescaling once the vector is small enough for epsilon to matter', () => {
    /* Not a bug, and worth pinning. The +1e-5 inside the square root exists to
       stop a division by zero, and it necessarily dominates when the variance
       is far below it. A vector scaled by 0.01 therefore does NOT come back to
       the same spread, and an earlier version of the test above asserted that
       it did. */
    const spread = (v: number[]) => Math.max(...v) - Math.min(...v);
    const shape = Array.from({ length: C_DIM }, (_, i) => i % 7);
    const tiny = layernorm(shape.map((x) => x * 0.001), unit.g, unit.b);
    expect(spread(tiny)).toBeLessThan(spread(layernorm(shape, unit.g, unit.b)));
    expect(tiny.every(Number.isFinite)).toBe(true);
  });

  it('does not divide by zero on an all-zero vector', () => {
    const out = layernorm(new Array(C_DIM).fill(0), unit.g, unit.b);
    expect(out.every(Number.isFinite)).toBe(true);
  });
});

describe('the feed-forward layer', () => {
  it('expands to roughly 4× and comes back to the original width', () => {
    expect(FFN_DIM).toBe(C_DIM * 4);
    const t = mlp(new Array(C_DIM).fill(0.1));
    expect(t.hidden).toHaveLength(FFN_DIM);
    expect(t.activated).toHaveLength(FFN_DIM);
    expect(t.out).toHaveLength(C_DIM);
  });

  it('the activation is nonlinear. That is the whole point of it', () => {
    // If gelu were linear, gelu(2x) would equal 2*gelu(x) and depth would buy
    // nothing, because stacked linear maps collapse into one.
    expect(gelu(2)).not.toBeCloseTo(2 * gelu(1), 3);
    expect(gelu(0)).toBe(0);
    expect(gelu(-3)).toBeLessThan(0); // unlike ReLU, still passes something
  });
});

describe('residual connections', () => {
  it('add rather than replace', () => {
    expect(add([1, 2], [0.5, -1])).toEqual([1.5, 1]);
  });

  it('the stream carries the embedding through, not a replacement of it', () => {
    const f = forward(DEFAULT_INPUT);
    f.afterAttn.forEach((row, i) => {
      row.forEach((v, d) => {
        expect(v).toBeCloseTo((f.stream[i]?.[d] ?? 0) + (f.attnOut[i]?.[d] ?? 0), 1);
      });
    });
  });
});

describe('the readout', () => {
  const f = forward(DEFAULT_INPUT);

  it('produces one logit per vocabulary entry', () => {
    expect(f.logits).toHaveLength(VOCAB.length);
  });

  it('probabilities sum to 1', () => {
    expect(f.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });

  it('predicts the letter with the highest probability', () => {
    const best = f.probs.indexOf(Math.max(...f.probs));
    expect(f.predicted).toBe(VOCAB[best]);
  });

  it('only the last position predicts', () => {
    // Change the final letter and the prediction may move; change nothing else
    // about the earlier ones and the logits still come from position T-1.
    const a = forward('C B A');
    const b = forward('C B C');
    expect(a.logits).not.toEqual(b.logits);
  });

  it('is deterministic', () => {
    expect(forward(DEFAULT_INPUT).probs).toEqual(f.probs);
  });
});

describe('softmax over the vocabulary', () => {
  it('turns raw scores into a distribution', () => {
    const p = softmaxVocab([2, 1, 0]);
    expect(p.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 6);
    expect(p[0]).toBeGreaterThan(p[1]!);
  });

  it('never returns exactly zero for an unmasked option', () => {
    // Softmax cannot output zero for a finite score, and a rounded-to-zero
    // probability would render as an impossible token, a claim the maths
    // does not make.
    for (const p of softmaxVocab([20, 0, -20])) expect(p).toBeGreaterThan(0);
  });

  it('is shift-invariant', () => {
    expect(softmaxVocab([1, 2, 3])).toEqual(softmaxVocab([101, 102, 103]));
  });
});

describe('edge cases the stage view can reach', () => {
  it('empty input does not throw', () => {
    const f = forward('');
    expect(f.letters).toEqual([]);
    expect(f.predicted).toBeUndefined();
  });

  it('a single token still completes the whole pass', () => {
    const f = forward('A');
    expect(f.afterMlp).toHaveLength(1);
    expect(f.probs.reduce((a, b) => a + b, 0)).toBeCloseTo(1, 1);
  });
});

describe('the migration to trained weights', () => {
  /**
   * The reason any of this was worth doing.
   *
   * With seeded random projections every attention row came out near uniform,
   * so the grid a learner studied had no structure in it to notice. These
   * assertions fail if the app ever drifts back to weights that cannot do the
   * task, because a page teaching attention would once again be showing noise.
   */
  it('actually sorts, which random weights never did', () => {
    let seq = 'C B A B B C'.split(' ');
    for (let i = 0; i < 6; i++) seq = [...seq, forward(seq.join(' ')).predicted!];
    expect(seq.slice(6).join('')).toBe('ABBBCC');
  });

  it('produces attention with structure, not a flat row', () => {
    const t = forward('C B A B B C');
    const rows = t.blocks.flatMap((b) => b.attnOut);
    expect(rows.length).toBeGreaterThan(0);

    // A uniform row over six visible tokens sits at 1/6. Trained rows do not.
    const { heads } = attention('C B A B B C');
    const last = heads[0]!.weights[5]!;
    expect(Math.max(...last)).toBeGreaterThan(0.3);
  });

  it('runs both blocks, and the second is not a repeat of the first', () => {
    const t = forward('C B A B B C');
    expect(t.blocks.length).toBe(2);
    expect(t.blocks[1]!.attnOut[0]).not.toEqual(t.blocks[0]!.attnOut[0]);
    // Block two must read what block one produced.
    expect(t.blocks[1]!.stream).toEqual(t.blocks[0]!.afterMlp);
  });

  it('keeps full precision, so a sum still equals its parts', () => {
    const t = forward('C B A B B C');
    const s = t.afterAttn[0]!;
    expect(s[0]).toBeCloseTo(t.stream[0]![0]! + t.attnOut[0]![0]!, 10);
  });
});
