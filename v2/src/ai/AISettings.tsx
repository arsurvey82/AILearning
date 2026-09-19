/**
 * The bring-your-own-key panel.
 *
 * Three providers, one free-text model field, and an honest warning. The key is
 * held in React/zustand state only. It is not written to localStorage, so it
 * is gone on reload. That is the correct default for a page that can be opened
 * straight off disk: persisting a credential to a static file's origin is a
 * worse trade than retyping it.
 */

import { useEffect, useRef, useState } from 'react';
import { useStore } from '../store';
import { listModels, PROVIDERS, type ModelOption, type ProviderId } from './providers';
import './AISettings.css';

export function AISettings() {
  const open = useStore((s) => s.aiSettingsOpen);
  const close = useStore((s) => s.closeAISettings);
  const provider = useStore((s) => s.aiProvider);
  const apiKey = useStore((s) => s.aiKey);
  const model = useStore((s) => s.aiModel);
  const reasoning = useStore((s) => s.aiReasoning);
  const setAI = useStore((s) => s.setAI);
  const clearAI = useStore((s) => s.clearAI);

  const [reveal, setReveal] = useState(false);
  const [models, setModels] = useState<ModelOption[] | null>(null);
  const [finding, setFinding] = useState(false);
  const [findError, setFindError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const firstRef = useRef<HTMLSelectElement>(null);

  // A model id from one provider is meaningless to another, so a discovered
  // list must not survive a provider switch.
  useEffect(() => {
    setModels(null);
    setFindError(null);
  }, [provider]);

  useEffect(() => {
    if (!open) return;
    firstRef.current?.focus();
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation(); // don't also collapse the notebook's layers
        close();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, close]);

  if (!open) return null;

  const spec = PROVIDERS[provider];
  const listId = `models-${provider}`;

  /**
   * Ask the key what it can reach, then pick the best fit for this job.
   *
   * This exists because a hardcoded default produced a 404 nobody could act
   * on: the model had been retired for new accounts. A list from the account
   * itself cannot go stale, and it turns "that name is wrong" into "here is
   * what is right".
   */
  const find = async () => {
    setFinding(true);
    setFindError(null);
    try {
      const found = await listModels(provider, apiKey);
      setModels(found);
      // Only fill an empty field. Overwriting a deliberate choice because the
      // user pressed a discovery button would be taking the decision away.
      if (found.length && !model.trim()) setAI({ model: found[0]!.id });
      if (!found.length) setFindError('That key did not return any usable chat models.');
    } catch (e) {
      setFindError(e instanceof Error ? e.message : String(e));
    } finally {
      setFinding(false);
    }
  };

  return (
    <div className="ais-backdrop" onMouseDown={(e) => e.target === e.currentTarget && close()}>
      <div
        className="ais"
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="ais-title"
      >
        <div className="ais-head">
          <h2 id="ais-title">Connect an LLM</h2>
          <button className="ais-x" onClick={close} aria-label="Close">
            ✕
          </button>
        </div>

        <p className="ais-lede">
          Optional. Every lesson, number and interaction on this page works without a key, this
          only adds a follow-up question box, grounded in the lesson content.
        </p>

        <label className="ais-l" htmlFor="ais-provider">
          Provider
        </label>
        <select
          id="ais-provider"
          ref={firstRef}
          className="ais-input"
          value={provider}
          onChange={(e) => setAI({ provider: e.target.value as ProviderId })}
        >
          {Object.values(PROVIDERS).map((p) => (
            <option key={p.id} value={p.id}>
              {p.label}
            </option>
          ))}
        </select>

        <label className="ais-l" htmlFor="ais-key">
          {spec.keyless ? 'API key (not needed)' : 'API key'}
        </label>
        <div className="ais-keyrow">
          <input
            id="ais-key"
            className="ais-input"
            type={reveal ? 'text' : 'password'}
            value={apiKey}
            spellCheck={false}
            autoComplete="off"
            placeholder={spec.keyHint}
            onChange={(e) => setAI({ key: e.target.value })}
          />
          <button
            className="ais-ghost"
            type="button"
            onClick={() => setReveal((r) => !r)}
            aria-label={reveal ? 'Hide key' : 'Show key'}
          >
            {reveal ? 'hide' : 'show'}
          </button>
        </div>
        <p className="ais-hint">
          {spec.keyless ? (
            <>
              Nothing to paste. Leave this empty.{' '}
              <a href={spec.keysUrl} target="_blank" rel="noreferrer noopener">
                Setup instructions
              </a>
              .
            </>
          ) : (
            <>
              Get one at{' '}
              <a href={spec.keysUrl} target="_blank" rel="noreferrer noopener">
                {new URL(spec.keysUrl).host}
              </a>
              .
            </>
          )}
        </p>

        {/* Nobody arrives knowing which of these they want, and "add an API
            key" with no idea where to get one is the same dead end as a map
            that stops. So the four honest answers, with what each costs. */}
        <details className="ais-help" data-testid="ai-help">
          <summary>I do not have a key. What are my options?</summary>
          <dl>
            <dt>Free and private, nothing leaves this machine</dt>
            <dd>
              <b>LM Studio.</b> Install it, download a model, start its local server. No account,
              no key, no cost. Slower than a hosted model and limited by your own hardware, which
              on this laptop is plenty for re-explaining a paragraph.
            </dd>
            <dt>Free, hosted</dt>
            <dd>
              <b>Google AI Studio</b> gives a key at no cost. <b>OpenRouter</b> with the model{' '}
              <code>openrouter/free</code> costs nothing for about 50 requests a day, and picks a
              free model for you so you do not have to choose one.
            </dd>
            <dt>Paid, best quality</dt>
            <dd>
              <b>Anthropic</b> or <b>OpenAI</b> directly. You pay per request, and for this use,
              re-explaining a short lesson, that is fractions of a penny.
            </dd>
            <dt>One key, many models</dt>
            <dd>
              <b>OpenRouter</b> again. One account reaches most providers, which is the least
              painful option if you expect to switch.
            </dd>
          </dl>
          <p>
            Whatever you choose, the key is held in memory for this page only. It is never saved
            to disk and never sent anywhere except the provider you picked.
          </p>
        </details>

        <label className="ais-l" htmlFor="ais-model">
          Model
        </label>
        <div className="ais-keyrow">
          <input
            id="ais-model"
            className="ais-input"
            value={model}
            spellCheck={false}
            autoComplete="off"
            list={models?.length || spec.modelSuggestions.length ? listId : undefined}
            placeholder={spec.defaultModel || 'model name'}
            onChange={(e) => setAI({ model: e.target.value })}
          />
          {spec.listUrl && (
            <button
              className="ais-ghost"
              type="button"
              onClick={find}
              disabled={finding || (!apiKey.trim() && !spec.keyless)}
              title={
                spec.keyless
                  ? 'List the models your local server has loaded'
                  : apiKey.trim()
                    ? 'List the models this key can reach'
                    : 'Paste a key first'
              }
            >
              {finding ? 'finding…' : 'Find models'}
            </button>
          )}
        </div>

        {/* The field stays free text even after discovery. The list is help,
            not a gate. A brand-new model your key can reach should never be
            unusable because our filter did not recognise its name. */}
        {(models?.length || spec.modelSuggestions.length) > 0 && (
          <datalist id={listId}>
            {(models?.length ? models.map((m) => m.id) : spec.modelSuggestions).map((m) => (
              <option key={m} value={m} />
            ))}
          </datalist>
        )}

        {models?.length ? (
          <>
            <div className="ais-models">
              {models.slice(0, 8).map((m) => (
                <button
                  key={m.id}
                  type="button"
                  className={`ais-model${m.id === model ? ' on' : ''}`}
                  onClick={() => setAI({ model: m.id })}
                >
                  {m.label}
                  {m.free && <em>free</em>}
                </button>
              ))}
            </div>
            <p className="ais-hint">
              {models.length} model{models.length === 1 ? '' : 's'} your key can reach. The first is
              a guess at the cheapest fast one, which is the right shape for re-explaining a
              paragraph, any of them work.
            </p>
          </>
        ) : (
          <p className="ais-hint">{spec.modelHint}</p>
        )}

        {findError && (
          <p className="ais-error" role="alert">
            <span aria-hidden="true">⚠ </span>
            {findError}
          </p>
        )}

        {spec.supportsReasoning && (
          <>
            <label className="ais-check">
              <input
                type="checkbox"
                checked={reasoning}
                onChange={(e) => setAI({ reasoning: e.target.checked })}
              />
              <span>
                Let the model reason before answering
                <em>
                  {' '}
. Reasoning tokens bill as output tokens, and on the free router they use up the
                  daily request budget faster. A four-sentence re-explanation rarely needs it.
                </em>
              </span>
            </label>
          </>
        )}

        <div className="ais-warn">
          {/* Warning a reader that their key is visible in devtools is only
              useful when they have one. On a local model the honest note is
              the opposite: nothing leaves the machine at all. */}
          {spec.keyless ? (
            <>
              <strong>Where this goes.</strong> Nowhere. Requests are sent to {spec.label} on this
              computer, over localhost. No key, no account, and nothing about your questions or the
              lesson leaves the machine.
            </>
          ) : (
            <>
              <strong>Where this key goes.</strong> Requests are sent straight from this page to{' '}
              {spec.label}. The key is kept in memory only. Nothing is written to storage, so it is
              gone when you reload, and it is never part of the published file. But a key used from
              a browser is visible in the network tab, so use one you are happy to rotate, and
              don't enter a key on a copy of this page you didn't build.
            </>
          )}
        </div>

        <div className="ais-actions">
          {apiKey && (
            <button className="ais-ghost" onClick={clearAI}>
              Forget key
            </button>
          )}
          <button className="ais-done" onClick={close}>
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
