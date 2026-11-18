import { describe, expect, it, vi } from 'vitest';
import type { ModelAsker } from './agentesModel.js';
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

  it('takes an unknown category name as a proposal, not as nothing', () => {
    expect(parseClassifierAnswer('{"category":"Cocina","new":null}', categories)).toEqual({ categoryId: null, newCategory: 'Cocina' });
  });

  it('treats garbage as «Sin categoría»', () => {
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

describe('buildLinkClassifier: asks agentes for the task, never a provider', () => {
  const members = ['u1'];

  it('sends the classify task with its schema to agentes and maps the answer', async () => {
    // Arrange
    const ask = vi.fn<ModelAsker>(async () => ({ ok: true, json: { category: 'Video, voz e imagen', new: null }, text: '' }));
    // Act
    const outcome = await buildLinkClassifier(ask).classify(card, categories, members);
    // Assert
    expect(outcome).toEqual({ ok: true, categoryId: 'c2' });
    const [askedFor, request] = ask.mock.calls[0]!;
    expect(askedFor).toEqual(members);
    expect(request).toMatchObject({ task: 'link.classify', system: classifierPrompt(card, categories).system });
    expect(request.schema).toMatchObject({ required: ['category', 'new'] });
    expect(JSON.stringify(request)).not.toMatch(/claude|haiku|anthropic/i);
  });

  it('proposes categories through the propose task', async () => {
    const ask = vi.fn<ModelAsker>(async () => ({ ok: true, json: { categories: ['Claude y skills', 'Diseño web y UI'] }, text: '' }));
    await expect(buildLinkClassifier(ask).propose([card], members)).resolves.toEqual({ ok: true, names: ['Claude y skills', 'Diseño web y UI'] });
    expect(ask.mock.calls[0]![1].task).toBe('link.propose');
  });

  it('passes «not configured» and failures through instead of guessing', async () => {
    await expect(buildLinkClassifier(async () => ({ ok: false, reason: 'not_configured' })).classify(card, categories, members)).resolves.toEqual({ ok: false, reason: 'not_configured' });
    await expect(buildLinkClassifier(async () => ({ ok: false, reason: 'failed' })).propose([card], members)).resolves.toEqual({ ok: false, reason: 'failed' });
  });

  it('treats a JSON that is not an object as «Sin categoría»', async () => {
    await expect(buildLinkClassifier(async () => ({ ok: true, json: null, text: '' })).classify(card, categories, members)).resolves.toEqual({ ok: true, categoryId: null });
  });
});
