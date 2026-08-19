/**
 * The forward pass, over real trained weights.
 *
 * This replaces the seeded-random toy. CLAUDE.md section 6 asked for trained
 * nanoGPT weights and the reason matters: with random projections, attention
 * comes out flat, near 20% everywhere, so the picture a learner studies has no
 * structure in it and nothing to explain. Trained weights produce lopsided rows
 * that correspond to the task, which is the whole point of showing attention.
 *
 * Architecture is nanoGPT and nothing here is invented:
 *   learned token and position embeddings, pre-LayerNorm blocks, causal
 *   attention with a fused QKV projection, a 4x GELU feed-forward (optionally a
 *   mixture of experts), final LayerNorm, and a head tied to the token
 *   embedding.
 *
 * Every intermediate is kept rather than just the output. The app needs to draw
 * the middle of the pass, and a trace that only reports the answer cannot be
 * checked against the reference implementation either.
 *
 * Verified against tools/make_fixtures.py, which reimplements the same
 * arithmetic in numpy from the same JSON. Two independent paths agreeing is a
 * much stronger claim than one path agreeing with itself.
 */

/* ------------------------------------------------------------------ types */

export interface Norm {
  g: number[];
  b: number[];
}
export interface Linear {
  /** [in][out], already transposed on export so a plain dot product works. */
  w: number[][];
  b?: number[];
}
export interface Expert {
  fc: Linear;
  down: Linear;
}
export interface BlockWeights {
  ln1: Norm;
  attn: Linear;
  proj: Linear;
  ln2: Norm;
  /** Dense feed-forward. Absent when this block is a mixture of experts. */
  fc?: Linear;
  down?: Linear;
  /** Mixture of experts. Absent when this block is dense. */
  gate?: Linear;
  experts?: Expert[];
}
export interface Weights {
  note: string;
  vocab: string[];
  n_embd: number;
  n_head: number;
  n_layer: number;
  block_size: number;
  head_dim: number;
  ffn: number;
  n_expert?: number;
  top_k?: number;
  wte: number[][];
  wpe: number[][];
  ln_f: Norm;
  blocks: BlockWeights[];
}

export interface HeadTrace {
  /** [T][T]. null where the causal mask blocks the pair. */
  scores: (number | null)[][];
  /** [T][T]. Rows sum to 1; masked entries are exactly 0. */
  weights: number[][];
  /** [T][head_dim]. */
  out: number[][];
}
export interface RoutePick {
  e: number;
  w: number;
}
export interface LayerTrace {
  norm1: number[][];
  Q: number[][];
  K: number[][];
  V: number[][];
  heads: HeadTrace[];
  attnOut: number[][];
  afterAttn: number[][];
  norm2: number[][];
  /** Dense only: the wide interior, one row per token. */
  hidden?: number[][];
  /** Mixture of experts only: which experts each token was sent to. */
  route?: RoutePick[][];
  down: number[][];
  afterMlp: number[][];
}
export interface Trace {
  tokens: string[];
  ids: number[];
  /** How many tokens fell out of the context window, if any. */
  dropped: number;
  embed: number[][];
  layers: LayerTrace[];
  finalNorm: number[][];
  logits: number[];
  probs: number[];
  predicted: string;
}

/* -------------------------------------------------------------- primitives */

/** v (length in) times W [in][out], plus optional bias. */
function matvec(v: readonly number[], m: Linear): number[] {
  const out = new Array<number>(m.w[0]!.length);
  for (let j = 0; j < out.length; j++) {
    let s = m.b ? m.b[j]! : 0;
    for (let i = 0; i < v.length; i++) s += v[i]! * m.w[i]![j]!;
    out[j] = s;
  }
  return out;
}

/**
 * LayerNorm, as GPT-2 and nanoGPT use it.
 *
 * Note this is not RMSNorm. The two differ by whether the mean is subtracted,
 * and swapping one for the other silently changes every number downstream, so
 * it has to match whatever the weights were trained with.
 */
