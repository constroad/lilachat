import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibrarySticker } from '@lilachat/shared';
import { StickerExportDialog } from './StickerExportDialog';

const sticker = (overrides: Partial<LibrarySticker> = {}): LibrarySticker => ({ id: '6739f0c2a1b2c3d4e5f60799', url: 'https://x/s.webp', mime: 'image/webp', width: 512, height: 512, favorite: false, at: '2026-11-27T12:00:00.000Z', animated: true, audioUrl: 'https://x/sonidos/wink-laugh.mp3', ...overrides });
const downloads: string[] = [];

beforeEach(() => {
  downloads.length = 0;
  vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:x'), revokeObjectURL: vi.fn() }));
  vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (this: HTMLAnchorElement) {
    downloads.push(this.download);
  });
});
afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** José 27/11: «exportarlo para usarlo en WhatsApp» (design sa-05). */
describe('StickerExportDialog', () => {
  it('the video with its sound downloads as the MP4 the server made', async () => {
    // Arrange
    const makeVideo = vi.fn(async () => ({ ok: true as const, file: new File(['mp4'], 'sticker-lilachat.mp4', { type: 'video/mp4' }) }));
    render(<StickerExportDialog sticker={sticker()} makeVideo={makeVideo} onClose={vi.fn()} />);
    // Act
    fireEvent.click(screen.getByTestId('exportar-video'));
    // Assert
    await waitFor(() => expect(downloads).toEqual(['sticker-lilachat.mp4']));
    expect(screen.getByText(/WhatsApp todavía no recibe stickers con sonido/)).toBeTruthy();
  });

  it('the picture downloads as WebP; a still one without sound only offers the picture', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(new Blob(['RIFF'], { type: 'image/webp' }), { status: 200 })));
    render(<StickerExportDialog sticker={sticker({ animated: false, audioUrl: undefined })} makeVideo={vi.fn()} onClose={vi.fn()} />);
    expect(screen.queryByTestId('exportar-video')).toBeNull();
    fireEvent.click(screen.getByTestId('exportar-imagen'));
    await waitFor(() => expect(downloads).toEqual(['sticker-lilachat.webp']));
  });

  it('a refusal is said, nothing downloads', async () => {
    const makeVideo = vi.fn(async () => ({ ok: false as const, message: 'No se pudo preparar el video. Inténtalo de nuevo.' }));
    render(<StickerExportDialog sticker={sticker()} makeVideo={makeVideo} onClose={vi.fn()} />);
    fireEvent.click(screen.getByTestId('exportar-video'));
    expect(await screen.findByRole('alert')).toHaveTextContent('No se pudo preparar el video. Inténtalo de nuevo.');
    expect(downloads).toEqual([]);
  });
});
