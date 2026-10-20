import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['yo', 'ana'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const mensaje = (extra: Partial<MensajeEnPantalla> = {}): MensajeEnPantalla => ({ chatId: 'c1', seq: 7, senderId: 'ana', clientKey: 'k7', kind: 'text', body: '¿Quién confirma el jueves?', at: new Date().toISOString(), ...extra });

function dibujar(m: MensajeEnPantalla, onAbrirHilo = vi.fn()) {
  const contexto: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), onAbrirHilo };
  render(
    <ConversacionContext.Provider value={contexto}>
      <BurbujaDeMensaje mensaje={m} mio={false} agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
  return onAbrirHilo;
}

/** José, 20/10: el hilo a mano junto a las reacciones, no solo dentro del menú. */
describe('el botón de hilo al pasar el mouse', () => {
  it('abre el hilo de ese mensaje', () => {
    const onAbrirHilo = dibujar(mensaje());
    fireEvent.click(screen.getByTestId('hilo-k7'));
    expect(onAbrirHilo).toHaveBeenCalledWith(7);
  });

  it('no aparece en una respuesta de un hilo (no hay hilos de hilos) ni en lo borrado', () => {
    dibujar(mensaje({ hiloDe: 3 }));
    expect(screen.queryByTestId('hilo-k7')).toBeNull();
  });

  it('no aparece mientras el mensaje no llegó al server', () => {
    dibujar(mensaje({ estado: 'enviando' }));
    expect(screen.queryByTestId('hilo-k7')).toBeNull();
  });
});
