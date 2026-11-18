import { describe, expect, it } from 'vitest';
import {
  buildCategoryView,
  cleanLinkUrl,
  commentBaitOf,
  linkPlatformOf,
  platformLabel,
  type LinkCard,
  type LinkNoteItem,
} from './linkNotes';

describe('cleanLinkUrl', () => {
  it('drops the tracking params of Instagram, YouTube, Facebook and TikTok', () => {
    expect(cleanLinkUrl('https://www.instagram.com/reel/DfXK5rxuHhk/?igsh=MWx4dGQ2&utm_source=ig_web')).toBe('https://www.instagram.com/reel/DfXK5rxuHhk/');
    expect(cleanLinkUrl('https://youtu.be/abc123?si=XyZ')).toBe('https://youtu.be/abc123');
    expect(cleanLinkUrl('https://www.facebook.com/share/r/1D56WoA4Bg/?mibextid=wwXIfr&fbclid=IwAR')).toBe('https://www.facebook.com/share/r/1D56WoA4Bg/');
    expect(cleanLinkUrl('https://vt.tiktok.com/ZSpHXquM7/?_t=8r&_r=1')).toBe('https://vt.tiktok.com/ZSpHXquM7/');
  });

  it('keeps the params that pick the content', () => {
    expect(cleanLinkUrl('https://www.youtube.com/watch?v=abc&t=42&si=zzz')).toBe('https://www.youtube.com/watch?v=abc&t=42');
  });

  it('returns the text untouched when it is not a URL', () => {
    expect(cleanLinkUrl('no es un enlace')).toBe('no es un enlace');
  });
});

describe('linkPlatformOf', () => {
  it.each([
    ['https://www.instagram.com/reel/DfXK5rxuHhk/', 'instagram', 'reel'],
    ['https://www.instagram.com/reels/DfXK5rxuHhk/', 'instagram', 'reel'],
    ['https://www.instagram.com/p/DemCjCiEVE3/', 'instagram', 'post'],
    ['https://www.facebook.com/share/r/1D56WoA4Bg/', 'facebook', 'reel'],
    ['https://www.facebook.com/share/v/1H4KjuHHA3/', 'facebook', 'video'],
    ['https://fb.watch/abc/', 'facebook', 'video'],
    ['https://youtube.com/shorts/vRDDH3QUcwk', 'youtube', 'short'],
    ['https://www.youtube.com/watch?v=abc', 'youtube', 'video'],
    ['https://vt.tiktok.com/ZSpHXquM7/', 'tiktok', 'video'],
    ['https://constroad.com/precios', 'web', 'page'],
  ])('%s is %s · %s', (url, platform, format) => {
    expect(linkPlatformOf(url)).toEqual({ platform, format });
  });

  it('treats a broken URL as a web page', () => {
    expect(linkPlatformOf('::')).toEqual({ platform: 'web', format: 'page' });
  });
});

describe('platformLabel', () => {
  it('names the network and the format in capitals', () => {
    expect(platformLabel({ platform: 'instagram', format: 'reel', url: 'https://instagram.com/reel/x' })).toBe('INSTAGRAM · REEL');
    expect(platformLabel({ platform: 'instagram', format: 'post', url: 'https://instagram.com/p/x' })).toBe('INSTAGRAM · PUBLICACIÓN');
    expect(platformLabel({ platform: 'tiktok', format: 'video', url: 'https://tiktok.com/x' })).toBe('TIKTOK');
  });

  it('shows the site of a plain web page', () => {
    expect(platformLabel({ platform: 'web', format: 'page', url: 'https://www.constroad.com/x' })).toBe('CONSTROAD.COM');
  });
});

