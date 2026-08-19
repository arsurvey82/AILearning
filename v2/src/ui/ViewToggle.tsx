/**
 * ViewToggle, CLAUDE.md §7.1.
 *
 * A persistent segmented control. The two views are co-equal, so neither is
 * styled as the "real" one with the other as an escape hatch.
 */

import { useStore } from '../store';
import './ViewToggle.css';

export function ViewToggle() {
  const view = useStore((s) => s.view);
  const setView = useStore((s) => s.setView);

  return (
    <div className="vt" role="group" aria-label="Switch view">
      {(['map', 'notebook'] as const).map((v) => (
        <button
          key={v}
          className={`vt-btn${view === v ? ' on' : ''}`}
          aria-pressed={view === v}
          onClick={() => setView(v)}
        >
          <span aria-hidden="true">{v === 'map' ? '◎' : '▤'}</span>
          {v === 'map' ? 'Map' : 'Notebook'}
        </button>
      ))}
    </div>
  );
}
