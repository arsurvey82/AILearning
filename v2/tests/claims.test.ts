/**
 * Derivable-claim validation.
 *
 * design-spec §8 requires that every at-scale figure gets a verification pass.
 * For figures that can be *computed* from a verified config, a citation is the
 * weaker option. The strong one is to recompute the number here and assert the
 * content says it. Then prose and arithmetic cannot drift apart silently.
 *
 * Reference configs in src/content/sources.ts were read from the cited config
 * files on 2026-08-05. If a model's config changes, these tests fail loudly
 * rather than the app quietly teaching a stale number.
 */

import { describe, expect, it } from 'vitest';
import { REFERENCE, SOURCES, headDim, kvBytesPerToken } from '../src/content/sources';
import { NODES, NODES_BY_ID } from '../src/content';
import { CONTEXT, C_DIM, VOCAB, posTable, tokenTable } from '../src/model/toyModel';
import { HEAD_DIM, N_HEADS } from '../src/model/attention';
import type { ConceptNode } from '../src/content/schema';

/** All rendered at-scale text for a node, flattened for substring checks. */
function scaleText(node: ConceptNode | undefined): string {
  return (node?.L3_atScale ?? [])
.map((s) => [s.label, s.here, s.gpt2, s.llama, s.note].filter(Boolean).join(' | '))
.join('\n');
}

/** Everything a reader can see on a node. */
function allText(node: ConceptNode | undefined): string {
  if (!node) return '';
  return [
    node.L0_oneLiner,
    node.L0_analogy ?? '',
    ...(node.L1?.prose ?? []),
    node.L1?.flow?.note ?? '',
    ...node.L2_snags.flatMap((s) => [s.q, s.a]),
    scaleText(node),
    node.L4_underHood ?? '',
  ].join('\n');
}

describe('head width is derived, not asserted', () => {
  it('GPT-2: 768 ÷ 12 = 64', () => {
    expect(headDim(REFERENCE.gpt2)).toBe(64);
    expect(scaleText(NODES_BY_ID['query'])).toContain('64');
  });

  it('Llama-3-8B: 4,096 ÷ 32 = 128', () => {
    expect(headDim(REFERENCE.llama3_8b)).toBe(128);
    expect(scaleText(NODES_BY_ID['query'])).toContain('128');
  });

  it('the toy model partitions its width the same way', () => {
    expect(HEAD_DIM * N_HEADS).toBe(C_DIM);
    expect(allText(NODES_BY_ID['attention'])).toContain(String(HEAD_DIM));
  });
});

describe('KV cache arithmetic', () => {
  const bytes = kvBytesPerToken(REFERENCE.llama3_8b);

  it('is 131,072 bytes. Exactly 128 KiB, per token', () => {
    // 2 (K and V) × 32 layers × 8 KV heads × 128 dims × 2 bytes
    expect(bytes).toBe(131_072);
    expect(bytes / 1024).toBe(128);
  });

  it('the node states every term of that product', () => {
    const t = allText(NODES_BY_ID['kv-cache']);
    for (const term of ['32', '8', '128', '131,072']) {
      expect(t, `missing term ${term}`).toContain(term);
    }
  });

  it('a full Llama-3 context is exactly 1 GiB for one sequence', () => {
    const total = REFERENCE.llama3_8b.context * bytes;
    expect(total).toBe(1024 ** 3);
    expect(scaleText(NODES_BY_ID['kv-cache'])).toContain('1 GiB');
  });

  it('grouped-query attention cuts the cache exactly fourfold', () => {
    const ratio = REFERENCE.llama3_8b.heads / REFERENCE.llama3_8b.kvHeads;
    expect(ratio).toBe(4);
    const withoutGqa = kvBytesPerToken({
...REFERENCE.llama3_8b,
      kvHeads: REFERENCE.llama3_8b.heads,
    });
    expect(withoutGqa / bytes).toBe(4);
    expect(allText(NODES_BY_ID['kv-cache'])).toMatch(/four times larger|fourfold/i);
  });
});

