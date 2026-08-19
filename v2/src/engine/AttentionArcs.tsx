/**
 * AttentionArcs, the one animation worth building.
 *
 * Attention is a *routing* idea, and routing is what a table of numbers is
 * worst at showing. Arcs whose weight is the attention weight make "this token
 * is listening mostly to that one" a thing you see rather than compute.
 *
 * Three research findings shape it, and each one rules something out:
 *
 * 1. SEGMENTING PRINCIPLE (Mayer). Learner-paced beats system-paced: pauses
 *    between segments are what let a learner process the previous one. So this
 *    STEPS on click, one query token at a time, and there is no autoplay.
 *    An animation that runs on its own would be the version that demos well
 *    and teaches worse.
 *
 * 2. SIGNALING PRINCIPLE (Mayer). Highlight the essential material. Only the
 *    active token's arcs are drawn at full strength; everything else recedes.
 *
 * 3. DUAL CODING / MULTIMEDIA PRINCIPLE (Mayer, Paivio). Words and pictures
 *    beat pictures alone, so every arc carries its percentage as text and the
 *    NumberGrid stays directly below. The arcs are not a replacement for the
 *    numbers, they are the second channel.
 *
 * Accessibility: the SVG is aria-hidden and a live text summary carries the
 * same information, because an arc diagram is unreadable to a screen reader no
 * matter how it is labelled. The NumberGrid below is the accessible primary.
 *
 * Sources are recorded in docs/pedagogy.md.
 */

import { useEffect, useRef } from 'react';
import { attention } from '../model/attention';
import { useStore } from '../store';
import './AttentionArcs.css';

const W = 720;
const H = 210;
const PAD = 44;
const BASELINE = H - 46;

export function AttentionArcs() {
  const runInput = useStore((s) => s.runInput);
  // Shared with the number grid below, so the two views never disagree.
  const q = useStore((s) => s.queryToken);
  const setQ = useStore((s) => s.setQueryToken);
  const reduced = useRef(false);

  useEffect(() => {
    reduced.current = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  }, []);

  const r = attention(runInput);
  const head = r.heads[0];
  const tokens = r.embedding.tokens;
  const n = tokens.length;

  // Keep the selection valid when the Run control shortens the input.
  const qi = Math.min(q, Math.max(n - 1, 0));

  if (n === 0) {
    return (
      <p className="aa-empty">
        Type some letters into <strong>Run</strong> above to see attention flow.
      </p>
    );
  }

  const step = n > 1 ? (W - PAD * 2) / (n - 1) : 0;
  const x = (i: number) => PAD + i * step;
  const weights = head?.weights[qi] ?? [];

  // Strongest source, for the plain-language summary.
  let topJ = 0;
  weights.forEach((w, j) => {
    if ((weights[topJ] ?? 0) < w) topJ = j;
  });

  const label = (i: number) => `${tokens[i]?.letter}@${tokens[i]?.seat}`;

  return (
    <figure className="aa">
      <figcaption className="aa-caption">
        Head 1. Each arc is how much <strong>{label(qi)}</strong> listens to an earlier token , 
        thicker means more. Step through the tokens to watch the pattern change.
      </figcaption>

      <div className="aa-stage">
        <svg
          className={`aa-svg${reduced.current ? ' still' : ''}`}
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="xMidYMid meet"
          aria-hidden="true"
        >
          {/* Arcs, drawn back-to-front so the strongest sits on top. */}
          {[...weights.keys()]
            .filter((j) => j <= qi)
            .sort((a, b) => (weights[a] ?? 0) - (weights[b] ?? 0))
            .map((j) => {
              const w = weights[j] ?? 0;
              const from = x(qi);
              const to = x(j);
              const span = Math.abs(from - to);
              // Self-attention has no span, so it gets a small loop instead of
              // a degenerate flat line.
              const lift = j === qi ? 46 : Math.min(30 + span * 0.42, BASELINE - 26);
              const d =
                j === qi
                  ? `M ${from - 13} ${BASELINE - 16} C ${from - 26} ${BASELINE - lift}, ${from + 26} ${BASELINE - lift}, ${from + 13} ${BASELINE - 16}`
                  : `M ${from} ${BASELINE - 16} Q ${(from + to) / 2} ${BASELINE - lift} ${to} ${BASELINE - 16}`;
              return (
                <path
                  key={j}
                  className="aa-arc"
                  d={d}
                  strokeWidth={0.8 + w * 13}
                  opacity={0.16 + w * 0.84}
                />
              );
            })}

          {/* Percentage labels, the verbal channel of dual coding. */}
          {[...weights.keys()]
            .filter((j) => j <= qi && (weights[j] ?? 0) >= 0.08)
            .map((j) => {
              const from = x(qi);
              const to = x(j);
              const span = Math.abs(from - to);
              const lift = j === qi ? 46 : Math.min(30 + span * 0.42, BASELINE - 26);
              return (
                <text
                  key={`t${j}`}
                  className="aa-pct"
                  x={(from + to) / 2}
                  y={BASELINE - lift / 2 - 6}
                  textAnchor="middle"
                >
                  {Math.round((weights[j] ?? 0) * 100)}%
                </text>
              );
            })}

          {/* Tokens along the baseline. */}
          {tokens.map((t, i) => {
            const masked = i > qi;
            const cls = i === qi ? 'q' : masked ? 'masked' : 'visible';
            return (
              <g key={i} className={`aa-tok ${cls}`}>
                <circle cx={x(i)} cy={BASELINE} r={14} />
                <text x={x(i)} y={BASELINE + 5} textAnchor="middle" className="aa-letter">
                  {t.letter}
                </text>
                <text x={x(i)} y={BASELINE + 32} textAnchor="middle" className="aa-seat">
                  {masked ? 'masked' : `seat ${t.seat}`}
                </text>
              </g>
            );
          })}
        </svg>
      </div>

      {/* Learner-paced controls. No autoplay, on purpose. */}
      <div className="aa-controls">
        <button
          className="aa-step"
          onClick={() => setQ(Math.max(0, qi - 1))}
          disabled={qi === 0}
          aria-label="Previous token"
        >
          ‹
        </button>
        <div className="aa-chips" role="tablist" aria-label="Choose which token is looking">
          {tokens.map((t, i) => (
            <button
              key={i}
              role="tab"
              aria-selected={i === qi}
              className={`aa-chip${i === qi ? ' on' : ''}`}
              onClick={() => setQ(i)}
            >
              {t.letter}
              <sub>{t.seat}</sub>
            </button>
          ))}
        </div>
        <button
          className="aa-step"
          onClick={() => setQ(Math.min(n - 1, qi + 1))}
          disabled={qi === n - 1}
          aria-label="Next token"
        >
          ›
        </button>
      </div>

      {/* The accessible equivalent, and the verbal half of dual coding. */}
      <p className="aa-read" aria-live="polite">
        <strong>{label(qi)}</strong> can see {qi + 1} of {n} token{n === 1 ? '' : 's'}, everything
        after it is masked. It gives most of its attention (
        {Math.round((weights[topJ] ?? 0) * 100)}%) to <strong>{label(topJ)}</strong>
        {qi === 0 ? ', because there is nothing else it is allowed to look at.' : '.'} The
        percentages across the row add up to 100.
      </p>
    </figure>
  );
}
