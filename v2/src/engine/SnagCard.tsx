/**
 * SnagCard, CLAUDE.md §7.3, L2.
 *
 * The snags render as a list of question chips; tapping one expands just that
 * answer inline. The point is recognition: the learner scans for the question
 * they were already silently asking and self-serves. So the chip shows the
 * question EXACTLY as a learner would phrase it, never rewritten as a heading.
 */

import { useState } from 'react';
import type { Snag } from '../content/schema';
import { inline } from './markdown';
import './SnagCard.css';

export function SnagList({ snags, idPrefix }: { snags: Snag[]; idPrefix: string }) {
  const [open, setOpen] = useState<number | null>(null);

  if (snags.length === 0) {
    return (
      <p className="snag-none">
        No snags captured for this node yet. They get harvested by walking a real beginner through
        it and logging where they trip, not invented.
      </p>
    );
  }

  return (
    <ul className="snags">
      {snags.map((s, i) => {
        const isOpen = open === i;
        const panelId = `${idPrefix}-snag-${i}`;
        return (
          <li key={s.q} className={`snag${isOpen ? ' open' : ''}`}>
            <button
              className="snag-q"
              aria-expanded={isOpen}
              aria-controls={panelId}
              onClick={() => setOpen(isOpen ? null : i)}
            >
              <span className="snag-mark" aria-hidden="true">
                {isOpen ? '−' : '?'}
              </span>
              <span>{s.q}</span>
            </button>
            {isOpen && (
              <div className="snag-a" id={panelId}>
                {inline(s.a)}
              </div>
            )}
          </li>
        );
      })}
    </ul>
  );
}
