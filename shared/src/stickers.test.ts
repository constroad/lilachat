import { describe, expect, it } from 'vitest';
import { addRecentSticker, findPackSticker, packLibrary, packStickerPath, RECENT_STICKERS_LIMIT, STICKER_PACKS, stickerSections, type LibrarySticker } from './stickers.js';
import { resolveChatPreview } from './chatDisplay.js';
import { armarAviso } from './aviso.js';
import { textoDelDestacado } from './destacados.js';

/** Stickers (José, 20/10): the WhatsApp-like panel — recent, favorites, mine and the default pack. */
const sticker = (id: string, favorite = false): LibrarySticker => ({ id, url: `https://x/${id}.webp`, mime: 'image/webp', width: 512, height: 512, favorite, at: '2026-10-20T10:00:00Z' });

describe('addRecentSticker', () => {
  it('puts the last used first, without repeats, up to a limit', () => {
    expect(addRecentSticker(['a', 'b', 'c'], 'b')).toEqual(['b', 'a', 'c']);
    expect(addRecentSticker([], 'a')).toEqual(['a']);
    const full = Array.from({ length: RECENT_STICKERS_LIMIT }, (_, index) => `s${index}`);
    const after = addRecentSticker(full, 'new');
    expect(after).toHaveLength(RECENT_STICKERS_LIMIT);
    expect(after[0]).toBe('new');
    expect(after).not.toContain(`s${RECENT_STICKERS_LIMIT - 1}`);
  });
});

describe('the default pack', () => {
  it('ships at least 20 stickers with unique slugs (the design shows a full panel)', () => {
    const [pack] = STICKER_PACKS;
    expect(pack!.stickers.length).toBeGreaterThanOrEqual(20);
    expect(new Set(pack!.stickers.map((one) => one.slug)).size).toBe(pack!.stickers.length);
  });

  it('a pack id resolves to its file; anything else does not', () => {
    const [pack] = STICKER_PACKS;
    const first = pack!.stickers[0]!;
    expect(findPackSticker(`pack:${pack!.id}/${first.slug}`)).toEqual({ packId: pack!.id, slug: first.slug, label: first.label });
    expect(packStickerPath(pack!.id, first.slug)).toBe(`/stickers/${pack!.id}/${first.slug}.webp`);
    expect(findPackSticker('pack:nope/x')).toBeNull();
    expect(findPackSticker(`pack:${pack!.id}/../../etc`)).toBeNull();
    expect(findPackSticker('6ad7b1c3c14ce8284e129806')).toBeNull();
  });

  it('the pack becomes stickers with absolute urls on the given server', () => {
    const library = packLibrary('https://lilachat.example');
    expect(library[0]!.url.startsWith('https://lilachat.example/stickers/')).toBe(true);
    expect(library[0]!.id.startsWith('pack:')).toBe(true);
  });
});

describe('stickerSections', () => {
  const library = [sticker('a', true), sticker('b'), sticker('c', true)];
  const pack = [sticker('pack:lila-1/fox'), sticker('pack:lila-1/cat')];

  it('recent (still available, in order), favorites, mine, then the pack', () => {
    expect(stickerSections({ library, recents: ['c', 'gone', 'pack:lila-1/cat', 'b'], packs: [{ id: 'lila-1', title: 'Lila', stickers: pack }] })).toEqual([
      { key: 'recent', title: 'Recientes', stickers: [library[2], pack[1], library[1]] },
      { key: 'favorites', title: 'Favoritos', stickers: [library[0], library[2]] },
      { key: 'mine', title: 'Mis stickers', stickers: library },
      { key: 'pack:lila-1', title: 'Lila', stickers: pack },
    ]);
  });

  it('with nothing used yet: «Mis stickers» (where «Crear» lives) and the pack', () => {
    expect(stickerSections({ library: [], recents: [], packs: [] })).toEqual([{ key: 'mine', title: 'Mis stickers', stickers: [] }]);
  });
});

describe('a sticker in previews', () => {
  it('the chat list says «Sticker» with its icon', () => {
    expect(resolveChatPreview({ typing: false, lastKind: 'sticker' })).toEqual({ text: 'Sticker', style: 'normal', media: 'sticker' });
  });

  it('the notification says «Sticker», not «Foto»', () => {
    expect(armarAviso({ chatName: 'Ana', senderName: 'Ana', esGrupo: false, kind: 'sticker', body: '' }).cuerpo).toBe('Sticker');
  });

  it('starred messages too', () => {
    expect(textoDelDestacado({ kind: 'sticker', media: { mime: 'image/webp' } })).toBe('Sticker');
  });
});
