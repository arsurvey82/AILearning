/**
 * The layer ladder: model, block, head, neuron, number.
 *
 * Five rungs, each a real level of the model rather than a page. Going down a
 * rung is zooming into the thing you were already looking at, so the reader
 * never loses the thread, and the breadcrumb reads back the path they took.
 *
 * The important part is the seam with the concept map. This surface shows THIS
 * model doing THIS sentence, with real numbers. The 64 authored nodes explain
 * what the concept is, what usually confuses people about it, and what it looks
 * like at real scale. Neither replaces the other, so every rung carries a link
 * across, and the reader can go from "here is a number" to "here is what this
 * step means" without leaving the sentence behind.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import { getNode } from '../content';
import { useStore } from '../store';
import { WORDS, decide, promptOf, type Sentence } from './words';
import './Ladder.css';

export type Rung = 'model' | 'block' | 'head' | 'neuron' | 'number';
const ORDER: Rung[] = ['model', 'block', 'head', 'neuron', 'number'];

/** Which authored lesson explains the concept a rung is showing. */
const CONCEPT: Record<Rung, string> = {
  model: 'transformer',
  block: 'layer',
  head: 'attention',
  neuron: 'neuron',
  number: 'parameter',
};

interface Grid {
  id: string;
  title: string;
  /** What it is, in the reader's terms. */
  note: string;
  rows: string[];
  cols: string[];
  m: (number | null)[][];
  /** Value that maps to full intensity. */
  scale: number;
  /** Render as a percentage. */
  pct?: boolean;
  /** Learned and fixed, rather than computed from your sentence. */
  learned?: boolean;
  /** Terms that produced a cell, for the callout. */
  from?: (r: number, c: number) => Array<{ label: string; value: number }>;
}

