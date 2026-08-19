/**
 * Retrieval practice.
 *
 * Roediger & Karpicke: "Testing is a powerful means of improving learning, not
 * just assessing it." Retrieving something produces substantially better
 * long-term retention than re-reading it, alternating study and test beats
 * either alone, and feedback strengthens the effect further.
 *
 * Three design consequences:
 *
 * - Every wrong option is a REAL misconception lifted from that node's snag
 *   cards. A distractor nobody would choose tests whether you recognise a
 *   sentence you just read, not whether you can retrieve the idea.
 * - Answering wrong opens the snag that already addresses it. That is the
 *   feedback the research says matters, and it reuses content that is already
 *   written, and for Embedding, already playtested.
 * - It is never a gate. Nothing is locked behind a correct answer, and it can
 *   be skipped entirely. A quiz that blocks progress converts retrieval
 *   practice into an obstacle, and obstacles get guessed at rather than
 *   thought about.
 */

import { useState } from 'react';
import type { Checkpoint as CheckpointSpec } from '../content/schema';
import { useStore, type Layer } from '../store';
import { inline } from './markdown';
import './Checkpoint.css';

export function Checkpoint({ spec, nodeId }: { spec: CheckpointSpec; nodeId: string }) {
  const [picked, setPicked] = useState<number | null>(null);
  const [open, setOpen] = useState(false);
  const toggleLayer = useStore((s) => s.toggleLayer);
  const isLayerOpen = useStore((s) => s.isLayerOpen);

  const chosen = picked === null ? undefined : spec.options[picked];
  const right = chosen?.correct === true;

  /** Send them to the card that already answers this. */
  const openSnags = () => {
    const l: Layer = 'L2';
    if (!isLayerOpen(nodeId, l)) toggleLayer(nodeId, l);
    document
      .querySelector(`#${CSS.escape(nodeId)}-l2-panel`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  };

  if (!open) {
    return (
      <button className="cp-invite" onClick={() => setOpen(true)}>
        <span className="cp-invite-t">Check yourself before moving on</span>
        <span className="cp-invite-d">
          One question. Trying to recall this is worth more than reading it again, and it is not a
          gate, so you can skip it.
        </span>
      </button>
    );
  }

  return (
    <section className="cp" aria-labelledby={`${nodeId}-cp`}>
      <p className="cp-kicker">Checkpoint</p>
      <h3 className="cp-q" id={`${nodeId}-cp`}>
        {inline(spec.question)}
      </h3>

      <ul className="cp-opts">
        {spec.options.map((o, i) => {
          const isPicked = picked === i;
          const state = picked === null ? '' : o.correct ? ' correct' : isPicked ? ' wrong' : ' dim';
          return (
            <li key={o.text}>
              <button
                className={`cp-opt${state}`}
                onClick={() => picked === null && setPicked(i)}
                disabled={picked !== null}
                aria-pressed={isPicked}
              >
                <span className="cp-mark" aria-hidden="true">
                  {picked === null ? '' : o.correct ? '✓' : isPicked ? '✕' : ''}
                </span>
                {inline(o.text)}
              </button>
            </li>
          );
        })}
      </ul>

      {chosen && (
        <div className={`cp-fb${right ? ' good' : ''}`} aria-live="polite">
          <p>{inline(chosen.feedback)}</p>
          {/* Wrong answers get routed to the written answer, not just marked. */}
          {!right && chosen.snagQ && (
            <button className="cp-goto" onClick={openSnags}>
              Read the card on this → <em>{chosen.snagQ}</em>
            </button>
          )}
          <button className="cp-again" onClick={() => setPicked(null)}>
            Try again
          </button>
        </div>
      )}
    </section>
  );
}
