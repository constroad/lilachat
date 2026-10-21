import { describe, expect, it } from 'vitest';
import { filterChannels, railSpaces, SPACE_RUBROS, spaceInitials, spaceInviteMessage, spaceSections, spaceSubtitle } from './spaceSections.js';

/** The chats of a company space by sections, like Slack (designs `s-03-lista-con-secciones` and `e1-07-chats-del-espacio`). */
describe('spaceSections', () => {
  const chat = (id: string, kind: 'direct' | 'group', at: string, extra: { name?: string; channel?: { visibility: 'public' | 'private' } } = {}) => ({ id, kind, lastAt: at, ...extra });
  const chats = [
    chat('d1', 'direct', '2026-10-21T10:44:00Z', { name: 'Ana Torres' }),
    chat('c-flota', 'group', '2026-10-20T09:00:00Z', { name: 'flota', channel: { visibility: 'public' } }),
    chat('g1', 'group', '2026-10-21T09:30:00Z', { name: 'Choferes' }),
    chat('c-general', 'group', '2026-10-21T09:15:00Z', { name: 'general', channel: { visibility: 'public' } }),
    chat('g2', 'group', '2026-10-21T10:48:00Z', { name: 'Compras de obra' }),
    chat('c-admin', 'group', '2026-10-12T09:00:00Z', { name: 'administracion', channel: { visibility: 'private' } }),
    chat('d2', 'direct', '2026-10-21T08:00:00Z', { name: 'Luis' }),
  ];
  it('channels by name with #general first; groups and direct messages by their last activity', () => {
    const sections = spaceSections(chats);
    expect(sections.map((section) => [section.key, section.chats.map((one) => one.id)])).toEqual([
      ['channels', ['c-general', 'c-admin', 'c-flota']],
      ['groups', ['g2', 'g1']],
      ['directs', ['d1', 'd2']],
    ]);
  });
  it('a section always shows, even empty (channels keep «Agregar canal»)', () => {
    expect(spaceSections([]).map((section) => [section.key, section.title, section.chats.length])).toEqual([
      ['channels', 'Canales', 0],
      ['groups', 'Grupos', 0],
      ['directs', 'Mensajes directos', 0],
    ]);
  });
});

describe('spaceInitials', () => {
  it('two letters for the square logo: the first two of one word, the initials of two', () => {
    expect(spaceInitials('CONSTROAD')).toBe('CO');
    expect(spaceInitials('Obra Miraflores')).toBe('OM');
    expect(spaceInitials('  ')).toBe('?');
  });
});

describe('spaceInviteMessage', () => {
  it('says which space, how to get in and the code', () => {
    const text = spaceInviteMessage({ spaceName: 'CONSTROAD', code: 'CONS-7K3P' });
    expect(text).toContain('CONSTROAD');
    expect(text).toContain('CONS-7K3P');
    expect(text).toContain('Unirme con un código');
  });
});

/** Exploring channels (design `e2-15-explorar-canales`): Todos · Públicos · Privados with their counts, and a search. */
describe('filterChannels', () => {
  const channels = [
    { id: '1', name: 'general', descripcion: 'Avisos del equipo', visibility: 'public' as const, members: 48, joined: true },
    { id: '2', name: 'compras', descripcion: 'Órdenes de cemento', visibility: 'public' as const, members: 8, joined: false },
    { id: '3', name: 'gerencia', visibility: 'private' as const, members: 4, joined: true },
  ];
  it('counts each tab and filters by it', () => {
    const result = filterChannels(channels, { query: '', visibility: 'all' });
    expect(result.counts).toEqual({ all: 3, public: 2, private: 1 });
    expect(filterChannels(channels, { query: '', visibility: 'private' }).channels.map((one) => one.id)).toEqual(['3']);
  });
  it('searches the name and the description, without accents or case', () => {
    expect(filterChannels(channels, { query: 'CEMENTO', visibility: 'all' }).channels.map((one) => one.id)).toEqual(['2']);
    expect(filterChannels(channels, { query: 'ordenes', visibility: 'all' }).channels.map((one) => one.id)).toEqual(['2']);
    expect(filterChannels(channels, { query: 'ger', visibility: 'all' }).channels.map((one) => one.id)).toEqual(['3']);
  });
});

/** The line under a space's name, in the switcher, the header and the preview: «Construcción · 48 miembros». */
describe('spaceSubtitle', () => {
  it('what it does and how many are in, singular for one', () => {
    expect(spaceSubtitle({ rubro: 'Construcción', members: 48 })).toBe('Construcción · 48 miembros');
    expect(spaceSubtitle({ members: 1 })).toBe('1 miembro');
    expect(spaceSubtitle({ rubro: '', members: 0 })).toBe('0 miembros');
  });
  it('the members first when asked (the header of the space: «48 miembros · Construcción»)', () => {
    expect(spaceSubtitle({ rubro: 'Maquinaria', members: 16 }, { membersFirst: true })).toBe('16 miembros · Maquinaria');
  });
  it('the trades offered when creating a space end in «Otro»', () => {
    expect(SPACE_RUBROS[0]).toBe('Construcción');
    expect(SPACE_RUBROS.at(-1)).toBe('Otro');
  });
});

/** The web's rail of spaces (design `e1-06`, José 21/10: «un panel en el lado izquierdo como WhatsApp Web»). */
describe('railSpaces', () => {
  const space = (id: string, status: 'active' | 'pending' | 'invited' | 'deactivated') => ({ id, status });
  it('the active ones and those waiting for approval, in the order the server sends them; never one without access', () => {
    expect(railSpaces([space('a', 'active'), space('d', 'deactivated'), space('p', 'pending'), space('i', 'invited')]).map((one) => one.id)).toEqual(['a', 'p']);
  });
  it('without spaces there is no rail: the personal account alone looks like WhatsApp', () => {
    expect(railSpaces([])).toEqual([]);
    expect(railSpaces(null)).toEqual([]);
    expect(railSpaces([space('d', 'deactivated')])).toEqual([]);
  });
});
