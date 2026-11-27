import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibrarySticker } from '@lilachat/shared';
import { StickerSoundDialog } from './StickerSoundDialog';

vi.mock('../winkSounds', () => ({ playWinkSound: vi.fn(), stopWinkSounds: vi.fn() }));
afterEach(cleanup);

const sticker = (overrides: Partial<LibrarySticker> = {}): LibrarySticker => ({ id: '6739f0c2a1b2c3d4e5f60799', url: 'https://x/s.webp', mime: 'image/webp', width: 512, height: 512, favorite: true, at: '2026-11-27T12:00:00.000Z', animated: true, ...overrides });

/** José 27/11: «ya tengo un sticker en mis favoritos… quiero agregarle audio sin volver a buscar el GIF» (design sa-01). */
describe('StickerSoundDialog', () => {
  it('a sticker without sound: «Agregar sonido», no «Sonido original», and a preset is saved', async () => {
    // Arrange
    const onSave = vi.fn(async () => ({ ok: true as const, data: { sticker: sticker() } }));
    const onClose = vi.fn();
    render(<StickerSoundDialog sticker={sticker()} onSave={onSave} onClose={onClose} />);
    expect(screen.getByRole('dialog', { name: 'Agregar sonido' })).toBeTruthy();
    expect(screen.getByTestId('linea-sonido-sticker').textContent).toBe('Animado · sin sonido');
    expect(screen.queryByTestId('sonido-original')).toBeNull();
    // Act
    fireEvent.click(screen.getByTestId('sonido-preset-risa'));
    fireEvent.click(screen.getByTestId('guardar-sonido-sticker'));
    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ id: '6739f0c2a1b2c3d4e5f60799' }), { sound: { kind: 'preset', presetId: 'risa' }, audio: null });
  });

  it('nothing chosen asks for a choice; a refusal stays open with its words', async () => {
    const onSave = vi.fn(async () => ({ ok: false as const, status: 400, message: 'No se pudo leer ese audio.' }));
    const onClose = vi.fn();
    render(<StickerSoundDialog sticker={sticker()} onSave={onSave} onClose={onClose} />);
    fireEvent.click(screen.getByTestId('guardar-sonido-sticker'));
    expect(screen.getByText('Elige el sonido del sticker.')).toBeTruthy();
    expect(onSave).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId('sin-sonido'));
    fireEvent.click(screen.getByTestId('guardar-sonido-sticker'));
    expect(await screen.findByText('No se pudo leer ese audio.')).toBeTruthy();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('one with a preset opens on it, as «Cambiar sonido»', () => {
    render(<StickerSoundDialog sticker={sticker({ audioUrl: 'https://x/sonidos/wink-horn.mp3' })} onSave={vi.fn()} onClose={vi.fn()} />);
    expect(screen.getByRole('dialog', { name: 'Cambiar sonido' })).toBeTruthy();
    expect(screen.getByTestId('sonido-preset-bocina').getAttribute('aria-checked')).toBe('true');
    expect(screen.getByTestId('linea-sonido-sticker').textContent).toBe('Animado · con sonido · Bocina');
  });
});
