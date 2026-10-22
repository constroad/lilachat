import { describe, expect, it, vi } from 'vitest';
import { addGifInFlight, gifAsQueuedFile, gifsInFlightOf, removeGifInFlight, subscribeGifsInFlight } from './gifsInFlight';

/** José, 22/10: a GIF took seconds to show up after tapping it. */
describe('GIFs in flight', () => {
  const gif = { id: 'abc', title: 'Gracias', previewUrl: 'https://media.giphy.com/abc/200w.gif', width: 200, height: 150 };

  it('the pending bubble is GIPHY\'s preview with its shape, as a GIF of the queue', () => {
    expect(gifAsQueuedFile(gif, 'c1', 'gif-1', '2026-10-22T10:00:00Z')).toMatchObject({ clientKey: 'gif-1', chatId: 'c1', uri: gif.previewUrl, mimeType: 'image/gif', width: 200, height: 150 });
  });

  it('shows in its chat only, and goes when the real message takes its place', () => {
    const listener = vi.fn();
    const stop = subscribeGifsInFlight(listener);
    addGifInFlight('c1', gifAsQueuedFile(gif, 'c1', 'gif-1', '2026-10-22T10:00:00Z'));
    expect(gifsInFlightOf('c1').map((file) => file.clientKey)).toEqual(['gif-1']);
    expect(gifsInFlightOf('c2')).toEqual([]);
    removeGifInFlight('gif-1');
    removeGifInFlight('gif-1');
    expect(gifsInFlightOf('c1')).toEqual([]);
    expect(listener).toHaveBeenCalledTimes(2);
    stop();
  });
});
