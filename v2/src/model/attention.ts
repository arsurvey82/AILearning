/**
 * Attention, over the trained weights.
 *
 * Two changes from the seeded version this replaces, and both matter.
 *
 * The projections are learned rather than random. Random Wq and Wk produce
 * scores with no structure, so every row of the attention grid came out near
 * uniform and a learner studying it was studying noise. Trained ones produce
 * rows that correspond to the task.
 *
 * And the input is normalised first. The trained model is pre-LayerNorm: it
 * runs ln_1 before the projection, so computing Q from the raw embedding would
 * quietly disagree with the weights and give numbers that belong to no model at
 * all. Matching the architecture the weights were trained under is not optional.
 *
 * Nothing here rounds. Rounding inside the model was how a probability below
 * 0.005 once became exactly zero and a bar disappeared; display formats, the
 * model does not.
 */

import { embed, type EmbedResult } from './embedding';
import { C_DIM } from './toyModel';
import weights from './weights.json';

export const N_HEADS = 2;
export const HEAD_DIM = C_DIM / N_HEADS;

/** Every token may look at itself and everything before it, and nothing after. */
export const CAUSAL = true;

interface BlockWeights {
  ln1: { g: number[]; b: number[] };
  attn: { w: number[][]; b: number[] };
  proj: { w: number[][]; b: number[] };
}
const BLOCKS = (weights as unknown as { blocks: BlockWeights[] }).blocks;

/** How many transformer blocks the trained model actually has. */
export const N_LAYERS = BLOCKS.length;

export interface Head {
  index: number;
  /** [C_DIM][HEAD_DIM] slices of the fused projection. */
  Wq: number[][];
  Wk: number[][];
  Wv: number[][];
  bq: number[];
  bk: number[];
  bv: number[];
}

/**
 * Split the fused QKV matrix back into per-head pieces.
 *
 * nanoGPT stores one [C, 3C] matrix because a single multiply is faster than
 * three. Splitting it is presentation, not arithmetic: Q occupies the first C
 * columns, K the next C, V the last, and head h owns a HEAD_DIM-wide stripe of
 * each.
 */
function headsOf(layer: number): Head[] {
  const B = BLOCKS[layer]!;
  const slice = (offset: number, h: number) => ({
    W: B.attn.w.map((row) => row.slice(offset + h * HEAD_DIM, offset + (h + 1) * HEAD_DIM)),
    b: B.attn.b.slice(offset + h * HEAD_DIM, offset + (h + 1) * HEAD_DIM),
  });
  return Array.from({ length: N_HEADS }, (_, h) => {
    const q = slice(0, h);
    const k = slice(C_DIM, h);
    const v = slice(2 * C_DIM, h);
    return { index: h, Wq: q.W, Wk: k.W, Wv: v.W, bq: q.b, bk: k.b, bv: v.b };
  });
}

/** Head weights of the first block, which is what the lessons show by default. */
export const HEADS: readonly Head[] = headsOf(0);

export function dot(a: readonly number[], b: readonly number[]): number {
  let s = 0;
  for (let i = 0; i < a.length; i++) s += a[i]! * (b[i] ?? 0);
  return s;
}

/** Handles -Infinity, which is how a masked pair arrives, and returns exact 0. */
export function softmax(row: readonly number[]): number[] {
  const finite = row.filter((x) => Number.isFinite(x));
  const max = finite.length ? Math.max(...finite) : 0;
  const e = row.map((x) => (Number.isFinite(x) ? Math.exp(x - max) : 0));
  const sum = e.reduce((a, b) => a + b, 0);
  return sum === 0 ? e.map(() => 0) : e.map((x) => x / sum);
}

/** LayerNorm, as GPT-2 and nanoGPT use it. Not RMSNorm: the mean is subtracted. */
export function layernorm(v: readonly number[], g: readonly number[], b: readonly number[]): number[] {
  const mean = v.reduce((a, x) => a + x, 0) / v.length;
  let variance = 0;
  for (const x of v) variance += (x - mean) * (x - mean);
  variance /= v.length;
  const d = Math.sqrt(variance + 1e-5);
  return v.map((x, i) => ((x - mean) / d) * g[i]! + b[i]!);
}

function project(v: readonly number[], W: number[][], b: readonly number[]): number[] {
  return b.map((bias, j) => {
    let s = bias;
    for (let i = 0; i < v.length; i++) s += v[i]! * W[i]![j]!;
    return s;
  });
}

export interface HeadResult {
  head: number;
  /** Per token: its query vector. */
  Q: number[][];
  K: number[][];
  V: number[][];
  /** [T][T] raw scaled scores; -Infinity where masked. */
  scores: number[][];
  /** [T][T] attention percentages; rows sum to 1, masked entries exactly 0. */
  weights: number[][];
  /** [T][HEAD_DIM] the blended values each token walks away with. */
  out: number[][];
}

export interface AttentionResult {
  embedding: EmbedResult;
  letters: string[];
  /** What the projections actually read: the embedding, normalised. */
  normed: number[][];
  heads: HeadResult[];
  /** sqrt(HEAD_DIM) - the divisor that keeps scores in a sane range. */
  scale: number;
  /** Which block these came from. */
  layer: number;
}

export function attention(raw: string, layer = 0): AttentionResult {
  const embedding = embed(raw);
  const B = BLOCKS[layer]!;
  const letters = embedding.tokens.map((t) => t.letter);
  // Pre-LayerNorm: the projections read the normalised stream, not the raw one.
  const normed = embedding.tokens.map((t) => layernorm(t.inputVec, B.ln1.g, B.ln1.b));
  const T = normed.length;
  const scale = Math.sqrt(HEAD_DIM);

  const heads: HeadResult[] = headsOf(layer).map((h) => {
    const Q = normed.map((x) => project(x, h.Wq, h.bq));
    const K = normed.map((x) => project(x, h.Wk, h.bk));
    const V = normed.map((x) => project(x, h.Wv, h.bv));

    const scores: number[][] = [];
    for (let i = 0; i < T; i++) {
      const row: number[] = [];
      for (let j = 0; j < T; j++) {
        if (CAUSAL && j > i) row.push(-Infinity);
        else row.push(dot(Q[i]!, K[j]!) / scale);
      }
      scores.push(row);
    }

    const weights = scores.map((row) => softmax(row));
    const out = weights.map((w) => {
      const acc = new Array<number>(HEAD_DIM).fill(0);
      for (let j = 0; j < T; j++) {
        const wj = w[j]!;
        if (wj === 0) continue;
        for (let d = 0; d < HEAD_DIM; d++) acc[d]! += wj * V[j]![d]!;
      }
      return acc;
    });

    return { head: h.index, Q, K, V, scores, weights, out };
  });

  return { embedding, letters, normed, heads, scale, layer };
}
