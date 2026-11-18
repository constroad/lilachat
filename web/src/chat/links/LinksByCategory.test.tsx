import { fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { LinkCard, LinkNoteItem } from '@lilachat/shared';
import { LinksByCategory } from './LinksByCategory';
import { forgetLinkNotes } from './linkNotesStore';

const card = (extra: Partial<LinkCard>): LinkCard => ({ url: 'https://www.instagram.com/reel/x/', platform: 'instagram', format: 'reel', status: 'ready', categoryBy: 'lila', ...extra });
const item = (seq: number, day: number, extra: Partial<LinkCard>): LinkNoteItem => ({ seq, at: `2026-11-${String(day).padStart(2, '0')}T15:00:00.000Z`, link: card(extra) });

const NOTES = {
  enabled: true,
  categories: [
    { id: 'ads', name: 'Publicidad y ventas' },
    { id: 'voice', name: 'Video, voz e imagen' },
  ],
  items: [
    item(1, 17, { author: 'Erik Taveras', text: 'Cómo instalar el MCP oficial de Meta', categoryId: 'ads', platform: 'facebook', format: 'video', url: 'https://www.facebook.com/share/v/1/' }),
    item(2, 14, { author: 'Alberto León', text: 'La IA hace que todos los anuncios se vean iguales', categoryId: 'ads' }),
    item(3, 2, { author: 'Ignacio Miranda', text: 'Meta sacó un MCP para WhatsApp', categoryId: 'ads' }),
    item(4, 1, { author: '@jsebas.yt', text: 'Comenta NICHO', commentBait: 'NICHO', categoryId: 'ads' }),
    item(5, 9, { author: 'Capi', text: 'Kokoro: voz de estudio en local', categoryId: 'voice' }),
    item(6, 8, { status: 'unreadable' }),
  ],
};
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function wideScreen(wide: boolean) {
  vi.stubGlobal('matchMedia', (query: string) => ({ matches: wide, media: query, addEventListener: vi.fn(), removeEventListener: vi.fn() }));
}

async function openView(body: unknown = NOTES) {
  const fetchMock = vi.fn(async () => json(body));
  vi.stubGlobal('fetch', fetchMock);
  const onCompose = vi.fn();
  render(<LinksByCategory jwt="t" chatId="n1" onCompose={onCompose} />);
  return { fetchMock, onCompose };
}

afterEach(() => {
  forgetLinkNotes();
  vi.unstubAllGlobals();
});

describe('«Por categoría» on a phone (nl-01 mobile)', () => {
  it('shows a skeleton, then chips with counts and sections with the newest three', async () => {
    // Arrange / Act
    await openView();
    // Assert
    expect(screen.getByTestId('enlaces-cargando')).toBeInTheDocument();
    await screen.findByTestId('vista-por-categoria');
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Todas6');
    expect(screen.getByTestId('chip-ads')).toHaveTextContent('Publicidad y ventas4');
    expect(screen.getByTestId('chip-none')).toHaveTextContent('Sin categoría1');
    expect(screen.getByTestId('chip-commentBait')).toHaveTextContent('Solo piden comentar1');
    expect(screen.getByTestId('seccion-ads')).toHaveTextContent('Publicidad y ventas · 4');
    expect(screen.getByTestId('enlace-1')).toHaveTextContent('FACEBOOK · VIDEO');
    expect(screen.getByTestId('enlace-1')).toHaveTextContent('17/11');
    expect(screen.queryByTestId('enlace-4')).toBeNull();
  });

  it('«Ver las 4» picks that category and shows all of them', async () => {
    await openView();
    fireEvent.click(await screen.findByTestId('ver-todas-ads'));
    expect(screen.getByTestId('chip-ads')).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByTestId('enlace-4')).toHaveTextContent('El post no trae contenido: solo pide comentar NICHO');
    expect(screen.queryByTestId('seccion-voice')).toBeNull();
  });

  it('the search folds accents and keeps the chip counts', async () => {
    // Arrange
    await openView();
    await screen.findByTestId('vista-por-categoria');
    // Act
    fireEvent.change(screen.getByTestId('buscar-enlaces'), { target: { value: 'como instalar' } });
    // Assert
    expect(screen.getByTestId('enlace-1')).toBeInTheDocument();
    expect(screen.queryByTestId('enlace-2')).toBeNull();
    expect(screen.queryByTestId('seccion-voice')).toBeNull();
    expect(screen.getByTestId('chip-all')).toHaveTextContent('Todas6');
  });

  it('a search with nothing says so', async () => {
    await openView();
    await screen.findByTestId('vista-por-categoria');
    fireEvent.change(screen.getByTestId('buscar-enlaces'), { target: { value: 'zzz' } });
    expect(screen.getByTestId('enlaces-sin-resultados')).toHaveTextContent('Ningún enlace coincide con «zzz».');
  });

  it('the «+» goes back to the chat to write', async () => {
    const { onCompose } = await openView();
    fireEvent.click(await screen.findByTestId('btn-nota-nueva'));
    expect(onCompose).toHaveBeenCalledTimes(1);
  });

  it('a chat with no links says how to save one', async () => {
    await openView({ enabled: true, categories: [], items: [] });
    expect(await screen.findByTestId('enlaces-vacio')).toHaveTextContent('Todavía no hay enlaces guardados');
    expect(screen.getByTestId('enlaces-vacio')).toHaveTextContent('Comparte un reel o pega un enlace en el chat.');
  });

  it('a failed read offers to try again', async () => {
    // Arrange
    const fetchMock = vi.fn(async () => json({ message: 'Sin conexión. Revisa tu internet.' }, 503));
    vi.stubGlobal('fetch', fetchMock);
    render(<LinksByCategory jwt="t" chatId="n1" onCompose={vi.fn()} />);
    expect(await screen.findByTestId('enlaces-error')).toHaveTextContent('Sin conexión. Revisa tu internet.');
    fetchMock.mockResolvedValueOnce(json(NOTES));
    // Act
    fireEvent.click(screen.getByTestId('btn-reintentar-enlaces'));
    // Assert
    expect(await screen.findByTestId('vista-por-categoria')).toBeInTheDocument();
  });
});