export function layernorm(v: readonly number[], n: Norm): number[] {
  const mean = v.reduce((a, x) => a + x, 0) / v.length;
  let variance = 0;
  for (const x of v) variance += (x - mean) * (x - mean);
  variance /= v.length;
  const d = Math.sqrt(variance + 1e-5);
  return v.map((x, i) => ((x - mean) / d) * n.g[i]! + n.b[i]!);
}

export const gelu = (x: number): number =>
  0.5 * x * (1 + Math.tanh(Math.sqrt(2 / Math.PI) * (x + 0.044715 * x ** 3)));

export function softmax(xs: readonly number[]): number[] {
  if (!xs.length) return [];
  const max = Math.max(...xs);
  const e = xs.map((x) => Math.exp(x - max));
  const sum = e.reduce((a, b) => a + b, 0);
  return sum === 0 ? e.map(() => 0) : e.map((x) => x / sum);
}

/* ------------------------------------------------------------------ pass */

export interface ForwardOptions {
  /**
   * Keep only the most recent block_size tokens.
   *
   * Not a nicety. The position table has exactly block_size rows, so a longer
   * sequence has no row to look up and the pass throws. Real models hit the
   * same wall; this is the context limit, and it is a hard edge.
   */
  window?: boolean;
}

export function forward(
  W: Weights,
  tokens: readonly string[],
  opts: ForwardOptions = {},
): Trace {
  const all = tokens.slice();
  const kept = opts.window === false ? all : all.slice(-W.block_size);
  if (kept.length > W.block_size) {
    throw new Error(`sequence of ${kept.length} exceeds block_size ${W.block_size}`);
  }

  const ids = kept.map((t) => {
    const i = W.vocab.indexOf(t);
    if (i < 0) throw new Error(`token not in vocabulary: ${t}`);
    return i;
  });
  const T = ids.length;
  const C = W.n_embd;
  const HD = W.head_dim;

  let x: number[][] = ids.map((id, t) => W.wte[id]!.map((v, d) => v + W.wpe[t]![d]!));
  const trace: Trace = {
    tokens: kept,
    ids,
    dropped: all.length - kept.length,
    embed: x.map((r) => r.slice()),
    layers: [],
    finalNorm: [],
    logits: [],
    probs: [],
    predicted: '',
  };

  for (const B of W.blocks) {
    const norm1 = x.map((r) => layernorm(r, B.ln1));
    const qkv = norm1.map((r) => matvec(r, B.attn));
    const Q = qkv.map((r) => r.slice(0, C));
    const K = qkv.map((r) => r.slice(C, 2 * C));
    const V = qkv.map((r) => r.slice(2 * C));

    const heads: HeadTrace[] = [];
    const merged: number[][] = Array.from({ length: T }, () => new Array<number>(C).fill(0));

    for (let h = 0; h < W.n_head; h++) {
      const lo = h * HD;
      const hi = lo + HD;
      const q = Q.map((r) => r.slice(lo, hi));
      const k = K.map((r) => r.slice(lo, hi));
      const v = V.map((r) => r.slice(lo, hi));

      const scores: (number | null)[][] = q.map((qi, i) =>
        k.map((kj, j) => {
          if (j > i) return null; // causal mask: no token may see ahead
          let s = 0;
          for (let d = 0; d < HD; d++) s += qi[d]! * kj[d]!;
          return s / Math.sqrt(HD);
        }),
      );

      // Masked entries become exactly zero rather than something very small,
      // which is what makes the causal triangle visible instead of merely faint.
      const weights = scores.map((row) => {
        const finite = row.map((s) => (s === null ? -1e9 : s));
        const p = softmax(finite);
        return p.map((val, j) => (row[j] === null ? 0 : val));
      });

      const out = weights.map((w) => {
        const acc = new Array<number>(HD).fill(0);
        for (let j = 0; j < T; j++) {
          const wj = w[j]!;
          if (wj === 0) continue;
          for (let d = 0; d < HD; d++) acc[d]! += wj * v[j]![d]!;
        }
        return acc;
      });

      out.forEach((r, t) => r.forEach((val, d) => (merged[t]![lo + d] = val)));
      heads.push({ scores, weights, out });
    }

    const attnOut = merged.map((r) => matvec(r, B.proj));
    x = x.map((r, t) => r.map((v, d) => v + attnOut[t]![d]!));
    const afterAttn = x.map((r) => r.slice());
    const norm2 = x.map((r) => layernorm(r, B.ln2));

    let down: number[][];
    let hidden: number[][] | undefined;
    let route: RoutePick[][] | undefined;

    if (B.experts && B.gate) {
      // Mixture of experts. The router scores every expert, the top k run, and
      // the rest are skipped entirely, which is how total size and cost per
      // token stop being the same number.
      const k = W.top_k ?? 2;
      route = norm2.map((r) => {
        const g = matvec(r, B.gate!);
        const ranked = g
          .map((val, i) => ({ val, i }))
          .sort((a, b) => b.val - a.val)
          .slice(0, k);
        const gw = softmax(ranked.map((p) => p.val));
        return ranked.map((p, j) => ({ e: p.i, w: gw[j]! }));
      });
      down = norm2.map((r, t) => {
        const acc = new Array<number>(C).fill(0);
        for (const pick of route![t]!) {
          const E = B.experts![pick.e]!;
          const h = matvec(r, E.fc).map(gelu);
          const o = matvec(h, E.down);
          for (let d = 0; d < C; d++) acc[d]! += pick.w * o[d]!;
        }
        return acc;
      });
    } else if (B.fc && B.down) {
      hidden = norm2.map((r) => matvec(r, B.fc!).map(gelu));
      down = hidden.map((r) => matvec(r, B.down!));
    } else {
      throw new Error('block has neither a dense feed-forward nor experts');
    }

    x = x.map((r, t) => r.map((v, d) => v + down[t]![d]!));
    trace.layers.push({
      norm1,
      Q,
      K,
      V,
      heads,
      attnOut,
      afterAttn,
      norm2,
      ...(hidden ? { hidden } : {}),
      ...(route ? { route } : {}),
      down,
      afterMlp: x.map((r) => r.slice()),
    });
  }

  trace.finalNorm = x.map((r) => layernorm(r, W.ln_f));
  const last = trace.finalNorm[T - 1]!;
  // The head is tied to the token embedding, so predicting is a comparison
  // against every row of the same table the input was looked up in.
  trace.logits = W.wte.map((row) => {
    let s = 0;
    for (let d = 0; d < C; d++) s += last[d]! * row[d]!;
    return s;
  });
  trace.probs = softmax(trace.logits);
  trace.predicted = W.vocab[trace.probs.indexOf(Math.max(...trace.probs))]!;
  return trace;
}

