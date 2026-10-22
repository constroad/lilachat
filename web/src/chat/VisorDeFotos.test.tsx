import { afterEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import { PhotoViewer } from './VisorDeFotos';
import type { MensajeEnPantalla } from './types';

const photo = (mime: string): MensajeEnPantalla => ({ chatId: 'c1', seq: 9, clientKey: 'k9', senderId: 'u2', kind: 'image', at: '2026-10-22T12:00:00.000Z', media: { mediaId: 'm9', url: 'https://storage.test/a.gif', mime } }) as unknown as MensajeEnPantalla;

afterEach(cleanup);

/** Pending 37 (José, 22/10): a GIF of the chat becomes my animated sticker from the viewer. */
describe('VisorDeFotos', () => {
  it('a GIF offers «Convertir en sticker animado»', () => {
    const onMakeSticker = vi.fn();
    render(<PhotoViewer fotos={[photo('image/gif')]} indice={0} onCambiar={vi.fn()} onCerrar={vi.fn()} onMakeSticker={onMakeSticker} />);
    fireEvent.click(screen.getByTestId('visor-gif-a-sticker'));
    expect(onMakeSticker).toHaveBeenCalledWith(expect.objectContaining({ seq: 9 }));
  });

  it('a photo does not, and neither does a GIF in a secret chat (no handler)', () => {
    render(<PhotoViewer fotos={[photo('image/jpeg')]} indice={0} onCambiar={vi.fn()} onCerrar={vi.fn()} onMakeSticker={vi.fn()} />);
    expect(screen.queryByTestId('visor-gif-a-sticker')).toBeNull();
    cleanup();
    render(<PhotoViewer fotos={[photo('image/gif')]} indice={0} onCambiar={vi.fn()} onCerrar={vi.fn()} />);
    expect(screen.queryByTestId('visor-gif-a-sticker')).toBeNull();
  });
});
