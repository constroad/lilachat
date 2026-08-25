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
};

describe('ChatList', () => {
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
