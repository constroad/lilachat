import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import { MenuDelMensaje } from './MenuDelMensaje';
import type { ChatSummary, MensajeEnPantalla } from './types';

const chat: ChatSummary = { id: 'c1', kind: 'group', name: 'Familia', memberIds: ['yo', 'ana'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const mensaje: MensajeEnPantalla = { chatId: 'c1', seq: 3, senderId: 'ana', clientKey: 'k3', kind: 'text', body: 'El sábado almorzamos', at: new Date().toISOString() };

function montar(extra: Partial<ContextoDeLaConversacion>, delMensaje: MensajeEnPantalla = mensaje) {
  const onAccion = vi.fn();
  const contexto: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map(), citado: () => undefined, onAccion, onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), ...extra };
  render(
    <ConversacionContext.Provider value={contexto}>
      <MenuDelMensaje mensaje={delMensaje} mio={false} />
    </ConversacionContext.Provider>
  );
  return { onAccion };
}

const abrir = async () => {
  screen.getByTestId('menu-k3').focus();
  await userEvent.keyboard('{Enter}');
};

describe('MenuDelMensaje — fijar (19/10)', () => {
  it('con permiso ofrece «Fijar» y avisa la acción', async () => {
    const { onAccion } = montar({ puedeFijar: true });
    await abrir();
    await userEvent.click(await screen.findByTestId('accion-fijar'));
    expect(onAccion).toHaveBeenCalledWith(mensaje, 'fijar');
  });

  it('si ya está fijado ofrece «Desfijar»', async () => {
    montar({ puedeFijar: true, fijados: new Set([3]) });
    await abrir();
    expect(await screen.findByTestId('accion-desfijar')).toHaveTextContent('Desfijar');
    expect(screen.queryByTestId('accion-fijar')).toBeNull();
  });

  it('sin permiso (no admin del grupo), ni una ni otra', async () => {
    montar({ puedeFijar: false });
    await abrir();
    await screen.findByTestId('accion-responder');
    expect(screen.queryByTestId('accion-fijar')).toBeNull();
  });
});

/** Pending 37 (José, 22/10): a GIF of the chat, mine or someone's, becomes my animated sticker from its menu. */
describe('MenuDelMensaje — GIF a sticker', () => {
  const gif: MensajeEnPantalla = { ...mensaje, kind: 'image', body: undefined, media: { mediaId: 'm3', url: 'https://storage.test/a.gif', mime: 'image/gif' } };

  it('a GIF offers «Convertir en sticker animado»', async () => {
    const onStickerAction = vi.fn();
    montar({ onStickerAction }, gif);
    await abrir();
    await userEvent.click(await screen.findByTestId('accion-sticker-gif'));
    expect(onStickerAction).toHaveBeenCalledWith(gif, 'gif');
  });

  it('a photo does not, and neither does a secret chat (no sticker actions there)', async () => {
    montar({ onStickerAction: vi.fn() }, { ...gif, media: { ...gif.media!, mime: 'image/jpeg' } });
    await abrir();
    await screen.findByTestId('accion-responder');
    expect(screen.queryByTestId('accion-sticker-gif')).toBeNull();
  });
});
