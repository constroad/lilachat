import { describe, expect, it } from 'vitest';
import { filterChannels, railSpaces, unreadElsewhere, splitArchived, SPACE_RUBROS, spaceInitials, spaceInviteEmail, spaceInviteMailto, spaceInviteMessage, spaceJoinLink, joinCodeFromLink, spaceSections, spaceSubtitle } from './spaceSections.js';
import { spaceRoleBadge, spaceSettingsRows, withLiveUnread } from './spaceSections.js';

/** The chats of a company space by sections, like Slack (designs `s-03-lista-con-secciones` and `e1-07-chats-del-espacio`). */
describe('spaceSections', () => {
  const chat = (id: string, kind: 'direct' | 'group', at: string, extra: { name?: string; channel?: { visibility: 'public' | 'private' }; appId?: string } = {}) => ({ id, kind, lastAt: at, ...extra });
  const chats = [
    chat('d1', 'direct', '2026-10-21T10:44:00Z', { name: 'Ana Torres' }),
    chat('c-flota', 'group', '2026-10-20T09:00:00Z', { name: 'flota', channel: { visibility: 'public' } }),
    chat('g1', 'group', '2026-10-21T09:30:00Z', { name: 'Choferes' }),
    chat('c-general', 'group', '2026-10-21T09:15:00Z', { name: 'general', channel: { visibility: 'public' } }),
    chat('g2', 'group', '2026-10-21T10:48:00Z', { name: 'Compras de obra' }),
    chat('c-admin', 'group', '2026-10-12T09:00:00Z', { name: 'administracion', channel: { visibility: 'private' } }),
    chat('d2', 'direct', '2026-10-21T08:00:00Z', { name: 'Luis' }),
    chat('a-portal', 'direct', '2026-10-21T11:00:00Z', { name: 'Portal', appId: 'app-portal' }),
    chat('a-pulso', 'direct', '2026-10-21T07:00:00Z', { name: 'Pulso', appId: 'app-pulso' }),
  ];
  it('channels by name with #general first; groups, direct messages and apps by their last activity; an app 1:1 is not a direct message', () => {
    const sections = spaceSections(chats);
    expect(sections.map((section) => [section.key, section.chats.map((one) => one.id)])).toEqual([
      ['channels', ['c-general', 'c-admin', 'c-flota']],
      ['groups', ['g2', 'g1']],
      ['directs', ['d1', 'd2']],
      ['apps', ['a-portal', 'a-pulso']],
    ]);
  });
  it('a section shows even empty (channels keep «Agregar canal»), except groups: a space creates channels (pending 109)', () => {
    expect(spaceSections([]).map((section) => [section.key, section.title, section.chats.length])).toEqual([
      ['channels', 'Canales', 0],
      ['directs', 'Mensajes directos', 0],
      ['apps', 'Apps', 0],
    ]);
  });

  it('a group made before the rule still shows in its section', () => {
    const sections = spaceSections([chat('g1', 'group', '2026-10-21T09:30:00Z', { name: 'Choferes' })]);
    expect(sections.find((section) => section.key === 'groups')?.chats.map((one) => one.id)).toEqual(['g1']);
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

  /** Pending 47 (José, 22/10): the link opens the app if it is installed. */
  it('carries the space’s own link first', () => {
    const text = spaceInviteMessage({ spaceName: 'CONSTROAD', code: 'CONS-7K3P' });
    expect(text).toContain('https://lilachat.constroad.com/unirse/CONS-7K3P');
    expect(text.indexOf('/unirse/')).toBeLessThan(text.indexOf('lilastore'));
  });
});

describe('join links', () => {
  it('the link of a code and the code of a link', () => {
    expect(spaceJoinLink('CONS-7K3P')).toBe('https://lilachat.constroad.com/unirse/CONS-7K3P');
    expect(joinCodeFromLink('https://lilachat.constroad.com/unirse/CONS-7K3P')).toBe('CONS-7K3P');
    expect(joinCodeFromLink('https://lilachat.constroad.com/unirse/cons7k3p?utm=wa')).toBe('CONS-7K3P');
  });

  it('any other address, or a broken code, is not a join link', () => {
    expect(joinCodeFromLink('https://evil.test/unirse/CONS-7K3P')).toBeNull();
    expect(joinCodeFromLink('https://lilachat.constroad.com/c/abc')).toBeNull();
    expect(joinCodeFromLink('https://lilachat.constroad.com/unirse/xx')).toBeNull();
    expect(joinCodeFromLink(null)).toBeNull();
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

/**
 * The invitation by email, the first option (José, 21/10: a company invites
 * by email first, then by WhatsApp). It goes from the inviter's own mail
 * app: where to get Lilachat (phone or computer), that one enters with the
 * phone number, and the code.
 */
describe('spaceInviteEmail', () => {
  it('a subject with the space, and a body with who invites, the steps and the code', () => {
    const email = spaceInviteEmail({ spaceName: 'CONSTROAD', code: 'CONS-7K3P', inviterName: 'José Zamora' });
    expect(email.subject).toBe('Invitación al espacio de CONSTROAD en Lilachat');
    expect(email.body).toContain('José Zamora te invita al espacio de CONSTROAD en Lilachat');
    expect(email.body).toContain('https://lilastore.constroad.com/app/lilachat');
    expect(email.body).toContain('https://lilachat.constroad.com');
    expect(email.body).toContain('Entra con tu número de celular');
    expect(email.body).toContain('«Unirme con un código» y escribe: CONS-7K3P');
    expect(email.body).toContain('Tus chats personales no se comparten con la empresa.');
  });
  it('without the inviter\'s name it still reads well', () => {
    expect(spaceInviteEmail({ spaceName: 'Inframaq', code: 'INFR-2B9Q' }).body).toMatch(/^Hola:\n\nTe invitamos al espacio de Inframaq en Lilachat/);
  });
  it('the mail link opens the mail app with the subject and the body, line breaks included', () => {
    const link = spaceInviteMailto({ spaceName: 'CONSTROAD', code: 'CONS-7K3P' });
    expect(link.startsWith('mailto:?subject=')).toBe(true);
    const params = new URLSearchParams(link.slice('mailto:?'.length));
    expect(params.get('subject')).toBe('Invitación al espacio de CONSTROAD en Lilachat');
    expect(params.get('body')).toContain('escribe: CONS-7K3P');
    // `+` is not a space in a mailto: spaces travel as %20 and line breaks as %0A.
    expect(link).not.toContain('+');
    expect(link).toContain('%0A');
  });
  it('invited by email (José, 22/10): addressed to that email, and verifying it in the profile is the way in; the code stays as a fallback', () => {
    const email = spaceInviteEmail({ spaceName: 'CONSTROAD', code: 'CONS-7K3P', to: 'luis@empresa.pe' });
    expect(email.body).toContain('En «Completa tu perfil», verifica este correo (luis@empresa.pe) y entras solo al espacio.');
    expect(email.body).toContain('escribe: CONS-7K3P');
    const link = spaceInviteMailto({ spaceName: 'CONSTROAD', code: 'CONS-7K3P', to: 'luis@empresa.pe' });
    expect(link.startsWith('mailto:luis%40empresa.pe?subject=')).toBe(true);
  });
});

describe('spaceInviteMessage, where to get the app', () => {
  it('says where to download Lilachat for whoever does not have it', () => {
    expect(spaceInviteMessage({ spaceName: 'CONSTROAD', code: 'CONS-7K3P' })).toContain('https://lilastore.constroad.com/app/lilachat');
  });
});

/** Archiving a chat of a space hides it from the space's list (debt of §84), like the personal list. */
describe('splitArchived', () => {
  it('the archived ones apart, with how many; the rest in the sections', () => {
    const chats = [{ id: 'a', archived: true }, { id: 'b' }, { id: 'c', archived: false }];
    expect(splitArchived(chats, false)).toEqual({ shown: [{ id: 'b' }, { id: 'c', archived: false }], archived: 1 });
  });
  it('opening «Archivados» shows only them', () => {
    expect(splitArchived([{ id: 'a', archived: true }, { id: 'b' }], true)).toEqual({ shown: [{ id: 'a', archived: true }], archived: 1 });
  });
});

/** José, 22/10: «si hay mensajes en espacios o cuentas individuales, ¿aparece que hay mensaje?» — the header says so. */
describe('unreadElsewhere', () => {
  const spaces = [
    { id: 'w1', status: 'active' as const, unreadChats: 2 },
    { id: 'w2', status: 'active' as const, unreadChats: 1 },
    { id: 'w3', status: 'pending' as const, unreadChats: 5 },
  ];
  it('in personal: the chats with something new in every space I am active in', () => {
    expect(unreadElsewhere({ spaces, currentId: null, personalUnread: 4 })).toBe(3);
  });
  it('inside a space: personal plus the other spaces, never the one I am looking at', () => {
    expect(unreadElsewhere({ spaces, currentId: 'w1', personalUnread: 4 })).toBe(5);
  });
  it('nothing loaded yet is zero', () => {
    expect(unreadElsewhere({ spaces: null, currentId: null, personalUnread: 0 })).toBe(0);
  });
});

describe('the space in the «Ajustes» tab (José, 24/10; design e-34)', () => {
  it('an admin gets settings, members with requests, channels, apps, invite and media', () => {
    // Act
    const rows = spaceSettingsRows({ role: 'admin', members: 12, pendingRequests: 2, joinCode: 'TEST-8355' }, ['Inframaq', 'Portal']);
    // Assert
    expect(rows.map((row) => [row.key, row.title, row.detail])).toEqual([
      ['settings', 'Ajustes del espacio', 'Nombre, logo, rubro y código de ingreso'],
      ['members', 'Miembros y roles', '12 miembros · 2 solicitudes'],
      ['channels', 'Canales', 'Explorar y unirte'],
      ['apps', 'Apps', 'Inframaq, Portal'],
      ['invite', 'Invitar al espacio', 'Código TEST-8355'],
      ['media', 'Medios del espacio', 'Fotos, videos y documentos de sus canales'],
    ]);
    expect([spaceRoleBadge('owner'), spaceRoleBadge('admin'), spaceRoleBadge('member')]).toEqual(['Dueño', 'Admin', null]);
  });

  it('a member sees no settings, no requests and no invite without a code', () => {
    const rows = spaceSettingsRows({ role: 'member', members: 1, pendingRequests: 3 }, []);
    expect(rows.map((row) => row.key)).toEqual(['members', 'channels', 'apps', 'media']);
    expect(rows[0]).toMatchObject({ title: 'Miembros', detail: '1 miembro' });
    expect(rows[2]!.detail).toBe('Ninguna instalada todavía');
  });
});

describe('withLiveUnread (pending 108, José 28/10: the space kept its badge after reading)', () => {
  const spaces = [
    { id: 'test', name: 'Test', unreadChats: 3 },
    { id: 'inframaq', name: 'Inframaq', unreadChats: 2 },
  ];

  it('the space I am in counts its chats with something unread, live from its list', () => {
    // Arrange
    const chats = [{ unread: 0 }, { unread: 4 }, { unread: 0 }];
    // Act
    const shown = withLiveUnread(spaces, 'test', chats);
    // Assert
    expect(shown?.map((space) => space.unreadChats)).toEqual([1, 2]);
  });

  it('nothing to change: same array (the rail does not redraw)', () => {
    const chats = [{ unread: 1 }, { unread: 2 }, { unread: 3 }];
    expect(withLiveUnread(spaces, 'test', chats)).toBe(spaces);
  });

  it('personal, no list yet or no spaces: the server count stays', () => {
    expect(withLiveUnread(spaces, null, [{ unread: 0 }])).toBe(spaces);
    expect(withLiveUnread(spaces, 'test', null)).toBe(spaces);
    expect(withLiveUnread(null, 'test', [])).toBeNull();
  });
});
