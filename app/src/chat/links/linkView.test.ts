import { describe, expect, it } from 'vitest';
import { buildCategoryView, type LinkCard, type LinkCategory, type LinkNoteItem } from '@lilachat/shared';
import {
  applyLinkUpdate,
  cardLinesOf,
  categoryNameOf,
  categoryNameProblem,
  categoryNoteOf,
  chipRowOf,
  dayMonthOf,
  isLinkOnlyBody,
  listRowsOf,
  parseNotesViews,
  placeholderKindOf,
  rowLayoutsOf,
  serializeNotesViews,
  HEADER_ROW_HEIGHT,
  CARD_ROW_HEIGHT,
} from './linkView';

/** José's «IA links» notes chat (18/11): real Mongo ids, real links. */
const ADS = '673b1f0e9d2c4a0012ab34c1';
const VOICE = '673b1f0e9d2c4a0012ab34c2';
const categories: LinkCategory[] = [
  { id: ADS, name: 'Publicidad y ventas' },
  { id: VOICE, name: 'Video, voz e imagen' },
];

const card = (overrides: Partial<LinkCard>): LinkCard => ({ url: 'https://www.instagram.com/reel/DQx1aBcD2eF/', platform: 'instagram', format: 'reel', status: 'ready', ...overrides });
const item = (seq: number, day: string, overrides: Partial<LinkCard> = {}): LinkNoteItem => ({ seq, at: `2026-11-${day}T15:20:00.000Z`, link: card(overrides) });

const items: LinkNoteItem[] = [
  item(101, '02', { categoryId: ADS, author: 'Ignacio Miranda' }),
  item(102, '09', { categoryId: VOICE, author: 'Capi' }),
  item(103, '14', { categoryId: ADS, author: 'Alberto León' }),
  item(104, '17', { categoryId: ADS, author: 'Erik Taveras' }),
  item(105, '15', { categoryId: ADS, author: 'Ana Ruiz' }),
  item(106, '16', { categoryId: null, commentBait: 'NICHO' }),
  item(107, '16', { status: 'unreadable' }),
];
const viewOf = (only = 'all', query = '') => buildCategoryView(items, categories, { query, only });

describe('the rows of the «Por categoría» list', () => {
  it('in «Todas» each section shows its 3 newest and offers the rest', () => {
    // Act
    const rows = listRowsOf(viewOf(), { only: 'all', query: '', columns: 1 });
    // Assert
    const ads = rows.filter((row) => row.kind === 'cards').slice(0, 3);
    expect(rows[0]).toMatchObject({ kind: 'header', id: ADS, name: 'Publicidad y ventas', count: 4, showAll: true });
    expect(ads.map((row) => row.kind === 'cards' && row.items[0]!.seq)).toEqual([104, 105, 103]);
    expect(rows[4]).toMatchObject({ kind: 'header', id: VOICE, count: 1, showAll: false });
  });

  it('a chosen category shows all of its links and no «Ver las N»', () => {
    const rows = listRowsOf(viewOf(ADS), { only: ADS, query: '', columns: 1 });
    expect(rows.filter((row) => row.kind === 'cards')).toHaveLength(4);
    expect(rows[0]).toMatchObject({ kind: 'header', showAll: false });
  });

  it('a search in «Todas» shows every match, not only 3', () => {
    const rows = listRowsOf(viewOf('all', 'a'), { only: 'all', query: 'a', columns: 1 });
    expect(rows.filter((row) => row.kind === 'cards' && row.items[0]!.link.categoryId === ADS)).toHaveLength(4);
  });

  it('two columns pair the cards, the odd one alone at the end', () => {
    const rows = listRowsOf(viewOf(ADS), { only: ADS, query: '', columns: 2 });
    expect(rows.filter((row) => row.kind === 'cards').map((row) => row.kind === 'cards' && row.items.length)).toEqual([2, 2]);
    const odd = listRowsOf(viewOf(VOICE), { only: VOICE, query: '', columns: 2 });
    expect(odd.at(-1)).toMatchObject({ kind: 'cards', items: [{ seq: 102 }] });
  });

  it('every row has a unique key', () => {
    const rows = listRowsOf(viewOf(), { only: 'all', query: '', columns: 2 });
    expect(new Set(rows.map((row) => row.key)).size).toBe(rows.length);
  });

  it('the layout of each row, for a list that never measures', () => {
    const rows = listRowsOf(viewOf(VOICE), { only: VOICE, query: '', columns: 1 });
    expect(rowLayoutsOf(rows)).toEqual([
      { length: HEADER_ROW_HEIGHT, offset: 0 },
      { length: CARD_ROW_HEIGHT, offset: HEADER_ROW_HEIGHT },
    ]);
  });
});

describe('the chips', () => {
  it('categories first, then the review chips only when they have links', () => {
    // Act
    const chips = chipRowOf(viewOf());
    // Assert
    expect(chips.map((chip) => `${chip.name} ${chip.count}`)).toEqual(['Todas 7', 'Publicidad y ventas 4', 'Video, voz e imagen 1', 'Sin categoría 2', 'Solo piden comentar 1', 'No se pudieron leer 1']);
    expect(chips.at(-1)).toMatchObject({ id: 'unreadable', review: true });
  });

  it('no review chips when nothing needs a look', () => {
    const clean = buildCategoryView([items[0]!], categories, { query: '' });
    expect(chipRowOf(clean).some((chip) => chip.review)).toBe(false);
  });
});

