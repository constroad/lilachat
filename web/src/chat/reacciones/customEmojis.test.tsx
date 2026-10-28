import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ConversacionContext, type ContextoDeLaConversacion } from '../contextoDeLaConversacion';
import type { ChatSummary, MensajeEnPantalla } from '../types';
import { PastillaDeReacciones } from './PastillaDeReacciones';
import { SpaceEmojiSection } from './SpaceEmojiSection';

/** Pending 19: a space's own emojis as reactions on the web. */
const channel: ChatSummary = { id: 'c9', kind: 'group', name: 'general', workspaceId: 'w1', memberIds: ['yo', 'ana'], lastSeq: 3, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0 };
const emojis = [{ id: 'e1', name: 'casco', url: 'https://x/casco.png', animated: false, createdBy: 'ana', createdAt: '2026-10-28T00:00:00Z' }];
const message: MensajeEnPantalla = { chatId: 'c9', seq: 3, senderId: 'ana', clientKey: 'k3', kind: 'text', body: 'Listo', at: new Date().toISOString(), reacciones: [{ userId: 'yo', emoji: ':casco:' }, { userId: 'ana', emoji: ':grua:' }] };

function renderWith(node: React.ReactNode, chat: ChatSummary = channel) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map(), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set() };
  return render(<ConversacionContext.Provider value={context}>{node}</ConversacionContext.Provider>);
}

afterEach(() => vi.unstubAllGlobals());

describe('custom emojis on the web', () => {
  it('the pill draws a known :name: as the space image and one the space took out as its name', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ emojis }), { status: 200 })));
    renderWith(<PastillaDeReacciones mensaje={message} mio={false} />);

    expect(await screen.findByAltText(':casco:')).toHaveAttribute('src', 'https://x/casco.png');
    expect(screen.getByText(':grua:')).toBeInTheDocument();
  });

  it('the picker section lists the space emojis and picks one as its token', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ emojis }), { status: 200 })));
    const onPick = vi.fn();
    renderWith(<SpaceEmojiSection onPick={onPick} onAdd={vi.fn()} />);

    fireEvent.click(await screen.findByTestId('emoji-propio-casco'));
    await waitFor(() => expect(onPick).toHaveBeenCalledWith(':casco:'));
  });

  it('outside a space there is no section', () => {
    vi.stubGlobal('fetch', vi.fn());
    const { container } = renderWith(<SpaceEmojiSection onPick={vi.fn()} onAdd={vi.fn()} />, { ...channel, workspaceId: undefined });
    expect(container).toBeEmptyDOMElement();
  });
});
