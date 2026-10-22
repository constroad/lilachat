import { describe, expect, it } from 'vitest';
import { GIF_MAX_BYTES, gifRenditionToSend, gifsFromGiphy, isAnimatedImage, isGiphyMediaUrl } from './gifs.js';

const giphy = {
  id: 'abc123',
  title: 'Buen trabajo GIF',
  images: {
    fixed_width_small: { url: 'https://media2.giphy.com/media/abc123/100w.gif', webp: 'https://media2.giphy.com/media/abc123/100w.webp', width: '100', height: '75' },
    fixed_width: { url: 'https://media2.giphy.com/media/abc123/200w.gif', width: '200', height: '150', size: '512000' },
  },
};

/** Backlog 37 (José, 21/10): GIFs and GIPHY, through the server (the key never reaches the app or the web). */
describe('gifs', () => {
  it('a GIPHY result becomes what the panel needs, the light preview first', () => {
    expect(gifsFromGiphy({ data: [giphy, { id: 'broken' }] })).toEqual([{ id: 'abc123', title: 'Buen trabajo GIF', previewUrl: 'https://media2.giphy.com/media/abc123/100w.webp', width: 200, height: 150 }]);
    expect(gifsFromGiphy(null)).toEqual([]);
  });

  it('what is sent is the 200 px GIF, only from GIPHY and not too heavy', () => {
    expect(gifRenditionToSend(giphy)).toEqual({ url: 'https://media2.giphy.com/media/abc123/200w.gif', width: 200, height: 150 });
    expect(gifRenditionToSend({ ...giphy, images: { fixed_width: { ...giphy.images.fixed_width, url: 'https://evil.example/x.gif' } } })).toBeNull();
    expect(gifRenditionToSend({ ...giphy, images: { fixed_width: { ...giphy.images.fixed_width, size: String(GIF_MAX_BYTES + 1) } } })).toBeNull();
    expect(isGiphyMediaUrl('https://i.giphy.com/x.gif')).toBe(true);
    expect(isGiphyMediaUrl('https://giphy.com.evil.example/x.gif')).toBe(false);
    expect(isGiphyMediaUrl('http://media.giphy.com/x.gif')).toBe(false);
  });

  it('a GIF moves in the bubble; a photo uses its thumbnail', () => {
    expect(isAnimatedImage('image/gif')).toBe(true);
    expect(isAnimatedImage('image/jpeg')).toBe(false);
    expect(isAnimatedImage(undefined)).toBe(false);
  });
});
