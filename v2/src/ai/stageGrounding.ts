/**
 * Grounding for the step-by-step narration, the real trace, as text.
 *
 * The request was "connect the LLM to the animation and run it step by step,
 * showing how Q/K/V works." The thing to be careful about is *which* part the
 * model is allowed to do.
 *
 * It does not compute anything. Q, K, V, the scaled scores, the softmax rows
 * and the blended outputs are all produced by `/src/model`, which is plain
 * deterministic TypeScript and is the source of truth (CLAUDE.md §2). This file
 * takes that finished trace and writes it down. The model's only job is to say
 * what those numbers mean, in the reader's terms.
 *
 * That distinction is the whole safety story: an LLM asked to "show how QKV
 * works" will happily invent a plausible matrix, and a learner has no way to
 * tell an invented 0.41 from a real one. So the numbers arrive pre-computed and
 * the system prompt forbids deriving new ones.
 */

import { attention } from '../model/attention';
import { forward } from '../model/forward';
import { embed } from '../model/embedding';

/** Rows are truncated because a 48-wide vector teaches nothing extra here and costs tokens. */
const WIDE = 6;

function vec(v: readonly number[], width = WIDE): string {
  const shown = v.slice(0, width).map((x) => x.toFixed(2)).join(', ');
  return `[${shown}${v.length > width ? `, … (${v.length} values)` : ''}]`;
}

function matrix(rows: readonly (readonly number[])[], labels: readonly string[]): string[] {
  return rows.map((r, i) => `    ${labels[i] ?? i}: ${vec(r)}`);
}

/**
 * What is actually on screen at this stage of the pass, as verified text.
 *
 * Returns undefined for stages with no numeric state of their own, rather than
 * inventing filler. The caller then grounds on the node's authored content
 * alone, which is the honest fallback.
 */
export function stageGrounding(stageId: string, input: string): string | undefined {
  const l: string[] = [];

  switch (stageId) {
    case 'tokenization':
    case 'token-id': {
      const e = embed(input);
      l.push('LIVE STATE. The input as the model now holds it:');
      l.push(`  Input text: "${input}"`);
      l.push(`  Pieces: ${e.tokens.map((t) => t.letter).join(' ')}`);
      l.push(`  Token IDs: ${e.tokens.map((t) => t.tokenId).join(', ')}`);
      l.push(`  Seats (positions): ${e.tokens.map((_, i) => i).join(', ')}`);
      break;
    }

    case 'embedding': {
      const e = embed(input);
      l.push('LIVE STATE, each token as a vector, token table plus position table:');
      for (const t of e.tokens.slice(0, 3)) {
        l.push(`  "${t.letter}" at seat ${t.seat} (token id ${t.tokenId}):`);
        l.push(`    from the token table: ${vec(t.tokenVec)}`);
        l.push(`    from the position table: ${vec(t.posVec)}`);
        l.push(`    their sum, which is what moves on: ${vec(t.inputVec)}`);
      }
      if (e.tokens.length > 3) l.push(`  … and ${e.tokens.length - 3} more tokens, same construction.`);
      break;
    }

    case 'attention': {
      const a = attention(input);
      const h = a.heads[0];
      if (!h) break;
      l.push('LIVE STATE. Attention, head 1 of ' + a.heads.length + ':');
      l.push(`  Tokens: ${a.letters.join(' ')}`);
      l.push(`  Scores are divided by ${a.scale.toFixed(2)} (the square root of the head width).`);
      l.push('  Q, each token\'s query, "what am I looking for":');
      l.push(...matrix(h.Q, a.letters));
      l.push('  K, each token\'s key, "what I offer to whoever looks":');
      l.push(...matrix(h.K, a.letters));
      l.push('  V, each token\'s value, "what gets carried away if I am chosen":');
      l.push(...matrix(h.V, a.letters));
      l.push('  Attention weights, one row per looking token (rows sum to 1;');
      l.push('  zeros to the right of the diagonal are the causal mask, not small numbers):');
      h.weights.forEach((row, i) => {
        const cells = row.map((w, j) => `${a.letters[j]}${j}=${w.toFixed(2)}`).join('  ');
        l.push(`    ${a.letters[i]}${i} looks at → ${cells}`);
      });
      l.push('  Output, each token\'s blended value vector after the weighted sum of V:');
      l.push(...matrix(h.out, a.letters));
      break;
    }

    case 'mlp':
    case 'residual':
    case 'normalization': {
      const f = forward(input);
      const last = f.letters.length - 1;
      l.push(`LIVE STATE. The residual stream at the last token ("${f.letters[last]}", seat ${last}):`);
      l.push(`  Entering the block (after embedding): ${vec(f.stream[last] ?? [])}`);
      l.push(`  What attention contributed: ${vec(f.attnOut[last] ?? [])}`);
      l.push(`  After adding it back to the stream: ${vec(f.afterAttn[last] ?? [])}`);
      l.push(`  After normalising, which is what the MLP reads: ${vec(f.normed[last] ?? [])}`);
      l.push(`  What the MLP contributed: ${vec(f.mlp[last]?.out ?? [])}`);
      l.push(`  The block's output, after adding that back: ${vec(f.afterMlp[last] ?? [])}`);
      break;
    }

    case 'unembedding':
    case 'logits':
    case 'softmax':
    case 'sampling':
    case 'the-loop': {
      const f = forward(input);
      const last = f.letters.length - 1;
      l.push('LIVE STATE. Turning the last token\'s vector into a prediction:');
      l.push(`  The vector being read from: ${vec(f.finalNorm[last] ?? [])}`);
      l.push(`  One raw score (logit) per vocabulary entry: ${f.logits.map((x, i) => `${'ABC'[i]}=${x.toFixed(2)}`).join('  ')}`);
      l.push(`  After softmax, as probabilities: ${f.probs.map((p, i) => `${'ABC'[i]}=${(p * 100).toFixed(1)}%`).join('  ')}`);
      l.push(`  Highest-probability next token: ${f.predicted ?? 'none'}`);
      break;
    }

    default:
      return undefined;
  }

  if (!l.length) return undefined;

  l.push('');
  l.push(
    'These values were computed by the lesson\'s own deterministic code for the current input. They are correct as given. Quote them; do not recompute, round differently, or derive new ones.',
  );
  return l.join('\n');
}
