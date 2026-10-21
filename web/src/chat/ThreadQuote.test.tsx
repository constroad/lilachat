import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat = { id: 'c1', kind: 'direct', name: 'Wilson', memberIds: ['yo', 'w'] } as unknown as ChatSummary;
const root = { chatId: 'c1', seq: 151, senderId: 'w', clientKey: 'root', kind: 'text', body: '¿Vamos el jueves?', at: new Date().toISOString() } as MensajeEnPantalla;
const reply = { chatId: 'c1', seq: 160, senderId: 'yo', clientKey: 'reply', kind: 'text', body: 'frustrado', hiloDe: 151, enElChat: true, at: new Date().toISOString() } as MensajeEnPantalla;

function draw(extra: Partial<ContextoDeLaConversacion>) {
  const openThread = vi.fn();
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: '', chat, detalle: null, nombres: new Map([['w', 'Wilson']]), citado: (seq) => (seq === 151 ? root : undefined), onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), onAbrirHilo: openThread, ...extra };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={reply} mio agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
  return openThread;
}

/** José, 20/10: «it reaches the chat but does not say which was the original message, like Slack». */
describe('a thread reply also sent to the chat', () => {
  it('says «Respondió en un hilo» with the root, and opens the thread', async () => {
    const openThread = draw({});

    const quote = screen.getByTestId('cita-hilo-151');
    expect(quote.textContent).toContain('Respondió en un hilo');
    expect(quote.textContent).toContain('¿Vamos el jueves?');
    await userEvent.click(quote);
    expect(openThread).toHaveBeenCalledWith(151);
  });

  it('inside the thread panel it does not repeat it', () => {
    draw({ inThread: true });
    expect(screen.queryByTestId('cita-hilo-151')).toBeNull();
  });
});
