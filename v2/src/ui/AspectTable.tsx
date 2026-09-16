/**
 * What is actually in the file you downloaded.
 *
 * The single most useful summary in the whole project, and it was somebody
 * else's idea. It answers a question nothing else here answers: people assume a
 * model file contains the machinery that produced it, and it does not. Open a
 * real checkpoint and there are tensors, a tokenizer, and two small JSON files.
 * No loss function. No gradients. No optimiser state.
 *
 * So the "in the file" column is the point, and the rows that say **nothing**
 * are worth more than the rows that say something. Backpropagation, gradients,
 * attention scores: all central to how this works, none of them present in what
 * you can download. That is one column doing more work than a page of prose.
 *
 * Sorted by phase rather than alphabetically, because the grouping is itself an
 * argument: here is what happened once and is gone, here is what only happens
 * when you ask a question, here is what is always true.
 */

import { useState } from 'react';
import { ASPECTS, ASPECT_SOURCE, PHASE_LABEL, getNode, leavesNoTrace } from '../content';
import type { Phase } from '../content/schema';
import { useStore } from '../store';
import './AspectTable.css';

const ORDER: Phase[] = ['both', 'training', 'inference', 'setup'];

const BLURB: Record<Phase, string> = {
  both: 'Running whenever the model runs, whether it is learning or answering.',
  training: 'Only while learning. By the time you download the model, all of this is gone.',
  inference: 'Only while answering. None of it existed while the model was being trained.',
  setup: 'Decided once, before anything runs, and frozen afterwards.',
};

export function AspectTable() {
  const focusNode = useStore((s) => s.focusNode);
  const setLearn = useStore((s) => s.setLearn);
  const [onlyAbsent, setOnlyAbsent] = useState(false);

  const absent = leavesNoTrace().length;
  const rows = Object.entries(ASPECTS)
    .map(([id, a]) => ({ id, a, node: getNode(id) }))
    .filter((r) => r.node && (!onlyAbsent || r.a.trace === null));

  const open = (id: string) => {
    focusNode(id, 'notebook');
    setLearn(false);
  };

  return (
    <section className="at" data-testid="aspect-table">
      <header className="at-head">
        <h2>What is actually in the file</h2>
        <p>
          Download a model and you get tensors, a tokenizer and two small config files. Not the
          loss function. Not the gradients. Not the optimiser. All of that was scaffolding for a
          process that finished, and it was thrown away.
        </p>
        <button
          className={`at-toggle${onlyAbsent ? ' on' : ''}`}
          onClick={() => setOnlyAbsent(!onlyAbsent)}
          data-testid="only-absent"
        >
          {onlyAbsent ? 'Show everything' : `Show only what is missing (${absent})`}
        </button>
      </header>

      <div className="at-wrap">
        <table className="at-tbl">
          <thead>
            <tr>
              <th>Concept</th>
              <th>In the file you download</th>
              <th>The code that does it</th>
            </tr>
          </thead>
          {ORDER.map((phase) => {
            const group = rows.filter((r) => r.a.phase === phase);
            if (!group.length) return null;
            return (
              <tbody key={phase} className={`at-g at-${phase}`}>
                <tr className="at-sep">
                  <td colSpan={3}>
                    <span className="at-sep-k">{PHASE_LABEL[phase]}</span>
                    <span className="at-sep-d">{BLURB[phase]}</span>
                  </td>
                </tr>
                {group.map(({ id, a, node }) => (
                  <tr key={id} data-testid={`aspect-${id}`}>
                    <td className="at-c">
                      <button onClick={() => open(id)}>{node!.title}</button>
                    </td>
                    <td className={`at-t${a.trace === null ? ' none' : ''}`}>
                      {/* The absent rows are the ones worth reading. */}
                      {a.trace ?? 'Nothing. It is not in there.'}
                    </td>
                    <td className="at-k">{a.code ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            );
          })}
        </table>
      </div>

      <p className="at-foot">
        Checked against a real checkpoint:{' '}
        <a href={ASPECT_SOURCE.url} target="_blank" rel="noreferrer noopener">
          {ASPECT_SOURCE.label}
        </a>
        . 8 billion numbers across 32 layers, and a handful of small files beside them.
      </p>
    </section>
  );
}
