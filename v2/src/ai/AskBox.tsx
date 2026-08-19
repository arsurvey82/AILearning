/**
 * "Still confused? Ask anything", design-spec §12, Layer B.
 *
 * Sits at the bottom of every node, below the authored snags. The order is
 * deliberate: the playtested cards answer the questions we already know people
 * ask, and this box catches the tail. Without a key the lesson is complete and
 * this box just explains what it would do, the app never degrades.
 */

import { useEffect, useMemo, useRef, useState } from 'react';
import type { ConceptNode, NumberBlock } from '../content/schema';
import { useStore } from '../store';
import { buildGrounding } from './grounding';
import { createAdapter, type Turn } from './providers';
import './AskBox.css';

export function AskBox({ node, block }: { node: ConceptNode; block?: NumberBlock }) {
  const aiProvider = useStore((s) => s.aiProvider);
  const aiKey = useStore((s) => s.aiKey);
  const aiModel = useStore((s) => s.aiModel);
  const aiReasoning = useStore((s) => s.aiReasoning);
  const openAISettings = useStore((s) => s.openAISettings);

  const [question, setQuestion] = useState('');
  /**
   * Follow-ups are a conversation, so prior turns are kept, including each
   * assistant turn's `reasoningDetails`, stored opaquely and replayed
   * unmodified. OpenRouter is explicit that the reasoning sequence must match
   * what the model produced, so it is never parsed or reshaped here.
   */
  const [turns, setTurns] = useState<Turn[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const abortRef = useRef<AbortController | null>(null);

  const adapter = useMemo(
    () =>
      createAdapter({
        provider: aiProvider,
        apiKey: aiKey,
        model: aiModel,
        reasoning: aiReasoning,
      }),
    [aiProvider, aiKey, aiModel, aiReasoning],
  );

  // A new node is a new subject; carrying the old thread would ground answers
  // in content the learner is no longer looking at.
  useEffect(() => {
    setTurns([]);
    setError(null);
    setQuestion('');
  }, [node.id]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    const q = question.trim();
    if (!q || busy) return;

    abortRef.current?.abort();
    const ctrl = new AbortController();
    abortRef.current = ctrl;

    setBusy(true);
    setError(null);
    setQuestion('');
    try {
      const result = await adapter.ask({
        grounding: buildGrounding(node, block),
        question: q,
        history: turns,
        signal: ctrl.signal,
      });
      setTurns((prev) => [
        ...prev,
        { role: 'user', content: q },
        {
          role: 'assistant',
          content: result.text,
          ...(result.reasoningDetails ? { reasoningDetails: result.reasoningDetails } : {}),
        },
      ]);
    } catch (err) {
      if (err instanceof DOMException && err.name === 'AbortError') return;
      setError(err instanceof Error ? err.message : String(err));
      setQuestion(q); // give it back rather than losing what they typed
    } finally {
      setBusy(false);
    }
  };

  if (!adapter.available) {
    return (
      <div className="ask ask-off">
        <p className="ask-off-t">Still confused about {node.title}?</p>
        <p className="ask-off-d">
          Add your own API key and you can ask follow-up questions here. The answer is grounded in
          this lesson's verified content, it re-explains, it never computes. Everything on this
          page already works without one.
        </p>
        <button className="ask-btn" onClick={openAISettings}>
          Add an API key
        </button>
      </div>
    );
  }

  return (
    <form className="ask" onSubmit={submit}>
      <label className="ask-label" htmlFor={`ask-${node.id}`}>
        {turns.length ? `Follow up about ${node.title}` : `Still confused? Ask about ${node.title}`}
      </label>

      {/* The thread. Follow-ups matter here: the second question is usually
          the one that gets at the real confusion. */}
      {turns.length > 0 && (
        <div className="ask-thread">
          {turns.map((t, i) =>
            t.role === 'user' ? (
              <p className="ask-q" key={i}>
                <span aria-hidden="true">›</span> {t.content}
              </p>
            ) : (
              <div className="ask-answer" key={i}>
                {t.content.split(/\n{2,}/).map((p, j) => (
                  <p key={j}>{p}</p>
                ))}
              </div>
            ),
          )}
        </div>
      )}

      <div className="ask-row">
        <input
          id={`ask-${node.id}`}
          className="ask-input"
          value={question}
          placeholder={turns.length ? 'and what about…?' : 'e.g. why does that matter?'}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={busy}
        />
        <button className="ask-btn" type="submit" disabled={busy || !question.trim()}>
          {busy ? 'Asking…' : turns.length ? 'Send' : 'Ask'}
        </button>
        {turns.length > 0 && !busy && (
          <button className="ask-reset" type="button" onClick={() => setTurns([])}>
            clear
          </button>
        )}
      </div>

      <p className="ask-note">
        Grounded in this lesson only. It re-explains the verified content above and is instructed
        not to compute or invent numbers. The arithmetic stays with the model on this page.
      </p>

      {error && (
        <p className="ask-error" role="alert">
          <span aria-hidden="true">⚠ </span>
          {error}
        </p>
      )}

      {turns.length > 0 && (
        <p className="ask-caveat" aria-live="polite">
          Re-explanation only. If any of this conflicts with the numbers or the layers above, the
          lesson is right and this is wrong.
        </p>
      )}
    </form>
  );
}
