/**
 * The index. One row per concept, one lens at a time.
 *
 * This is a pivot, and that is the whole idea. Read DOWN a column and you get a
 * single question asked of every concept at once: what is not in the downloaded
 * file, what only runs while learning, what failed to make this necessary. Read
 * ACROSS a row and you get every lens on one concept, which is what the lesson
 * pages already do.
 *
 * Until this existed the project could only be read across. Every lens was real
 * but scattered over different screens, so nobody could ask "show me everything
 * that leaves no trace" and get an answer. That question turns out to teach more
 * than most of the prose.
 *
 * Each lens reports its own coverage, in the open. A lens at 61% is a lens with
 * a hole in it, and hiding that behind a tidy table would be the same dishonesty
 * as an empty box that looks full.
 */

import { useMemo, useState } from 'react';
import { ASPECTS, NODES, ORIGINS, PHASE_LABEL, PRACTICE, sourcedCount } from '../content';
import type { ConceptNode, Phase } from '../content/schema';
import { useStore } from '../store';
import './ConceptIndex.css';

type LensId = 'what' | 'use' | 'choose' | 'why' | 'when' | 'file' | 'code' | 'scale';

interface Lens {
  id: LensId;
  label: string;
  question: string;
  /** The cell for one concept, or null when this lens has nothing to say. */
  cell: (n: ConceptNode) =>
    | { text: string; absent?: boolean; note?: string; judgement?: boolean }
    | null;
  /** True when this lens is opinion rather than checkable fact. */
  opinion?: boolean;
  /**
   * What this lens holds, counted rather than claimed.
   *
   * "Why it exists" reads 100%, and its first six rows all say NO HISTORY,
   * because groupings and mathematical objects sort to the top. A reader who
   * opens the lens and scrolls no further concludes it is empty, which is the
   * box that looks full in a new costume. Saying "42 carry a dated fix" up
   * front is the fix, and the number is computed so it cannot drift.
   */
  summary?: () => string;
  /** Group rows by when they run rather than by area. */
  byPhase?: boolean;
}

const LENSES: Lens[] = [
  {
    id: 'what',
    label: 'What it is',
    question: 'In one sentence, what is this?',
    cell: (n) => ({ text: n.L0_oneLiner }),
  },
  {
    id: 'use',
    label: 'What it is for',
    question: 'In practice, what do people use this for?',
    opinion: true,
    cell: (n) => {
      const p = PRACTICE[n.id];
      if (!p) return null;
      return { text: p.useCase, judgement: p.confidence === 'judgement' };
    },
  },
  {
    id: 'choose',
    label: 'When to choose it',
    question: 'When would you reach for this, and when would you not?',
    opinion: true,
    summary: () => `${sourcedCount()} of ${NODES.length} rest on a published source. The rest are informed opinion.`,
    cell: (n) => {
      const p = PRACTICE[n.id];
      if (!p) return null;
      return {
        text: p.choose,
        note: p.confidence === 'sourced' ? 'sourced' : undefined,
        judgement: p.confidence === 'judgement',
      };
    },
  },
  {
    id: 'why',
    label: 'Why it exists',
    question: 'What was broken before it, and when?',
    summary: () => {
      const all = NODES.map((n) => ORIGINS[n.id]).filter(Boolean);
      const fix = all.filter((o) => o!.kind === 'fix');
      const years = fix.map((o) => (o as { year: number }).year).sort((a, b) => a - b);
      return `${fix.length} carry a dated fix, from ${years[0]} to ${years[years.length - 1]}. ${
        all.filter((o) => o!.kind === 'forced').length
      } nobody chose. ${all.filter((o) => o!.kind === 'none').length} have no history to tell, and say so.`;
    },
    cell: (n) => {
      const o = ORIGINS[n.id];
      if (!o) return null;
      if (o.kind === 'none') return { text: o.because, note: 'no history' };
      return o.kind === 'forced'
        ? { text: o.because, note: 'nobody chose it' }
        : { text: o.problem, note: String(o.year) };
    },
  },
  {
    id: 'when',
    label: 'When it runs',
    question: 'Learning, answering, both, or once at setup?',
    byPhase: true,
    cell: (n) => {
      const a = ASPECTS[n.id];
      return a ? { text: PHASE_LABEL[a.phase] } : null;
    },
  },
  {
    id: 'file',
    label: 'In the file',
    question: 'What of it exists in the model you download?',
    summary: () => {
      const gone = NODES.filter((n) => ASPECTS[n.id]?.trace === null).length;
      return `${gone} of ${NODES.length} leave nothing at all in the file you download.`;
    },
    byPhase: true,
    cell: (n) => {
      const a = ASPECTS[n.id];
      if (!a) return null;
      return a.trace === null
        ? { text: 'Nothing. It is not in there.', absent: true }
        : { text: a.trace };
    },
  },
  {
    id: 'code',
    label: 'The code',
    question: 'What actually does it?',
    byPhase: true,
    cell: (n) => {
      const a = ASPECTS[n.id];
      return a?.code ? { text: a.code } : null;
    },
  },
  {
    id: 'scale',
    label: 'At real scale',
    question: 'What does this look like in a model people actually use?',
    cell: (n) => {
      const s = n.L3_atScale[0];
      if (!s) return null;
      const big = s.llama ?? s.gpt2;
      return big ? { text: `${s.label}: ${big}`, note: `here ${s.here}` } : null;
    },
  },
];

