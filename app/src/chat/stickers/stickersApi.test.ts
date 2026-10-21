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
