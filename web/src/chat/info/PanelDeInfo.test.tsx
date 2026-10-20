import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { aDetalle } from '../useDetalleDelChat';
import type { ChatSummary } from '../types';
import { PanelDeInfo } from './PanelDeInfo';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Familia', memberIds: ['yo', 'mama', 'ana'], lastSeq: 1, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const detalle = (yoSoyAdmin: boolean) =>
  aDetalle({
    members: [
      { id: 'yo', name: 'José', phone: '9', role: yoSoyAdmin ? 'admin' : 'member', esYo: true },
      { id: 'mama', name: 'Mamá', phone: '900000001', role: 'admin' },
      { id: 'ana', name: 'Ana', phone: '900000088', role: 'member' },
    ],
  });

afterEach(() => vi.unstubAllGlobals());

function dibujar(yoSoyAdmin: boolean) {
  const onAccionDeChat = vi.fn();
  const onCambio = vi.fn();
  render(<PanelDeInfo chat={chat} detalle={detalle(yoSoyAdmin)} yo="yo" jwt="jwt" base={null} onCerrar={vi.fn()} onAviso={vi.fn()} onCambio={onCambio} onAccionDeChat={onAccionDeChat} onVerFoto={vi.fn()} />);
  return { onAccionDeChat, onCambio };
}

describe('PanelDeInfo (W3b)', () => {
  it('grupo: título, participantes con «Admin» y sumar gente', () => {
    dibujar(false);
    expect(screen.getByText('Info. del grupo')).toBeInTheDocument();
    expect(screen.getByText('Grupo · 3 participantes')).toBeInTheDocument();
    expect(screen.getByTestId('participante-mama')).toHaveTextContent('Admin');
    expect(screen.getByTestId('btn-agregar-participante')).toBeInTheDocument();
    // Un miembro común no saca ni nombra admins: sin menú.
    expect(screen.queryByTestId('menu-participante-ana')).toBeNull();
  });

  it('un admin ve el menú de cada participante', () => {
    dibujar(true);
    expect(screen.getByTestId('menu-participante-ana')).toBeInTheDocument();
  });

  it('silenciar usa la misma acción que la lista', async () => {
    const { onAccionDeChat } = dibujar(false);
    await userEvent.click(screen.getByTestId('interruptor-silenciar'));
    expect(onAccionDeChat).toHaveBeenCalledWith(chat, 'silenciar');
  });

  it('renombrar manda el nombre nuevo y relee', async () => {
    const pedido = vi.fn(async () => new Response('{"ok":true}', { status: 200 }));
    vi.stubGlobal('fetch', pedido);
    const { onCambio } = dibujar(false);
    await userEvent.click(screen.getByTestId('btn-editar-nombre'));
    await userEvent.clear(screen.getByTestId('input-nombre-del-chat'));
    await userEvent.type(screen.getByTestId('input-nombre-del-chat'), 'Familia Zamora{Enter}');
    expect(pedido).toHaveBeenCalledWith('/api/chats/c1', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Familia Zamora' }) }));
    expect(onCambio).toHaveBeenCalled();
  });

  it('salir pide confirmación', async () => {
    const { onAccionDeChat } = dibujar(false);
    await userEvent.click(screen.getByTestId('btn-salir-del-grupo'));
    expect(onAccionDeChat).not.toHaveBeenCalled();
    await userEvent.click(screen.getByTestId('btn-confirmar-accion-chat'));
    expect(onAccionDeChat).toHaveBeenCalledWith(chat, 'salir');
  });
});