describe('«Por categoría» on a computer (nl-01 desktop)', () => {
  it('has the categories column, the review and the grid of the chosen one', async () => {
    // Arrange
    wideScreen(true);
    await openView();
    await screen.findByTestId('vista-por-categoria');
    // Act
    fireEvent.click(screen.getByTestId('categoria-ads'));
    // Assert
    expect(screen.getByTestId('categoria-ads')).toHaveAttribute('aria-current', 'true');
    expect(screen.getByTestId('titulo-filtro')).toHaveTextContent('Publicidad y ventas');
    expect(screen.getByTestId('titulo-filtro-kicker')).toHaveTextContent('CATEGORÍA · 4 ENLACES');
    expect(screen.getByTestId('revision-commentBait')).toHaveTextContent('1');
    expect(screen.getByTestId('revision-unreadable')).toHaveTextContent('1');
    expect(screen.getByTestId('btn-renombrar-categoria')).toBeInTheDocument();
    // Review 18/11: a long author is cut inside its grid card, never past its border.
    const card = screen.getByTestId('enlace-1');
    expect(card).toHaveClass('min-w-0');
    expect([...card.querySelectorAll('button')].at(-1)).toHaveClass('min-w-0', 'w-full');
    expect(card.querySelector('span.mt-2.truncate')).toHaveClass('max-w-full');
  });

  it('«Más viejos» turns the order around', async () => {
    wideScreen(true);
    await openView();
    fireEvent.click(await screen.findByTestId('categoria-ads'));
    fireEvent.change(screen.getByTestId('orden-enlaces'), { target: { value: 'oldest' } });
    const cards = within(screen.getByTestId('vista-por-categoria')).getAllByTestId(/^enlace-\d$/);
    expect(cards.map((one) => one.dataset.testid)).toEqual(['enlace-4', 'enlace-3', 'enlace-2', 'enlace-1']);
  });

  it('«Renombrar» saves the new name and reads the view again', async () => {
    // Arrange
    wideScreen(true);
    const { fetchMock } = await openView();
    fireEvent.click(await screen.findByTestId('categoria-voice'));
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    // Act
    fireEvent.click(screen.getByTestId('btn-renombrar-categoria'));
    fireEvent.change(screen.getByTestId('campo-nombre-categoria'), { target: { value: 'Voz' } });
    fireEvent.click(screen.getByTestId('btn-guardar-nombre-categoria'));
    // Assert
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/link-categories/voice', expect.objectContaining({ method: 'PATCH', body: JSON.stringify({ name: 'Voz' }) })));
    await waitFor(() => expect(screen.queryByTestId('campo-nombre-categoria')).toBeNull());
  });

  it('«Unir con…» sends the links to the chosen one', async () => {
    wideScreen(true);
    const { fetchMock } = await openView();
    fireEvent.click(await screen.findByTestId('categoria-voice'));
    fetchMock.mockResolvedValueOnce(json({ ok: true }));
    fireEvent.click(screen.getByTestId('btn-unir-categoria-abrir'));
    fireEvent.click(screen.getByTestId('unir-con-none'));
    fireEvent.click(screen.getByTestId('btn-unir-categoria'));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith('/api/chats/n1/link-categories/voice/merge', expect.objectContaining({ method: 'POST', body: JSON.stringify({ into: null }) })));
  });
});
