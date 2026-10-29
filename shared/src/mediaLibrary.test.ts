import { describe, expect, it } from 'vitest';
import { MEDIA_LIBRARY_TABS, mediaEmptyText, mediaLibraryType, mediaMonthSections, mediaSearchTerm, splitMediaSection } from './mediaLibrary.js';

/** «Medios» (pending 38, José 21/10): photos, videos, documents and links of all my chats, like WhatsApp. */
describe('mediaLibrary', () => {
  it('«Todo» and the four tabs in WhatsApp order', () => {
    expect(MEDIA_LIBRARY_TABS.map((tab) => [tab.type, tab.label])).toEqual([
      ['all', 'Todo'],
      ['photos', 'Fotos'],
      ['videos', 'Videos'],
      ['files', 'Documentos'],
      ['links', 'Enlaces'],
    ]);
  });
  it('an unknown type from the URL falls back to photos', () => {
    expect(mediaLibraryType('links')).toBe('links');
    expect(mediaLibraryType('nada')).toBe('photos');
    expect(mediaLibraryType(undefined)).toBe('photos');
  });
  it('sections by month, newest first: «Este mes», then the month (with the year when it is another one)', () => {
    const now = new Date('2026-10-21T15:00:00-05:00');
    const items = [
      { id: 'a', at: '2026-10-20T10:00:00-05:00' },
      { id: 'b', at: '2026-10-01T09:00:00-05:00' },
      { id: 'c', at: '2026-09-15T09:00:00-05:00' },
      { id: 'd', at: '2025-12-24T09:00:00-05:00' },
    ];
    expect(mediaMonthSections(items, now).map((section) => [section.title, section.items.map((item) => item.id)])).toEqual([
      ['Este mes', ['a', 'b']],
      ['Septiembre', ['c']],
      ['Diciembre de 2025', ['d']],
    ]);
  });
  it('nothing, no sections', () => {
    expect(mediaMonthSections([], new Date())).toEqual([]);
  });
});

describe('«Todo» and the search in Medios (pending 6)', () => {
  it('«Todo» is the first tab; the server still reads an unknown tab as photos', () => {
    expect(MEDIA_LIBRARY_TABS[0]).toEqual({ type: 'all', label: 'Todo' });
    expect(mediaLibraryType('all')).toBe('all');
    expect(mediaLibraryType('nada')).toBe('photos');
  });

  it('a search of one letter, or blank, does not filter', () => {
    expect(mediaSearchTerm('  informe ')).toBe('informe');
    expect(mediaSearchTerm('i')).toBeNull();
    expect(mediaSearchTerm(undefined)).toBeNull();
  });

  it('an empty tab says so; with a search, that nothing matched it', () => {
    expect(mediaEmptyText('all', '')).toBe('Todavía no hay medios.');
    expect(mediaEmptyText('files', 'x')).toBe('Todavía no hay documentos.');
    expect(mediaEmptyText('photos', 'planos')).toBe('Nada coincide con «planos».');
  });

  it('a month splits its photos and videos into the grid and its documents and links into rows', () => {
    const items = [{ kind: 'file' as const, id: 1 }, { kind: 'image' as const, id: 2 }, { kind: 'text' as const, id: 3 }, { kind: 'video' as const, id: 4 }];
    const { tiles, rows } = splitMediaSection(items);
    expect(tiles.map((item) => item.id)).toEqual([2, 4]);
    expect(rows.map((item) => item.id)).toEqual([1, 3]);
  });
});

