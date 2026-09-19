/**
 * The facilitator's notepad, for running the protocol in docs/playtest-protocol.md.
 *
 * The protocol asks for two things at once that a human cannot actually do
 * together: watch someone closely enough to catch a silent stumble, and write
 * down where they were when it happened. "Record the screen, or take
 * timestamped notes. You will not remember it."
 *
 * But the app already knows where they were. Which concept, which layers are
 * open, which surface, what input is in the run box. So the only thing a
 * facilitator should ever have to type is the one thing the app cannot know:
 * the learner's exact words. Everything else is captured on the keypress.
 *
 * Two rules this respects, both from the protocol:
 *
 *   The learner must never see this. A visible research instrument changes the
 *   session, so it is off unless the URL ends in #playtest, which a learner
 *   will not type and a facilitator sets up before they sit down.
 *
 *   Their wording is the artifact. The field is labelled "their exact words"
 *   and the export preserves them verbatim, because a tidied heading is the
 *   thing that stops a snag card working.
 *
 * It deliberately does NOT decide what becomes a snag. That filter has four
 * gates and one of them is "two or more people hit it", which no single
 * session can answer. This records; the judgement stays with a person.
 */

import { useEffect, useState } from 'react';
import { getNode } from '../content';
import { useStore } from '../store';
import './Recorder.css';

type Kind = 'said' | 'silent';

interface Entry {
  /** Seconds since the session started. */
  at: number;
  kind: Kind;
  /** Their words, verbatim. Empty for a silent stumble. */
  words: string;
  /** Captured, not typed. */
  where: string;
  resolvedAlone: boolean | null;
}

/** Where the learner was, in the protocol's terms, read from live state. */
function whereNow(): string {
  const s = useStore.getState();
  const node = getNode(s.focusNodeId);
  const layers = [...s.openLayers];
  const bits = [node?.title ?? s.focusNodeId];
  if (s.learn) bits.push('trained-model surface');
  else bits.push(s.graphic === 'universe' ? 'universe map' : 'structure pane');
  if (layers.length) bits.push(`${layers.join(' + ')} open`);
  if (s.level === 'practised') bits.push('practised mode');
  if (s.dig.length) bits.push(`digging: ${s.dig[s.dig.length - 1]}`);
  /* Only where the run box is actually on screen. Otherwise it lands on every
     single row and the one line that matters gets lost in boilerplate. */
  if (node?.L1?.example && s.runInput) bits.push(`input "${s.runInput}"`);
  return bits.join(', ');
}

const mmss = (n: number) =>
  `${String(Math.floor(n / 60)).padStart(2, '0')}:${String(n % 60).padStart(2, '0')}`;

