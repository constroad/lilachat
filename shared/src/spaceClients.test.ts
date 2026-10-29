import { describe, expect, it } from 'vitest';
import { archivedBanner, clientChatIds, clientRowSubtitle, dayLabel, filterArchivedClients, splitClients, type SpaceClient } from './spaceClients.js';

/** Pending 21 (§157): the client channels in the space list and «Archivados» (designs f-01, f-02, f-03). */
const now = new Date('2026-10-29T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const client = (id: string, extra: Partial<SpaceClient> = {}): SpaceClient => ({
  id,
  chat_id: `chat-${id}`,
  name: `Cliente ${id}`,
  live: true,
  archived_since: null,
  last_activity_at: daysAgo(1),
  last_order_at: daysAgo(1),
  orders_total: 3,
  archived_group: '2-6',
  services: [],
  ...extra,
});
const chat = (id: string, unread = 0, lastAt?: string) => ({ id: `chat-${id}`, unread, lastAt });

describe('splitClients', () => {
  it('splits live and archived, joins each with its chat and counts the archived ones with something unread', () => {
    // Arrange
    const clients = [client('a', { last_activity_at: daysAgo(5) }), client('b', { last_activity_at: daysAgo(1) }), client('c', { live: false }), client('d', { live: false })];
    // Act
    const split = splitClients(clients, [chat('a', 0, daysAgo(0)), chat('c', 2)]);
    // Assert
    expect(split.live.map((entry) => entry.client.id)).toEqual(['a', 'b']);
    expect(split.live[1]!.chat).toBeNull();
    expect(split.archived.map((entry) => entry.client.id)).toEqual(['c', 'd']);
    expect(split.archivedUnread).toBe(1);
    expect([...clientChatIds(clients)]).toEqual(['chat-a', 'chat-b', 'chat-c', 'chat-d']);
  });
});

describe('clientRowSubtitle and dayLabel', () => {
  it('says the open services and the last order (design f-01)', () => {
    const services = [
      { id: '1', name: 'Base', status: 'in_progress' as const, stage_label: 'En ejecución' },
      { id: '2', name: 'Carpeta', status: 'pending' as const, stage_label: 'Pendiente' },
      { id: '3', name: 'Bacheo', status: 'completed' as const, stage_label: 'Completado' },
    ];
    expect(clientRowSubtitle({ services, last_order_at: '2026-10-29T14:00:00Z' }, now)).toBe('2 servicios en curso · Último pedido hoy');
    expect(clientRowSubtitle({ services: services.slice(0, 1), last_order_at: null }, now)).toBe('1 servicio en curso');
    expect(clientRowSubtitle({ services: [], last_order_at: '2026-10-28T14:00:00Z' }, now)).toBe('Sin servicios en curso · Último pedido ayer');
  });

  it('counts the days in Lima: 23:30 of the 28th in Lima is «ayer» although it is the 29th in UTC', () => {
    expect(dayLabel('2026-10-29T04:30:00Z', now)).toBe('ayer');
    expect(dayLabel('2026-10-12T15:00:00Z', now)).toBe('12 oct');
  });
});

describe('archivedBanner', () => {
  it('only an archived channel has it, with the date and the 60-day rule (design f-03)', () => {
    expect(archivedBanner({ live: true, archived_since: null })).toBeNull();
    expect(archivedBanner({ live: false, archived_since: '2026-10-12T15:00:00Z' })).toEqual({ title: 'Archivado desde el 12/10/2026', body: 'Sin movimiento en 60 días. Vuelve a Clientes con el próximo movimiento.' });
  });
});

describe('filterArchivedClients', () => {
  const archived = [
    { client: client('1', { live: false, name: 'Constructora Rímac', ruc: '20562910394', last_order_at: daysAgo(200), archived_group: '6+' }), chat: chat('1', 2) },
    { client: client('2', { live: false, name: 'Transportes Huaral', ruc: '20491238471', last_order_at: daysAgo(100), archived_group: '2-6' }), chat: chat('2') },
    { client: client('3', { live: false, name: 'Obras y Pistas', last_order_at: null, archived_group: '6+' }), chat: null },
  ];

  it('groups by age with the counts of each chip (design f-02)', () => {
    // Act
    const view = filterArchivedClients(archived, { query: '', filter: 'all' }, now);
    // Assert
    expect(view.groups.map((group) => [group.title, group.entries.map((entry) => entry.client.id)])).toEqual([['Hace 2 a 6 meses', ['2']], ['Hace más de 6 meses', ['1', '3']]]);
    expect(view.counts).toEqual({ all: 3, unread: 1, recent: 1 });
  });

  it('searches by name without accents or by RUC, and the chips filter', () => {
    expect(filterArchivedClients(archived, { query: 'rimac', filter: 'all' }, now).shown).toBe(1);
    expect(filterArchivedClients(archived, { query: '2049123', filter: 'all' }, now).groups[0]!.entries[0]!.client.id).toBe('2');
    expect(filterArchivedClients(archived, { query: '', filter: 'unread' }, now).groups.flatMap((group) => group.entries.map((entry) => entry.client.id))).toEqual(['1']);
    expect(filterArchivedClients(archived, { query: '', filter: 'recent' }, now).groups.flatMap((group) => group.entries.map((entry) => entry.client.id))).toEqual(['2']);
  });

  it('nothing matching leaves no groups', () => {
    expect(filterArchivedClients(archived, { query: 'nadie', filter: 'all' }, now)).toMatchObject({ groups: [], shown: 0 });
  });
});