const PHASE_ORDER: Phase[] = ['both', 'training', 'inference', 'setup'];
const TRACK_LABEL: Record<string, string> = {
  model: 'The model',
  build: 'Building it',
  operations: 'Running it',
  beyond: 'Beyond text',
};

export function ConceptIndex() {
  const focusNode = useStore((s) => s.focusNode);
  const setLearn = useStore((s) => s.setLearn);
  const [lensId, setLensId] = useState<LensId>('file');
  const [gapsOnly, setGapsOnly] = useState(false);

  const lens = LENSES.find((l) => l.id === lensId)!;

  /** Coverage per lens, computed rather than claimed. */
  const coverage = useMemo(
    () =>
      Object.fromEntries(
        LENSES.map((l) => [l.id, NODES.filter((n) => l.cell(n) !== null).length]),
      ) as Record<LensId, number>,
    [],
  );

  const rows = NODES.map((n) => ({ n, c: lens.cell(n) })).filter(
    (r) => (gapsOnly ? r.c === null || r.c.absent : true),
  );

  const groups = lens.byPhase
    ? PHASE_ORDER.map((p) => ({
        key: p,
        label: PHASE_LABEL[p],
        rows: rows.filter((r) => ASPECTS[r.n.id]?.phase === p),
      })).concat([
        { key: 'none' as Phase, label: 'Not answered yet', rows: rows.filter((r) => !ASPECTS[r.n.id]) },
      ])
    : ['model', 'build', 'operations', 'beyond'].map((t) => ({
        key: t as Phase,
        label: TRACK_LABEL[t]!,
        rows: rows.filter((r) => r.n.track === t),
      }));

  const open = (id: string) => {
    focusNode(id, 'notebook');
    setLearn(false);
  };

  return (
    <section className="ci" data-testid="concept-index">
      <header className="ci-head">
        <h2>The index</h2>
        <p>
          One question, asked of everything at once. Every lesson can answer several of these;
          this is the only place you can read one answer straight down the list.
        </p>

        <div className="ci-lenses" role="group" aria-label="Choose a lens">
          {LENSES.map((l) => {
            const pct = Math.round((coverage[l.id] / NODES.length) * 100);
            return (
              <button
                key={l.id}
                className={`ci-lens${l.id === lensId ? ' on' : ''}`}
                onClick={() => setLensId(l.id)}
                data-testid={`lens-${l.id}`}
              >
                <b>{l.label}</b>
                {/* Coverage in the open. A lens with a hole should say so. */}
                <em className={pct === 100 ? 'full' : pct < 50 ? 'thin' : ''}>{pct}%</em>
              </button>
            );
          })}
        </div>

        <div className="ci-q">
          <span>
            {lens.question}
            {/* Everything else in this project can be checked: a date has a
                paper, a number is recomputed, a trace can be verified against a
                real download. These two cannot, and saying so is the difference
                between an opinion and a fact wearing the same typeface. */}
            {lens.opinion && (
              <em className="ci-warn" data-testid="opinion-warning">
                {' '}
                Judgement, not fact. Marked where a published source backs it.
              </em>
            )}
          </span>
          <button
            className={`ci-gaps${gapsOnly ? ' on' : ''}`}
            onClick={() => setGapsOnly(!gapsOnly)}
            data-testid="gaps-only"
          >
            {gapsOnly ? 'show everything' : 'show only the gaps'}
          </button>
        </div>

        {lens.summary && (
          <p className="ci-sum" data-testid="lens-summary">
            {lens.summary()}
          </p>
        )}
      </header>

      <div className="ci-wrap">
        {gapsOnly && rows.length === 0 && (
          <p className="ci-none" data-testid="no-gaps">
            No gaps in this lens. Every concept has an answer here.
          </p>
        )}
        <table className="ci-tbl">
          {groups.map((g) =>
            g.rows.length === 0 ? null : (
              <tbody key={String(g.key)} className={`ci-g ci-${String(g.key)}`}>
                <tr className="ci-sep">
                  <td colSpan={2}>{g.label}</td>
                </tr>
                {g.rows.map(({ n, c }) => (
                  <tr key={n.id} data-testid={`row-${n.id}`}>
                    <td className="ci-c">
                      <button onClick={() => open(n.id)}>{n.title}</button>
                    </td>
                    <td className={`ci-v${c?.absent ? ' absent' : ''}${c ? '' : ' empty'}`}>
                      {c ? (
                        <>
                          {c.note && <span className="ci-note">{c.note}</span>}
                          {c.text}
                        </>
                      ) : (
                        /* An unanswered cell is shown rather than hidden. A tidy
                           table with the gaps filtered out would be the empty box
                           that looks full, again. */
                        'not written yet'
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            ),
          )}
        </table>
      </div>

      <p className="ci-foot">
        Every lens now answers every concept, which is why the percentages read 100. Six of
        the eight are checkable: a date has a paper, a number is recomputed, a trace can be
        confirmed against a real download. <b>What it is for</b> and <b>when to choose it</b>
        {' '}cannot be checked that way. They are marked, and they are still waiting on
        someone watching a learner actually use this.
      </p>
    </section>
  );
}
