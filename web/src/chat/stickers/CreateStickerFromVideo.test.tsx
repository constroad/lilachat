import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { LibrarySticker } from '@lilachat/shared';
import type { ApiResult } from '../../api';
import { CreateStickerFromVideo } from './CreateStickerFromVideo';
import type { VideoStickerRequest } from './stickersApi';

const saved = (audioUrl?: string): LibrarySticker => ({ id: 'v1', url: 'https://storage.test/v1.webp', mime: 'image/webp', width: 512, height: 512, favorite: false, at: '2026-11-26T12:00:00.000Z', animated: true, ...(audioUrl ? { audioUrl } : {}) });
type SaveResult = ApiResult<{ sticker: LibrarySticker }>;

const savesWithSound = async (): Promise<SaveResult> => ({ ok: true, data: { sticker: saved('https://storage.test/v1.m4a') } });

function open(onSave: (request: VideoStickerRequest) => Promise<SaveResult> = savesWithSound, initialClip?: File) {
  const actions = { onClose: vi.fn(), onSave: vi.fn(onSave), onSend: vi.fn(async () => true) };
  render(<CreateStickerFromVideo chatName="Obra Av. Colonial" initialClip={initialClip} {...actions} />);
  return actions;
}

const gifFile = () => new File(['GIF89a'], 'risa.gif', { type: 'image/gif' });

/** Picks a video of `seconds` and lets the preview read its length. */
function pickVideo(seconds = 20, file = new File(['mp4'], 'obra.mp4', { type: 'video/mp4' })) {
  fireEvent.change(screen.getByTestId('input-video-sticker'), { target: { files: [file] } });
  const video = screen.queryByTestId('video-sticker-preview');
  if (!video) return;
  Object.defineProperty(video, 'duration', { configurable: true, value: seconds });
  fireEvent.loadedMetadata(video);
}

/** José 26/11 (design ss-04): «Crear sticker desde un video». */
describe('CreateStickerFromVideo', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:video'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal('Audio', class { onended = null; play = vi.fn(async () => undefined); pause = vi.fn(); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a long video keeps its first 6 seconds, with the original sound chosen', () => {
    open();
    pickVideo(20);
    expect(screen.getByTestId('sticker-video-tiempos')).toHaveTextContent('0:00 – 0:06');
    expect(screen.getByTestId('duracion-sticker-video')).toHaveTextContent('6.0 segundos');
    expect(screen.getByTestId('sonido-original')).toHaveAttribute('aria-checked', 'true');
  });

  it('without a video nothing can be saved', () => {
    open();
    expect(screen.getByTestId('guardar-sticker-video')).toBeDisabled();
    expect(screen.getByTestId('enviar-sticker-video')).toBeDisabled();
  });

  it('a photo instead of a video says so', () => {
    open();
    pickVideo(20, new File(['jpg'], 'foto.jpg', { type: 'image/jpeg' }));
    expect(screen.getByTestId('aviso-sticker-video')).toHaveTextContent('Elige un video o un GIF.');
  });

  it('without a file it opens the picker by itself', () => {
    const opened = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    open();
    expect(opened).toHaveBeenCalled();
  });

  it('«Guardar en Mis stickers» sends the window and the sound, and closes', async () => {
    const { onSave, onSend, onClose } = open();
    pickVideo(20);
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ trim: { startMs: 0, endMs: 6_000 }, sound: { kind: 'original' }, audio: null }));
    expect(onSend).not.toHaveBeenCalled();
  });

  it('«Enviar» with a Lilachat sound saves it and then sends it here', async () => {
    const { onSave, onSend, onClose } = open();
    pickVideo(20);
    fireEvent.click(screen.getByTestId('sonido-preset-bocina'));
    expect(screen.getByTestId('sonido-preset-bocina')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('enviar-sticker-video'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sound: { kind: 'preset', presetId: 'bocina' } }));
    expect(onSend).toHaveBeenCalledWith(expect.objectContaining({ id: 'v1' }));
  });

  it('«Sin sonido» goes as none', async () => {
    const { onSave } = open();
    pickVideo(20);
    fireEvent.click(screen.getByTestId('sin-sonido'));
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sound: { kind: 'none' } })));
  });

  it('«Grabar tu voz» without a recording says what is missing and saves nothing', () => {
    const { onSave } = open();
    pickVideo(20);
    fireEvent.click(screen.getByTestId('sonido-grabar'));
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    expect(screen.getByTestId('aviso-sticker-video')).toHaveTextContent('Graba tu voz primero');
    expect(onSave).not.toHaveBeenCalled();
  });

  it('an uploaded audio goes as the sticker sound', async () => {
    const { onSave } = open();
    pickVideo(20);
    const audio = new File(['mp3'], 'risa.mp3', { type: 'audio/mpeg' });
    fireEvent.change(screen.getByTestId('input-audio-sticker'), { target: { files: [audio] } });
    expect(screen.getByTestId('sonido-subir')).toHaveAttribute('aria-checked', 'true');
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    await waitFor(() => expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sound: { kind: 'file' }, audio })));
  });

  it('while converting: a progress line and every button disabled', async () => {
    let answer: (result: SaveResult) => void = () => undefined;
    open(() => new Promise<SaveResult>((resolve) => { answer = resolve; }));
    pickVideo(20);
    fireEvent.click(screen.getByTestId('enviar-sticker-video'));
    expect(await screen.findByTestId('progreso-sticker-video')).toBeInTheDocument();
    expect(screen.getByTestId('guardar-sticker-video')).toBeDisabled();
    expect(screen.getByTestId('sin-sonido')).toBeDisabled();
    answer({ ok: false, status: 503, message: 'x' });
    await waitFor(() => expect(screen.queryByTestId('progreso-sticker-video')).toBeNull());
  });

  it('the server’s refusal is shown as it comes, and it can be tried again', async () => {
    const { onClose } = open(async () => ({ ok: false, status: 413, message: 'No se pudo dejar ese clip en 500 KB: prueba con uno más corto.' }));
    pickVideo(20);
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    expect(await screen.findByTestId('aviso-sticker-video')).toHaveTextContent('No se pudo dejar ese clip en 500 KB: prueba con uno más corto.');
    expect(screen.getByTestId('guardar-sticker-video')).not.toBeDisabled();
    expect(onClose).not.toHaveBeenCalled();
  });

  it('a silent video with «Sonido original»: it is saved without sound and the person is told', async () => {
    const { onClose } = open(async () => ({ ok: true, data: { sticker: saved() } }));
    pickVideo(20);
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    expect(await screen.findByTestId('info-sticker-video')).toHaveTextContent('El video no tenía sonido');
    expect(onClose).not.toHaveBeenCalled();
  });

  it('after a silent save, «Enviar» sends the same sticker without making another', async () => {
    const { onSave, onSend } = open(async () => ({ ok: true, data: { sticker: saved() } }));
    pickVideo(20);
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    await screen.findByTestId('info-sticker-video');
    fireEvent.click(screen.getByTestId('enviar-sticker-video'));
    await screen.findByTestId('listo-sticker-video');
    expect(onSave).toHaveBeenCalledTimes(1);
    expect(onSend).toHaveBeenCalledTimes(1);
  });
});

