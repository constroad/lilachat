import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ChatList } from './ChatList';
import type { ChatSummary } from './types';

/**
 * Contratos de la lista, no su apariencia.
 *
 * Lo que se fija acá es lo que el diseño promete y es fácil de romper sin
 * notarlo: que la fila abierta se distinga, que «escribiendo» reemplace la
 * vista previa, y que cargando no se lea como vacío.
 */
const chat = (over: Partial<ChatSummary> = {}): ChatSummary => ({
  id: 'c1',
  kind: 'group',
  name: 'Familia',
  memberIds: ['u1', 'u2'],
  lastSeq: 3,
  unread: 0,
  lastMessage: { seq: 3, body: 'Llego tarde', senderId: 'u2', at: new Date().toISOString() },
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...over,
});

const base = {
  selectedChatId: null,
  query: '',
  onQueryChange: () => undefined,
  onSelect: () => undefined,
  me: { name: 'José', phone: '902049935' },
  onSettings: () => undefined,
  loading: false,
  onNewChat: () => undefined,
  onNewGroup: () => undefined,
  onAgenda: () => undefined,
  onNewBorrador: () => undefined,
  onAccion: () => undefined,
  jwt: 'jwt-de-prueba',
};

describe('ChatList', () => {
  /** Auditoría (19/10): la fila de la web no tenía los checks de mi último mensaje. */
  it('mi último mensaje lleva sus checks; el ajeno y el borrado, no', () => {
    const mio = { seq: 3, body: 'Ya voy', senderId: 'u1', at: new Date().toISOString() };
    const { rerender } = render(<ChatList {...base} yo="u1" chats={[chat({ lastMessage: mio, othersDeliveredSeq: 3 })]} />);
    expect(screen.getByTestId('checks-fila-delivered')).toBeInTheDocument();

    rerender(<ChatList {...base} yo="u1" chats={[chat({ lastMessage: mio, othersReadSeq: 3, othersDeliveredSeq: 3 })]} />);
    expect(screen.getByTestId('checks-fila-read')).toBeInTheDocument();

    rerender(<ChatList {...base} yo="u1" chats={[chat()]} />);
    expect(screen.queryByTestId(/checks-fila-/)).toBeNull();

    rerender(<ChatList {...base} yo="u1" chats={[chat({ lastMessage: { ...mio, deletedAt: new Date().toISOString() } })]} />);
    expect(screen.queryByTestId(/checks-fila-/)).toBeNull();
    expect(screen.getByText('Se eliminó este mensaje')).toBeInTheDocument();
  });

  it('muestra nombre, vista previa y hora', () => {
    render(<ChatList {...base} chats={[chat()]} />);

    expect(screen.getByText('Familia')).toBeInTheDocument();
    expect(screen.getByText('Llego tarde')).toBeInTheDocument();
  });

  /** La fila abierta se marca; sin esto no se sabe qué se está mirando. */
  it('marca la conversación seleccionada', () => {
    render(<ChatList {...base} chats={[chat()]} selectedChatId="c1" />);

    expect(screen.getByTestId('chat-c1')).toHaveAttribute('aria-current', 'true');
  });

  it('«escribiendo» reemplaza la vista previa', () => {
    render(<ChatList {...base} chats={[chat({ typingName: 'Ana' })]} />);

    expect(screen.getByText('Escribiendo…')).toBeInTheDocument();
    expect(screen.queryByText('Llego tarde')).not.toBeInTheDocument();
  });

  /**
   * Cargando NO puede leerse como vacío: es la diferencia entre «esperá» y «no
   * tienes conversaciones», y el usuario asume lo segundo.
   */
  it('cargando muestra skeleton, no el vacío', () => {
    render(<ChatList {...base} chats={[]} loading />);

    expect(screen.getByTestId('lista-cargando')).toBeInTheDocument();
    expect(screen.queryByText(/Todavía no tienes conversaciones/)).not.toBeInTheDocument();
  });

  /** Un filtro sin resultados no es lo mismo que no tener chats. */
  it('distingue el vacío del filtro del vacío real', () => {
    const { rerender } = render(<ChatList {...base} chats={[]} />);
    expect(screen.getByText(/Todavía no tienes conversaciones/)).toBeInTheDocument();

    rerender(<ChatList {...base} chats={[]} query="zzz" />);
    expect(screen.getByText(/Ninguna conversación coincide/)).toBeInTheDocument();
  });

  it('avisa al elegir una conversación', async () => {
    const onSelect = vi.fn();
    render(<ChatList {...base} chats={[chat()]} onSelect={onSelect} />);

    await userEvent.click(screen.getByTestId('chat-c1'));

    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 'c1' }));
  });
});

