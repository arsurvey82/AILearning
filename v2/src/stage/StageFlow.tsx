/**
 * StageFlow. A node's actual structure, large, stepped through.
 *
 * The map draws abstract circles. Circles answer "where does this concept sit
 * in a taxonomy", which is a navigation question, not a learning one. bbycroft
 * never shows an abstract node: it shows the real thing as boxes, with data
 * moving through them, and that is what makes the flow legible.
 *
 * So for every node that has a structure, this renders THAT, the boxes, the
 * order, and what lives inside each one, at the size of the graphic pane,
 * and steps through it one box at a time.
 *
 * Stepping is per-box, not per-node: the point is watching the data move
 * through *this* stage, not skipping to the next one. Everything ahead of the
 * current box is dimmed, everything behind is marked done, so direction is
 * visible without an animation running on its own (segmenting principle , 
 * learner-paced beats system-paced).
 */

import { useEffect, useState } from 'react';
import type { FlowNode, FlowSpec } from '../content/schema';
import './StageFlow.css';

const KIND_WORD: Record<string, string> = {
  input: 'in',
  stage: 'step',
  store: 'holds state',
  control: 'decides',
  output: 'out',
};

export function StageFlow({ spec, nodeId }: { spec: FlowSpec; nodeId: string }) {
  const [at, setAt] = useState(0);

  // A different node is a different diagram; starting mid-way through would be
  // meaningless.
  useEffect(() => setAt(0), [nodeId]);

  const last = spec.steps.length - 1;
  const step = (d: -1 | 1) => setAt((v) => Math.max(0, Math.min(last, v + d)));
  const current = spec.steps[at];

  return (
    <section className="sf" aria-label="Structure">
      <p className="sf-caption">{spec.caption}</p>

      <ol className="sf-chain">
        {spec.steps.map((s, i) => (
          <li
            key={s.id}
            className={`sf-item ${i === at ? 'here' : i < at ? 'done' : 'ahead'}`}
          >
            <button
              className={`sf-box k-${s.kind ?? 'stage'}`}
              onClick={() => setAt(i)}
              aria-current={i === at ? 'step' : undefined}
            >
              <span className="sf-kind">{KIND_WORD[s.kind ?? 'stage']}</span>
              <span className="sf-num">{i + 1}</span>
              <span className="sf-label">{s.label}</span>
              {s.sub && <span className="sf-sub">{s.sub}</span>}
              {s.parts && s.parts.length > 0 && (
                <span className="sf-parts">
                  {s.parts.map((p: FlowNode) => (
                    <span className={`sf-part k-${p.kind ?? 'stage'}`} key={p.id}>
                      <span className="sf-part-l">{p.label}</span>
                      {p.sub && <span className="sf-part-s">{p.sub}</span>}
                    </span>
                  ))}
                </span>
              )}
            </button>
          </li>
        ))}
      </ol>

      {spec.loop && (
        <p className="sf-loop">
          <span aria-hidden="true">↩ </span>
          {spec.loop}
        </p>
      )}

      <div className="sf-controls">
        <button className="sf-btn" onClick={() => step(-1)} disabled={at === 0} aria-label="Previous box">
          ◀
        </button>
        <span className="sf-pos">
          {at + 1} of {spec.steps.length}, <strong>{current?.label}</strong>
        </span>
        <button className="sf-btn" onClick={() => step(1)} disabled={at === last} aria-label="Next box">
          ▶
        </button>
      </div>

      {spec.note && <p className="sf-note">{spec.note}</p>}
    </section>
  );
}