/** José 26/11 (design sc-01a): the file chosen under «Crear» arrives already loaded. */
describe('CreateStickerFromVideo with the file already chosen', () => {
  beforeEach(() => {
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL: vi.fn(() => 'blob:clip'), revokeObjectURL: vi.fn() }));
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockResolvedValue(undefined);
    vi.stubGlobal('Audio', class { onended = null; play = vi.fn(async () => undefined); pause = vi.fn(); });
  });
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a video: no second picker, its preview and its trim', () => {
    const opened = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    open(savesWithSound, new File(['mp4'], 'obra.mp4', { type: 'video/mp4' }));
    expect(opened).not.toHaveBeenCalled();
    const video = screen.getByTestId('video-sticker-preview');
    Object.defineProperty(video, 'duration', { configurable: true, value: 20 });
    fireEvent.loadedMetadata(video);
    expect(screen.getByTestId('sticker-video-tiempos')).toHaveTextContent('0:00 – 0:06');
    expect(screen.getByTestId('sonido-original')).toHaveAttribute('aria-checked', 'true');
  });

  it('a GIF: an image preview, no trim and no «Sonido original»; «Sin sonido» is chosen', () => {
    const opened = vi.spyOn(HTMLInputElement.prototype, 'click').mockImplementation(() => undefined);
    open(savesWithSound, gifFile());
    expect(opened).not.toHaveBeenCalled();
    expect(screen.getByTestId('gif-sticker-preview')).toHaveAttribute('src', 'blob:clip');
    expect(screen.queryByTestId('video-sticker-preview')).toBeNull();
    expect(screen.queryByTestId('sticker-video-tramo')).toBeNull();
    expect(screen.getByTestId('gif-entero-sticker')).toHaveTextContent('desde el inicio');
    expect(screen.queryByTestId('sonido-original')).toBeNull();
    expect(screen.getByTestId('sin-sonido')).toHaveAttribute('aria-checked', 'true');
    expect(screen.getByText('Crear sticker desde un GIF')).toBeInTheDocument();
  });

  it('a GIF is saved whole from the start, as the file it is, without sound', async () => {
    const gif = gifFile();
    const { onSave, onClose } = open(async () => ({ ok: true, data: { sticker: saved() } }), gif);
    fireEvent.click(screen.getByTestId('guardar-sticker-video'));
    await waitFor(() => expect(onClose).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ video: gif, trim: { startMs: 0, endMs: 6_000 }, sound: { kind: 'none' }, audio: null }));
  });

  it('a GIF with a Lilachat sound is sent with it', async () => {
    const { onSave, onSend } = open(savesWithSound, gifFile());
    fireEvent.click(screen.getByTestId('sonido-preset-risa'));
    fireEvent.click(screen.getByTestId('enviar-sticker-video'));
    await waitFor(() => expect(onSend).toHaveBeenCalled());
    expect(onSave).toHaveBeenCalledWith(expect.objectContaining({ sound: { kind: 'preset', presetId: 'risa' } }));
  });

  it('changing the GIF for a video brings back the trim and «Sonido original»', () => {
    open(savesWithSound, gifFile());
    pickVideo(20);
    expect(screen.getByTestId('sticker-video-tiempos')).toHaveTextContent('0:00 – 0:06');
    expect(screen.getByTestId('sonido-original')).toHaveAttribute('aria-checked', 'true');
  });

  it('a file that is not a clip says so and nothing can be saved', () => {
    open(savesWithSound, new File(['pdf'], 'acta.pdf', { type: 'application/pdf' }));
    expect(screen.getByTestId('aviso-sticker-video')).toHaveTextContent('Elige un video o un GIF.');
    expect(screen.getByTestId('guardar-sticker-video')).toBeDisabled();
  });
});
