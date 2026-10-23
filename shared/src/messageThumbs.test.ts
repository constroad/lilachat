import { describe, expect, it } from 'vitest';
import { listThumbPath, winkTileUrl } from './messageThumbs.js';

describe('message thumbnails (pending 57)', () => {
  it('a sticker, a photo and a GIF give their small image; a video, its frame', () => {
    // Act / Assert
    expect(listThumbPath({ kind: 'sticker', media: { url: '/files/s.webp', mime: 'image/webp' } })).toBe('/files/s.webp');
    expect(listThumbPath({ kind: 'image', media: { url: '/files/p.jpg', thumbUrl: '/files/p-thumb.jpg', mime: 'image/jpeg' } })).toBe('/files/p-thumb.jpg');
    expect(listThumbPath({ kind: 'image', media: { url: '/files/g.gif', mime: 'image/gif' } })).toBe('/files/g.gif');
    expect(listThumbPath({ kind: 'video', media: { url: '/files/v.mp4', thumbUrl: '/files/v.jpg', mime: 'video/mp4' } })).toBe('/files/v.jpg');
  });

  it('nothing for a deleted message, text, audio or a file without a preview', () => {
    // Act / Assert
    expect(listThumbPath({ kind: 'sticker', deletedAt: '2026-10-22', media: { url: '/files/s.webp', mime: 'image/webp' } })).toBeUndefined();
    expect(listThumbPath({ kind: 'text' })).toBeUndefined();
    expect(listThumbPath({ kind: 'audio', media: { url: '/files/a.m4a', mime: 'audio/mp4' } })).toBeUndefined();
    expect(listThumbPath({ kind: 'file', media: { url: '/files/x.zip', mime: 'application/zip' } })).toBeUndefined();
    expect(listThumbPath({ kind: 'video', media: { url: '/files/v.mp4', mime: 'video/mp4' } })).toBeUndefined();
  });

  it('a character wink has its tile on the web; the balloon uses its own; an emoji wink has none', () => {
    // Act / Assert
    expect(winkTileUrl('panda')).toBe('https://lilachat.constroad.com/guinos/panda-tile.webp');
    expect(winkTileUrl('balloon')).toBe('https://lilachat.constroad.com/guinos/balloon-tile.webp');
    expect(winkTileUrl('hearts')).toBeUndefined();
    expect(winkTileUrl('nope')).toBeUndefined();
    expect(winkTileUrl(undefined)).toBeUndefined();
    expect(winkTileUrl('panda', '')).toBe('/guinos/panda-tile.webp');
  });
});
