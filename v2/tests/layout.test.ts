/**
 * The scene claims to be drawn at true proportions. That is a factual claim
 * about the picture, so it is tested like one.
 *
 * If these pass, a reader who sees the MLP block as four times wider than the
 * stream is seeing something true about the model, not an artistic decision.
 */

import { describe, expect, it } from 'vitest';
import { blocksForStage, boundsOf, buildLayout } from '../src/scene/layout';
import { C_DIM, CONTEXT, VOCAB } from '../src/model/toyModel';
import { HEAD_DIM, N_HEADS } from '../src/model/attention';
import { FFN_DIM } from '../src/model/forward';
import { FORWARD_PASS } from '../src/content';

const T = 6;
const L = buildLayout(T);
const by = (id: string) => L.blocks.find((b) => b.id === id)!;

describe('scene layout', () => {
  it('draws the stream at the model\'s real width', () => {
    expect(by('stream-in').cols).toBe(C_DIM);
    expect(by('stream-in').rows).toBe(T);
  });

  it('makes the MLP exactly as much wider as it really is', () => {
    expect(by('ffn').cols).toBe(FFN_DIM);
    expect(by('ffn').cols / by('stream-in').cols).toBe(FFN_DIM / C_DIM);
  });

  it('makes each head narrower than the stream, by the real ratio', () => {
    expect(by('proj-h0-Q').cols).toBe(HEAD_DIM);
    expect(by('proj-h0-Q').cols * N_HEADS).toBe(C_DIM);
  });

  it('gives every head its own Q, K and V', () => {
    for (let h = 0; h < N_HEADS; h++) {
      for (const n of ['Q', 'K', 'V']) expect(by(`proj-h${h}-${n}`)).toBeTruthy();
    }
  });

  it('draws the attention matrices square, because they are', () => {
    const s = by('scores-h0');
    expect(s.cols).toBe(T);
    expect(s.rows).toBe(T);
  });

  it('shows the vocabulary as the tiny thing it is here', () => {
    expect(by('logits').cols).toBe(VOCAB.length);
    expect(by('unembed').rows).toBe(VOCAB.length);
    // The honest punchline of the whole diagram: 48 wide in, 3 wide out.
    expect(by('unembed').cols).toBe(C_DIM);
  });

  it('sizes the position table by the context length, not the input length', () => {
    expect(by('wpe').rows).toBe(CONTEXT);
    expect(by('wte').rows).toBe(VOCAB.length);
  });

  it('follows the input length. A longer sequence is a taller scene', () => {
    const a = buildLayout(3);
    const b = buildLayout(9);
    expect(b.bounds.h).toBeGreaterThan(a.bounds.h);
    expect(a.blocks.find((x) => x.id === 'stream-in')!.rows).toBe(3);
  });

  it('stacks downward without any two blocks overlapping vertically', () => {
    // Side-by-side blocks share a y, so compare distinct rows only.
    const rows = new Map<number, number>();
    for (const b of L.blocks) rows.set(b.y, Math.max(rows.get(b.y) ?? 0, b.rows));
    const ys = [...rows.keys()].sort((p, q) => p - q);
    for (let i = 1; i < ys.length; i++) {
      expect(ys[i]!).toBeGreaterThanOrEqual(ys[i - 1]! + rows.get(ys[i - 1]!)!);
    }
  });

  it('gives every stage of the pass somewhere to fly to', () => {
    for (const stage of FORWARD_PASS) {
      expect(blocksForStage(L, stage).length, stage).toBeGreaterThan(0);
    }
  });

  it('boundsOf covers everything it is given', () => {
    const b = boundsOf([by('wte'), by('wpe')]);
    expect(b.w).toBeGreaterThanOrEqual(C_DIM * 2);
    expect(b.h).toBe(CONTEXT);
  });
});