describe('context windows. the figure that was wrong', () => {
  it('Llama 3 is 8,192, not 128,000', () => {
    // Llama 3's config states max_position_embeddings 8192; 128,000 is Llama 3.1.
    expect(REFERENCE.llama3_8b.context).toBe(8192);
  });

  it('no node presents 128,000 as Llama 3 rather than Llama 3.1', () => {
    for (const n of NODES) {
      for (const s of n.L3_atScale) {
        if (s.llama?.includes('128,000')) {
          // Only acceptable if the surrounding note names 3.1 explicitly.
          expect(s.note ?? '', `${n.id}/${s.label}`).toMatch(/3\.1/);
        }
      }
    }
  });

  it('nodes that mention 128,000 attribute it to Llama 3.1', () => {
    for (const n of NODES) {
      const t = scaleText(n);
      if (t.includes('128,000')) {
        expect(t, `${n.id} cites 128,000 without naming 3.1`).toMatch(/3\.1|Llama 3\.1/);
      }
    }
  });
});

describe('parameter and matrix sizes', () => {
  it('the Llama-3 token table is 525,336,576 numbers', () => {
    const cells = REFERENCE.llama3_8b.vocab * REFERENCE.llama3_8b.dim;
    expect(cells).toBe(525_336_576);
    expect(allText(NODES_BY_ID['embedding'])).toContain('525,336,576');
  });

  it('weights at 2 bytes each put an 8B model near 16 GB', () => {
    const gb = (REFERENCE.llama3_8b.params * REFERENCE.llama3_8b.bytesPerValue) / 1e9;
    expect(gb).toBe(16);
    expect(allText(NODES_BY_ID['gpu'])).toContain('16 GB');
  });

  it('the toy model reports its own table sizes correctly', () => {
    expect(tokenTable.length).toBe(VOCAB.length);
    expect(posTable.length).toBe(CONTEXT);
    expect(tokenTable.length * C_DIM).toBe(144);
    expect(allText(NODES_BY_ID['token-id'])).toContain('48');
  });

  it('the two-tables saving is 3 + 11 = 14, not 3 × 11 = 33', () => {
    expect(VOCAB.length + CONTEXT).toBe(14);
    expect(VOCAB.length * CONTEXT).toBe(33);
    const t = allText(NODES_BY_ID['embedding']);
    expect(t).toContain('14');
  });
});

describe('scale divisors', () => {
  it('√64 = 8 and √128 rounds to 11.3', () => {
    expect(Math.sqrt(64)).toBe(8);
    expect(Number(Math.sqrt(128).toFixed(1))).toBe(11.3);
    const t = scaleText(NODES_BY_ID['attention-scores']);
    expect(t).toContain('8');
    expect(t).toContain('11.3');
  });

  it('the toy divisor matches its own head width', () => {
    expect(Number(Math.sqrt(HEAD_DIM).toFixed(2))).toBe(4.9);
  });
});

describe('citations', () => {
  it('every at-scale row with an external figure carries a source', () => {
    const uncited: string[] = [];
    for (const n of NODES) {
      for (const s of n.L3_atScale) {
        const external = [s.gpt2, s.llama].filter(Boolean).join(' ');
        // A row is externally-factual if it makes a numeric claim about a real
        // model. Rows that only compare qualitatively are judgement, not fact.
        if (/\d/.test(external) && !s.source) uncited.push(`${n.id} / ${s.label}`);
      }
    }
    /**
     * A RATCHET, not a pass mark.
     *
     * 82 at-scale rows make a numeric claim about a real system. 27 are cited
     * against a primary source; 55 are not yet. Asserting zero would fail the
     * whole suite and teach everyone to ignore it; asserting nothing would let
     * the backlog grow silently.
     *
     * So: the number may only go DOWN. Adding an uncited numeric row breaks
     * the build. Lower this line each time research clears a batch.
     */
    expect(uncited.length, `uncited numeric rows:\n${uncited.join('\n')}`).toBeLessThanOrEqual(55);
  });

  it('every source that exists points at a real, specific URL', () => {
    for (const n of NODES) {
      for (const s of n.L3_atScale) {
        if (!s.source) continue;
        expect(s.source.url, `${n.id}/${s.label}`).toMatch(/^https:\/\//);
        expect(s.source.label.length, `${n.id}/${s.label}`).toBeGreaterThan(4);
      }
    }
  });

  it('the source registry has no placeholder entries', () => {
    for (const [key, src] of Object.entries(SOURCES)) {
      expect(src.url, key).toMatch(/^https:\/\/[^ ]+\.[^ ]+/);
      expect(src.url, key).not.toMatch(/example\.com|TODO/i);
    }
  });
});
