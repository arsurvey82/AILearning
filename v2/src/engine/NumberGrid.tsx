/**
 * NumberGrid, CLAUDE.md §7.4.
 *
 * Renders any NumberBlock. Knows nothing about embeddings; it renders labelled
 * rows of numbers with a role colour and a provenance probe.
 *
 * Three rules from the spec drive the design:
 *   - monospace + tabular-nums, so the numbers read as data
 *   - slice big vectors (6 of 48) with a "show all" escape, never dump 48
 *   - hover/focus a cell -> its exact value AND where it came from
 *
 * Deviation, flagged: the spec says "tooltip". A floating tooltip occludes
 * neighbouring cells in a dense grid, which is exactly the wrong trade in a
 * component whose job is comparing adjacent numbers. The probe is instead a
 * persistent readout directly under the grid, wired to aria-live so screen
 * readers get the same information mouse users do. Native `title` is kept as a
 * fallback for hover.
 */

import { useEffect, useRef, useState } from 'react';
import type { NumberBlock, NumberRole } from '../content/schema';
import { useStore } from '../store';
import './NumberGrid.css';

/**
 * How many columns to show before the "show all" escape.
 *
 * 6 for a learner: Miller's classic finding is that immediate working memory
 * holds roughly seven items, so a row you can take in at a glance stays under
 * that. 12 once practised. The constraint is about processing capacity a
 * beginner needs for the concept itself, and someone who already has the
 * schema is spending far less of it there (expertise reversal).
 */
const SLICE_LEARNING = 6;
const SLICE_PRACTISED = 12;

const ROLE_VAR: Record<NumberRole, string> = {
  token: 'var(--role-token)',
  position: 'var(--role-position)',
  input: 'var(--role-input)',
  neutral: 'var(--role-neutral)',
};

/** Always paired with the label so colour is never the only signal (§7.6). */
const ROLE_MARK: Record<NumberRole, string> = {
  token: '●', // filled circle
  position: '▲', // triangle
  input: '■', // square
  neutral: '○',
};

function fmt(n: number): string {
  // Minus infinity is a real value here, not an error: it is what a masked
  // attention score is before softmax, and softmax turns it into exactly zero.
  if (!Number.isFinite(n)) return n < 0 ? '  -inf' : '   inf';
  return (n < 0 ? '' : ' ') + n.toFixed(2); // figure space keeps signs aligned
}

export function NumberGrid({
  block,
  pulseKey,
  /** When supplied, group selection is controlled from outside so this grid
   *  and another view of the same thing cannot disagree. */
  selected,
  onSelect,
}: {
  block: NumberBlock;
  pulseKey?: number;
  selected?: number;
  onSelect?: (i: number) => void;
}) {
  const level = useStore((s) => s.level);
  const [localGroupIdx, setLocalGroupIdx] = useState(0);
  const groupIdx = selected ?? localGroupIdx;
  const setGroupIdx = onSelect ?? setLocalGroupIdx;
  const [showAll, setShowAll] = useState(false);
  const [probe, setProbe] = useState<string | null>(null);
  const gridRef = useRef<HTMLDivElement>(null);

  // Keep the selection valid when the Run control shortens the input.
  const idx = Math.min(groupIdx, Math.max(block.groups.length - 1, 0));
  const group = block.groups[idx];

  // A brief recompute pulse when the input changes (§7.5).
  useEffect(() => {
    const el = gridRef.current;
    if (!el || pulseKey === undefined) return;
    el.classList.remove('pulse');
    void el.offsetWidth; // restart the animation
    el.classList.add('pulse');
  }, [pulseKey]);

  if (!group) {
    return (
      <div className="ng-empty">
        Nothing to embed yet. Type some letters into <strong>Run</strong> above.
      </div>
    );
  }

  const slice = level === 'practised' ? SLICE_PRACTISED : SLICE_LEARNING;
  const shown = showAll ? block.totalDims : Math.min(slice, block.totalDims);
  const hidden = block.totalDims - shown;

  return (
    <figure className="ng" ref={gridRef}>
      <figcaption className="ng-caption">{block.caption}</figcaption>

      {block.groups.length > 1 && (
        <div className="ng-groups" role="tablist" aria-label="Choose which token to inspect">
          {block.groups.map((g, i) => (
            <button
              key={g.id}
              role="tab"
              aria-selected={i === idx}
              className={`ng-chip${i === idx ? ' on' : ''}`}
              onClick={() => setGroupIdx(i)}
            >
              {g.label}
            </button>
          ))}
        </div>
      )}

      <div className="ng-groupmeta">
        <strong>{group.label}</strong>
        {group.sublabel && <span className="ng-sub"> · {group.sublabel}</span>}
      </div>

      <div className="ng-scroll">
        <table className="ng-table tabular">
          <caption className="sr-only">
            {group.label}: {group.rows.map((r) => r.label).join(', ')}, showing {shown} of{' '}
            {block.totalDims} dimensions
          </caption>
          <tbody>
            {group.rows.map((row) => (
              <tr key={row.label} className={`ng-row role-${row.role}`}>
                <th scope="row" className="ng-label">
                  <span aria-hidden="true" style={{ color: ROLE_VAR[row.role] }}>
                    {ROLE_MARK[row.role]}
                  </span>{' '}
                  {row.label}
                </th>
                {Array.from({ length: shown }, (_, d) => {
                  const v = row.values[d];
                  if (v === undefined) return null;
                  const src = row.sourceOf(d);
                  return (
                    <td key={d} className="ng-cellwrap">
                      <button
                        className="ng-cell"
                        style={{ '--role': ROLE_VAR[row.role] } as React.CSSProperties}
                        title={src}
                        aria-label={`${row.label}, dimension ${d}, value ${v}. ${src}`}
                        onMouseEnter={() => setProbe(src)}
                        onFocus={() => setProbe(src)}
                        onMouseLeave={() => setProbe(null)}
                        onBlur={() => setProbe(null)}
                      >
                        {fmt(v)}
                      </button>
                    </td>
                  );
                })}
                {hidden > 0 && (
                  <td className="ng-ellipsis" aria-hidden="true">
                    …
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="ng-foot">
        <span className="ng-count">
          showing {shown} of {block.totalDims} {block.unit ?? 'dimensions'}
        </span>
        {block.totalDims > slice && (
          <button className="ng-more" onClick={() => setShowAll((s) => !s)}>
            {showAll ? 'show fewer' : `show all ${block.totalDims}`}
          </button>
        )}
      </div>

      <p className="ng-probe" aria-live="polite">
        {probe ?? 'Hover or tab onto any number to see where it came from.'}
      </p>

      {block.footnote && <p className="ng-note">{block.footnote}</p>}
    </figure>
  );
}