export function Recorder() {
  const [on, setOn] = useState(false);
  const [startedAt, setStartedAt] = useState<number | null>(null);
  const [now, setNow] = useState(0);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [draft, setDraft] = useState('');
  const [pendingWhere, setPendingWhere] = useState<string | null>(null);
  const [pendingAt, setPendingAt] = useState(0);
  const [copied, setCopied] = useState(false);

  /* A learner will not type this. A facilitator sets it before they sit down.
     Checked on mount and on hashchange, so it can be turned on mid-session
     without losing the app's state. */
  useEffect(() => {
    const check = () => setOn(window.location.hash === '#playtest');
    check();
    window.addEventListener('hashchange', check);
    return () => window.removeEventListener('hashchange', check);
  }, []);

  useEffect(() => {
    if (startedAt === null) return;
    const t = setInterval(() => setNow(Math.floor((Date.now() - startedAt) / 1000)), 1000);
    return () => clearInterval(t);
  }, [startedAt]);

  if (!on) return null;

  const elapsed = startedAt === null ? 0 : now;

  const begin = () => {
    setStartedAt(Date.now());
    setEntries([]);
    setNow(0);
  };

  /* The capture happens HERE, on the keypress, not when the facilitator
     finishes typing. By then the learner has moved on and the context would
     record where they went next rather than where they got stuck. */
  const catchIt = (kind: Kind) => {
    const where = whereNow();
    const at = elapsed;
    if (kind === 'silent') {
      setEntries((e) => [...e, { at, kind, words: '', where, resolvedAlone: null }]);
      return;
    }
    setPendingWhere(where);
    setPendingAt(at);
  };

  const commit = () => {
    if (pendingWhere === null) return;
    setEntries((e) => [
      ...e,
      { at: pendingAt, kind: 'said', words: draft.trim(), where: pendingWhere, resolvedAlone: null },
    ]);
    setDraft('');
    setPendingWhere(null);
  };

  const mark = (i: number, resolvedAlone: boolean) =>
    setEntries((e) => e.map((x, j) => (j === i ? { ...x, resolvedAlone } : x)));

  /** The protocol's log table, filled in. Paste straight into a session note. */
  const asMarkdown = () => {
    const rows = entries.map((e) => {
      const words = e.kind === 'silent' ? '(silent stumble)' : `"${e.words}"`;
      const res =
        e.resolvedAlone === null ? 'not marked' : e.resolvedAlone ? 'alone' : 'needed telling';
      return `| ${mmss(e.at)} | ${words} | ${e.where} | ${res} |`;
    });
    return [
      `# Playtest session`,
      ``,
      `Length: ${mmss(elapsed)}. Stumbles: ${entries.length} (${
        entries.filter((e) => e.kind === 'silent').length
      } silent).`,
      ``,
      `| At | Their words | Where they were | Resolved |`,
      `| --- | --- | --- | --- |`,
      ...rows,
      ``,
      `Their wording is the artifact and is recorded verbatim. Nothing here is a`,
      `snag yet: the four gates in docs/playtest-protocol.md decide that, and one`,
      `of them cannot be answered by a single session.`,
    ].join('\n');
  };

  const copy = () => {
    void navigator.clipboard?.writeText(asMarkdown());
    setCopied(true);
    setTimeout(() => setCopied(false), 1600);
  };

  return (
    <aside className="pt" data-testid="recorder" aria-label="Playtest recorder, facilitator only">
      <header className="pt-head">
        <b>Playtest</b>
        {startedAt === null ? (
          <button className="pt-go" onClick={begin} data-testid="pt-start">
            Start session
          </button>
        ) : (
          <span className="pt-clock" data-testid="pt-clock">
            {mmss(elapsed)}
          </span>
        )}
      </header>

      {startedAt !== null && (
        <>
          <div className="pt-btns">
            <button onClick={() => catchIt('said')} data-testid="pt-said">
              They said something
            </button>
            <button onClick={() => catchIt('silent')} data-testid="pt-silent">
              Silent stumble
            </button>
          </div>

          {pendingWhere !== null && (
            <div className="pt-draft">
              {/* Their words, not a tidied heading. The protocol is explicit
                  that the phrasing is what makes a card work. */}
              <label htmlFor="pt-words">Their exact words</label>
              <input
                id="pt-words"
                value={draft}
                autoFocus
                placeholder="wait, is position 3 an A?"
                onChange={(e) => setDraft(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && commit()}
                data-testid="pt-words"
              />
              <p className="pt-where">{pendingWhere}</p>
              <button onClick={commit} data-testid="pt-commit">
                Log it
              </button>
            </div>
          )}

          <ol className="pt-list" data-testid="pt-list">
            {entries.map((e, i) => (
              <li key={i} className={e.kind}>
                <span className="pt-at">{mmss(e.at)}</span>
                <span className="pt-words">
                  {e.kind === 'silent' ? 'silent stumble' : `"${e.words}"`}
                </span>
                <span className="pt-w">{e.where}</span>
                <span className="pt-res">
                  <button
                    className={e.resolvedAlone === true ? 'on' : ''}
                    onClick={() => mark(i, true)}
                  >
                    alone
                  </button>
                  <button
                    className={e.resolvedAlone === false ? 'on' : ''}
                    onClick={() => mark(i, false)}
                  >
                    told
                  </button>
                </span>
              </li>
            ))}
          </ol>

          <footer className="pt-foot">
            <button onClick={copy} data-testid="pt-copy">
              {copied ? 'Copied' : `Copy ${entries.length} as markdown`}
            </button>
          </footer>
        </>
      )}
    </aside>
  );
}
