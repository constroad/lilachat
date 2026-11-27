import { afterEach, describe, expect, it, vi } from 'vitest';
import { createStickerFromVideo, fetchGifFile, sendSticker, stickerFromGif, uploadGifSticker, videoStickerForm } from './stickersApi';

/** José, 20/10: «no puedo responder con sticker» — the reply and the thread travel with the sticker. */
describe('sendSticker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the quoted message and the thread with the sticker', async () => {
    const request = vi.fn(async () => new Response('{"duplicate":false}', { status: 201 }));
    vi.stubGlobal('fetch', request);

    await sendSticker('jwt', 'c1', 's1', 'k1', { replyToSeq: 151, hiloDe: 140, enElChat: false });

    const body = JSON.parse(String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ stickerId: 's1', clientKey: 'k1', replyToSeq: 151, hiloDe: 140, enElChat: false });
  });
});

/** Pending 37 (José, 21/10 and 22/10): my own animated stickers from a GIF. */
describe('animated stickers from a GIF', () => {
  afterEach(() => vi.unstubAllGlobals());
  const sticker = { id: 'n1', url: 'https://storage.test/n1.webp', mime: 'image/webp', width: 512, height: 512, favorite: false, at: '2026-10-22T12:00:00.000Z', animated: true };

  it('a GIF of the computer goes as a file to /api/stickers/animated', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ sticker }), { status: 201 }));
    vi.stubGlobal('fetch', request);

    const saved = await uploadGifSticker('jwt', new File(['GIF89a'], 'risa.gif', { type: 'image/gif' }));

    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/stickers/animated');
    expect((init.body as FormData).get('file')).toBeInstanceOf(File);
    expect(saved).toEqual({ ok: true, data: { sticker } });
  });

  it('a GIF of a chat goes by its chat and seq, never by its URL', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ sticker }), { status: 201 }));
    vi.stubGlobal('fetch', request);

    await stickerFromGif('jwt', 'c1', 9);

    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/stickers/from-gif');
    expect(JSON.parse(String(init.body))).toEqual({ chatId: 'c1', seq: 9 });
  });

  it('the server’s refusal reaches the person as it is', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'No se pudo dejar ese GIF en 500 KB: prueba con uno más corto.' }), { status: 413 })));
    const saved = await uploadGifSticker('jwt', new File(['GIF89a'], 'largo.gif', { type: 'image/gif' }));
    expect(saved).toMatchObject({ ok: false, status: 413, message: 'No se pudo dejar ese GIF en 500 KB: prueba con uno más corto.' });
  });
});

/** José 26/11 (designs ss-01…ss-04): a sticker with sound from a video. */
describe('a sticker from a video', () => {
  afterEach(() => vi.unstubAllGlobals());
  const video = new File(['mp4'], 'obra.mp4', { type: 'video/mp4' });
  const trim = { startMs: 12_000, endMs: 18_000 };
  const sticker = { id: 'v1', url: 'https://storage.test/v1.webp', mime: 'image/webp', width: 512, height: 512, favorite: false, at: '2026-11-26T12:00:00.000Z', animated: true, audioUrl: 'https://storage.test/v1.m4a' };

  it('the form carries the video, the window and the sound as the server reads them', () => {
    const form = videoStickerForm({ video, trim, sound: { kind: 'original' } });
    expect(form.get('file')).toBeInstanceOf(File);
    expect(form.get('startMs')).toBe('12000');
    expect(form.get('endMs')).toBe('18000');
    expect(form.get('sound')).toBe('original');
    expect(form.get('audio')).toBeNull();
  });

  it('a preset goes by its id, and «Sin sonido» as none', () => {
    expect(videoStickerForm({ video, trim, sound: { kind: 'preset', presetId: 'bocina' } }).get('sound')).toBe('preset:bocina');
    expect(videoStickerForm({ video, trim, sound: { kind: 'none' } }).get('sound')).toBe('none');
  });

  it('a recorded voice travels as the audio part with an audio type', () => {
    const voice = new Blob(['webm'], { type: 'audio/webm' });
    const audio = videoStickerForm({ video, trim, sound: { kind: 'file' }, audio: voice }).get('audio') as File;
    expect(audio).toBeInstanceOf(File);
    expect(audio.type).toBe('audio/webm');
    expect(audio.name).toBe('sticker-sonido.webm');
  });

  it('an audio is only sent when the sound is a file', () => {
    const voice = new Blob(['webm'], { type: 'audio/webm' });
    expect(videoStickerForm({ video, trim, sound: { kind: 'none' }, audio: voice }).get('audio')).toBeNull();
  });

  it('the window goes in whole milliseconds', () => {
    const form = videoStickerForm({ video, trim: { startMs: 1_000.4, endMs: 3_200.6 }, sound: { kind: 'none' } });
    expect(form.get('startMs')).toBe('1000');
    expect(form.get('endMs')).toBe('3201');
  });

  it('goes to /api/stickers/from-video and returns the sticker with its sound', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ sticker }), { status: 201 }));
    vi.stubGlobal('fetch', request);

    const saved = await createStickerFromVideo('jwt', { video, trim, sound: { kind: 'original' } });

    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('/api/stickers/from-video');
    expect((init.headers as Record<string, string>).Authorization).toBe('Bearer jwt');
    expect(saved).toEqual({ ok: true, data: { sticker } });
  });

  it('the server’s refusal reaches the person as it is', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'No se pudo dejar ese clip en 500 KB: prueba con uno más corto.' }), { status: 413 })));
    const saved = await createStickerFromVideo('jwt', { video, trim, sound: { kind: 'none' } });
    expect(saved).toMatchObject({ ok: false, status: 413, message: 'No se pudo dejar ese clip en 500 KB: prueba con uno más corto.' });
  });
});

/** José 26/11 (design sc-01a): «Convertir en sticker animado» opens the clip editor with the chat's GIF. */
describe('the GIF of a chat as a file', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('comes as a GIF file the editor can take', async () => {
    const request = vi.fn(async () => new Response('GIF89a', { status: 200, headers: { 'Content-Type': 'image/gif' } }));
    vi.stubGlobal('fetch', request);

    const fetched = await fetchGifFile('https://chat.test/media/a.gif');

    expect(request).toHaveBeenCalledWith('https://chat.test/media/a.gif');
    expect(fetched.ok).toBe(true);
    if (!fetched.ok) return;
    expect(fetched.file.type).toBe('image/gif');
    expect(fetched.file.name).toBe('a.gif');
    expect(fetched.file.size).toBe(6);
  });

  it('a GIF served without its type still goes as image/gif', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('GIF89a', { status: 200 })));
    const fetched = await fetchGifFile('/media/sin-nombre');
    expect(fetched.ok && fetched.file).toMatchObject({ type: 'image/gif', name: 'sticker.gif' });
  });

  it('a refusal of the server says it could not be opened', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('', { status: 404 })));
    expect(await fetchGifFile('/media/a.gif')).toEqual({ ok: false, message: 'No se pudo abrir ese GIF. Inténtalo de nuevo.' });
  });

  it('a network failure says so, without breaking', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => Promise.reject(new TypeError('Failed to fetch'))));
    expect(await fetchGifFile('/media/a.gif')).toEqual({ ok: false, message: 'No se pudo traer ese GIF. Revisa tu conexión.' });
  });
});
