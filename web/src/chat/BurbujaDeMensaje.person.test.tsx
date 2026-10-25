import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** José, 25/10/2026: the name or the photo of whoever wrote opens their card, in every mode. */
const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['yo', 'ana'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const message = (extra: Partial<MensajeEnPantalla> = {}): MensajeEnPantalla => ({ chatId: 'c1', seq: 7, senderId: 'ana', clientKey: 'k7', kind: 'text', body: 'Hola', at: new Date().toISOString(), ...extra });

function draw(params: { message: MensajeEnPantalla; flat: boolean; withCard?: boolean }) {
  const onViewPerson = vi.fn();
  const context: ContextoDeLaConversacion = {
    yo: 'yo',
    jwt: 'j',
    chat,
    detalle: null,
    nombres: new Map([['ana', 'Ana'], ['yo', 'Tú']]),
    citado: () => undefined,
    onAccion: vi.fn(),
    onVerFoto: vi.fn(),
    puedeFijar: false,
    fijados: new Set(),
    flat: params.flat,
    ...(params.withCard === false ? {} : { onViewPerson }),
  };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={params.message} mio={params.message.senderId === 'yo'} agrupado={false} ultimoDelGrupo conAutor chat={chat} flat={params.flat} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
  return onViewPerson;
}

describe('opening a card from a message', () => {
  it('in the Slack format the name opens the card of its author', () => {
    // Arrange
    const onViewPerson = draw({ message: message(), flat: true });
    // Act
    fireEvent.click(screen.getByTestId('autor-k7'));
    // Assert
    expect(onViewPerson).toHaveBeenCalledWith('ana');
  });

  it('in the Slack format the photo opens it too', () => {
    const onViewPerson = draw({ message: message(), flat: true });
    fireEvent.click(screen.getByTestId('avatar-k7'));
    expect(onViewPerson).toHaveBeenCalledWith('ana');
  });

  it('in the bubble format the name of the author opens it', () => {
    const onViewPerson = draw({ message: message(), flat: false });
    fireEvent.click(screen.getByTestId('autor-k7'));
    expect(onViewPerson).toHaveBeenCalledWith('ana');
  });

  it('my own name and photo open nothing', () => {
    draw({ message: message({ senderId: 'yo' }), flat: true });
    expect(screen.queryByTestId('avatar-k7')).toBeNull();
    expect(screen.getByTestId('autor-k7').tagName).not.toBe('BUTTON');
  });

  it('without the context hook (a thread panel, a secret chat) the name is plain text', () => {
    draw({ message: message(), flat: true, withCard: false });
    expect(screen.getByTestId('autor-k7').tagName).not.toBe('BUTTON');
    expect(screen.queryByTestId('avatar-k7')).toBeNull();
  });
});
