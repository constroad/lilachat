import { afterEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, within } from '@testing-library/react';
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

  it('a reminder at the root shows as its card, not as plain text (Wilson, 30/10)', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const reminderRoot = { ...raiz, body: 'Recordatorio: Pagar baño portátil', ref: { tipo: 'recordatorio', id: 'r-1' } } as MensajeEnPantalla;
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={reminderRoot} respuestas={[]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    expect(screen.getByTestId('tarjeta-recordatorio-1')).toBeInTheDocument();
    expect(screen.queryByText('Recordatorio: Pagar baño portátil')).toBeNull();
  });

  // José 13/11: the voucher's thread read «Archivo» at its root while the chat showed the photo.
  it('a photo at the root shows as the photo (with its caption), not as the word «Archivo»', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const photoRoot = { ...raiz, kind: 'image', body: undefined, media: { url: 'https://lila.example.com/m/voucher.jpg', thumbUrl: 'https://lila.example.com/m/voucher-t.jpg', mime: 'image/jpeg', width: 420, height: 560 } } as unknown as MensajeEnPantalla;
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={photoRoot} respuestas={[]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    expect(within(screen.getByTestId('raiz-del-hilo')).getByTestId('foto-r1')).toBeInTheDocument();
    expect(within(screen.getByTestId('raiz-del-hilo')).queryByText('Archivo')).toBeNull();
  });

  it('a photo with a caption at the root shows both', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const captioned = { ...raiz, kind: 'image', body: 'Factura de la ferretería', media: { url: 'https://lila.example.com/m/f.jpg', thumbUrl: 'https://lila.example.com/m/f-t.jpg', mime: 'image/jpeg' } } as unknown as MensajeEnPantalla;
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={captioned} respuestas={[]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    const root = within(screen.getByTestId('raiz-del-hilo'));
    expect(root.getByTestId('foto-r1')).toBeInTheDocument();
    expect(root.getByText('Factura de la ferretería')).toBeInTheDocument();
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

  it('a pasted screenshot or an attached photo goes to the thread, with «También enviar al chat» (José 10/11)', async () => {
    Element.prototype.scrollIntoView = vi.fn();
    const onFiles = vi.fn();
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[respuesta]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} onFiles={onFiles} />
      </ConversacionContext.Provider>
    );
    const shot = new File(['x'], 'captura.png', { type: 'image/png' });
    await userEvent.click(screen.getByTestId('casilla-tambien-al-chat'));
    await userEvent.upload(screen.getByTestId('archivo-hilo'), shot);
    expect(onFiles).toHaveBeenLastCalledWith([shot], true);
    screen.getByTestId('input-hilo').focus();
    await userEvent.paste({ files: [shot] } as unknown as DataTransfer);
    expect(onFiles).toHaveBeenCalledTimes(2);
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

  /** José 17/11: «en un hilo no puedo escribir :hug para filtrar emojis de abrazo como se hace en el main». */
  describe('«:hug» in the reply field, as in the chat composer', () => {
    const mountThread = (id: string) => {
      Element.prototype.scrollIntoView = vi.fn();
      const sent = vi.fn();
      render(
        <ConversacionContext.Provider value={conversation}>
          <PanelDeHilo chat={{ ...chat, id } as ChatSummary} raiz={raiz} respuestas={[]} yo="yo" nombres={new Map()} onEnviar={sent} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
        </ConversacionContext.Provider>
      );
      return { sent, field: () => screen.getByTestId('input-hilo') as HTMLTextAreaElement };
    };

    it('typing «:hug» offers the hug emoji; Enter puts it in place of the word, without sending', async () => {
      // Arrange
      const user = userEvent.setup();
      const { sent, field } = mountThread('emoji-enter');
      // Act
      await user.type(field(), 'hola :hug');
      // Assert
      expect(await screen.findByTestId('emoji-sugerido-🤗')).toBeInTheDocument();
      await user.keyboard('{Enter}');
      expect(field().value).toBe('hola 🤗 ');
      expect(sent).not.toHaveBeenCalled();
      expect(screen.queryByTestId('sugerencias-emoji')).toBeNull();
    });

    it('a click on a suggestion puts it and the reply sends with it; «10:30» offers nothing', async () => {
      // Arrange
      const user = userEvent.setup();
      const { sent, field } = mountThread('emoji-click');
      // Act
      await user.type(field(), 'te mando un :abrazo');
      fireEvent.mouseDown(await screen.findByTestId('emoji-sugerido-🤗'));
      await user.type(field(), 'a las 10:30');
      // Assert
      expect(field().value).toBe('te mando un 🤗 a las 10:30');
      expect(screen.queryByTestId('sugerencias-emoji')).toBeNull();
      await user.click(screen.getByTestId('btn-enviar-hilo'));
      expect(sent).toHaveBeenCalledWith('te mando un 🤗 a las 10:30', false, undefined);
    });

    it('Escape closes the suggestions and leaves the word as typed', async () => {
      const user = userEvent.setup();
      const { field } = mountThread('emoji-escape');
      await user.type(field(), ':hug');
      await screen.findByTestId('sugerencias-emoji');
      await user.keyboard('{Escape}');
      expect(screen.queryByTestId('sugerencias-emoji')).toBeNull();
      expect(field().value).toBe(':hug');
    });
  });
  // José 28/11 (APK): a bot's album and progress card in a thread read as «4 fotos y 1 video» / «Avance del pedido».
  it('a bot album and a progress card among the replies show as the album and the card, not their summary', () => {
    Element.prototype.scrollIntoView = vi.fn();
    const photo = (index: number) => ({ url: `https://media.test/${index}.jpg`, thumbUrl: `https://media.test/${index}-t.jpg`, mime: 'image/jpeg' });
    const albumReply = { ...raiz, seq: 2, clientKey: 'b2', hiloDe: 1, body: '4 fotos y 1 video', files: [photo(1), photo(2), photo(3), photo(4), { url: 'https://media.test/5.mp4', mime: 'video/mp4' }] } as unknown as MensajeEnPantalla;
    const progressReply = { ...raiz, seq: 3, clientKey: 'b3', hiloDe: 1, body: 'Avance del pedido', card: { kicker: 'DESPACHO', title: 'Avance del pedido', fields: [], blocks: [{ type: 'progress', value: 15, max: 60, label: 'm³ despachados', tone: 'ok' }] } } as unknown as MensajeEnPantalla;
    render(
      <ConversacionContext.Provider value={conversation}>
        <PanelDeHilo chat={chat} raiz={raiz} respuestas={[albumReply, progressReply]} yo="yo" nombres={new Map()} onEnviar={vi.fn()} onReintentar={vi.fn()} onDescartar={vi.fn()} onEdit={vi.fn()} onCerrar={vi.fn()} />
      </ConversacionContext.Provider>
    );
    expect(screen.getByTestId('album-app-2')).toBeInTheDocument();
    expect(screen.getByTestId('tarjeta-cabecera')).toBeInTheDocument();
    expect(screen.queryByText('4 fotos y 1 video')).toBeNull();
  });
});