describe('a link card that arrives by socket (`msg.link`)', () => {
  it('replaces the card of a link already in the view', () => {
    const moved = applyLinkUpdate(items, 102, card({ categoryId: ADS, categoryBy: 'user', author: 'Capi' }));
    expect(moved?.find((one) => one.seq === 102)?.link).toMatchObject({ categoryId: ADS, categoryBy: 'user' });
    expect(moved?.find((one) => one.seq === 101)).toBe(items[0]);
  });

  it('a link the view does not have asks for a reload (the frame has no date)', () => {
    expect(applyLinkUpdate(items, 999, card({}))).toBeNull();
  });
});

describe('texts of a card', () => {
  it('the date as dd/mm in the phone’s time zone', () => {
    expect(dayMonthOf('2026-11-02T15:20:00.000Z')).toBe('02/11');
    expect(dayMonthOf('no es fecha')).toBe('');
  });

  it('who put it in its category', () => {
    expect(categoryNoteOf(card({ categoryId: ADS, categoryBy: 'lila' }))).toBe('La eligió Lila al guardarlo. Tú decides.');
    expect(categoryNoteOf(card({ categoryId: null, categoryBy: 'user' }))).toBe('La elegiste tú.');
    expect(categoryNoteOf(card({}))).toBeNull();
  });

  it('the category’s name, «Sin categoría» when it has none or it was merged away', () => {
    expect(categoryNameOf(categories, ADS)).toBe('Publicidad y ventas');
    expect(categoryNameOf(categories, null)).toBe('Sin categoría');
    expect(categoryNameOf(categories, '673b1f0e9d2c4a0012ab34ff')).toBe('Sin categoría');
  });

  it('the placeholder of a card without image', () => {
    expect(placeholderKindOf(card({ format: 'reel' }))).toBe('play');
    expect(placeholderKindOf(card({ platform: 'youtube', format: 'short' }))).toBe('play');
    expect(placeholderKindOf(card({ format: 'post' }))).toBe('post');
    expect(placeholderKindOf(card({ platform: 'web', format: 'page' }))).toBe('page');
    expect(placeholderKindOf(card({ status: 'unreadable' }))).toBe('locked');
  });
});

describe('a message that is only its link', () => {
  it('the bubble drops the bare URL: the card says it all', () => {
    expect(isLinkOnlyBody('  https://www.instagram.com/reel/DQx1aBcD2eF/?igsh=MWx2  ')).toBe(true);
  });

  it('a note with words keeps its text', () => {
    expect(isLinkOnlyBody('revisar esto https://youtu.be/abc')).toBe(false);
    expect(isLinkOnlyBody(undefined)).toBe(false);
  });
});

describe('a new or renamed category, checked before the server', () => {
  it('empty, too long or repeated (accents and case folded) is refused', () => {
    expect(categoryNameProblem('   ', categories)).toBe('Escribe un nombre.');
    expect(categoryNameProblem('x'.repeat(41), categories)).toBe('Máximo 40 letras.');
    expect(categoryNameProblem('video, VOZ e imágen', categories)).toBe('Ya tienes una categoría con ese nombre.');
  });

  it('renaming a category to its own name with other case is fine', () => {
    expect(categoryNameProblem('publicidad y ventas', categories, ADS)).toBeNull();
  });

  it('past 12 categories it asks to merge first', () => {
    const many = Array.from({ length: 12 }, (_, index) => ({ id: `673b1f0e9d2c4a0012ab35${String(index).padStart(2, '0')}`, name: `Tema ${index}` }));
    expect(categoryNameProblem('Otra', many)).toBe('Llegaste a 12 categorías: une dos antes de crear otra.');
  });
});

describe('the remembered view of each notes chat', () => {
  it('reads what was saved and ignores junk', () => {
    expect(parseNotesViews(serializeNotesViews({ '673b1f0e9d2c4a0012ab3401': 'links' }))).toEqual({ '673b1f0e9d2c4a0012ab3401': 'links' });
    expect(parseNotesViews('{"a":"otra","b":"chat"}')).toEqual({ b: 'chat' });
    expect(parseNotesViews('no json')).toEqual({});
    expect(parseNotesViews(null)).toEqual({});
  });
});

describe('the lines of a card', () => {
  it('author and post text', () => {
    expect(cardLinesOf(card({ author: 'Capi (@capi.al.grano)', text: ' Kokoro: voz de estudio en local ' }))).toEqual({ title: 'Capi (@capi.al.grano)', body: 'Kokoro: voz de estudio en local' });
  });

  it('a post that only asks to comment says so', () => {
    expect(cardLinesOf(card({ author: '@jsebas.yt', commentBait: 'NICHO' })).body).toBe('El post no trae contenido: solo pide comentar NICHO');
  });

  it('a link the network did not show, and one still being read', () => {
    expect(cardLinesOf(card({ status: 'unreadable' }))).toEqual({ title: 'No se pudo leer', body: 'La red no lo muestra sin iniciar sesión' });
    expect(cardLinesOf(card({ status: 'pending' }))).toEqual({ title: 'instagram.com', body: 'Lila lo está leyendo…' });
  });
});
