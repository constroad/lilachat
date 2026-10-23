import { afterEach, describe, expect, it } from 'vitest';
import { pushImageOf } from '../src/pushService.js';

/** Pending 57 (José, 22/10): a sticker or a wink arrived as the word «Sticker», without its image. */
describe('pushImageOf', () => {
  const before = process.env.LILA_PUBLIC_URL;
  afterEach(() => {
    process.env.LILA_PUBLIC_URL = before;
  });

  it('a sticker or photo sends its small image, absolute', () => {
    // Arrange
    process.env.LILA_PUBLIC_URL = 'https://lila.example';
    // Act / Assert
    expect(pushImageOf({ kind: 'sticker', media: { url: '/files/s.webp', mime: 'image/webp' } }, false)).toBe('https://lila.example/files/s.webp');
    expect(pushImageOf({ kind: 'image', media: { url: '/files/p.jpg', thumbUrl: '/files/p-t.jpg', mime: 'image/jpeg' } }, false)).toBe('https://lila.example/files/p-t.jpg');
  });

  it('a wink sends its tile from the web; text sends nothing', () => {
    // Act / Assert
    expect(pushImageOf({ kind: 'guino', wink: 'panda' }, false)).toBe('https://lilachat.constroad.com/guinos/panda-tile.webp');
    expect(pushImageOf({ kind: 'text' }, false)).toBe('');
  });

  it('a secret chat never sends an image', () => {
    // Act / Assert
    expect(pushImageOf({ kind: 'sticker', media: { url: '/files/s.webp', mime: 'image/webp' } }, true)).toBe('');
  });
});