export function Ladder({ sentence }: { sentence: Sentence }) {
  const setLearn = useStore((s) => s.setLearn);
  const focusNode = useStore((s) => s.focusNode);

  const [rung, setRung] = useState<Rung>('model');
  const [block, setBlock] = useState(0);
  const [head, setHead] = useState(0);
  const [neuron, setNeuron] = useState(0);
  const [pick, setPick] = useState<{ g: string; r: number; c: number } | null>(null);

  const result = useMemo(() => decide(sentence), [sentence]);
  const words = promptOf(sentence);
  const t = result.trace;

  // A rung change invalidates the selection, since the cell it named is gone.
  useEffect(() => setPick(null), [rung, block, head, neuron, sentence]);

  const grids = useMemo((): Grid[] => {
    const L = t.layers[block]!;
    const H = L.heads[head]!;
    const dims = (n: number) => Array.from({ length: n }, (_, i) => String(i));

    switch (rung) {
      case 'model':
        return [
          { id: 'embed', title: 'After embedding', note: 'Your words, as vectors. What each word is, plus where it sits.',
            rows: words, cols: dims(t.embed[0]!.length), m: t.embed, scale: 3 },
          ...t.layers.map((Ly, i) => ({
            id: `blk${i}`, title: `After block ${i + 1}`,
            note: i === 0 ? 'The first block has run. Attention mixed the words, then each one thought alone.'
                          : 'The second block has run. This is what the prediction is read from.',
            rows: words, cols: dims(Ly.afterMlp[0]!.length), m: Ly.afterMlp, scale: 4,
          })),
          { id: 'probs', title: 'What comes next', note: `The model chose "${result.verb}".`,
            rows: ['p'], cols: t.probs.map((_, i) => String(i)), m: [t.probs], scale: 1, pct: true },
        ];

      case 'block':
        return [
          { id: 'norm1', title: 'Normalised, ready for attention', note: 'Rescaled so no one dimension dominates.',
            rows: words, cols: dims(L.norm1[0]!.length), m: L.norm1, scale: 3 },
          { id: 'attnOut', title: 'What attention contributed', note: 'The blend of other words, projected back to full width.',
            rows: words, cols: dims(L.attnOut[0]!.length), m: L.attnOut, scale: 2 },
          { id: 'afterAttn', title: 'Added to the stream', note: 'Added, never replaced. The word keeps what it was as well as what it heard.',
            rows: words, cols: dims(L.afterAttn[0]!.length), m: L.afterAttn, scale: 4 },
          { id: 'afterMlp', title: 'After the MLP, block complete', note: 'One transformer block is exactly these two moves.',
            rows: words, cols: dims(L.afterMlp[0]!.length), m: L.afterMlp, scale: 4 },
        ];

      case 'head':
        return [
          { id: 'Q', title: 'Q, what each word is looking for', note: 'A learned question, one per word.',
            rows: words, cols: dims(t.layers[block]!.Q[0]!.length), m: L.Q, scale: 3 },
          { id: 'K', title: 'K, what each word offers', note: 'A learned label, for other words to match against.',
            rows: words, cols: dims(L.K[0]!.length), m: L.K, scale: 3 },
          { id: 'scores', title: 'Scores, every question against every earlier label',
            note: 'Blank cells are the future, which no word may see.',
            rows: words, cols: words, m: H.scores, scale: 6 },
          { id: 'weights', title: 'Attention, each row a budget adding to 1',
            note: 'This is where the reach past the distractor happens.',
            rows: words, cols: words, m: H.weights, scale: 1, pct: true,
            from: (r) => H.weights[r]!.map((w, j) => ({ label: words[j]!, value: w })).filter((x) => x.value > 0 ) },
        ];

      case 'neuron': {
        const hidden = L.hidden;
        if (!hidden) {
          return [{ id: 'noexp', title: 'This block routes to experts', note: 'Switch to the dense model to inspect individual neurons.',
            rows: words, cols: dims(L.down[0]!.length), m: L.down, scale: 3 }];
        }
        return [
          { id: 'hidden', title: `MLP neurons, ${hidden[0]!.length} of them, four times the width of the stream`,
            note: 'Each column is one neuron. Each row is one word. This is where most of a real model\'s facts live.',
            rows: words, cols: dims(hidden[0]!.length), m: hidden, scale: 3 },
          { id: 'one', title: `Neuron ${neuron}, across the sentence`,
            note: 'One column of the grid above, on its own. Some neurons fire for one word and nothing else.',
            rows: words, cols: ['fires'], m: hidden.map((r) => [r[neuron] ?? 0]), scale: 3 },
        ];
      }

      case 'number':
        return [
          { id: 'wte', title: 'Token table, learned and fixed', note: 'Part of the model. It does not change when you change the sentence.',
            rows: t.ids.map((_, k) => words[k]!), cols: dims(WORDS.wte[0]!.length),
            m: t.ids.map((id) => WORDS.wte[id]!), scale: 3, learned: true },
          { id: 'embedN', title: 'Your sentence, embedded', note: 'Computed. Change a word and every number here moves.',
            rows: words, cols: dims(t.embed[0]!.length), m: t.embed, scale: 3 },
        ];
    }
  }, [rung, block, head, neuron, t, words, result.verb]);

  const concept = getNode(CONCEPT[rung]);
  const at = ORDER.indexOf(rung);

  return (
    <section className="ld" data-testid="ladder">
      <nav className="ld-crumbs" aria-label="Where you are in the model">
        {ORDER.slice(0, at + 1).map((r, i) => (
          <span key={r}>
            {i > 0 && <span className="ld-sep" aria-hidden="true">/</span>}
            <button
              className={`ld-crumb${r === rung ? ' here' : ''}`}
              onClick={() => setRung(r)}
              data-testid={`crumb-${r}`}
            >
              {r === 'block' ? `block ${block + 1}` : r === 'head' ? `head ${head + 1}`
                : r === 'neuron' ? `neuron ${neuron}` : r}
            </button>
          </span>
        ))}
      </nav>

      <div className="ld-bar">
        <div className="ld-rungs" role="group" aria-label="Zoom level">
          {ORDER.map((r, i) => (
            <button
              key={r}
              className={`ld-rung${r === rung ? ' on' : ''}`}
              onClick={() => setRung(r)}
              data-testid={`rung-${r}`}
            >
              <span className="ld-rung-n">L{i}</span>
              {r}
            </button>
          ))}
        </div>

        {/* Only the selectors that mean anything at this depth. */}
        <div className="ld-sel">
          {(rung === 'block' || rung === 'head' || rung === 'neuron') && (
            <Choice label="block" n={t.layers.length} value={block} onChange={setBlock} testid="pick-block" />
          )}
          {rung === 'head' && (
            <Choice label="head" n={t.layers[block]!.heads.length} value={head} onChange={setHead} testid="pick-head" />
          )}
          {rung === 'neuron' && t.layers[block]!.hidden && (
            <Choice
              label="neuron"
              n={t.layers[block]!.hidden![0]!.length}
              value={neuron}
              onChange={setNeuron}
              testid="pick-neuron"
              compact
            />
          )}
        </div>

        {/* The seam with the concept map. */}
        {concept && (
          <button
            className="ld-concept"
            data-testid="read-concept"
            onClick={() => {
              focusNode(concept.id, 'notebook');
              setLearn(false);
            }}
          >
            Read about {concept.title}
          </button>
        )}
      </div>

      <div className="ld-grids">
        {grids.map((g) => (
          <GridView key={g.id} g={g} pick={pick} onPick={setPick} words={words} />
        ))}
      </div>
    </section>
  );
}

