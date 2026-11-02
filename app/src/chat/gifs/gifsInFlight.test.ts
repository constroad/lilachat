import { describe, expect, it, vi } from 'vitest';
import { addMediaInFlight, gifAsQueuedFile, mediaInFlightOf, removeMediaInFlight, stickerAsQueuedFile, subscribeMediaInFlight } from './gifsInFlight';

/** José, 22/10: a GIF took seconds to show up after tapping it. 02/11: a sticker too. */
describe('GIFs and stickers in flight', () => {
  const gif = { id: 'abc', title: 'Gracias', previewUrl: 'https://media.giphy.com/abc/200w.gif', width: 200, height: 150 };
  const sticker = { id: '6ada82b05a210fa4025f6a2c', url: 'https://lilachat.constroad.com/media/stickers/6ada82b0.webp', mime: 'image/webp', width: 512, height: 512, favorite: true, at: '2026-11-02T10:00:00Z' };

  it('the pending bubble is GIPHY\'s preview with its shape, as a GIF of the queue', () => {
    expect(gifAsQueuedFile(gif, 'c1', 'gif-1', '2026-10-22T10:00:00Z')).toMatchObject({ clientKey: 'gif-1', chatId: 'c1', uri: gif.previewUrl, mimeType: 'image/gif', width: 200, height: 150 });
  });

  it('a sticker waits as itself: the same image the panel showed (already cached), marked as a sticker', () => {
    expect(stickerAsQueuedFile(sticker, 'c1', 'st-1', '2026-11-02T10:00:00Z')).toMatchObject({ clientKey: 'st-1', chatId: 'c1', uri: sticker.url, mimeType: 'image/webp', width: 512, height: 512, sticker: true });
  });

  it('shows in its chat only, and goes when the real message takes its place', () => {
    const listener = vi.fn();
    const stop = subscribeMediaInFlight(listener);
    addMediaInFlight('c1', gifAsQueuedFile(gif, 'c1', 'gif-1', '2026-10-22T10:00:00Z'));
    expect(mediaInFlightOf('c1').map((file) => file.clientKey)).toEqual(['gif-1']);
    expect(mediaInFlightOf('c2')).toEqual([]);
    removeMediaInFlight('gif-1');
    removeMediaInFlight('gif-1');
    expect(mediaInFlightOf('c1')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
});
