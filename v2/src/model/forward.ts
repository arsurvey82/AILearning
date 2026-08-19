/**
 * The rest of the forward pass, over the trained weights.
 *
 * What changed in the migration, and why none of it was optional:
 *
 *   RMSNorm became LayerNorm. The old code used a Llama-ism while the lessons
 *   around it claimed GPT-2 lineage. The two differ by whether the mean is
 *   subtracted, so running the wrong one over these weights produces numbers
 *   that belong to no model at all.
 *
 *   SiLU became GELU, for the same reason.
 *
 *   One block became two, because the model that learned to sort has two, and
 *   a second block that re-read the raw embedding would be a duplicate of the
 *   first rather than a continuation of it.
 *
 *   Nothing rounds. Rounding inside the model is how a probability below 0.005
 *   once became exactly zero and a bar vanished from the screen. Display
 *   formats; the model keeps what it computed.
 *
 * The flat fields on the trace describe block one, because that is what the
 * lessons walk through. `blocks` carries both, and the prediction is taken
 * after all of them, which is the only correct place to take it.
 */

import { attention, HEAD_DIM, layernorm } from './attention';
import { C_DIM, VOCAB, tokenTable, type Letter } from './toyModel';
import trained from './weights.json';

interface Lin {
  w: number[][];
  b: number[];
}
interface Blk {
  ln2: { g: number[]; b: number[] };
  proj: Lin;
  fc: Lin;
  down: Lin;
}
const W = trained as unknown as { blocks: Blk[]; ln_f: { g: number[]; b: number[] } };

/** Four times the width of the stream, which is where most facts are stored. */
export const FFN_DIM = W.blocks[0]!.fc.w[0]!.length;

/** How many transformer blocks the trained model has. */
export const N_LAYERS = W.blocks.length;

export { layernorm };

/** GELU, the curve nanoGPT and GPT-2 use. Smooth, and it lets a little through below zero. */
export function gelu(z: number): number {
  return 0.5 * z * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (z + 0.044715 * z ** 3)));
}

export function add(a: readonly number[], b: readonly number[]): number[] {
  return a.map((v, i) => v + (b[i] ?? 0));
}

function matvec(v: readonly number[], m: Lin): number[] {
  return m.b.map((bias, j) => {
    let s = bias;
    for (let i = 0; i < v.length; i++) s += v[i]! * m.w[i]![j]!;
    return s;
  });
}

export interface MlpTrace {
  hidden: number[];
  activated: number[];
  out: number[];
}

/** Expand, bend, contract. The curve is why depth buys anything. */
export function mlp(v: readonly number[], layer = 0): MlpTrace {
  const B = W.blocks[layer]!;
  const hidden = matvec(v, B.fc);
  const activated = hidden.map(gelu);
  return { hidden, activated, out: matvec(activated, B.down) };
}

/**
 * Softmax over the vocabulary. Deliberately unrounded: a two-decimal round here
 * once turned every probability below 0.005 into exactly zero, and the bar it
 * fed rendered as nothing at all.
 */
export function softmaxVocab(logits: readonly number[]): number[] {
  const max = logits.length ? Math.max(...logits) : 0;
  const e = logits.map((l) => Math.exp(l - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return sum === 0 ? e.map(() => 0) : e.map((x) => x / sum);
}

export interface BlockTrace {
  layer: number;
  /** What entered this block. */
  stream: number[][];
  /** Concatenated heads, projected by Wo. */
  attnOut: number[][];
  /** stream + attnOut. */
  afterAttn: number[][];
  /** LayerNorm of afterAttn, which is what the MLP reads. */
  normed: number[][];
  mlp: MlpTrace[];
  /** afterAttn + mlp.out, the block's output. */
  afterMlp: number[][];
}

export interface ForwardTrace extends Omit<BlockTrace, 'layer'> {
  letters: Letter[];
  /** Every block, in order. The flat fields above mirror the first. */
  blocks: BlockTrace[];
  finalNorm: number[][];
  /** One raw score per vocabulary entry, from the LAST position. */
  logits: number[];
  probs: number[];
  predicted?: Letter;
}

function runBlock(stream: number[][], layer: number, raw: string): BlockTrace {
  const B = W.blocks[layer]!;
  const att = attention(raw, layer);
  const T = stream.length;

  /* Concatenate the heads side by side, then one learned projection. Without
     Wo the heads would sit in fixed disjoint slices and nothing could combine
     what two different heads found. */
  const concat: number[][] = [];
  for (let i = 0; i < T; i++) {
    const parts: number[] = [];
    for (const h of att.heads) parts.push(...(h.out[i] ?? new Array<number>(HEAD_DIM).fill(0)));
    concat.push(parts);
  }
  const attnOut = concat.map((c) => matvec(c, B.proj));
  const afterAttn = stream.map((x, i) => add(x, attnOut[i] ?? []));
  const normed = afterAttn.map((v) => layernorm(v, B.ln2.g, B.ln2.b));
  const traces: MlpTrace[] = normed.map((v) => mlp(v, layer));
  const afterMlp = afterAttn.map((x, i) => add(x, traces[i]?.out ?? []));

  return { layer, stream, attnOut, afterAttn, normed, mlp: traces, afterMlp };
}

export function forward(input: string): ForwardTrace {
  const att0 = attention(input, 0);
  const letters = att0.embedding.tokens.map((t) => t.letter);
  let stream = att0.embedding.tokens.map((t) => t.inputVec);

  const blocks: BlockTrace[] = [];
  for (let l = 0; l < N_LAYERS; l++) {
    const b = runBlock(stream, l, input);
    blocks.push(b);
    stream = b.afterMlp;
  }

  const finalNorm = stream.map((v) => layernorm(v, W.ln_f.g, W.ln_f.b));
  const T = finalNorm.length;

  // Only the last position predicts. Weight tying: the same token table, used
  // transposed, turns a vector back into one score per vocabulary slot.
  const last = finalNorm[T - 1] ?? [];
  const logits = tokenTable.map((row) => {
    let s = 0;
    for (let d = 0; d < C_DIM; d++) s += (row[d] ?? 0) * (last[d] ?? 0);
    return s;
  });
  const probs = softmaxVocab(logits);

  let best = 0;
  probs.forEach((p, i) => {
    if (p > (probs[best] ?? 0)) best = i;
  });

  const first = blocks[0]!;
  return {
    letters,
    ...first,
    blocks,
    finalNorm,
    logits,
    probs,
    ...(T > 0 ? { predicted: VOCAB[best] } : {}),
  };
}