function Choice({
  label, n, value, onChange, testid, compact,
}: {
  label: string; n: number; value: number; onChange: (v: number) => void;
  testid: string; compact?: boolean;
}) {
  if (compact) {
    return (
      <label className="ld-choice">
        <span>{label}</span>
        <input
          type="range" min={0} max={n - 1} value={value} data-testid={testid}
          onChange={(e) => onChange(Number(e.target.value))}
        />
        <b>{value}</b>
      </label>
    );
  }
  return (
    <div className="ld-choice">
      <span>{label}</span>
      {Array.from({ length: n }, (_, i) => (
        <button
          key={i}
          className={`ld-opt${i === value ? ' on' : ''}`}
          onClick={() => onChange(i)}
          data-testid={`${testid}-${i}`}
        >
          {i + 1}
        </button>
      ))}
    </div>
  );
}

/** One matrix, drawn on canvas because a 256-wide grid is too many DOM nodes. */
function GridView({
  g, pick, onPick, words,
}: {
  g: Grid;
  pick: { g: string; r: number; c: number } | null;
  onPick: (p: { g: string; r: number; c: number } | null) => void;
  words: string[];
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  const wrap = useRef<HTMLDivElement>(null);
  const [hover, setHover] = useState<{ r: number; c: number } | null>(null);
  const cell = useRef(0);

  useEffect(() => {
    const cv = ref.current;
    if (!cv) return;
    const ctx = cv.getContext('2d');
    if (!ctx) return;
    const css = getComputedStyle(document.documentElement);
    const v = (n: string) => css.getPropertyValue(n).trim() || '#888';

    const draw = () => {
      const w = cv.clientWidth;
      const dpr = Math.min(devicePixelRatio || 1, 2);
      const cs = Math.max(3, Math.min(30, w / g.cols.length));
      cell.current = cs;
      // The row labels sit outside the canvas, so they need the cell size too.
      wrap.current?.style.setProperty('--cell', `${cs}px`);
      const h = g.m.length * cs;
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.clearRect(0, 0, w, h);

      const sel = pick?.g === g.id ? pick : null;
      for (let r = 0; r < g.m.length; r++) {
        for (let c = 0; c < g.cols.length; c++) {
          const raw = g.m[r]![c];
          const x = c * cs;
          const y = r * cs;
          if (raw === null || raw === undefined) {
            // Masked. An outline, not a faint fill, so it reads as "forbidden"
            // rather than "small".
            ctx.globalAlpha = 0.12;
            ctx.strokeStyle = v('--muted');
            ctx.lineWidth = 0.5;
            ctx.strokeRect(x + 0.5, y + 0.5, cs - 1, cs - 1);
            continue;
          }
          const tI = Math.min(1, Math.abs(raw) / g.scale);
          ctx.globalAlpha = (g.learned ? 0.45 : 1) * (0.12 + 0.88 * Math.sqrt(tI));
          ctx.fillStyle = raw < 0 ? v('--orange') : g.learned ? v('--orange') : v('--blue');
          ctx.fillRect(x, y, Math.max(1, cs - 1), Math.max(1, cs - 1));

          const on = (sel && sel.r === r && sel.c === c) || (hover && hover.r === r && hover.c === c);
          if (on) {
            ctx.globalAlpha = 1;
            ctx.strokeStyle = v('--violet');
            ctx.lineWidth = 2;
            ctx.strokeRect(x - 1, y - 1, cs + 1, cs + 1);
          }
          if (cs >= 20) {
            ctx.globalAlpha = 1;
            ctx.fillStyle = v('--ink');
            ctx.font = `9px ${v('--mono')}`;
            ctx.textAlign = 'center';
            ctx.fillText(g.pct ? String(Math.round(raw * 100)) : raw.toFixed(1), x + cs / 2, y + cs / 2 + 3);
            ctx.textAlign = 'left';
          }
        }
      }
      ctx.globalAlpha = 1;
    };

    draw();
    const ro = new ResizeObserver(draw);
    ro.observe(cv);
    return () => ro.disconnect();
  }, [g, pick, hover]);

  const locate = (e: React.PointerEvent) => {
    const cv = ref.current;
    if (!cv || !cell.current) return null;
    const rect = cv.getBoundingClientRect();
    const c = Math.floor((e.clientX - rect.left) / cell.current);
    const r = Math.floor((e.clientY - rect.top) / cell.current);
    if (r < 0 || r >= g.m.length || c < 0 || c >= g.cols.length) return null;
    if (g.m[r]![c] === null || g.m[r]![c] === undefined) return null;
    return { r, c };
  };

  const sel = pick?.g === g.id ? pick : null;
  const shown = sel ?? hover;
  const raw = shown ? g.m[shown.r]![shown.c] : null;

  return (
    <div className="ld-g">
      <p className="ld-g-t">
        {g.title}
        {g.learned && <em className="ld-g-fixed">learned, fixed</em>}
      </p>
      <p className="ld-g-n">{g.note}</p>
      <div className="ld-g-rows" ref={wrap}>
        <div className="ld-g-labels" aria-hidden="true">
          {g.rows.map((r, i) => (
            <span key={i}>{r}</span>
          ))}
        </div>
        <canvas
          ref={ref}
          className="ld-canvas"
          onPointerMove={(e) => setHover(locate(e))}
          onPointerLeave={() => setHover(null)}
          onPointerDown={(e) => {
            const p = locate(e);
            onPick(p && !(sel && sel.r === p.r && sel.c === p.c) ? { g: g.id, ...p } : null);
          }}
        />
      </div>

      {shown && raw !== null && raw !== undefined && (
        <div className="ld-read" data-testid={sel ? 'picked' : 'hovered'}>
          <span className="ld-read-v">{g.pct ? `${(raw * 100).toFixed(1)}%` : raw.toFixed(3)}</span>
          <span className="ld-read-w">
            row {g.rows[shown.r]}, column {g.cols[shown.c]}
          </span>
          {g.from && sel && (
            <span className="ld-read-t">
              {g.from(sel.r, sel.c)
                .slice(0, 6)
                .map((x) => `${x.label} ${(x.value * 100).toFixed(0)}%`)
                .join('  ')}
            </span>
          )}
        </div>
      )}

      {/* The canvas cannot be tabbed into, so the same cells exist as text. */}
      <ul className="ld-a11y">
        {g.rows.map((r, i) => (
          <li key={i}>
            {r}: {g.m[i]!.slice(0, 8).map((x) => (x === null ? 'masked' : x.toFixed(2))).join(', ')}
            {g.m[i]!.length > 8 ? `, and ${g.m[i]!.length - 8} more` : ''}
          </li>
        ))}
      </ul>
      <span className="ld-hidden">{words.join(' ')}</span>
    </div>
  );
}
