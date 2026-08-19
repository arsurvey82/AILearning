/**
 * The whole model, laid out in space, at true proportions.
 *
 * This is the part of bbycroft that actually does the teaching, and it is not
 * the drawings. It is that there is only ever ONE scene. The model sits in
 * space, every tensor drawn at its real size, and the camera flies to whatever
 * you are looking at. Nothing appears or disappears. You cannot lose your place
 * because the place never changes, which is the opposite of a slideshow, where
 * every step silently asks "where did the last thing go?"
 *
 * So this file is pure geometry, derived entirely from the model constants. If
 * C_DIM changes, the picture changes. Nothing here is a hand-drawn impression
 * of a transformer: the MLP block is four times wider than the stream because
 * FFN_DIM really is 4 × C_DIM, and the vocabulary strip is nearly invisible
 * beside it because a 3-letter vocabulary really is that small.
 *
 * Units are cells. One cell = one number. Blocks are centred on x = 0 and
 * stack downward, so the residual stream reads as a spine.
 */

import { C_DIM, CONTEXT, VOCAB } from '../model/toyModel';
import { HEAD_DIM, N_HEADS } from '../model/attention';
import { FFN_DIM } from '../model/forward';

/** Vertical space between stacked blocks, in cells. */
const GAP = 6;
/** Extra space where the diagram crosses into a new phase. */
const PHASE_GAP = 14;
/** Horizontal space between blocks that sit side by side (the heads). */
const SIDE_GAP = 8;

export type BlockKind =
  | 'token' // discrete input/output symbols
  | 'table' // a learned lookup table
  | 'stream' // the residual stream: T × C_DIM
  | 'proj' // a per-head projection
  | 'square' // a T × T attention matrix
  | 'wide' // the MLP interior
  | 'weights' // a learned weight matrix
  | 'score'; // logits / probabilities

export interface Block {
  id: string;
  label: string;
  /** What it is, in the reader's terms. Drawn when there is room. */
  note?: string;
  kind: BlockKind;
  /** Top-left corner, in cells. */
  x: number;
  y: number;
  /** Size in cells. Cols × rows is the real number count. */
  cols: number;
  rows: number;
  /** Which forward-pass stage(s) light this block up. */
  stages: string[];
}

export interface SceneLayout {
  blocks: Block[];
  /** Bounding box of everything, in cells. */
  bounds: { x: number; y: number; w: number; h: number };
  /** Ordered ids, for drawing the connections between blocks. */
  chain: string[];
}

/** Centre a block of `cols` width on the spine. */
function cx(cols: number): number {
  return -cols / 2;
}

/**
 * Build the scene for a sequence of length T.
 *
 * T is the only input because it is the only thing the reader can change. Every
 * other dimension comes from the model itself.
 */
