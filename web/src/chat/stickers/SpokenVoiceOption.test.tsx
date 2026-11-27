import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { LibrarySticker } from '@lilachat/shared';
import { StickerSoundDialog } from './StickerSoundDialog';
import type { StickerVoiceDoor } from './stickerVoiceDoor';

vi.mock('../winkSounds', () => ({ playWinkSound: vi.fn(), stopWinkSounds: vi.fn() }));
afterEach(cleanup);

const SPACE = '6a87c797c709c4a21aba3aff';
const sticker: LibrarySticker = { id: '6739f0c2a1b2c3d4e5f60799', url: 'https://x/s.webp', mime: 'image/webp', width: 512, height: 512, favorite: true, at: '2026-11-27T12:00:00.000Z', animated: true };
const door = (listen: StickerVoiceDoor['listen'] = vi.fn(async () => ({ ok: false as const, message: 'La voz no está disponible ahora. Inténtalo más tarde.' }))): StickerVoiceDoor => ({ spaceId: SPACE, listen });

/** José 27/11: Latin Spanish voices for sound stickers, admins only, only Valeria and Daniel (design sv-01). */
describe('«Voz» in the sticker sound', () => {
  it('is not offered to someone who is not an admin of the space', () => {
    render(<StickerSoundDialog sticker={sticker} onSave={vi.fn()} onClose={vi.fn()} voiceDoor={null} />);
    expect(screen.queryByTestId('sonido-voz')).toBeNull();
  });

  it('an admin writes a phrase, picks Daniel and saves it', async () => {
    // Arrange
    const onSave = vi.fn(async () => ({ ok: true as const, data: { sticker } }));
    const onClose = vi.fn();
    render(<StickerSoundDialog sticker={sticker} onSave={onSave} onClose={onClose} voiceDoor={door()} />);
    // Act
    fireEvent.click(screen.getByTestId('sonido-voz'));
    expect(screen.getByText('Solo admins')).toBeTruthy();
    expect(screen.queryByTestId('voz-lucia')).toBeNull();
    fireEvent.change(screen.getByTestId('voz-frase'), { target: { value: '¡Vaciado listo!' } });
    expect(screen.getByTestId('voz-contador').textContent).toBe('15/120');
    fireEvent.click(screen.getByTestId('voz-daniel'));
    fireEvent.click(screen.getByTestId('guardar-sonido-sticker'));
    // Assert
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(sticker, { sound: { kind: 'voice', voiceId: 'daniel' }, audio: null, spoken: { text: '¡Vaciado listo!', spaceId: SPACE } });
  });

  it('«Escuchar» says when the voice is not available, and the person can try again', async () => {
    // Arrange
    const listen = vi.fn(async () => ({ ok: false as const, message: 'La voz no está disponible ahora. Inténtalo más tarde.' }));
    render(<StickerSoundDialog sticker={sticker} onSave={vi.fn()} onClose={vi.fn()} voiceDoor={door(listen)} />);
    fireEvent.click(screen.getByTestId('sonido-voz'));
    fireEvent.change(screen.getByTestId('voz-frase'), { target: { value: 'Hola' } });
    // Act
    fireEvent.click(screen.getByTestId('voz-escuchar'));
    // Assert
    expect(await screen.findByText('La voz no está disponible ahora. Inténtalo más tarde.')).toBeTruthy();
    expect(listen).toHaveBeenCalledWith('valeria', 'Hola');
    expect((screen.getByTestId('voz-escuchar') as HTMLButtonElement).disabled).toBe(false);
  });

  it('without a phrase «Escuchar» does not ask', () => {
    const listen = vi.fn();
    render(<StickerSoundDialog sticker={sticker} onSave={vi.fn()} onClose={vi.fn()} voiceDoor={door(listen)} />);
    fireEvent.click(screen.getByTestId('sonido-voz'));
    expect((screen.getByTestId('voz-escuchar') as HTMLButtonElement).disabled).toBe(true);
  });
});
