/**
 * ProgressRail, CLAUDE.md §7.3.
 *
 * "How far in am I" made visible without a number to memorise. It counts
 * SIBLINGS, not the whole universe: with ~50 nodes across three continents,
 * "4 of 50" is noise, whereas "3 of 6 inside The Transformer" is a position a
 * learner can actually hold.
 *
 * Outline nodes render hollow and dashed, so the rail also shows honestly how
 * much of this stretch has real ground under it.
 */

import { FORWARD_PASS, getNode, isOnForwardPass, siblingsOf } from '../content';
import { useStore } from '../store';
import './ProgressRail.css';

export function ProgressRail() {
  const focusNodeId = useStore((s) => s.focusNodeId);
  const focusNode = useStore((s) => s.focusNode);
  const visited = useStore((s) => s.visited);

  // On the pipeline the rail counts the PIPELINE, matching what Prev/Next
  // actually does. Off it, siblings are the meaningful stretch.
  const onSpine = isOnForwardPass(focusNodeId);
  const sibs = onSpine
    ? FORWARD_PASS.map((id) => getNode(id)).filter((n): n is NonNullable<typeof n> => !!n)
    : siblingsOf(focusNodeId);

  const i = sibs.findIndex((n) => n.id === focusNodeId);
  const parent = getNode(focusNodeId)?.parent;
  const where = onSpine ? 'the forward pass' : parent ? getNode(parent)?.title : undefined;

  if (sibs.length <= 1) return <span className="pr-text">{where ?? 'the whole map'}</span>;

  return (
    <nav className="pr" aria-label={where ? `Progress along ${where}` : 'Progress'}>
      <ol className="pr-list">
        {sibs.map((n, idx) => {
          const state = n.id === focusNodeId ? 'here' : visited.has(n.id) ? 'seen' : 'unseen';
          return (
            <li key={n.id}>
              <button
                className={`pr-dot ${state} ${n.status}`}
                aria-current={n.id === focusNodeId ? 'step' : undefined}
                aria-label={`${idx + 1}. ${n.title}${n.status === 'stub' ? ' (outline only)' : ''}`}
                title={n.title}
                onClick={() => focusNode(n.id)}
              />
            </li>
          );
        })}
      </ol>
      <span className="pr-text">
        {i + 1} of {sibs.length}
        {where && <span className="pr-where"> {onSpine ? 'along' : 'in'} {where}</span>}
      </span>
    </nav>
  );
}
