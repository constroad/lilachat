import { afterEach, describe, expect, it, vi } from 'vitest';
import { buildLinkClassifier, classifierPrompt, parseClassifierAnswer, parseProposedCategories } from './linkClassifier.js';

const categories = [
  { id: 'c1', name: 'Publicidad y ventas' },
  { id: 'c2', name: 'Video, voz e imagen' },
];
const card = { url: 'https://www.instagram.com/reel/x/', platform: 'instagram' as const, format: 'reel' as const, status: 'ready' as const, author: 'Capi (@capi.al.grano)', text: 'Kokoro: voz de estudio en local' };

describe('classifierPrompt', () => {
  it('lists the categories and the link, and keeps the instructions stable for the cache', () => {
    const prompt = classifierPrompt(card, categories);
    expect(prompt.user).toContain('- Publicidad y ventas');
    expect(prompt.user).toContain('Capi (@capi.al.grano)');
    expect(prompt.user).toContain('Kokoro');
    expect(classifierPrompt({ ...card, text: 'otro' }, categories).system).toBe(prompt.system);
  });
});

describe('parseClassifierAnswer', () => {
  it('maps the chosen name back to its id, without caring about case or accents', () => {
    expect(parseClassifierAnswer('{"category":"video, voz e IMAGEN","new":null}', categories)).toEqual({ categoryId: 'c2' });
  });

  it('reads the JSON even inside a code fence', () => {
    expect(parseClassifierAnswer('```json\n{"category":"Publicidad y ventas"}\n```', categories)).toEqual({ categoryId: 'c1' });
  });

  it('accepts a proposed new category when none fits', () => {
    expect(parseClassifierAnswer('{"category":null,"new":"Finanzas personales"}', categories)).toEqual({ categoryId: null, newCategory: 'Finanzas personales' });
  });

  it('turns a «new» that already exists into that category', () => {
    expect(parseClassifierAnswer('{"category":null,"new":"publicidad y ventas"}', categories)).toEqual({ categoryId: 'c1' });
  });

  it('treats an invented category or garbage as «Sin categoría»', () => {
    expect(parseClassifierAnswer('{"category":"Cocina"}', categories)).toEqual({ categoryId: null });
    expect(parseClassifierAnswer('no sé', categories)).toEqual({ categoryId: null });
    expect(parseClassifierAnswer('{"category":null,"new":"' + 'x'.repeat(80) + '"}', categories)).toEqual({ categoryId: null });
  });
});

describe('parseProposedCategories', () => {
  it('keeps distinct, short names, at most nine', () => {
    const names = Array.from({ length: 12 }, (_, index) => `Tema ${index}`);
    expect(parseProposedCategories(JSON.stringify({ categories: ['Video', 'video', ' Publicidad ', '', ...names] }))).toHaveLength(9);
    expect(parseProposedCategories('{"categories":["Video","video"," Publicidad "]}')).toEqual(['Video', 'Publicidad']);
  });

  it('gives nothing for garbage', () => {
    expect(parseProposedCategories('{}')).toEqual([]);
  });
});

describe('buildLinkClassifier', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.unstubAllEnvs();
  });

  it('says it is not configured without a key, and does not call anyone', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', '');
    const fetchSpy = vi.fn();
    vi.stubGlobal('fetch', fetchSpy);
    await expect(buildLinkClassifier().classify(card, categories)).resolves.toEqual({ ok: false, reason: 'not_configured' });
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('asks Haiku 5.5 at low effort and reads its answer', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ content: [{ type: 'text', text: '{"category":"Video, voz e imagen"}' }] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchSpy);
    await expect(buildLinkClassifier().classify(card, categories)).resolves.toEqual({ ok: true, categoryId: 'c2' });
    const body = JSON.parse(String((fetchSpy.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body.model).toBe('claude-haiku-5-5');
    expect(body.output_config).toEqual({ effort: 'low' });
  });

  it('reports a refused call instead of guessing', async () => {
    vi.stubEnv('ANTHROPIC_API_KEY', 'test-key');
    vi.stubGlobal('fetch', vi.fn(async () => new Response('overloaded', { status: 529 })));
    await expect(buildLinkClassifier().classify(card, categories)).resolves.toEqual({ ok: false, reason: 'failed' });
  });
});
