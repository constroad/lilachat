import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { ClientEntry, SpaceClient } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';
import { ClientsSection } from './ClientsSection';
import { ArchivedClients } from './ArchivedClients';
import { ArchivedClientBanner, ArchivedComposerNote, ClientServices } from './ClientChannelParts';

/** Pending 21 (§157): the client channels on the web (designs f-01, f-02, f-03). */
const now = new Date('2026-10-29T15:00:00Z');
const daysAgo = (days: number) => new Date(now.getTime() - days * 86_400_000).toISOString();
const client = (id: string, extra: Partial<SpaceClient> = {}): SpaceClient => ({ id, chat_id: `chat-${id}`, name: `Cliente ${id}`, live: true, archived_since: null, last_activity_at: daysAgo(1), last_order_at: daysAgo(0), orders_total: 4, archived_group: '2-6', services: [], ...extra });
const chat = (id: string, unread = 0) => ({ id: `chat-${id}`, kind: 'group', name: `Cliente ${id}`, unread, lastSeq: 3, memberIds: [], lastMessage: { seq: 3, body: 'Hola', senderId: 'u', at: daysAgo(0) } }) as unknown as ChatSummary;
const entry = (one: SpaceClient, unread = 0): ClientEntry<ChatSummary> => ({ client: one, chat: chat(one.id, unread) });
const inProgress = { id: 's1', name: 'Base granular km 12', status: 'in_progress' as const, stage_label: 'En ejecución', progress: 40, url: 'https://drive.example.com/s1' };

describe('ClientsSection (design f-01)', () => {
  it('lists the live clients with their services line and opens «Archivados» with its unread count', () => {
    // Arrange
    const onOpen = vi.fn();
    const onArchived = vi.fn();
    render(<ClientsSection spaceId="sp1" query="" live={[entry(client('a', { services: [inProgress] }), 3)]} archived={Array.from({ length: 237 }, (_, index) => entry(client(`v${index}`, { live: false })))} archivedUnread={2} folded={false} onToggle={vi.fn()} selectedChatId={null} onOpen={onOpen} onArchived={onArchived} now={now} />);
    // Act
    fireEvent.click(screen.getByTestId('cliente-fila-a'));
    fireEvent.click(screen.getByTestId('clientes-archivados'));
    // Assert
    expect(screen.getByText('1 servicio en curso · Último pedido hoy')).toBeInTheDocument();
    expect(screen.getByText('Archivados · 237 clientes')).toBeInTheDocument();
    expect(screen.getByText('2 sin leer')).toBeInTheDocument();
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'chat-a' }));
    expect(onArchived).toHaveBeenCalled();
  });

  it('the search of the space also finds an archived client', () => {
    // Arrange and act
    render(<ClientsSection spaceId="sp1" query="antiguo" live={[entry(client('a'))]} archived={[entry(client('z', { name: 'Cliente Antiguo', live: false }))]} archivedUnread={0} folded={false} onToggle={vi.fn()} selectedChatId={null} onOpen={vi.fn()} onArchived={vi.fn()} />);
    // Assert
    expect(screen.getByTestId('cliente-fila-z')).toBeInTheDocument();
    expect(screen.queryByTestId('cliente-fila-a')).toBeNull();
  });

  it('is not there for someone in no client channel', () => {
    const { container } = render(<ClientsSection spaceId="sp1" query="" live={[]} archived={[]} archivedUnread={0} folded={false} onToggle={vi.fn()} selectedChatId={null} onOpen={vi.fn()} onArchived={vi.fn()} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('ArchivedClients (design f-02)', () => {
  const archived = [
    entry(client('1', { live: false, name: 'Constructora Rímac', ruc: '20562910394', last_order_at: daysAgo(200), archived_group: '6+', archived_since: '2026-04-11T15:00:00Z' }), 2),
    entry(client('2', { live: false, name: 'Transportes Huaral', ruc: '20491238471', last_order_at: daysAgo(100), archived_group: '2-6', archived_since: '2026-10-12T15:00:00Z' })),
  ];

  it('shows the 60-day rule, the groups by age and the table rows; a row opens its chat', () => {
    // Arrange
    const onOpen = vi.fn();
    render(<ArchivedClients archived={archived} onOpen={onOpen} onClose={vi.fn()} now={now} />);
    // Act
    fireEvent.click(screen.getByTestId('archivado-fila-2'));
    // Assert
    expect(screen.getByText('Sin movimiento en 60 días. Vuelve a Clientes con el próximo movimiento.')).toBeInTheDocument();
    expect(within(screen.getByTestId('grupo-archivados-2-6')).getByText('12/10/2026')).toBeInTheDocument();
    expect(screen.getByTestId('grupo-archivados-6+')).toHaveTextContent('Constructora Rímac');
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: 'chat-2' }));
  });

  it('searches by RUC and filters by «Sin leer»; nothing matching says so', () => {
    // Arrange
    render(<ArchivedClients archived={archived} onOpen={vi.fn()} onClose={vi.fn()} now={now} />);
    // Act
    fireEvent.change(screen.getByTestId('buscar-archivados'), { target: { value: '2049' } });
    const byRuc = screen.queryByTestId('grupo-archivados-6+');
    fireEvent.change(screen.getByTestId('buscar-archivados'), { target: { value: '' } });
    fireEvent.click(screen.getByTestId('chip-archivados-unread'));
    const unread = screen.queryByTestId('grupo-archivados-2-6');
    fireEvent.change(screen.getByTestId('buscar-archivados'), { target: { value: 'nadie' } });
    // Assert
    expect(byRuc).toBeNull();
    expect(unread).toBeNull();
    expect(screen.getByTestId('archivados-vacio')).toBeInTheDocument();
  });
});

