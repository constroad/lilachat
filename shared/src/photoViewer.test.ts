import { describe, expect, it } from 'vitest';
import { opensInPhotoViewer } from './photoViewer.js';

/** José, 22/10: swiping through the photo viewer showed the stickers too, in the app and on the web. */
describe('photo viewer', () => {
  const photo = { kind: 'image', media: { url: '/a.jpg', mime: 'image/jpeg' } };
  it('photos, GIFs and videos go in; stickers, deleted messages and files do not', () => {
    expect(opensInPhotoViewer(photo)).toBe(true);
    expect(opensInPhotoViewer({ kind: 'image', media: { url: '/a.gif', mime: 'image/gif' } })).toBe(true);
    expect(opensInPhotoViewer({ kind: 'video', media: { url: '/a.mp4', mime: 'video/mp4', thumbUrl: '/t.jpg' } })).toBe(true);
    expect(opensInPhotoViewer({ kind: 'sticker', media: { url: '/s.webp', mime: 'image/webp' } })).toBe(false);
    expect(opensInPhotoViewer({ ...photo, deletedAt: '2026-10-22T10:00:00Z' })).toBe(false);
    expect(opensInPhotoViewer({ kind: 'file', media: { url: '/a.pdf', mime: 'application/pdf' } })).toBe(false);
    expect(opensInPhotoViewer({ kind: 'image' })).toBe(false);
  });

  it('a video without a thumbnail (lila could not make one, QA 22/10) still opens', () => {
    expect(opensInPhotoViewer({ kind: 'video', media: { url: '/a.mp4', mime: 'video/mp4' } })).toBe(true);
  });
});
