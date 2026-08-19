/**
 * The entry point into the forward pass.
 *
 * Extracted from the map for the same reason as the drill-down chips: it is not
 * a map feature, it is the front door. When the graphic pane stopped defaulting
 * to the map, this button went with it and there was no longer an obvious way
 * to start walking, which is the one thing a first-time reader most needs.
 */

import { FORWARD_PASS, forwardPassBuiltCount } from '../content';
import { DEFAULT_INPUT } from '../model/toyModel';
import { useStore } from '../store';

export function WalkStart() {
  const focusNode = useStore((s) => s.focusNode);
  return (
    <button
      className="map-start"
      onClick={() => {
        const first = FORWARD_PASS[0];
        if (first) focusNode(first, 'notebook');
      }}
    >
      <span className="map-start-t">▶ Walk the forward pass</span>
      <span className="map-start-d">
        Follow one input, {DEFAULT_INPUT}, from raw letters to attention , {' '}
        {forwardPassBuiltCount()} steps built in full
      </span>
    </button>
  );
}
