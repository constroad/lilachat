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
    render(<ClientsSection query="" live={[entry(client('a', { services: [inProgress] }), 3)]} archived={237} archivedUnread={2} folded={false} onToggle={vi.fn()} selectedChatId={null} onOpen={onOpen} onArchived={onArchived} now={now} />);
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

  it('is not there for someone in no client channel', () => {
    const { container } = render(<ClientsSection query="" live={[]} archived={0} archivedUnread={0} folded={false} onToggle={vi.fn()} selectedChatId={null} onOpen={vi.fn()} onArchived={vi.fn()} />);
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

  it('«Servicios» shows the client Drive, each service with its state, progress, Drive link and records; a record opens its message', () => {
    // Arrange
    const onOpenRecord = vi.fn();
    const records = [{ seq: 7, at: '2026-10-29T11:36:30Z', kind: 'service.record', service_id: 's1', title: 'Control de pista · 29 de octubre', kicker: 'INFORME' }];
    render(<ClientServices client={client('x', { drive_url: 'https://portal.constroad.com/drive/c1', services: [inProgress, { id: 's2', name: 'Bacheo', status: 'completed', stage_label: '' }] })} records={records} onOpenRecord={onOpenRecord} />);
    // Act
    fireEvent.click(screen.getByTestId('registro-7'));
    // Assert
    expect(screen.getByTestId('drive-cliente')).toHaveAttribute('href', 'https://portal.constroad.com/drive/c1');
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('En ejecución');
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('40 %');
    expect(screen.getByTestId('servicio-s1')).toHaveTextContent('INFORME');
    expect(screen.getByTestId('servicio-drive-s1')).toHaveAttribute('href', 'https://drive.example.com/s1');
    expect(screen.getByTestId('servicio-s2')).toHaveTextContent('Completado');
    expect(onOpenRecord).toHaveBeenCalledWith(7);
  });

  it('without a client Drive there is no Drive row, and records still loading show a placeholder', () => {
    render(<ClientServices client={client('x', { services: [inProgress] })} records={null} />);
    expect(screen.queryByTestId('drive-cliente')).toBeNull();
    expect(screen.queryByTestId(/registro-/)).toBeNull();
  });
});
