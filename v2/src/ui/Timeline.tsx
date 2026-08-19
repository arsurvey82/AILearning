/**
 * The walk-back path: every fix, oldest first, with the failure that caused it.
 *
 * Origins on individual nodes answer "why is this here" one concept at a time.
 * That is useful and it is not the whole value. Read together, the dates do
 * something a scattered field cannot: they show that a language model is not
 * one recent invention but a stack of fixes, each patching a specific earlier
 * failure, accumulated over more than a century.
 *
 * Which is why this lists the PROBLEM rather than the concept. A row saying
 * "2014 Attention" teaches nothing a heading could not. A row saying
 * "translators crushed a sentence into one summary and long ones did not
 * survive" is the thing that makes 2017 make sense when you reach it.
 *
 * The two forced entries are separated out on purpose. They have no year
 * because nobody chose them, and mixing them into the dated list would imply
 * they could have gone another way.
 */

import { useMemo, useState } from 'react';
import { ORIGINS, forcedNodes, getNode, nodeTimeline } from '../content';
import { useStore } from '../store';
import './Timeline.css';

type Filter = 'all' | 'before' | 'after';

/** The transformer is the hinge everything else is either side of. */
const HINGE = 2017;

export function Timeline() {
  const focusNode = useStore((s) => s.focusNode);
  const setLearn = useStore((s) => s.setLearn);
  const [filter, setFilter] = useState<Filter>('all');

  const dated = useMemo(() => nodeTimeline(), []);
  const shown = dated.filter((d) =>
    filter === 'all' ? true : filter === 'before' ? d.year < HINGE : d.year >= HINGE,
  );
  const span = dated.length ? dated[dated.length - 1]!.year - dated[0]!.year : 0;

  const open = (id: string) => {
    focusNode(id, 'notebook');
    setLearn(false);
  };

  return (
    <section className="tl" data-testid="timeline">
      <header className="tl-head">
        <h2>Why the parts are the parts</h2>
        <p>
          Not the values, the categories. Each one is the leftover of a problem somebody had.{' '}
          <b>{dated.length}</b> dated fixes across <b>{span}</b> years, plus{' '}
          <b>{forcedNodes().length}</b> things nobody chose.
        </p>
        <div className="tl-filters" role="group" aria-label="Filter by era">
          {(
            [
              ['all', 'Everything'],
              ['before', `Before the transformer`],
              ['after', `${HINGE} onwards`],
            ] as Array<[Filter, string]>
          ).map(([k, label]) => (
            <button
              key={k}
              className={`tl-f${filter === k ? ' on' : ''}`}
              onClick={() => setFilter(k)}
              data-testid={`filter-${k}`}
            >
              {label}
            </button>
          ))}
        </div>
      </header>

      {/* Nobody chose these, so they sit outside the timeline rather than at
          the start of it. A year would imply an alternative history. */}
      {filter === 'all' && (
        <div className="tl-forced">
          <span className="tl-forced-k">no date, because nobody chose them</span>
          <div className="tl-forced-row">
            {forcedNodes().map((id) => (
              <button key={id} className="tl-chip" onClick={() => open(id)} data-testid={`forced-${id}`}>
                {getNode(id)?.title ?? id}
              </button>
            ))}
          </div>
        </div>
      )}

      <ol className="tl-list">
        {shown.map((d) => {
          const node = getNode(d.id);
          const o = ORIGINS[d.id];
          if (!node || !o || o.kind !== 'fix') return null;
          const hinge = d.year === HINGE;
          return (
            <li key={d.id} className={`tl-row${hinge ? ' hinge' : ''}`}>
              <button className="tl-open" onClick={() => open(d.id)} data-testid={`year-${d.id}`}>
                <span className="tl-year">{d.year}</span>
                <span className="tl-body">
                  <span className="tl-title">{node.title}</span>
                  {/* The failure, not the feature. This is the row's job. */}
                  <span className="tl-problem">{o.problem}</span>
                </span>
              </button>
            </li>
          );
        })}
      </ol>

      <p className="tl-foot">
        Read the order. Attention is 2014 and the transformer is 2017, so attention is not the
        transformer. Backpropagation is 1986 and belongs to any neural network, not this one.
        Gradient descent is 1847 and was not invented for machines at all.
      </p>
    </section>
  );
}
