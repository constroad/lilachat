import { beforeEach, describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MenuDelMensaje } from '../MenuDelMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from '../types';
import { ListaDeDestacados } from './ListaDeDestacados';

/** «Destacados» en la web (20/10), como la app: la estrella personal. */
const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['yo', 'ana'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const mensaje: MensajeEnPantalla = { chatId: 'c1', seq: 7, senderId: 'ana', clientKey: 'k7', kind: 'text', body: 'Plano final', at: new Date().toISOString() };

function conMenu(destacados: ReadonlySet<number>, onAccion = vi.fn()) {
  const contexto: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana']]), citado: () => undefined, onAccion, onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), destacados };
  render(
    <ConversacionContext.Provider value={contexto}>
      <MenuDelMensaje mensaje={mensaje} mio={false} />
    </ConversacionContext.Provider>
  );
  return onAccion;
}

describe('el menú del mensaje', () => {
  it('ofrece «Destacar», o «Quitar destacado» si ya lo está', async () => {
    const onAccion = conMenu(new Set());
    await userEvent.click(screen.getByTestId('menu-k7'));
    await userEvent.click(await screen.findByTestId('accion-destacar'));
    expect(onAccion).toHaveBeenCalledWith(mensaje, 'destacar');
  });

  it('ya destacado: quitar', async () => {
    const onAccion = conMenu(new Set([7]));
    await userEvent.click(screen.getByTestId('menu-k7'));
    await userEvent.click(await screen.findByTestId('accion-quitarDestacado'));
    expect(onAccion).toHaveBeenCalledWith(mensaje, 'quitarDestacado');
  });
});

describe('la lista de destacados', () => {
  let llamadas: { url: string; method: string }[] = [];
  beforeEach(() => {
    llamadas = [];
    vi.stubGlobal(
      'fetch',
      vi.fn(async (url: string, init?: RequestInit) => {
        llamadas.push({ url, method: init?.method ?? 'GET' });
        if (init?.method === 'DELETE') return new Response(null, { status: 204 });
        return new Response(
          JSON.stringify({
            destacados: [
              { chatId: 'c1', seq: 7, en: '2026-10-20T15:00:00Z', chat: { kind: 'group', name: 'Obra' }, autor: { id: 'ana', name: 'Ana', phone: '900000002' }, mensaje: { kind: 'text', body: 'Plano final', at: '2026-10-20T14:00:00Z' } },
              { chatId: 'c2', seq: 3, en: '2026-10-20T14:00:00Z', chat: { kind: 'direct', name: 'Wilson', phone: '900000003' }, autor: { id: 'yo' }, mensaje: { kind: 'image', at: '2026-10-20T13:00:00Z', media: { mime: 'image/jpeg' } } },
            ],
          }),
          { status: 200 }
        );
      })
    );
  });

  it('todas: el texto, quién y en qué chat; tocar lleva al mensaje', async () => {
    const onIr = vi.fn();
    render(<ListaDeDestacados jwt="j" yo="yo" onIr={onIr} onCerrar={() => {}} />);
    expect(await screen.findByText('Plano final')).toBeTruthy();
    expect(screen.getByText('Ana · Obra')).toBeTruthy();
    expect(screen.getByText('📷 Foto')).toBeTruthy();
    await userEvent.click(screen.getByTestId('fila-destacado-c1-7'));
    expect(onIr).toHaveBeenCalledWith(expect.objectContaining({ chatId: 'c1', seq: 7 }));
  });

  it('las de un chat; la estrella la quita (DELETE)', async () => {
    render(<ListaDeDestacados jwt="j" yo="yo" chatId="c1" onIr={() => {}} onCerrar={() => {}} />);
    expect(await screen.findByText('Plano final')).toBeTruthy();
    expect(screen.queryByText('📷 Foto')).toBeNull();
    await userEvent.click(screen.getByTestId('quitar-destacado-c1-7'));
    await waitFor(() => expect(llamadas.some((l) => l.method === 'DELETE' && l.url.endsWith('/api/chats/c1/destacados/7'))).toBe(true));
    expect(screen.queryByText('Plano final')).toBeNull();
  });
});
