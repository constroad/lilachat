import { fireEvent, render, screen, within } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import type { LibrarySticker } from '@lilachat/shared';
import { StickerPanel } from './StickerPanel';

const sticker = (id: string, favorite = false): LibrarySticker => ({ id, url: `https://storage.test/${id}.webp`, mime: 'image/webp', width: 512, height: 512, favorite, at: '2026-10-20T12:00:00.000Z' });
const pack = { id: 'lila-1', title: 'Lila', stickers: [sticker('pack:lila-1/dog-ready'), sticker('pack:lila-1/cat')] };

function draw(params: { library: LibrarySticker[] | null; recents?: string[]; packs?: (typeof pack)[] }) {
  const actions = { onSend: vi.fn(), onCreate: vi.fn(), onToggleFavorite: vi.fn(), onRemove: vi.fn() };
  render(<StickerPanel library={params.library} recents={params.recents ?? []} packs={params.packs ?? [pack]} error="" {...actions} />);
  return actions;
}

/** The web Stickers tab (José, 20/10; design `s1-web-stickers`), same as the app. */
describe('StickerPanel (web)', () => {
  it('a new person: «Crear», how to start, and the default pack ready to send', () => {
    const { onSend } = draw({ library: [] });
    expect(screen.getByTestId('btn-crear-sticker')).toBeInTheDocument();
    expect(screen.getByText(/Crea tu primer sticker/)).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('sticker-pack:lila-1-pack:lila-1/cat'));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ id: 'pack:lila-1/cat' }));
  });

  it('while loading, the reserved place and not an empty state', () => {
    draw({ library: null });
    expect(screen.getByTestId('stickers-cargando')).toBeInTheDocument();
    expect(screen.queryByText(/Crea tu primer sticker/)).toBeNull();
  });

  it('recent and favorites have their section; «Crear» goes in the first one', () => {
    draw({ library: [sticker('a', true), sticker('b')], recents: ['b'] });
    const recent = screen.getByTestId('seccion-stickers-recent');
    expect(within(recent).getByTestId('btn-crear-sticker')).toBeInTheDocument();
    expect(within(recent).getByTestId('sticker-recent-b')).toBeInTheDocument();
    expect(within(screen.getByTestId('seccion-stickers-favorites')).getByTestId('sticker-favorites-a')).toBeInTheDocument();
  });

  it('a filter leaves only its section; tapping it again shows all', () => {
    draw({ library: [sticker('a', true), sticker('b')], recents: ['b'] });
    fireEvent.click(screen.getByTestId('filtro-stickers-favorites'));
    expect(screen.queryByTestId('seccion-stickers-recent')).toBeNull();
    expect(screen.getByTestId('seccion-stickers-favorites')).toBeInTheDocument();
    fireEvent.click(screen.getByTestId('filtro-stickers-favorites'));
    expect(screen.getByTestId('seccion-stickers-recent')).toBeInTheDocument();
  });

  it('«Mis stickers» shows two rows and «Ver todos» opens the rest', () => {
    draw({ library: Array.from({ length: 12 }, (_, index) => sticker(`s${index}`)) });
    const mine = screen.getByTestId('seccion-stickers-mine');
    expect(within(mine).getAllByRole('button', { name: 'Mandar el sticker' })).toHaveLength(7);
    fireEvent.click(screen.getByTestId('btn-ver-todos-stickers'));
    expect(within(mine).getAllByRole('button', { name: 'Mandar el sticker' })).toHaveLength(12);
  });

  it('the star toggles favorite and the X removes from «Mis stickers», without sending', () => {
    const { onToggleFavorite, onRemove, onSend } = draw({ library: [sticker('a')] });
    fireEvent.click(screen.getByTestId('favorito-mine-a'));
    fireEvent.click(screen.getByTestId('quitar-mine-a'));
    expect(onToggleFavorite).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(onRemove).toHaveBeenCalledWith(expect.objectContaining({ id: 'a' }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('a pack sticker can be starred but not removed', () => {
    draw({ library: [] });
    expect(screen.getByTestId('favorito-pack:lila-1-pack:lila-1/cat')).toBeInTheDocument();
    expect(screen.queryByTestId('quitar-pack:lila-1-pack:lila-1/cat')).toBeNull();
  });

  /** José 26/11 (design sc-01a): ONE «Crear» for a photo, a video or a GIF. */
  it('one «Crear» tile, with its caption, and no «Desde un video» nor «Desde un GIF»', () => {
    draw({ library: [] });
    const tile = screen.getByTestId('btn-crear-sticker');
    expect(tile).toHaveTextContent('Crear');
    expect(tile).toHaveTextContent('Foto, video o GIF');
    expect(screen.queryByTestId('crear-desde-video')).toBeNull();
    expect(screen.queryByTestId('btn-sticker-desde-gif')).toBeNull();
    expect(screen.getByTestId('input-crear-sticker')).toHaveAttribute('accept', 'image/*,video/*');
  });

  it('«Crear» opens the file picker, and the chosen file is handed over', () => {
    const { onCreate } = draw({ library: [] });
    const input = screen.getByTestId('input-crear-sticker') as HTMLInputElement;
    const opened = vi.spyOn(input, 'click');
    fireEvent.click(screen.getByTestId('btn-crear-sticker'));
    expect(opened).toHaveBeenCalled();
    const gif = new File(['GIF89a'], 'risa.gif', { type: 'image/gif' });
    fireEvent.change(input, { target: { files: [gif] } });
    expect(onCreate).toHaveBeenCalledWith(gif);
  });

  it('closing the picker without a file does nothing', () => {
    const { onCreate } = draw({ library: [] });
    fireEvent.change(screen.getByTestId('input-crear-sticker'), { target: { files: [] } });
    expect(onCreate).not.toHaveBeenCalled();
  });
});
