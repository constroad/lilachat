import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkCard } from '@lilachat/shared';
import { bodyIsOnlyLink, StoredLinkInBubble, storedLinkOf } from './StoredLinkInBubble';
import { forgetLinkNotes } from './linkNotesStore';

const notes = { enabled: true, categories: [{ id: 'ads', name: 'Publicidad y ventas' }], items: [] };
const link = (extra: Partial<LinkCard> = {}): LinkCard => ({ url: 'https://www.facebook.com/share/v/1/', platform: 'facebook', format: 'video', status: 'ready', author: 'IA Para Tu Negocio - Erik Taveras', text: 'Cómo instalar el MCP oficial de Meta', categoryId: 'ads', categoryBy: 'lila', ...extra });
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function renderBubble(card: LinkCard) {
  const fetchMock = vi.fn(async () => json(notes));
  vi.stubGlobal('fetch', fetchMock);
  render(<StoredLinkInBubble jwt="t" chatId="n1" seq={3} at="2026-11-17T14:14:00.000Z" link={card} />);
  return fetchMock;
}

afterEach(() => {
  forgetLinkNotes();
  vi.unstubAllGlobals();
});

describe('the stored link in a notes chat bubble (nl-02)', () => {
  it('draws the card and its category with a pencil', async () => {
    renderBubble(link());
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('FACEBOOK · VIDEO');
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('IA Para Tu Negocio - Erik Taveras');
    await waitFor(() => expect(screen.getByTestId('pastilla-categoria')).toHaveTextContent('Publicidad y ventas'));
  });

  it('a link without a category says «Sin categoría»', async () => {
    renderBubble(link({ categoryId: null }));
    await waitFor(() => expect(screen.getByTestId('pastilla-categoria')).toBeEnabled());
    expect(screen.getByTestId('pastilla-categoria')).toHaveTextContent('Sin categoría');
  });

  it('the pencil opens «Mover a»', async () => {
    renderBubble(link());
    await waitFor(() => expect(screen.getByTestId('pastilla-categoria')).toBeEnabled());
    fireEvent.click(screen.getByTestId('pastilla-categoria'));
    expect(screen.getByTestId('mover-a-ads')).toHaveAttribute('aria-checked', 'true');
  });

  it('a post that only asks to comment says so', () => {
    renderBubble(link({ commentBait: 'NICHO', text: 'Comenta NICHO' }));
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('Solo pide comentar');
    // Design nl-02: the badge sits under the author, before the description.
    const badge = screen.getByTestId('solo-pide-comentar');
    expect(badge.compareDocumentPosition(screen.getByText(/comentar NICHO/)) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('El post no trae contenido: solo pide comentar NICHO');
  });

  it('an unreadable link offers «Reintentar»', async () => {
    // Arrange
    const fetchMock = renderBubble(link({ status: 'unreadable', author: undefined, text: undefined }));
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('No se pudo leer');
    expect(screen.getByTestId('enlace-guardado-3')).toHaveTextContent('La red no lo muestra sin iniciar sesión');
    fetchMock.mockResolvedValueOnce(json({ ok: true }, 202));
    // Act
    fireEvent.click(screen.getByTestId('btn-reintentar-enlace'));
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/messages/3/link-refresh', expect.objectContaining({ method: 'POST' })));
  });

  it('only a notes chat with links sorted uses the stored card', () => {
    const message = { link: link() };
    expect(storedLinkOf(message, { kind: 'notas', linksSorted: true })).toEqual(link());
    expect(storedLinkOf(message, { kind: 'notas' })).toBeNull();
    expect(storedLinkOf({ ...message, deletedAt: 'x' }, { kind: 'notas', linksSorted: true })).toBeNull();
  });

  it('hides a body that is only the link', () => {
    expect(bodyIsOnlyLink(' https://www.instagram.com/reel/abc/ ')).toBe(true);
    expect(bodyIsOnlyLink('mira esto https://www.instagram.com/reel/abc/')).toBe(false);
  });
});
