/**
 * The drill-down affordance, extracted so it does not belong to the map.
 *
 * It used to live only in the map overlay, which was fine while the map was
 * always the graphic pane. Once the pane started showing a node's structure
 * instead, fourteen container nodes, including the root, lost their only way
 * down. The chips are not a map feature; they are how you get to a child, and
 * they have to follow the learner rather than one particular rendering.
 */

import { childrenOf, hasChildren } from '../content';
import { useStore } from '../store';

export function InsideChips({ nodeId, showArrow = true }: { nodeId: string; showArrow?: boolean }) {
  const focusNode = useStore((s) => s.focusNode);
  const kids = childrenOf(nodeId);
  if (!kids.length) return null;

  return (
    <div className="map-kids">
      {kids.map((k) => (
        <button
          key={k.id}
          className="map-kid"
          data-node-id={k.id}
          /* Deliberately does not force the view. Side by side it makes no
             difference, both panes are already up. Stacked, it means drilling
             down keeps you in the graphic while you look around, and opening
             the lesson stays a separate, deliberate step. */
          onClick={() => focusNode(k.id)}
        >
          <span className="map-dot" style={{ background: `var(--${k.color})` }} />
          {k.title}
          {showArrow && hasChildren(k.id) && <span className="map-more">›</span>}
        </button>
      ))}
    </div>
  );
}
