import { afterEach, describe, expect, it, vi } from 'vitest';

vi.mock('@react-native-async-storage/async-storage', () => ({ default: { getItem: vi.fn(async () => null), setItem: vi.fn(async () => undefined) } }));
vi.mock('../subidaXhr', () => ({ subirPorXhr: vi.fn() }));
vi.mock('../../api/client', () => ({ BASE_URL: 'https://qa.test' }));

const { stickerFromGif } = await import('./stickersApi');
const { saveGifSticker } = await import('./useStickers');

const sticker = { id: 'n1', url: 'https://storage.test/n1.webp', mime: 'image/webp', width: 512, height: 512, favorite: false, at: '2026-10-22T12:00:00.000Z', animated: true };
afterEach(() => vi.unstubAllGlobals());

/** Pending 37 (José, 22/10): a GIF of the chat becomes my animated sticker. */
describe('GIF to animated sticker (app)', () => {
  it('goes by chat and seq, never by URL, and hands back the sticker', async () => {
    const request = vi.fn(async () => new Response(JSON.stringify({ sticker }), { status: 201 }));
    vi.stubGlobal('fetch', request);

    const made = await stickerFromGif('jwt', 'c1', 9);

    const [url, init] = request.mock.calls[0] as unknown as [string, RequestInit];
    expect(url).toBe('https://qa.test/api/stickers/from-gif');
    expect(JSON.parse(String(init.body))).toEqual({ chatId: 'c1', seq: 9 });
    expect(made).toEqual({ ok: true, data: sticker });
  });

  it('tells the person what happened: saved, or the server’s reason', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ sticker }), { status: 201 })));
    await expect(saveGifSticker('jwt', { chatId: 'c1', seq: 9 })).resolves.toBe('Sticker animado guardado en Mis stickers');
    vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({ message: 'Ese mensaje no es un GIF.' }), { status: 400 })));
    await expect(saveGifSticker('jwt', { chatId: 'c1', seq: 3 })).resolves.toBe('Ese mensaje no es un GIF.');
  });
});
