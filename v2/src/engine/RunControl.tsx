/**
 * RunControl, CLAUDE.md §7.5.
 *
 * Change the letters and the symbolic core re-runs; every visible number
 * updates. This is the playground threaded through the lesson rather than
 * bolted on beside it, which is why it lives above the notebook and not in a
 * separate "try it" section.
 */

import { useStore } from '../store';
import { CONTEXT, DEFAULT_INPUT, VOCAB } from '../model/toyModel';
import { parseInput } from '../model/embedding';
import './RunControl.css';

export function RunControl() {
  const runInput = useStore((s) => s.runInput);
  const setRunInput = useStore((s) => s.setRunInput);
  const parsed = parseInput(runInput);

  const problems: string[] = [];
  if (parsed.ignored.length > 0) {
    problems.push(
      `ignored ${parsed.ignored.map((c) => `"${c}"`).join(', ')}. Vocabulary is only ${VOCAB.join(', ')}`,
    );
  }
  if (parsed.truncated) {
    problems.push(`cut to ${CONTEXT} letters. That is the whole context window`);
  }

  return (
    <div className="run">
      <label className="run-label" htmlFor="run-input">
        Run
      </label>
      <input
        id="run-input"
        className="run-input tabular"
        value={runInput}
        spellCheck={false}
        autoComplete="off"
        aria-describedby="run-help"
        onChange={(e) => setRunInput(e.target.value)}
      />
      <button className="run-reset" onClick={() => setRunInput(DEFAULT_INPUT)}>
        reset
      </button>
      <p className="run-help" id="run-help">
        {problems.length > 0 ? (
          <span className="run-warn">
            <span aria-hidden="true">⚠ </span>
            {problems.join(' · ')}
          </span>
        ) : (
          <>
            {parsed.letters.length} letter{parsed.letters.length === 1 ? '' : 's'} in{' '}
            {CONTEXT} seats · every number below is recomputed from these
          </>
        )}
      </p>
    </div>
  );
}
