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
    // The time goes after the sentence (design `m-04-lineas-del-chat`).
    expect(screen.getByTestId('linea-zumbido').textContent).toMatch(/^Wilson te mandó un zumbido\d/);
  });

  it('mine', () => {
    draw(nudge('yo'), true);
    expect(screen.getByTestId('linea-zumbido').textContent).toMatch(/^Mandaste un zumbido\d/);
  });

  it('deleted for everyone, a nudge or a wink reads as a deleted message (22/10)', () => {
    // Arrange
    const deletedAt = new Date().toISOString();
    // Act
    draw({ ...nudge('w'), deletedAt }, false);
    draw({ ...nudge('w'), clientKey: 'g-w', kind: 'guino', wink: 'panda', deletedAt } as MensajeEnPantalla, false);
    // Assert
    expect(screen.queryByTestId('linea-zumbido')).toBeNull();
    expect(screen.queryByTestId(/^linea-guino/)).toBeNull();
    expect(screen.getAllByText('Se eliminó este mensaje')).toHaveLength(2);
  });
});