/** Run the pass repeatedly, appending each prediction. This is generation. */
export function generate(W: Weights, prompt: readonly string[], n: number): string[] {
  const seq = prompt.slice();
  for (let i = 0; i < n; i++) seq.push(forward(W, seq).predicted);
  return seq.slice(prompt.length);
}

/** Parameters that exist, and parameters that actually run for one token. */
export function paramCounts(W: Weights): { total: number; active: number } {
  const sizeOf = (l: Linear) => l.w.length * l.w[0]!.length + (l.b?.length ?? 0);
  let total = W.wte.length * W.n_embd + W.wpe.length * W.n_embd + W.ln_f.g.length * 2;
  let skipped = 0;
  for (const B of W.blocks) {
    total += B.ln1.g.length * 2 + B.ln2.g.length * 2 + sizeOf(B.attn) + sizeOf(B.proj);
    if (B.experts && B.gate) {
      total += sizeOf(B.gate);
      const per = sizeOf(B.experts[0]!.fc) + sizeOf(B.experts[0]!.down);
      total += per * B.experts.length;
      skipped += per * (B.experts.length - (W.top_k ?? 2));
    } else if (B.fc && B.down) {
      total += sizeOf(B.fc) + sizeOf(B.down);
    }
  }
  return { total, active: total - skipped };
}
