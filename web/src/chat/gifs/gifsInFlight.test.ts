import { describe, expect, it } from 'vitest';
import { act, renderHook } from '@testing-library/react';
import { addGifInFlight, gifAsPendingMessage, removeGifInFlight, useGifsInFlight } from './gifsInFlight';

/** José, 22/10: a GIF took seconds to show up after clicking it. */
describe('GIFs in flight', () => {
  const gif = { id: 'abc', title: 'Gracias', previewUrl: 'https://media.giphy.com/abc/200w.gif', width: 200, height: 150 };

  it('shows at once in its chat as GIPHY\'s preview, «sending», and goes when removed', () => {
    const { result } = renderHook(() => useGifsInFlight('c1'));
    act(() => addGifInFlight('c1', 'gif-1', gif));
    expect(result.current).toHaveLength(1);
    expect(gifAsPendingMessage(result.current[0]!, 'yo')).toMatchObject({ clientKey: 'gif-1', senderId: 'yo', estado: 'enviando', media: { url: gif.previewUrl, mime: 'image/gif', width: 200 } });
    act(() => removeGifInFlight('gif-1'));
    expect(result.current).toEqual([]);
  });
});