describe('a client channel (design f-03)', () => {
  it('archived: the banner with its date and the note over the composer; live: neither', () => {
    // Arrange
    const archived = client('x', { live: false, archived_since: '2026-10-12T15:00:00Z' });
    // Act
    const { rerender } = render(<><ArchivedClientBanner client={archived} /><ArchivedComposerNote client={archived} /></>);
    const withBanner = screen.getByTestId('aviso-cliente-archivado').textContent;
    const withNote = screen.getByTestId('nota-archivado').textContent;
    rerender(<><ArchivedClientBanner client={client('x')} /><ArchivedComposerNote client={client('x')} /></>);
    // Assert
    expect(withBanner).toContain('Archivado desde el 12/10/2026');
    expect(withNote).toBe('Escribir aquí no lo saca de Archivados');
    expect(screen.queryByTestId('aviso-cliente-archivado')).toBeNull();
    expect(screen.queryByTestId('nota-archivado')).toBeNull();
  });

  it('the links of the channel (José 31/10): the client\'s at the top and each service\'s on its card, only while their action is on', () => {
    // Arrange
    const open = vi.fn();
    const links = { can: (kind: string) => kind !== 'order', open, map: vi.fn() };
    render(<ClientServices client={client('x', { services: [inProgress] })} records={[]} target={null} links={links} />);
    // Act
    fireEvent.click(screen.getByTestId('enlace-cliente'));
    fireEvent.click(screen.getByTestId('enlace-servicio-s1'));
    // Assert
    expect(open.mock.calls).toEqual([[{ kind: 'client', clientId: 'x' }], [{ kind: 'service', clientId: 'x', serviceId: 's1' }]]);
  });

  it('the «Ver despachos y fotos» of an order\'s card opens its service once the records say which it is', () => {
    // Arrange
    const onFocused = vi.fn();
    const target = { jwt: 'j', spaceId: 'sp', clientId: 'x' };
    const records = [{ seq: 10, at: now.toISOString(), kind: 'order.created', service_id: 's1', record_id: 'o1', title: '30 m³' }];
    const one = client('x', { services: [inProgress] });
    const { rerender } = render(<ClientServices client={one} records={null} target={target} focusSeq={10} onFocused={onFocused} />);
    expect(onFocused).not.toHaveBeenCalled();
    // Act
    rerender(<ClientServices client={one} records={records} target={target} focusSeq={10} onFocused={onFocused} />);
    // Assert
    expect(screen.getByTestId('detalle-servicio')).toBeInTheDocument();
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it('a card with no order among the records stays on the list of services', () => {
    // Arrange
    const onFocused = vi.fn();
    // Act
    render(<ClientServices client={client('x', { services: [inProgress] })} records={[]} target={{ jwt: 'j', spaceId: 'sp', clientId: 'x' }} focusSeq={10} onFocused={onFocused} />);
    // Assert
    expect(screen.queryByTestId('detalle-servicio')).toBeNull();
    expect(onFocused).toHaveBeenCalledTimes(1);
  });

  it('tells its channel when a service opens and closes, so it can take the whole conversation (José 06/11)', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { service: { id: inProgress.id, name: inProgress.name }, orders: [], dispatches: [], reports: [], totals: { orders: 0, dispatches: 0, reports: 0 } } }), { status: 200 })));
    const onServiceOpen = vi.fn();
    const { unmount } = render(<ClientServices client={client('x', { services: [inProgress] })} records={[]} target={{ jwt: 'j', spaceId: 'sp', clientId: 'x' }} onServiceOpen={onServiceOpen} />);
    // Act
    fireEvent.click(screen.getByTestId(`abrir-servicio-${inProgress.id}`));
    await screen.findByTestId('volver-a-servicios');
    fireEvent.click(screen.getByTestId('volver-a-servicios'));
    const shown = onServiceOpen.mock.calls.map((call) => call[0]);
    unmount();
    // Assert
    expect(shown).toContain(true);
    expect(shown.at(-1)).toBe(false);
    expect(onServiceOpen).toHaveBeenLastCalledWith(false);
  });

  it('the client\'s Drive is a link for whoever may see it, now that «Archivos» is gone', () => {
    // Arrange
    const withDrive = client('x', { services: [inProgress], drive_url: 'https://portal.constroad.com/drive/c1', access: { money: true } });
    const withoutDrive = client('y', { services: [inProgress], drive_url: 'https://portal.constroad.com/drive/c1', access: { money: false } });
    // Act
    const { rerender } = render(<ClientServices client={withDrive} records={[]} target={null} />);
    const link = screen.getByTestId('drive-cliente');
    // Assert
    expect(link).toHaveAttribute('href', 'https://portal.constroad.com/drive/c1');
    rerender(<ClientServices client={withoutDrive} records={[]} target={null} />);
    expect(screen.queryByTestId('drive-cliente')).toBeNull();
  });

  it('without the link actions offered to that person there is nothing to tap', () => {
    render(<ClientServices client={client('x', { services: [inProgress] })} records={[]} target={null} links={{ can: () => false, open: vi.fn(), map: vi.fn() }} />);
    expect(screen.queryByTestId('enlace-cliente')).toBeNull();
    expect(screen.queryByTestId('enlace-servicio-s1')).toBeNull();
  });

  it('«Servicios» shows each service with its state, progress and records; a record opens its message', () => {
    // Arrange
    const onOpenRecord = vi.fn();
    const records = [{ seq: 7, at: '2026-10-29T11:36:30Z', kind: 'service.record', service_id: 's1', title: 'Control de pista · 29 de octubre', kicker: 'INFORME' }];
    render(<ClientServices client={client('x', { drive_url: 'https://portal.constroad.com/drive/c1', services: [{ ...inProgress, started_at: '2026-10-06' }, { id: 's2', name: 'Bacheo', status: 'completed', stage_label: '' }] })} records={records} onOpenRecord={onOpenRecord} target={null} />);
    // Act
    fireEvent.click(screen.getByTestId('registro-7'));
    // Assert
    expect(screen.queryByTestId('drive-cliente')).toBeNull();
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('En ejecución');
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('40 %');
    // José 01/11: the service's records come under their day.
    expect(screen.getByTestId('dia-registros-29 de octubre')).toHaveTextContent('Control de pista');
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('INFORME');
    expect(screen.getByTestId('abrir-servicio-s1')).toHaveAttribute('href', 'https://drive.example.com/s1');
    expect(screen.getByTestId('servicio-s2')).toHaveTextContent('Completado');
    // José 31/10: the day it started, as a day (read as an instant it would be 5 oct in Lima); without one, nothing.
    expect(screen.getByTestId('inicio-servicio-s1')).toHaveTextContent('Inicio 6 oct');
    expect(screen.queryByTestId('inicio-servicio-s2')).toBeNull();
    expect(onOpenRecord).toHaveBeenCalledWith(7);
  });

  it('with the space, tapping a service opens its expediente and «Servicios» goes back (José 30/10)', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ detail: { service: { id: 's1', name: 'Base granular km 12' }, orders: [], dispatches: [], reports: [], totals: { orders: 0, dispatches: 0, reports: 0 } } }), { status: 200 })));
    render(<ClientServices client={client('x', { services: [inProgress] })} records={[]} target={{ jwt: 'j', spaceId: 'w1', clientId: 'x' }} />);
    fireEvent.click(screen.getByTestId('abrir-servicio-s1'));
    expect(await screen.findByText('Este servicio todavía no tiene pedidos.')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('volver-a-servicios'));
    expect(screen.getByTestId('servicio-s1')).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it('records still loading show a placeholder', () => {
    render(<ClientServices client={client('x', { services: [inProgress] })} records={null} target={null} />);
    expect(screen.queryByTestId(/registro-/)).toBeNull();
  });
});
