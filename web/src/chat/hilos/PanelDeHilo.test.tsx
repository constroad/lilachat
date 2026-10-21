import { afterEach, describe, expect, it, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ChatSummary, MensajeEnPantalla } from '../types';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import { PanelDeHilo } from './PanelDeHilo';

const chat = { id: 'c1', kind: 'direct', name: 'Wilson', memberIds: ['yo', 'w'] } as unknown as ChatSummary;
const raiz = { chatId: 'c1', seq: 1, senderId: 'w', clientKey: 'r1', kind: 'text', body: 'Hola', at: '2026-10-20T15:00:00.000Z' } as MensajeEnPantalla;
const respuesta = { ...raiz, seq: 2, clientKey: 'r2', body: 'Te respondo', hiloDe: 1, senderId: 'yo' } as MensajeEnPantalla;
const conversation: ContextoDeLaConversacion = { yo: 'yo', jwt: '', chat, detalle: null, nombres: new Map(), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };

/**
 * Backlog 4 (José, 20/10: closing a thread left the web white). In recent
 * Chrome `scrollIntoView` returns a Promise; the panel's effect returned it,
 * React kept it as the cleanup and called it on close: «n is not a function».
 */
describe('PanelDeHilo', () => {
  const original = Element.prototype.scrollIntoView;
  afterEach(() => {
    Element.prototype.scrollIntoView = original;
  });

  it('closes without crashing when scrollIntoView returns a Promise (recent Chrome)', () => {
    Element.prototype.scrollIntoView = vi.fn(() => Promise.resolve()) as unknown as typeof Element.prototype.scrollIntoView;
    const props = { chat, raiz, yo: 'yo', nombres: new Map([['w', 'Wilson']]), onEnviar: vi.fn(), onReintentar: vi.fn(), onDescartar: vi.fn(), onEditar: vi.fn(), onCerrar: vi.fn() };
    const inConversation = (respuestas: MensajeEnPantalla[]) => (
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo {...props} respuestas={respuestas} />
      </ConversacionContext.Provider>
    );
    const { rerender, unmount } = render(inConversation([]));

    // A new reply re-runs the effect (its previous cleanup is called), then closing unmounts it.
    expect(() => rerender(inConversation([respuesta]))).not.toThrow();
    expect(() => unmount()).not.toThrow();
    expect(Element.prototype.scrollIntoView).toHaveBeenCalled();
  });

  it('«Editar» on my reply edits it in the thread input, not in the chat (José, 20/10)', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const mine = { ...respuesta, at: new Date().toISOString() };
    const onEditar = vi.fn(async () => ({ ok: true }));
    const chatEdit = vi.fn();
    render(
      <ConversacionContext.Provider value={{ ...conversation, onAccion: chatEdit }}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[mine]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEditar={onEditar} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );

    await userEvent.click(screen.getByTestId('menu-r2'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const input = screen.getByTestId('input-hilo');
    expect(input).toHaveValue('Te respondo');
    await userEvent.clear(input);
    await userEvent.type(input, 'Te respondo mañana');
    await userEvent.click(screen.getByTestId('btn-enviar-hilo'));

    expect(onEditar).toHaveBeenCalledWith(2, 'Te respondo mañana');
    // Saved: the input goes back to the (empty) draft, not the edited text.
    expect(screen.getByTestId('input-hilo')).toHaveValue('');
    expect(chatEdit).not.toHaveBeenCalled();
  });
});
