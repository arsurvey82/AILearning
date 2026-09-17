/**
 * Scale one. Seven words, four numbers each, small enough to print.
 *
 * The trained transformer is scale two, and it was wrong to make it the front
 * door. At sixty-four wide you can only ever show a reader a heatmap of a row;
 * at four you can print the row and they can read it out loud. That is the
 * difference between a diagram of a thing and the thing itself.
 *
 * Three structures borrowed from a learning journal that works better than
 * anything I had built:
 *
 *   the one idea first    meaning becomes location, so similarity becomes
 *                         distance, and nothing has to understand anything
 *   two different times   build and run, because most confusion comes from
 *                         mixing them up
 *   origin, by date       every knob is the leftover of a dated failure, and
 *                         walking back to the failure is what stops it feeling
 *                         arbitrary
 *
 * Every term in every line here can be opened, because a reader may not know
 * some of it, or any of it, and an explanation with an undefined word in it is
 * what "vague" actually means.
 */

import { useState } from 'react';
import { Prose } from '../glossary/Dig';
import { ConceptIndex } from '../ui/ConceptIndex';
import { Timeline } from '../ui/Timeline';
import { useStore } from '../store';
import tiny from '../model/tiny.json';
import './Start.css';

const T = tiny as {
  vocab: string[];
  dim: number;
  corpus: string[];
  tokens: number[][];
  positions: number[][];
  cat_dog_cosine: number;
  cat_wood_cosine: number;
};

/** How aligned two rows are. The measuring tool, at the size you can check. */
function cosine(a: number[], b: number[]): number {
  const dot = a.reduce((s, x, i) => s + x * b[i]!, 0);
  const na = Math.sqrt(a.reduce((s, x) => s + x * x, 0));
  const nb = Math.sqrt(b.reduce((s, x) => s + x * x, 0));
  return na && nb ? dot / (na * nb) : 0;
}

export function Start() {
  const digTo = useStore((s) => s.digTo);
  const [compare, setCompare] = useState<[string, string]>(['cat', 'dog']);

  const idx = (w: string) => T.vocab.indexOf(w);
  const sim = cosine(T.tokens[idx(compare[0])]!, T.tokens[idx(compare[1])]!);

  return (
    <div className="st">
      {/* ---- the one idea, before anything else ---- */}
      <section className="st-thesis">
        <span className="st-k">the one idea underneath all of it</span>
        <p className="st-big">
          Meaning becomes <em>location</em>.<br />
          So similarity becomes <em>distance</em>.
        </p>
        <Prose
          className="st-tail"
          text="Words do not arrive with positions. We give them positions, using one rule: things that mean similar things go near each other. After that a computer can find related things by measuring, and it never has to know what anything means. That is [[embedding]], and it is the front door of the whole machine."
        />
      </section>

      {/* ---- the table, printed ---- */}
      <section className="st-sec">
        <h2>Seven words, four numbers each</h2>
        <Prose
          className="st-lede"
          text="This is the entire [[token-table]] of a small model, trained on sixteen lines of text. Four is the [[dimension]], which is the width of every row."
        />

        <div className="st-plate">
          <table className="st-nums" data-testid="table">
            <thead>
              <tr>
                <th className="lab">token</th>
                {Array.from({ length: T.dim }, (_, i) => (
                  <th key={i}>c{i + 1}</th>
                ))}
                <th>vs {compare[0]}</th>
              </tr>
            </thead>
            <tbody>
              {T.vocab.map((w, r) => {
                const s = cosine(T.tokens[r]!, T.tokens[idx(compare[0])]!);
                const near = w !== compare[0] && s > 0.8;
                return (
                  <tr key={w} className={near ? 'near' : w === compare[0] ? 'self' : ''}>
                    <td className="lab">
                      <button onClick={() => setCompare([w, compare[0]])} data-testid={`row-${w}`}>
                        {w}
                      </button>
                    </td>
                    {T.tokens[r]!.map((v, c) => (
                      <td key={c}>{v.toFixed(2)}</td>
                    ))}
                    <td className="sim">{w === compare[0] ? '—' : s.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        <p className="st-note" data-testid="verdict">
          <b>{compare[0]}</b> and <b>{compare[1]}</b> score{' '}
          <b className="st-hi">{sim.toFixed(2)}</b>. Nobody typed these numbers in. They came out
          of the sixteen lines below, because those two words keep the same company.
        </p>

        <details className="st-corpus">
          <summary>the whole corpus it learned from</summary>
          <ul>
            {T.corpus.map((line, i) => (
              <li key={i}>{line}</li>
            ))}
          </ul>
          <Prose text="Change any of it and the table changes, because a word is placed by the company it keeps. That is all [[training]] does here." />
        </details>
      </section>

      {/* ---- two different times ---- */}
      <section className="st-sec">
        <h2>Two different times</h2>
        <p className="st-lede">
          Almost every confusion about these models comes from mixing these up.
        </p>
        <div className="st-times">
          <div className="st-time">
            <button className="st-time-k" onClick={() => digTo('build-time')}>
              time one · build
            </button>
            <ol>
              <li>gather documents</li>
              <li>read them, decide the vocabulary</li>
              <li>a person writes the settings</li>
              <li>create both tables, full of random numbers</li>
            </ol>
            <p>Happens once. Everything is the right shape and the wrong values.</p>
          </div>
          <div className="st-time run">
            <button className="st-time-k" onClick={() => digTo('run-time')}>
              time two · run
            </button>
            <ol>
              <li>text arrives</li>
              <li>text becomes token ids</li>
              <li>ids look up rows</li>
              <li>position rows get added</li>
            </ol>
            <p>Happens every single time text goes in. Both tables existed already.</p>
          </div>
        </div>
        <Prose
          className="st-note"
          text="[[training]] is not a third time. It is time two, run millions of times, with the numbers corrected after each one. When it stops, the numbers freeze and the machinery is identical."
        />
      </section>

      {/* ---- the index: one question, asked of everything ---- */}
      <ConceptIndex />

      {/* ---- origin: the walk-back path ---- */}
      <Timeline />
    </div>
  );
}
