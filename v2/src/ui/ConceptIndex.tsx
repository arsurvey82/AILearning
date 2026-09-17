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
import { ASPECTS, NODES, ORIGINS, PHASE_LABEL } from '../content';
import type { ConceptNode, Phase } from '../content/schema';
import { useStore } from '../store';
import './ConceptIndex.css';

type LensId = 'what' | 'why' | 'when' | 'file' | 'code' | 'scale';

interface Lens {
  id: LensId;
  label: string;
  question: string;
  /** The cell for one concept, or null when this lens has nothing to say. */
  cell: (n: ConceptNode) => { text: string; absent?: boolean; note?: string } | null;
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
    id: 'why',
    label: 'Why it exists',
    question: 'What was broken before it, and when?',
    cell: (n) => {
      const o = ORIGINS[n.id];
      if (!o) return null;
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
    : ['model', 'build', 'operations'].map((t) => ({
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
          <span>{lens.question}</span>
          <button
            className={`ci-gaps${gapsOnly ? ' on' : ''}`}
            onClick={() => setGapsOnly(!gapsOnly)}
            data-testid="gaps-only"
          >
            {gapsOnly ? 'show everything' : 'show only the gaps'}
          </button>
        </div>
      </header>

      <div className="ci-wrap">
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
        Two lenses do not exist at all yet: <b>when would I choose this</b> and{' '}
        <b>what is it for in practice</b>. Both are judgement rather than fact, and neither
        should be written before someone has watched a learner use this.
      </p>
    </section>
  );
}
