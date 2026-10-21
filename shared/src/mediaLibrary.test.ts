import { describe, expect, it } from 'vitest';
import { MEDIA_LIBRARY_TABS, mediaLibraryType, mediaMonthSections } from './mediaLibrary.js';

/** «Medios» (pending 38, José 21/10): photos, videos, documents and links of all my chats, like WhatsApp. */
describe('mediaLibrary', () => {
  it('four tabs in WhatsApp order', () => {
    expect(MEDIA_LIBRARY_TABS.map((tab) => [tab.type, tab.label])).toEqual([
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