describe('commentBaitOf', () => {
  it('flags a post that only asks to comment a word', () => {
    expect(commentBaitOf('Comenta NICHO y te lo paso!!!')).toBe('NICHO');
    expect(commentBaitOf('Comment "JARVIS" and I will send it 🔥 #ai #claude')).toBe('JARVIS');
  });

  it('does not flag a post with real content that also asks to comment', () => {
    const text = 'Cinco automatizaciones para pymes con n8n: llamada perdida a WhatsApp, agente que responde, seguimiento de cotizaciones, cobros y reseñas en Google. Comenta N8N y te paso la plantilla.';
    expect(commentBaitOf(text)).toBeNull();
  });

  it('ignores an empty or plain text', () => {
    expect(commentBaitOf(undefined)).toBeNull();
    expect(commentBaitOf('Kokoro: voz de estudio en local')).toBeNull();
  });
});

const card = (overrides: Partial<LinkCard>): LinkCard => ({ url: 'https://x.com/a', platform: 'web', format: 'page', status: 'ready', ...overrides });
const item = (seq: number, at: string, link: LinkCard): LinkNoteItem => ({ seq, at, link });

describe('buildCategoryView', () => {
  const categories = [
    { id: 'ads', name: 'Publicidad y ventas' },
    { id: 'video', name: 'Video, voz e imagen' },
    { id: 'empty', name: 'Infraestructura propia' },
  ];
  const items = [
    item(1, '2026-10-20T10:00:00Z', card({ categoryId: 'ads', author: 'Erik Taveras', text: 'MCP de Meta' })),
    item(2, '2026-11-02T10:00:00Z', card({ categoryId: 'ads', author: 'Ignacio Miranda', text: 'WhatsApp Business' })),
    item(3, '2026-11-09T10:00:00Z', card({ categoryId: 'video', author: 'Capi', text: 'Kokoro: voz de estudio' })),
    item(4, '2026-10-30T10:00:00Z', card({ categoryId: null, author: '@jsebas.yt', commentBait: 'NICHO' })),
    item(5, '2026-10-30T11:00:00Z', card({ categoryId: 'gone', status: 'unreadable' })),
  ];

  it('counts every category, keeps empty ones as chips and lists sections newest first', () => {
    const view = buildCategoryView(items, categories, { query: '' });
    expect(view.total).toBe(5);
    expect(view.chips.map((chip) => [chip.id, chip.count])).toEqual([
      ['all', 5],
      ['ads', 2],
      ['video', 1],
      ['empty', 0],
      ['none', 2],
    ]);
    expect(view.sections.map((section) => section.id)).toEqual(['ads', 'video', 'none']);
    expect(view.sections[0]!.items.map((one) => one.seq)).toEqual([2, 1]);
  });

  it('sends a link of a deleted category to «Sin categoría»', () => {
    const view = buildCategoryView(items, categories, { query: '' });
    expect(view.sections.find((section) => section.id === 'none')!.items.map((one) => one.seq)).toEqual([5, 4]);
  });

  it('counts the review marks', () => {
    expect(buildCategoryView(items, categories, { query: '' }).review).toEqual({ commentBait: 1, unreadable: 1 });
  });

  it('searches author, text and category without accents or case', () => {
    const view = buildCategoryView(items, categories, { query: 'VOZ' });
    expect(view.sections.flatMap((section) => section.items.map((one) => one.seq))).toEqual([3]);
    const byCategory = buildCategoryView(items, categories, { query: 'publicidad' });
    expect(byCategory.sections.flatMap((section) => section.items.map((one) => one.seq))).toEqual([2, 1]);
  });

  it('keeps the chip counts of the whole chat while searching', () => {
    expect(buildCategoryView(items, categories, { query: 'capi' }).chips[0]!.count).toBe(5);
  });

  it('shows one category, or one review mark, when asked', () => {
    expect(buildCategoryView(items, categories, { query: '', only: 'video' }).sections.map((section) => section.id)).toEqual(['video']);
    expect(buildCategoryView(items, categories, { query: '', only: 'commentBait' }).sections[0]!.items.map((one) => one.seq)).toEqual([4]);
    expect(buildCategoryView(items, categories, { query: '', only: 'unreadable' }).sections[0]!.items.map((one) => one.seq)).toEqual([5]);
  });
});
