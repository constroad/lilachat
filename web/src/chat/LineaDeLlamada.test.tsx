import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const direct: ChatSummary = { id: 'c1', kind: 'direct', name: 'Ana Torres', memberIds: ['yo', 'ana'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const call = (senderId: string, valor = 'voz:perdida'): MensajeEnPantalla => ({ chatId: 'c1', seq: 7, senderId, clientKey: 'sis-llamada-7', kind: 'system', body: 'Llamada perdida', system: { evento: 'llamada', valor }, at: new Date().toISOString() });

function renderWith(message: MensajeEnPantalla, chat: ChatSummary = direct) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana Torres']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={message} mio={false} agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
}

afterEach(() => vi.unstubAllGlobals());

/** Backlog 23 (José, 21/10): «Recordarme devolverla» on a missed call, also on the web. */
describe('the call line on the web', () => {
  it('a missed call for me, in red, with «Recordarme devolverla»; the reminder is personal and points to this chat', async () => {
    const fetch = vi.fn(async () => new Response(JSON.stringify({ id: 'r1' }), { status: 201 }));
    vi.stubGlobal('fetch', fetch);
    renderWith(call('ana'));
    expect(screen.getByTestId('llamada-7')).toHaveTextContent('Llamada perdida');
    fireEvent.click(screen.getByTestId('recordar-devolver-7'));
    fireEvent.click(screen.getByTestId('devolver-quarter'));
    await waitFor(() => expect(fetch).toHaveBeenCalled());
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/agenda/reminders');
    expect(JSON.parse(String(init.body))).toMatchObject({ title: 'Devolver la llamada a Ana Torres', callBack: { chatId: 'c1', video: false } });
    expect(JSON.parse(String(init.body)).chatId).toBeUndefined();
    expect(await screen.findByText(/Te lo recuerdo a las/)).toBeInTheDocument();
  });

  it('no reminder for a call I made, one that was answered, or in a group', () => {
    renderWith(call('yo'));
    expect(screen.queryByTestId('recordar-devolver-7')).toBeNull();
  });

  it('an answered call says its length and offers nothing', () => {
    renderWith(call('ana', 'voz:95'));
    expect(screen.queryByTestId('recordar-devolver-7')).toBeNull();
  });
});
