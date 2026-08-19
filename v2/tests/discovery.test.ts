/**
 * Model discovery, against stubbed responses.
 *
 * This exists because a hardcoded model name produced a 404 a reader could not
 * act on. Google had retired `gemini-2.5-flash` for new accounts. The lesson
 * is not "pick a better name": it is that any name written into this repo is
 * wrong eventually, and silently. Discovery is the fix, so the four different
 * response shapes need pinning.
 */

import { afterEach, describe, expect, it, vi } from 'vitest';
import { listModels, rankModels, type ModelOption } from '../src/ai/providers';

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

afterEach(() => vi.unstubAllGlobals());

describe('listModels', () => {
  it('strips Google\'s "models/" prefix and drops anything that cannot chat', async () => {
    stub({
      models: [
        { name: 'models/gemini-x-flash', displayName: 'Gemini X Flash', supportedGenerationMethods: ['generateContent'] },
        { name: 'models/text-embedding-99', displayName: 'Embedding', supportedGenerationMethods: ['embedContent'] },
        { name: 'models/gemini-x-pro', displayName: 'Gemini X Pro', supportedGenerationMethods: ['generateContent'] },
      ],
    });
    const out = await listModels('google', 'AIzaTEST');
    const ids = out.map((m) => m.id);
    expect(ids).toContain('gemini-x-flash');
    expect(ids.every((i) => !i.startsWith('models/'))).toBe(true);
    // An embedding model would 404 on generateContent, so it must never be offered.
    expect(ids).not.toContain('text-embedding-99');
  });

  it('sends the right auth header for each provider', async () => {
    const g = stub({ models: [] });
    await listModels('google', 'K');
    expect(((g.mock.calls[0]![1] as RequestInit).headers as Record<string, string>)['x-goog-api-key']).toBe('K');

    const a = stub({ data: [] });
    await listModels('anthropic', 'K');
    const ah = (a.mock.calls[0]![1] as RequestInit).headers as Record<string, string>;
    expect(ah['x-api-key']).toBe('K');
    expect(ah['anthropic-version']).toBe('2023-06-01');

    const o = stub({ data: [] });
    await listModels('openai', 'K');
    expect(((o.mock.calls[0]![1] as RequestInit).headers as Record<string, string>).authorization).toBe(
      'Bearer K',
    );
  });

  it('reads Anthropic display names and OpenAI bare ids', async () => {
    stub({ data: [{ id: 'claude-x', display_name: 'Claude X' }] });
    expect((await listModels('anthropic', 'K'))[0]).toMatchObject({ id: 'claude-x', label: 'Claude X' });

    stub({ data: [{ id: 'gpt-x' }] });
    expect((await listModels('openai', 'K'))[0]).toMatchObject({ id: 'gpt-x', label: 'gpt-x' });
  });

  it('marks an OpenRouter model free only when BOTH prices are zero', async () => {
    stub({
      data: [
        { id: 'a/free', name: 'A', pricing: { prompt: '0', completion: '0' } },
        { id: 'b/paid', name: 'B', pricing: { prompt: '0', completion: '0.0002' } },
      ],
    });
    const out = await listModels('openrouter', 'K');
    expect(out.find((m) => m.id === 'a/free')?.free).toBe(true);
    expect(out.find((m) => m.id === 'b/paid')?.free).toBeFalsy();
  });

  it('surfaces a rejected key rather than returning an empty list', async () => {
    stub({ error: { message: 'bad key' } }, false, 401);
    await expect(listModels('google', 'nope')).rejects.toThrow(/rejected the key/i);
  });
});

describe('rankModels', () => {
  const m = (id: string, free = false): ModelOption => ({ id, label: id, free });

  it('puts a free model first, because cost is the loudest constraint here', () => {
    const out = rankModels([m('paid-pro-2'), m('free-thing-2', true)]);
    expect(out[0]!.id).toBe('free-thing-2');
  });

  it('prefers the small fast tier over the large one for a re-explanation', () => {
    const out = rankModels([m('gemini-3-pro'), m('gemini-3-flash')]);
    expect(out[0]!.id).toBe('gemini-3-flash');
  });

  it('prefers the newer version of the same tier', () => {
    const out = rankModels([m('gemini-2-flash'), m('gemini-9-flash')]);
    expect(out[0]!.id).toBe('gemini-9-flash');
  });

  it('deprioritises previews, which are the ones that get retired', () => {
    const out = rankModels([m('x-3-flash-preview'), m('x-3-flash')]);
    expect(out[0]!.id).toBe('x-3-flash');
  });

  it('is deterministic, so the offered default does not move between visits', () => {
    const list = [m('b-2-flash'), m('a-2-flash'), m('c-2-pro')];
    expect(rankModels(list).map((x) => x.id)).toEqual(rankModels([...list].reverse()).map((x) => x.id));
  });
});
