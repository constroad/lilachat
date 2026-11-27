import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('../subidaXhr', () => ({ subirPorXhr: vi.fn() }));

/** José, 20/10: «no puedo responder con sticker» — the reply and the thread travel with the sticker. */
describe('sendSticker', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sends the quoted message and the thread with the sticker', async () => {
    const request = vi.fn(async () => new Response('{"duplicate":false}', { status: 201 }));
    vi.stubGlobal('fetch', request);
    const { sendSticker } = await import('./stickersApi');

    await sendSticker('jwt', 'c1', 's1', 'k1', { replyToSeq: 151 });

    const body = JSON.parse(String((request.mock.calls[0] as unknown as [string, RequestInit])[1].body));
    expect(body).toEqual({ stickerId: 's1', clientKey: 'k1', replyToSeq: 151 });
  });
});

/** José 26/11 (designs ss-01/ss-02): the video, the window, the sound and, for a voice or a file, the audio. */
describe('createStickerFromVideo', () => {
  const video = { uri: 'file:///v.mp4', name: 'v.mp4', mime: 'video/mp4' };
  const fields: [string, string][] = [['startMs', '12000'], ['endMs', '18000'], ['sound', 'file']];

  it('posts the video, its audio and the fields, and returns the sticker', async () => {
    const { subirPorXhr } = await import('../subidaXhr');
    const upload = vi.mocked(subirPorXhr);
    upload.mockResolvedValueOnce({ tipo: 'respuesta', status: 201, payload: { sticker: { id: 's9', url: 'https://x/s.webp', audioUrl: 'https://x/a.m4a' } } });
    const { createStickerFromVideo } = await import('./stickersApi');
    const progress = vi.fn();

    const made = await createStickerFromVideo('jwt', { video, audio: { uri: 'file:///a.m4a', name: 'a.m4a', mime: 'audio/m4a' }, fields }, progress);

    expect(made).toEqual({ ok: true, data: { id: 's9', url: 'https://x/s.webp', audioUrl: 'https://x/a.m4a' } });
    const request = upload.mock.calls.at(-1)![0];
    expect(request.url).toMatch(/\/api\/stickers\/from-video$/);
    expect(request.token).toBe('jwt');
    expect(request.onProgress).toBe(progress);
    expect(request.form.get('startMs')).toBe('12000');
    expect(request.form.get('endMs')).toBe('18000');
    expect(request.form.get('sound')).toBe('file');
    expect(request.form.has('file')).toBe(true);
    expect(request.form.has('audio')).toBe(true);
  });

  it('sends no audio part when the sound is not a file', async () => {
    const { subirPorXhr } = await import('../subidaXhr');
    const upload = vi.mocked(subirPorXhr);
    upload.mockResolvedValueOnce({ tipo: 'respuesta', status: 201, payload: { sticker: { id: 's1' } } });
    const { createStickerFromVideo } = await import('./stickersApi');

    await createStickerFromVideo('jwt', { video, audio: null, fields: [['startMs', '0'], ['endMs', '6000'], ['sound', 'original']] });

    expect(upload.mock.calls.at(-1)![0].form.has('audio')).toBe(false);
  });

  it('shows the server message as it is, and a lost connection as the upload said', async () => {
    const { subirPorXhr } = await import('../subidaXhr');
    const upload = vi.mocked(subirPorXhr);
    const { createStickerFromVideo } = await import('./stickersApi');
    upload.mockResolvedValueOnce({ tipo: 'respuesta', status: 413, payload: { message: 'Ese video pesa demasiado (máximo 60 MB).' } });
    await expect(createStickerFromVideo('jwt', { video, audio: null, fields })).resolves.toEqual({ ok: false, reason: 'Ese video pesa demasiado (máximo 60 MB).' });

    upload.mockResolvedValueOnce({ tipo: 'respuesta', status: 503, payload: {} });
    await expect(createStickerFromVideo('jwt', { video, audio: null, fields })).resolves.toEqual({ ok: false, reason: 'No se pudo guardar el sticker.' });

    upload.mockResolvedValueOnce({ tipo: 'fallo', motivo: 'Sin conexión. Inténtalo de nuevo.', reintentable: true });
    await expect(createStickerFromVideo('jwt', { video, audio: null, fields })).resolves.toEqual({ ok: false, reason: 'Sin conexión. Inténtalo de nuevo.' });
  });
});
