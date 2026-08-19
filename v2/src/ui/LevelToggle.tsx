/**
 * Scaffolding control. The expertise reversal effect, made a user choice.
 *
 * The naive reading of "take a novice to expert" is to add more: more
 * explanation, more analogy, more worked steps. The research says the opposite
 * at the far end. Guidance that raises a novice's learning gains *lowers* an
 * expert's, because it duplicates what their prior knowledge already supplies
 * and they must spend effort reconciling the redundancy.
 *
 * So progression here means the app removing support, not piling it on. The
 * control is explicit rather than inferred from clicks, a wrong guess about
 * someone's expertise is exactly the failure this is trying to avoid, and
 * "you seem experienced now" is a guess.
 */

import { useState } from 'react';
import { useStore, type Level } from '../store';
import './LevelToggle.css';

const COPY: Record<Level, { label: string; hint: string }> = {
  learning: {
    label: 'Learning',
    hint: 'Analogies shown, six numbers at a time, the full scaffolding.',
  },
  practised: {
    label: 'Practised',
    hint: 'Analogies hidden, twelve numbers at a time. Less hand-holding, same content.',
  },
};

export function LevelToggle() {
  const level = useStore((s) => s.level);
  const setLevel = useStore((s) => s.setLevel);
  const [why, setWhy] = useState(false);

  return (
    <div className="lv">
      <div className="lv-row" role="group" aria-label="How much scaffolding to show">
        <span className="lv-l">Detail</span>
        {(Object.keys(COPY) as Level[]).map((l) => (
          <button
            key={l}
            className={`lv-btn${level === l ? ' on' : ''}`}
            aria-pressed={level === l}
            title={COPY[l].hint}
            onClick={() => setLevel(l)}
          >
            {COPY[l].label}
          </button>
        ))}
        <button
          className="lv-why"
          aria-expanded={why}
          onClick={() => setWhy((w) => !w)}
          aria-label="Why this setting exists"
        >
          why?
        </button>
      </div>

      {why && (
        <p className="lv-note">
          Support that helps a beginner measurably <em>hurts</em> someone who already holds the
          idea. It duplicates guidance their own knowledge supplies, and they spend effort
          reconciling the two. That is the <strong>expertise reversal effect</strong>, and it is
          why progressing here means the app showing you <em>less</em>, not more. Nothing is
          removed from the lesson; only the scaffolding around it.
        </p>
      )}
    </div>
  );
}
