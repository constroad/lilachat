import { describe, expect, it } from 'vitest';
import { clientsOfEntry, spaceListReady, isOrderCard, orderFocusOf, serviceStageLine, archivedBanner, clientChatIds, clientHeaderSubtitle, clientRowSubtitle, dayLabel, filterArchivedClients, filterServices, pageLiveClients, splitClients, CLIENTS_PAGE, CLIENTS_PREVIEW, type SpaceClient } from './spaceClients.js';

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
  it('a client with only quotes (no order, no service) is not listed, unless its channel has something unread (José, 30/10)', () => {
    // Arrange
    const quoted = client('q', { orders_total: 0, last_order_at: null });
    const quotedWithNews = client('n', { orders_total: 0, last_order_at: null, live: false });
    const serviced = client('s', { orders_total: 0, last_order_at: null, services: [{ id: 's1', name: 'Base', status: 'pending', stage_label: '' }] });
    // Act
    const split = splitClients([quoted, quotedWithNews, serviced, client('o')], [chat('n', 1)]);
    // Assert
    expect(split.live.map((entry) => entry.client.id)).toEqual(['s', 'o']);
    expect(split.archived.map((entry) => entry.client.id)).toEqual(['n']);
    expect([...clientChatIds([quoted])]).toEqual(['chat-q']);
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

describe('clientHeaderSubtitle', () => {
  it('a client channel reads «Cliente · N miembros» under its name (design f-03)', () => {
    expect(clientHeaderSubtitle(6)).toBe('Cliente · 6 miembros');
    expect(clientHeaderSubtitle(1)).toBe('Cliente · 1 miembro');
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


describe('an order\'s card opens its sheet (José 06/11: «el card llega pero no puedo tocarlo para ver fotos»)', () => {
  const services = [{ id: 's1', name: 'QA-CTLPIS' }];
  const record = (extra: Record<string, unknown>) => ({ seq: 10, at: daysAgo(0), service_id: 's1', title: '30 m³', ...extra });

  it('knows an order\'s card by its kicker, whatever its case', () => {
    expect(isOrderCard({ kicker: 'PEDIDO' })).toBe(true);
    expect(isOrderCard({ kicker: ' pedido ' })).toBe(true);
    expect(isOrderCard({ kicker: 'INFORME' })).toBe(false);
    expect(isOrderCard({})).toBe(false);
  });

  it('finds the service and the order of the card\'s message', () => {
    // Arrange
    const records = [record({ seq: 9, kind: 'service.record', record_id: 'r1' }), record({ kind: 'order.created', record_id: 'o1' })];
    // Act and assert
    expect(orderFocusOf(services, records, 10)).toEqual({ service: services[0], orderId: 'o1' });
  });

  it('a message that is not an order, has no order id or is not among the records opens nothing', () => {
    expect(orderFocusOf(services, [record({ kind: 'service.record', record_id: 'r1' })], 10)).toBeNull();
    expect(orderFocusOf(services, [record({ kind: 'order.created' })], 10)).toBeNull();
    expect(orderFocusOf(services, [record({ kind: 'order.created', record_id: 'o1' })], 11)).toBeNull();
  });

  it('an order of a service the channel no longer lists opens nothing', () => {
    expect(orderFocusOf(services, [record({ kind: 'order.created', record_id: 'o1', service_id: 'otro' })], 10)).toBeNull();
  });
});

describe('the space list waits for its clients (José 04/11: «muestra varios y después los recorta»)', () => {
  it('is not ready while the clients are unknown: their channels would sit in «Canales» and then leave', () => {
    expect(spaceListReady({ chats: [], clients: null })).toBe(false);
    expect(spaceListReady({ chats: null, clients: [] })).toBe(false);
    expect(spaceListReady({ chats: [], clients: [] })).toBe(true);
  });

  it('paints what it already saw, even when the refresh fails', () => {
    expect(clientsOfEntry({ value: ['a'], error: 'sin red' })).toEqual(['a']);
  });

  it('waits for the first answer, and a failed one is an empty list, not a wait forever', () => {
    expect(clientsOfEntry({})).toBeNull();
    expect(clientsOfEntry({ error: 'sin red' })).toEqual([]);
  });
});

describe('pageLiveClients (José 29/10: the last 3 or 4, «Ver más» and a filter by client)', () => {
  const entry = (id: string, name: string, unread = 0, ruc?: string) => ({ client: { id, name, ruc } as SpaceClient, chat: { id: `c-${id}`, unread } });
  const live = [entry('1', 'El Almirante'), entry('2', 'Pachacamac SAC'), entry('3', 'Vía Sur'), entry('4', 'Consorcio Norte'), entry('5', 'Andes', 2), entry('6', 'Lurín', 0, '20601234567')];

  it('shows the newest four first, plus any further one with unread messages, and says how many stay hidden', () => {
    const page = pageLiveClients(live, { query: '', shown: CLIENTS_PREVIEW });

    expect(page.entries.map((one) => one.client.id)).toEqual(['1', '2', '3', '4', '5']);
    expect(page.hidden).toBe(1);
  });

  it('«Ver más» grows the page and leaves nothing hidden at the end', () => {
    expect(pageLiveClients(live, { query: '', shown: CLIENTS_PREVIEW + CLIENTS_PAGE }).hidden).toBe(0);
  });

  it('a filter searches every live client by name without accents, or by RUC, with no page limit', () => {
    expect(pageLiveClients(live, { query: 'pachacámac', shown: CLIENTS_PREVIEW }).entries.map((one) => one.client.id)).toEqual(['2']);
    expect(pageLiveClients(live, { query: '2060123', shown: CLIENTS_PREVIEW }).entries.map((one) => one.client.id)).toEqual(['6']);
  });

  it('a search also finds the archived ones, after the live (José 05/11: «no muestra clientes antiguos»); without a search they stay out', () => {
    // Arrange
    const archived = [entry('7', 'Andes Viejo'), entry('8', 'Obras Antiguas', 0, '20991234567')];
    // Act
    const byName = pageLiveClients(live, { query: 'andes', shown: CLIENTS_PREVIEW, archived });
    const byRuc = pageLiveClients(live, { query: '2099123', shown: CLIENTS_PREVIEW, archived });
    const noSearch = pageLiveClients(live, { query: '', shown: CLIENTS_PREVIEW, archived });
    // Assert
    expect(byName.entries.map((one) => one.client.id)).toEqual(['5', '7']);
    expect(byRuc.entries.map((one) => one.client.id)).toEqual(['8']);
    expect(noSearch.entries.map((one) => one.client.id)).toEqual(['1', '2', '3', '4', '5']);
  });
});

describe('filterServices (José 29/10: the services of a client channel with their search filters)', () => {
  const service = (id: string, name: string, status: SpaceClient['services'][number]['status']) => ({ id, name, status, stage_label: '' });
  const services = [service('1', 'Pavimentación Av. Los Álamos', 'in_progress'), service('2', 'Bacheo Jr. Lima', 'pending'), service('3', 'Parchado Av. Central', 'completed'), service('4', 'Asfaltado Calle 5', 'rejected')];

  it('counts each filter and shows the open ones (pending or in progress) first', () => {
    const shown = filterServices(services, { query: '', filter: 'all' });

    expect(shown.counts).toEqual({ all: 4, open: 2, completed: 1, rejected: 1 });
    expect(shown.services.map((one) => one.id)).toEqual(['1', '2', '3', '4']);
  });

  it('the newest start first among the open ones and among the closed ones (José 12/11)', () => {
    // Arrange
    const dated = [
      { ...service('a', 'Corredor Pachacútec', 'in_progress'), started_at: '2026-07-01' },
      { ...service('b', 'b1', 'pending'), started_at: '2026-07-13' },
      { ...service('c', 'Sin fecha', 'pending') },
      { ...service('d', 'QA-PISTA-APK', 'pending'), started_at: '2026-11-12' },
      { ...service('e', 'Parchado viejo', 'completed'), started_at: '2026-12-01' },
    ];
    // Act
    const shown = filterServices(dated, { query: '', filter: 'all' });
    // Assert
    expect(shown.services.map((one) => one.id)).toEqual(['d', 'b', 'a', 'c', 'e']);
  });

  it('a chip keeps only its state, and the search finds by name without accents', () => {
    expect(filterServices(services, { query: '', filter: 'open' }).services.map((one) => one.id)).toEqual(['1', '2']);
    expect(filterServices(services, { query: 'alamos', filter: 'all' }).services.map((one) => one.id)).toEqual(['1']);
    expect(filterServices(services, { query: 'av.', filter: 'completed' }).services.map((one) => one.id)).toEqual(['3']);
  });
});

describe('serviceStageLine', () => {
  it('«Etapa: X» unless the stage only repeats the state pill', () => {
    expect(serviceStageLine({ status: 'in_progress', stage_label: 'Ejecución' })).toBe('Etapa: Ejecución');
    expect(serviceStageLine({ status: 'pending', stage_label: 'Pendiente' })).toBe('Avance');
    expect(serviceStageLine({ status: 'pending', stage_label: '' })).toBe('Avance');
  });
});
