import { act, fireEvent, render, screen } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { MiniVideoPlayer } from './MiniVideoPlayer';
import { closeMiniPlayer, miniPlayerVideo, openMiniPlayer } from './miniPlayer';
import { PhotoViewer } from '../chat/VisorDeFotos';
import type { MensajeEnPantalla } from '../chat/types';

const video: MensajeEnPantalla = { chatId: 'c1', seq: 4, senderId: 'u2', clientKey: 'k4', kind: 'video', body: 'La obra', at: '2026-10-22T15:00:00.000Z', media: { url: 'https://x/v.mp4', thumbUrl: 'https://x/t.jpg', mime: 'video/mp4' } };

describe('the mini player (pending 14)', () => {
  afterEach(() => act(() => closeMiniPlayer()));

  it('from the viewer, a video goes to the mini player and the viewer closes', () => {
    // Arrange
    const onClose = vi.fn();
    render(<PhotoViewer fotos={[video]} indice={0} onCambiar={() => undefined} onCerrar={onClose} />);
    // Act
    fireEvent.click(screen.getByTestId('visor-mini-reproductor'));
    // Assert
    expect(miniPlayerVideo()).toMatchObject({ url: 'https://x/v.mp4', poster: 'https://x/t.jpg', title: 'La obra' });
    expect(onClose).toHaveBeenCalled();
  });

  it('a photo has no mini player button', () => {
    render(<PhotoViewer fotos={[{ ...video, kind: 'image', media: { url: 'https://x/f.jpg', mime: 'image/jpeg' } }]} indice={0} onCambiar={() => undefined} onCerrar={() => undefined} />);
    expect(screen.queryByTestId('visor-mini-reproductor')).toBeNull();
  });

  it('the mini player shows the video and closes', () => {
    render(<MiniVideoPlayer />);
    expect(screen.queryByTestId('mini-reproductor')).toBeNull();
    act(() => openMiniPlayer({ url: 'https://x/v.mp4', startAt: 3, title: 'La obra' }));
    expect(screen.getByTestId('mini-reproductor-video')).toHaveAttribute('src', 'https://x/v.mp4');
    fireEvent.click(screen.getByTestId('btn-cerrar-mini-reproductor'));
    expect(screen.queryByTestId('mini-reproductor')).toBeNull();
  });
});
