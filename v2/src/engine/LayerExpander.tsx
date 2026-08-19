/**
 * LayerExpander. The core interaction (CLAUDE.md §7.3).
 *
 * Four calm expanders, collapsed by default. Only what the learner opens is
 * shown, so the surface stays calm and depth is genuinely opt-in. This is the
 * mechanism design-spec §11 calls "the rabbit hole is the feature".
 */

import type { ReactNode } from 'react';
import './LayerExpander.css';

export interface LayerExpanderProps {
  id: string;
  label: string;
  hint?: string;
  /** e.g. "8 cards". Lets the learner judge the depth before committing. */
  count?: string;
  open: boolean;
  onToggle: () => void;
  children: ReactNode;
}

export function LayerExpander({
  id,
  label,
  hint,
  count,
  open,
  onToggle,
  children,
}: LayerExpanderProps) {
  const panelId = `${id}-panel`;
  return (
    <div className={`lx${open ? ' open' : ''}`}>
      <button
        className="lx-head"
        aria-expanded={open}
        aria-controls={panelId}
        id={`${id}-button`}
        onClick={onToggle}
      >
        <span className="lx-caret" aria-hidden="true">
          ▸
        </span>
        <span className="lx-label">{label}</span>
        {hint && <span className="lx-hint">{hint}</span>}
        {count && <span className="lx-count">{count}</span>}
      </button>
      {/* Mounted only when open: nothing hidden is in the tab order or the
          accessibility tree, and the notebook stays cheap with many cells. */}
      {open && (
        <div className="lx-panel" id={panelId} role="region" aria-labelledby={`${id}-button`}>
          {children}
        </div>
      )}
    </div>
  );
}
