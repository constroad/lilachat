import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { BurbujaDeMensaje } from '../BurbujaDeMensaje';
import { MenuDelMensaje } from '../MenuDelMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from '../types';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Obra', memberIds: ['me', 'ana'], lastSeq: 5, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const sticker = (extra: Partial<MensajeEnPantalla> = {}): MensajeEnPantalla => ({
  chatId: 'c1', seq: 5, senderId: 'ana', clientKey: 'k5', kind: 'sticker', at: new Date().toISOString(),
  media: { url: 'https://storage.test/s.webp', mime: 'image/webp', width: 512, height: 512 } as MensajeEnPantalla['media'],
  ...extra,
});

function mount(message: MensajeEnPantalla, options: { menu?: boolean; secret?: boolean } = {}) {
  const onStickerAction = vi.fn();
  const context: ContextoDeLaConversacion = { yo: 'me', jwt: 'j', chat, detalle: null, nombres: new Map([['ana', 'Ana']]), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), onStickerAction: options.secret ? undefined : onStickerAction };
  render(
    <ConversacionContext.Provider value={context}>
      {options.menu ? <MenuDelMensaje mensaje={message} mio={false} /> : <BurbujaDeMensaje mensaje={message} mio={false} agrupado={false} ultimoDelGrupo conAutor chat={chat} onReintentar={vi.fn()} onDescartar={vi.fn()} />}
    </ConversacionContext.Provider>
  );
  return { onStickerAction };
}

const openMenu = async () => {
  screen.getByTestId('menu-k5').focus();
  await userEvent.keyboard('{Enter}');
};

/** A sticker on the web has no bubble and is big, like the app and WhatsApp Web (José, 20/10). */
describe('a sticker in the web conversation', () => {
  it('shows the image, without bubble or «Archivo»', () => {
    mount(sticker());
    expect(screen.getByTestId('sticker-k5')).toHaveAttribute('src', 'https://storage.test/s.webp');
    expect(screen.queryByText('Archivo')).toBeNull();
  });

  it('in a group it carries the sender name', () => {
    mount(sticker());
    expect(screen.getByText('Ana')).toBeInTheDocument();
  });

  it('deleted: the usual tombstone, not the image', () => {
    mount(sticker({ deletedAt: new Date().toISOString(), media: undefined }));
    expect(screen.queryByTestId('sticker-k5')).toBeNull();
  });

  it('the menu offers to keep it and to make it a favorite', async () => {
    const { onStickerAction } = mount(sticker(), { menu: true });
    await openMenu();
    await userEvent.click(await screen.findByTestId('accion-sticker-favorite'));
    expect(onStickerAction).toHaveBeenCalledWith(expect.objectContaining({ seq: 5 }), 'favorite');
  });

  it('a text message, or a secret chat, offers nothing about stickers', async () => {
    mount(sticker({ kind: 'text', body: 'hola', media: undefined }), { menu: true });
    await openMenu();
    await screen.findByTestId('accion-responder');
    expect(screen.queryByTestId('accion-sticker-keep')).toBeNull();
  });
});
