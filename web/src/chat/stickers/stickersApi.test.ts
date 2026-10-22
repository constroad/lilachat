import { afterEach, describe, expect, it, vi } from 'vitest';
import { sendSticker, stickerFromGif, uploadGifSticker } from './stickersApi';

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
