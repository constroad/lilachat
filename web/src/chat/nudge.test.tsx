import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat = { id: 'c1', kind: 'direct', name: 'Wilson', memberIds: ['yo', 'w'] } as unknown as ChatSummary;
const nudge = (senderId: string) => ({ chatId: 'c1', seq: 9, senderId, clientKey: `z-${senderId}`, kind: 'zumbido', at: new Date().toISOString() }) as MensajeEnPantalla;

function draw(message: MensajeEnPantalla, mine: boolean, extra: Partial<ContextoDeLaConversacion> = {}) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: '', chat, detalle: null, nombres: new Map([['w', 'Wilson']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), ...extra };
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

/** «Te ataco» (José, 02/11): an attack someone sent me can be sent straight back. */
describe('«Devolver» on a wink', () => {
  const wink = (senderId: string, id: string) => ({ ...nudge(senderId), clientKey: `g-${senderId}-${id}`, kind: 'guino', wink: id }) as MensajeEnPantalla;

  it('sends the same attack back, once', () => {
    // Arrange
    const onReturnWink = vi.fn();
    draw(wink('w', 'hit-slipper'), false, { onReturnWink });
    // Act
    fireEvent.click(screen.getByTestId('devolver-guino-9'));
    fireEvent.click(screen.getByTestId('devolver-guino-9'));
    // Assert
    expect(onReturnWink).toHaveBeenCalledTimes(1);
    expect(onReturnWink).toHaveBeenCalledWith('hit-slipper');
    expect(screen.getByTestId('devolver-guino-9').textContent).toContain('Devuelto');
  });

  it('not on my own attack, not on a wink that is not an attack, not where winks are off', () => {
    draw(wink('yo', 'hit-slipper'), true, { onReturnWink: vi.fn() });
    draw(wink('w', 'piggy'), false, { onReturnWink: vi.fn() });
    draw(wink('w', 'hit-pie'), false);
    expect(screen.queryByTestId('devolver-guino-9')).toBeNull();
  });
});

/** José, 02/11: a nudge or a wink line has the message menu, to delete it like in the app. */
describe('the menu of a nudge or a wink line', () => {
  const wink = (senderId: string) => ({ ...nudge(senderId), clientKey: `g-${senderId}`, kind: 'guino', wink: 'hit-slipper' }) as MensajeEnPantalla;
  const open = (clientKey: string) => {
    const trigger = screen.getByTestId(`menu-${clientKey}`);
    fireEvent.keyDown(trigger, { key: 'Enter' });
  };

  it('deletes my wink, and offers its info but nothing to reply to or copy', async () => {
    // Arrange
    const onAccion = vi.fn();
    const message = wink('yo');
    draw(message, true, { onAccion });
    // Act
    open('g-yo');
    fireEvent.click(await screen.findByTestId('accion-eliminar'));
    // Assert
    expect(onAccion).toHaveBeenCalledWith(message, 'eliminar');
  });

  it('someone else’s nudge: only «Eliminar»', async () => {
    draw(nudge('w'), false);
    open('z-w');
    await screen.findByTestId('accion-eliminar');
    expect(screen.queryByTestId('accion-responder')).toBeNull();
    expect(screen.queryByTestId('accion-info')).toBeNull();
    expect(screen.queryByTestId('accion-destacar')).toBeNull();
  });

  it('a wink still sending has no menu yet', () => {
    draw({ ...wink('yo'), estado: 'enviando' } as MensajeEnPantalla, true);
    expect(screen.queryByTestId('menu-g-yo')).toBeNull();
  });
});
