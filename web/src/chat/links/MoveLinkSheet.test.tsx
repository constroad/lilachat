import { fireEvent, render, renderHook, screen, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkCard, LinkNoteItem } from '@lilachat/shared';
import { MoveLinkSheet } from './MoveLinkSheet';
import { forgetLinkNotes, useLinkNotes } from './linkNotesStore';

const capi: LinkCard = { url: 'https://www.instagram.com/reel/kokoro/', platform: 'instagram', format: 'reel', status: 'ready', author: 'Capi', text: 'Kokoro: voz de estudio en local', categoryId: 'voice', categoryBy: 'lila' };
const item: LinkNoteItem = { seq: 7, at: '2026-11-09T15:00:00.000Z', link: capi };
const notes = {
  enabled: true,
  categories: [{ id: 'ads', name: 'Publicidad y ventas' }, { id: 'voice', name: 'Video, voz e imagen' }],
  items: [item, { seq: 8, at: '2026-11-10T15:00:00.000Z', link: { ...capi, categoryId: 'ads' } }],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

afterEach(() => {
  forgetLinkNotes();
  vi.unstubAllGlobals();
});

describe('«Mover a · ¿En qué categoría va?» (nl-03)', () => {
  it('marks the current one, says Lila chose it and counts each category', () => {
    render(<MoveLinkSheet jwt="t" chatId="n1" item={item} notes={notes} onClose={vi.fn()} />);
    expect(screen.getByTestId('mover-a-voice')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByTestId('mover-a-voice')).toHaveTextContent('Categoría actual');
    expect(screen.getByTestId('mover-a-ads')).toHaveTextContent('1');
    expect(screen.getByTestId('quien-eligio')).toHaveTextContent('La eligió Lila al guardarlo. Tú decides.');
    expect(screen.getByTestId('btn-mover-enlace')).toBeDisabled();
  });

  it('moves it, and the view in memory takes the new card', async () => {
    // Arrange
    const moved = { ...capi, categoryId: 'ads', categoryBy: 'user' as const };
    const fetchMock = vi.fn(async (url: string) => (url.endsWith('/links') ? json(notes) : json({ ok: true, link: moved })));
    vi.stubGlobal('fetch', fetchMock);
    const store = renderHook(() => useLinkNotes('t', 'n1', true));
    await waitFor(() => expect(store.result.current.state.status).toBe('ready'));
    const onClose = vi.fn();
    render(<MoveLinkSheet jwt="t" chatId="n1" item={item} notes={notes} onClose={onClose} />);
    // Act
    fireEvent.click(screen.getByTestId('mover-a-ads'));
    fireEvent.click(screen.getByTestId('btn-mover-enlace'));
    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/messages/7/link-category', expect.objectContaining({ method: 'PUT', body: JSON.stringify({ categoryId: 'ads' }) }));
    expect(store.result.current.state.notes?.items[0]?.link).toEqual(moved);
  });

  it('«Sin categoría» sends null', async () => {
    const fetchMock = vi.fn(async () => json({ ok: true, link: { ...capi, categoryId: null, categoryBy: 'user' } }));
    vi.stubGlobal('fetch', fetchMock);
    render(<MoveLinkSheet jwt="t" chatId="n1" item={item} notes={notes} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('mover-a-none'));
    fireEvent.click(screen.getByTestId('btn-mover-enlace'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/messages/7/link-category', expect.objectContaining({ body: JSON.stringify({ categoryId: null }) })));
  });

  it('a new category is created and chosen', async () => {
    // Arrange
    vi.stubGlobal('fetch', vi.fn(async () => json({ ok: true, category: { id: 'claude', name: 'Claude y skills' } })));
    render(<MoveLinkSheet jwt="t" chatId="n1" item={item} notes={notes} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('btn-nueva-categoria'));
    fireEvent.change(screen.getByTestId('campo-nueva-categoria'), { target: { value: 'Claude y skills' } });
    fireEvent.click(screen.getByTestId('btn-crear-categoria'));
    // Assert
    await waitFor(() => expect(screen.getByTestId('mover-a-claude')).toHaveAttribute('aria-checked', 'true'));
    expect(screen.getByTestId('btn-mover-enlace')).toBeEnabled();
  });

  it('a refusal says why and keeps the sheet open', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => json({ message: 'Ya hay una categoría con ese nombre.' }, 409)));
    render(<MoveLinkSheet jwt="t" chatId="n1" item={item} notes={notes} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('btn-nueva-categoria'));
    fireEvent.change(screen.getByTestId('campo-nueva-categoria'), { target: { value: 'Publicidad y ventas' } });
    fireEvent.click(screen.getByTestId('btn-crear-categoria'));
    expect(await screen.findByTestId('error-formulario')).toHaveTextContent('Ya hay una categoría con ese nombre.');
  });

  it('a link someone moved says so', () => {
    render(<MoveLinkSheet jwt="t" chatId="n1" item={{ ...item, link: { ...capi, categoryBy: 'user' } }} notes={notes} onClose={vi.fn()} />);
    expect(screen.getByTestId('quien-eligio')).toHaveTextContent('La elegiste tú.');
  });
});
