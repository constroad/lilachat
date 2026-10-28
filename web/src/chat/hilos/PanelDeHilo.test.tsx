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
    const props = { chat, raiz, yo: 'yo', nombres: new Map([['w', 'Wilson']]), onEnviar: vi.fn(), onReintentar: vi.fn(), onDescartar: vi.fn(), onEdit: vi.fn(), onCerrar: vi.fn() };
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

  it('opening a thread puts the cursor in its reply field (pending 110: typing went to the main chat)', () => {
    Element.prototype.scrollIntoView = vi.fn();
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[respuesta]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    expect(screen.getByTestId('input-hilo')).toHaveFocus();
  });

  it('«Responder» on a reply answers in this thread, never quotes it in the main chat (pending 110)', async () => {
    // Arrange
    Element.prototype.scrollIntoView = vi.fn();
    const chatAction = vi.fn();
    render(
      <ConversacionContext.Provider value={{ ...conversation, onAccion: chatAction }}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[{ ...respuesta, senderId: 'w' }]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    // Act
    await userEvent.click(screen.getByTestId('menu-r2'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Responder' }));
    // Assert
    expect(chatAction).not.toHaveBeenCalled();
    expect(screen.getByTestId('input-hilo')).toHaveFocus();
  });

  it('«Editar» on my reply edits it in the thread input, not in the chat (José, 20/10)', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const mine = { ...respuesta, at: new Date().toISOString() };
    const editMessage = vi.fn(async () => ({ ok: true }));
    const chatEdit = vi.fn();
    render(
      <ConversacionContext.Provider value={{ ...conversation, onAccion: chatEdit }}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[mine]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={editMessage} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );

    await userEvent.click(screen.getByTestId('menu-r2'));
    await userEvent.click(await screen.findByRole('menuitem', { name: 'Editar' }));
    const input = screen.getByTestId('input-hilo');
    expect(input).toHaveValue('Te respondo');
    await userEvent.clear(input);
    await userEvent.type(input, 'Te respondo mañana');
    await userEvent.click(screen.getByTestId('btn-enviar-hilo'));

    expect(editMessage).toHaveBeenCalledWith(2, 'Te respondo mañana');
    // Saved: the input goes back to the (empty) draft, not the edited text.
    expect(screen.getByTestId('input-hilo')).toHaveValue('');
    expect(chatEdit).not.toHaveBeenCalled();
  });

  /** José 25/10: «en un canal (incluido sus hilos) no puedo taggear». */
  describe('mentions in the reply field', () => {
    // The draft of a thread outlives its panel (module state): each test uses its own channel.
    let channelCount = 0;
    const people = [{ id: 'ana', nombre: 'Ana' }, { id: 'carla', nombre: 'Carla', outsideChat: true }];
    const mountThread = (extra: Partial<Parameters<typeof PanelDeHilo>[0]> = {}) => {
      Element.prototype.scrollIntoView = vi.fn();
      channelCount += 1;
      const channel = { ...chat, id: `channel-${channelCount}`, kind: 'group' } as ChatSummary;
      const sent = vi.fn();
      const onOutsideMentions = vi.fn();
      render(
        <ConversacionContext.Provider value={conversation}>
          <PanelDeHilo chat={channel} raiz={raiz} respuestas={[]} yo="yo" nombres={new Map()} onEnviar={sent} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} mencionables={people} onOutsideMentions={onOutsideMentions} {...extra} />
        </ConversacionContext.Provider>
      );
      return { sent, onOutsideMentions };
    };

    it('«@» lists the group mentions, the people of the channel and the rest of the space', async () => {
      mountThread();
      await userEvent.type(screen.getByTestId('input-hilo'), '@');
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(expect.arrayContaining([expect.stringContaining('todos'), expect.stringContaining('Ana'), expect.stringContaining('Carla')]));
      expect(screen.getByText('No está en este canal')).toBeInTheDocument();
    });

    it('choosing someone of the channel sends the reply with their mention', async () => {
      const { sent, onOutsideMentions } = mountThread();
      await userEvent.type(screen.getByTestId('input-hilo'), 'Hola @An');
      await userEvent.click(screen.getByTestId('mencionar-ana'));
      await userEvent.click(screen.getByTestId('btn-enviar-hilo'));
      expect(sent).toHaveBeenCalledWith('Hola @Ana', false, [{ userId: 'ana', desde: 5, largo: 4 }]);
      expect(onOutsideMentions).not.toHaveBeenCalled();
    });

    it('choosing someone from outside sends no mention and offers to add them', async () => {
      const { sent, onOutsideMentions } = mountThread();
      await userEvent.type(screen.getByTestId('input-hilo'), 'Hola @Ca');
      await userEvent.click(screen.getByTestId('mencionar-carla'));
      await userEvent.click(screen.getByTestId('btn-enviar-hilo'));
      expect(sent).toHaveBeenCalledWith('Hola @Carla', false, undefined);
      expect(onOutsideMentions).toHaveBeenCalledWith([{ userId: 'carla', nombre: 'Carla', outsideChat: true }]);
    });

    it('a thread without people to mention (a 1:1) shows no list', async () => {
      mountThread({ mencionables: undefined });
      await userEvent.type(screen.getByTestId('input-hilo'), '@');
      expect(screen.queryByRole('listbox')).toBeNull();
    });
  });
});
