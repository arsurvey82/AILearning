/**
 * Real numbers for the faces of the scene.
 *
 * Every slab shows the values it actually holds for the current input. The
 * symbolic core computes them; this file only routes them to a block id. A
 * block with no entry here draws as flat colour rather than inventing data.
 */

import { attention } from '../model/attention';
import { embed } from '../model/embedding';
import { forward } from '../model/forward';
import { posTable, tokenTable } from '../model/toyModel';

export type Matrix = readonly (readonly number[])[];

/** Every block that carries live data, keyed by the id `layout.ts` gives it. */
export function sceneValues(input: string): Map<string, Matrix> {
  const m = new Map<string, Matrix>();
  const f = forward(input);
  const a = attention(input);
  const e = embed(input);

  m.set('wte', tokenTable);
  m.set('wpe', posTable);
  m.set('stream-in', e.tokens.map((t) => t.inputVec));
  m.set('norm1', f.normed);
  m.set('attn-out', f.attnOut);
  m.set('add1', f.afterAttn);
  m.set('norm2', f.normed);
  m.set('ffn', f.mlp.map((s) => s.hidden));
  m.set('add2', f.afterMlp);
  m.set('normf', f.finalNorm);
  m.set('logits', [f.logits]);
  m.set('probs', [f.probs]);

  a.heads.forEach((h, i) => {
    m.set(`proj-h${i}-Q`, h.Q);
    m.set(`proj-h${i}-K`, h.K);
    m.set(`proj-h${i}-V`, h.V);
    // Weights rather than raw scores: masked cells read as exact zero, which
    // makes the causal triangle visible on the face.
    m.set(`scores-h${i}`, h.weights);
  });

  return m;
}

/** Largest absolute value, so the colour scale fits the data it is showing. */
export function extent(rows: Matrix): number {
  let max = 0;
  for (const r of rows) for (const v of r) max = Math.max(max, Math.abs(v));
  return max || 1;
}
