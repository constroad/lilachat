import { describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat = { id: 'c1', kind: 'direct', name: 'Wilson', memberIds: ['yo', 'w'] } as unknown as ChatSummary;
const nudge = (senderId: string) => ({ chatId: 'c1', seq: 9, senderId, clientKey: `z-${senderId}`, kind: 'zumbido', at: new Date().toISOString() }) as MensajeEnPantalla;

function draw(message: MensajeEnPantalla, mine: boolean) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: '', chat, detalle: null, nombres: new Map([['w', 'Wilson']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={message} mio={mine} agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
}

/** The MSN nudge (backlog 3): a line in the chat, not a bubble. */
describe('nudge line', () => {
  it('says who sent it, or that I did', () => {
    draw(nudge('w'), false);
    expect(screen.getByTestId('linea-zumbido').textContent).toBe('Wilson te mandó un zumbido');
  });

  it('mine', () => {
    draw(nudge('yo'), true);
    expect(screen.getByTestId('linea-zumbido').textContent).toBe('Mandaste un zumbido');
  });
});