/** W3a (19/10): filtros, archivados y el menú de cada fila, como WhatsApp Web. */
describe('ChatList — W3a', () => {
  const lista = [
    chat({ id: 'c1', name: 'Familia', kind: 'group', pinned: true, unread: 2 }),
    chat({ id: 'c2', name: 'Ana', kind: 'direct', muted: true }),
    chat({ id: 'c3', name: 'Ideas', kind: 'notas', markedUnread: true }),
    chat({ id: 'c4', name: 'Viejo', kind: 'direct', archived: true }),
  ];

  it('los chips muestran cuántos hay y filtran', async () => {
    render(<ChatList {...base} chats={lista} />);
    expect(screen.getByTestId('filtro-no-leidos')).toHaveTextContent('No leídos2');
    expect(screen.getByTestId('filtro-grupos')).toHaveTextContent('Grupos1');
    expect(screen.getByTestId('filtro-borradores')).toHaveTextContent('Borradores1');

    await userEvent.click(screen.getByTestId('filtro-borradores'));
    expect(screen.getByTestId('chat-c3')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-c1')).toBeNull();
    expect(screen.getByTestId('filtro-borradores')).toHaveAttribute('aria-pressed', 'true');
  });

  it('los archivados no están en la principal: se entra por su fila y se vuelve', async () => {
    render(<ChatList {...base} chats={lista} />);
    expect(screen.queryByTestId('chat-c4')).toBeNull();
    expect(screen.getByTestId('fila-archivados')).toHaveTextContent('1');

    await userEvent.click(screen.getByTestId('fila-archivados'));
    expect(screen.getByTestId('chat-c4')).toBeInTheDocument();
    expect(screen.queryByTestId('chat-c1')).toBeNull();
    expect(screen.queryByTestId('filtro-grupos')).toBeNull();

    await userEvent.click(screen.getByTestId('btn-salir-archivados'));
    expect(screen.getByTestId('chat-c1')).toBeInTheDocument();
  });

  it('cada fila muestra fijado, silenciado y marcado como no leído', () => {
    render(<ChatList {...base} chats={lista} />);
    expect(screen.getByTestId('fijado-c1')).toBeInTheDocument();
    expect(screen.getByTestId('silenciado-c2')).toBeInTheDocument();
    expect(screen.getByTestId('marca-no-leido-c3')).toBeInTheDocument();
  });

  it('el menú de la fila ofrece las acciones y avisa la elegida', async () => {
    const onAccion = vi.fn();
    render(<ChatList {...base} chats={lista} onAccion={onAccion} />);
    screen.getByTestId('menu-chat-c2').focus();
    await userEvent.keyboard('{Enter}');
    expect(await screen.findByTestId('accion-chat-reactivar')).toHaveTextContent('Activar notificaciones');
    await userEvent.click(screen.getByTestId('accion-chat-archivar'));
    expect(onAccion).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }), 'archivar');
  });

  it('eliminar pide confirmación antes de avisar', async () => {
    const onAccion = vi.fn();
    render(<ChatList {...base} chats={lista} onAccion={onAccion} />);
    screen.getByTestId('menu-chat-c2').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByTestId('accion-chat-eliminar'));
    expect(onAccion).not.toHaveBeenCalled();
    expect(screen.getByRole('dialog', { name: '¿Eliminar el chat con Ana?' })).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('btn-confirmar-accion-chat'));
    expect(onAccion).toHaveBeenCalledWith(expect.objectContaining({ id: 'c2' }), 'eliminar');
  });

  it('«Nuevo borrador» está en el menú de la cabecera', async () => {
    const onNewBorrador = vi.fn();
    render(<ChatList {...base} chats={lista} onNewBorrador={onNewBorrador} />);
    await userEvent.click(screen.getByTestId('btn-menu'));
    await userEvent.click(screen.getByTestId('btn-nuevo-borrador'));
    expect(onNewBorrador).toHaveBeenCalled();
  });
});

describe('ChatList — confirmar un borrador', () => {
  it('eliminar un borrador no habla de «la otra persona»', async () => {
    render(<ChatList {...base} chats={[chat({ id: 'n1', name: 'Ideas', kind: 'notas' })]} />);
    screen.getByTestId('menu-chat-n1').focus();
    await userEvent.keyboard('{Enter}');
    await userEvent.click(await screen.findByTestId('accion-chat-eliminar'));
    const dialogo = screen.getByRole('dialog', { name: '¿Eliminar el borrador Ideas?' });
    expect(dialogo).not.toHaveTextContent('otra persona');
  });
});

describe('ChatList — vista previa de avisos (W3b)', () => {
  it('«Fijaste un mensaje» en vez del teléfono que manda el server', () => {
    const aviso = chat({ id: 'a1', kind: 'direct', name: 'Ana', lastMessage: { seq: 5, kind: 'system', body: '902049935 fijó un mensaje', senderId: 'yo', at: new Date().toISOString(), system: { evento: 'fijo', quien: { phone: '902049935' } } } });
    render(<ChatList {...base} chats={[aviso]} yo="yo" />);
    expect(screen.getByText('Fijaste un mensaje')).toBeInTheDocument();
  });

  it('si lo hizo la otra persona de un 1:1, con el nombre del chat', () => {
    const aviso = chat({ id: 'a2', kind: 'direct', name: 'Ana', lastMessage: { seq: 5, kind: 'system', body: '900000088 fijó un mensaje', senderId: 'ana', at: new Date().toISOString(), system: { evento: 'fijo', quien: { phone: '900000088' } } } });
    render(<ChatList {...base} chats={[aviso]} yo="yo" />);
    expect(screen.getByText('Ana fijó un mensaje')).toBeInTheDocument();
  });
});