export function buildLayout(T: number): SceneLayout {
  const blocks: Block[] = [];
  let y = 0;

  const push = (b: Omit<Block, 'x' | 'y'> & { x?: number; y?: number }) => {
    const block: Block = { ...b, x: b.x ?? cx(b.cols), y: b.y ?? y } as Block;
    blocks.push(block);
    return block;
  };

  // --- Input -------------------------------------------------------------
  push({
    id: 'tokens',
    label: 'Input tokens',
    note: `${T} pieces, each one symbol`,
    kind: 'token',
    cols: T,
    rows: 1,
    stages: ['tokenization', 'token-id', 'the-loop'],
  });
  y += 1 + GAP;

  // --- Embedding ---------------------------------------------------------
  // The two tables sit side by side because the whole point of the Embedding
  // lesson is that they are separate and indexed by different things.
  const tokTableW = C_DIM;
  const posTableW = C_DIM;
  const pairW = tokTableW + SIDE_GAP + posTableW;
  push({
    id: 'wte',
    label: 'Token table',
    note: `${VOCAB.length} × ${C_DIM}, one row per symbol`,
    kind: 'table',
    x: -pairW / 2,
    y,
    cols: tokTableW,
    rows: VOCAB.length,
    stages: ['embedding'],
  });
  push({
    id: 'wpe',
    label: 'Position table',
    note: `${CONTEXT} × ${C_DIM}, one row per seat`,
    kind: 'table',
    x: -pairW / 2 + tokTableW + SIDE_GAP,
    y,
    cols: posTableW,
    rows: CONTEXT,
    stages: ['embedding'],
  });
  y += Math.max(VOCAB.length, CONTEXT) + GAP;

  push({
    id: 'stream-in',
    label: 'Residual stream',
    note: `${T} × ${C_DIM}. The tokens as vectors, token + position`,
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['embedding', 'residual'],
  });
  y += T + PHASE_GAP;

  // --- Attention ---------------------------------------------------------
  push({
    id: 'norm1',
    label: 'RMSNorm',
    note: 'rescaled, same shape',
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['normalization'],
  });
  y += T + GAP;

  // Q, K and V for every head, side by side. Seeing six narrow blocks where
  // the stream was one wide one is the fact that "each head is half as wide".
  const projRow = N_HEADS * 3;
  const projTotal = projRow * HEAD_DIM + (projRow - 1) * (SIDE_GAP / 2);
  for (let h = 0; h < N_HEADS; h++) {
    for (const [k, name] of (['Q', 'K', 'V'] as const).entries()) {
      const i = h * 3 + k;
      push({
        id: `proj-h${h}-${name}`,
        label: `${name}${N_HEADS > 1 ? ` · head ${h + 1}` : ''}`,
        note: `${T} × ${HEAD_DIM}`,
        kind: 'proj',
        x: -projTotal / 2 + i * (HEAD_DIM + SIDE_GAP / 2),
        y,
        cols: HEAD_DIM,
        rows: T,
        stages: ['attention'],
      });
    }
  }
  y += T + GAP;

  // The T × T matrices. The only square things in the model, and the reason
  // cost grows with the square of the sequence.
  const sqTotal = N_HEADS * T + (N_HEADS - 1) * SIDE_GAP;
  for (let h = 0; h < N_HEADS; h++) {
    push({
      id: `scores-h${h}`,
      label: `Scores · head ${h + 1}`,
      note: `${T} × ${T}, every token against every token`,
      kind: 'square',
      x: -sqTotal / 2 + h * (T + SIDE_GAP),
      y,
      cols: T,
      rows: T,
      stages: ['attention'],
    });
  }
  y += T + GAP;

  push({
    id: 'attn-out',
    label: 'Heads joined, then × Wo',
    note: `${T} × ${C_DIM}, back to full width`,
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['attention'],
  });
  y += T + GAP;

  push({
    id: 'add1',
    label: 'Add to the stream',
    note: 'added, not replaced',
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['residual'],
  });
  y += T + PHASE_GAP;

  // --- MLP ---------------------------------------------------------------
  push({
    id: 'norm2',
    label: 'RMSNorm',
    note: 'again, before the MLP reads',
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['normalization'],
  });
  y += T + GAP;

  push({
    id: 'ffn',
    label: 'MLP interior',
    note: `${T} × ${FFN_DIM}. ${FFN_DIM / C_DIM}× wider than the stream`,
    kind: 'wide',
    cols: FFN_DIM,
    rows: T,
    stages: ['mlp'],
  });
  y += T + GAP;

  push({
    id: 'add2',
    label: 'Back down, added to the stream',
    note: `${T} × ${C_DIM}`,
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['mlp', 'residual'],
  });
  y += T + PHASE_GAP;

  // --- Head --------------------------------------------------------------
  push({
    id: 'normf',
    label: 'Final RMSNorm',
    kind: 'stream',
    cols: C_DIM,
    rows: T,
    stages: ['normalization', 'unembedding'],
  });
  y += T + GAP;

  push({
    id: 'unembed',
    label: 'Unembedding matrix',
    note: `${C_DIM} × ${VOCAB.length}, back to vocabulary size`,
    kind: 'weights',
    cols: C_DIM,
    rows: VOCAB.length,
    stages: ['unembedding'],
  });
  y += VOCAB.length + GAP;

  push({
    id: 'logits',
    label: 'Logits',
    note: `${VOCAB.length} raw scores, from the last token only`,
    kind: 'score',
    cols: VOCAB.length,
    rows: 1,
    stages: ['unembedding', 'logits'],
  });
  y += 1 + GAP;

  push({
    id: 'probs',
    label: 'Probabilities',
    note: 'after softmax, they sum to 1',
    kind: 'score',
    cols: VOCAB.length,
    rows: 1,
    stages: ['softmax'],
  });
  y += 1 + GAP;

  push({
    id: 'pick',
    label: 'The chosen token',
    note: 'appended to the input, and the whole thing runs again',
    kind: 'token',
    cols: 1,
    rows: 1,
    stages: ['sampling', 'the-loop'],
  });

  const maxX = Math.max(...blocks.map((b) => b.x + b.cols));
  const minX = Math.min(...blocks.map((b) => b.x));
  const maxY = Math.max(...blocks.map((b) => b.y + b.rows));

  return {
    blocks,
    bounds: { x: minX, y: 0, w: maxX - minX, h: maxY },
    chain: blocks.map((b) => b.id),
  };
}

/** The blocks a given pipeline stage should fly the camera to. */
export function blocksForStage(layout: SceneLayout, stage: string): Block[] {
  return layout.blocks.filter((b) => b.stages.includes(stage));
}

/** Bounding box of a set of blocks, in cells. */
export function boundsOf(blocks: readonly Block[]): { x: number; y: number; w: number; h: number } {
  if (!blocks.length) return { x: 0, y: 0, w: 1, h: 1 };
  const x = Math.min(...blocks.map((b) => b.x));
  const y = Math.min(...blocks.map((b) => b.y));
  const r = Math.max(...blocks.map((b) => b.x + b.cols));
  const bt = Math.max(...blocks.map((b) => b.y + b.rows));
  return { x, y, w: r - x, h: bt - y };
}
