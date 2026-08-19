/**
 * Gemini's request shape, checked against a stubbed fetch.
 *
 * These are not network tests. They pin the three things that differ from the
 * chat-completions shape and that would each fail silently or confusingly:
 * the model lives in the URL path, the system prompt is its own field, and the
 * assistant role is called "model". Getting any of them wrong produces a 400
 * that reads like a key problem.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { createAdapter, PROVIDERS } from '../src/ai/providers';

function stub(body: unknown, ok = true, status = 200) {
  const spy = vi.fn(async () => ({
    ok,
    status,
    json: async () => body,
    text: async () => JSON.stringify(body),
  })) as unknown as typeof fetch;
  vi.stubGlobal('fetch', spy);
  return spy as unknown as ReturnType<typeof vi.fn>;
}

const REPLY = { candidates: [{ content: { parts: [{ text: 'Because the seats are separate.' }] } }] };

const adapter = () =>
  createAdapter({ provider: 'google', apiKey: 'AIzaTEST', model: 'gemini-2.5-flash' });

afterEach(() => vi.unstubAllGlobals());

describe('Gemini adapter', () => {
  it('puts the model in the URL path, not the body', async () => {
    const f = stub(REPLY);
    await adapter().ask({ grounding: 'g', question: 'q' });
    const [url] = f.mock.calls[0]!;
    expect(url).toContain('/models/gemini-2.5-flash:generateContent');
    expect(url).not.toContain('{model}');
  });

  it('sends the key as a header, so it never lands in a URL or a log', async () => {
    const f = stub(REPLY);
    await adapter().ask({ grounding: 'g', question: 'q' });
    const [url, init] = f.mock.calls[0]! as [string, RequestInit];
    expect((init.headers as Record<string, string>)['x-goog-api-key']).toBe('AIzaTEST');
    expect(url).not.toContain('AIzaTEST');
  });

  it('carries the grounding rules in systemInstruction, not as a message', async () => {
    const f = stub(REPLY);
    await adapter().ask({ grounding: 'VERIFIED THING', question: 'q' });
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.systemInstruction.parts[0].text).toMatch(/never recompute|do not compute|only re-explain/i);
    expect(JSON.stringify(body.contents)).toContain('VERIFIED THING');
    // "system" is not a role Gemini accepts.
    expect(body.contents.every((c: { role: string }) => c.role !== 'system')).toBe(true);
  });

  it('replays an earlier answer as role "model", which is what Gemini calls it', async () => {
    const f = stub(REPLY);
    await adapter().ask({
      grounding: 'g',
      question: 'and why?',
      history: [
        { role: 'user', content: 'what is a seat?' },
        { role: 'assistant', content: 'a position slot' },
      ],
    });
    const body = JSON.parse((f.mock.calls[0]![1] as RequestInit).body as string);
    expect(body.contents.map((c: { role: string }) => c.role)).toEqual(['user', 'model', 'user']);
    expect(body.contents.every((c: { role: string }) => c.role !== 'assistant')).toBe(true);
  });

  it('reports a blocked prompt instead of rendering a blank answer', async () => {
    // Gemini returns HTTP 200 with no candidates when it declines.
    stub({ promptFeedback: { blockReason: 'SAFETY' } });
    await expect(adapter().ask({ grounding: 'g', question: 'q' })).rejects.toThrow(/SAFETY/);
  });

  it('reports an empty candidate rather than showing nothing', async () => {
    stub({ candidates: [{ content: { parts: [] }, finishReason: 'MAX_TOKENS' }] });
    await expect(adapter().ask({ grounding: 'g', question: 'q' })).rejects.toThrow(/MAX_TOKENS/);
  });

  it('ships NO hardcoded model name, because that was the bug', () => {
    // `gemini-2.5-flash` was hardcoded here and 404'd for new accounts: Google
    // had withdrawn it. Any name in this file is wrong eventually and fails
    // silently until someone hits it, so the default is discovery instead.
    expect(PROVIDERS.google.label).toMatch(/Gemini/);
    expect(PROVIDERS.google.defaultModel).toBe('');
    expect(PROVIDERS.google.modelSuggestions).toEqual([]);
    expect(PROVIDERS.google.listUrl).toBeTruthy();
  });

  it('stays unavailable with no key, like every other provider', () => {
    expect(createAdapter({ provider: 'google', apiKey: '', model: 'gemini-2.5-flash' }).available).toBe(
      false,
    );
  });
});
