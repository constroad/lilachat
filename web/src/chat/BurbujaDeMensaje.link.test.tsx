import { render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkCard } from '@lilachat/shared';
import { BurbujaDeMensaje } from './BurbujaDeMensaje';
import { ConversacionContext, type ContextoDeLaConversacion } from './contextoDeLaConversacion';
import { forgetLinkNotes } from './links/linkNotesStore';
import type { ChatSummary, MensajeEnPantalla } from './types';

/** José 18/11: a link in a notes chat with its links sorted shows the stored card and its category (nl-02). */
const URL_REEL = 'https://www.instagram.com/reel/kokoro/';
const card: LinkCard = { url: URL_REEL, platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi', text: 'Kokoro: voz de estudio en local', categoryId: 'voice', categoryBy: 'lila' };
const notesChat = (linksSorted: boolean): ChatSummary => ({ id: 'n1', kind: 'notas', name: 'IA links', memberIds: ['yo'], lastSeq: 9, unread: 0, lastMessage: null, othersReadSeq: 0, othersDeliveredSeq: 0, ...(linksSorted ? { linksSorted: true as const } : {}) });

function draw(chat: ChatSummary) {
  const context: ContextoDeLaConversacion = { yo: 'yo', jwt: 'j', chat, detalle: null, nombres: new Map(), citado: () => undefined, onAccion: vi.fn(), onVerFoto: vi.fn(), puedeFijar: false, fijados: new Set(), flat: false };
  const message: MensajeEnPantalla = { chatId: 'n1', seq: 5, senderId: 'yo', clientKey: 'k5', kind: 'text', body: URL_REEL, at: '2026-11-09T15:00:00.000Z', link: card };
  render(
    <ConversacionContext.Provider value={context}>
      <BurbujaDeMensaje mensaje={message} mio agrupado={false} ultimoDelGrupo conAutor={false} chat={chat} flat={false} onReintentar={vi.fn()} onDescartar={vi.fn()} />
    </ConversacionContext.Provider>
  );
}

afterEach(() => {
  forgetLinkNotes();
  vi.unstubAllGlobals();
});

describe('a link in a notes chat bubble', () => {
  it('with links sorted: the stored card and its category, not the generic preview', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ enabled: true, categories: [{ id: 'voice', name: 'Video, voz e imagen' }], items: [] }), { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    // Act
    draw(notesChat(true));
    // Assert
    expect(screen.getByTestId('enlace-guardado-5')).toHaveTextContent('Capi');
    // E2E 18/11: a long author pushed the bubble off screen; the card and its bubble never grow past their column.
    expect(screen.getByTestId('enlace-guardado-5')).toHaveClass('max-w-full');
    expect(screen.getByTestId('enlace-guardado-5').closest('.rounded-xl.px-3')).toHaveClass('max-w-full');
    await waitFor(() => expect(screen.getByTestId('pastilla-categoria')).toHaveTextContent('Video, voz e imagen'));
    expect(fetchMock).not.toHaveBeenCalledWith(expect.stringContaining('vista-previa'), expect.anything());
    expect(screen.queryByText(URL_REEL)).toBeNull();
  });

  it('with the switch off: the chat as before, no stored card', () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('{}', { status: 404 })));
    draw(notesChat(false));
    expect(screen.queryByTestId('enlace-guardado-5')).toBeNull();
  });
});
