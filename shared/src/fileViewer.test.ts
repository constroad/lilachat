import { describe, expect, it } from 'vitest';
import { galleryOf, mimeOf, openingOf, viewerWhenOf } from './fileViewer.js';

/** José 30/10: Portal's files open in Lilachat's viewer, not in Portal. */
describe('fileViewer', () => {
  it('uses the mime when it says something; otherwise the extension of the link, without its query', () => {
    // Act / Assert
    expect(mimeOf({ url: 'https://lila.constroad.com/files/a', name: 'a', mime: 'image/png' })).toBe('image/png');
    expect(mimeOf({ url: 'https://lila.constroad.com/files/voucher.JPG?v=2', name: 'Comprobante', mime: 'application/octet-stream' })).toBe('image/jpeg');
    expect(mimeOf({ url: 'https://lila.constroad.com/files/guia.pdf', name: 'Guía' })).toBe('application/pdf');
    expect(mimeOf({ url: 'https://lila.constroad.com/files/obra.mp4', name: 'Video' })).toBe('video/mp4');
    expect(mimeOf({ url: 'https://lila.constroad.com/files/planilla', name: 'Planilla' })).toBe('application/octet-stream');
  });

  it('photos and videos open in the gallery, PDFs in the PDF viewer, the rest with another app', () => {
    // Act / Assert
    expect(openingOf('image/heic')).toBe('gallery');
    expect(openingOf('video/quicktime')).toBe('gallery');
    expect(openingOf('application/pdf')).toBe('pdf');
    expect(openingOf('application/vnd.ms-excel')).toBe('other');
  });

  it('the gallery is the photos and videos among the files, in their order', () => {
    // Arrange
    const files = [
      { url: 'https://x/1.jpg', name: '1' },
      { url: 'https://x/plano.pdf', name: 'Plano' },
      { url: 'https://x/2.mp4', name: '2' },
    ];
    // Act / Assert
    expect(galleryOf(files).map((file) => file.name)).toEqual(['1', '2']);
  });
});

/** The viewer's line under the photo: a dispatch's ISO departure reads as a day and an hour, a label stays as it came. */
describe('viewerWhenOf', () => {
  it('formats an ISO moment and keeps a ready label', () => {
    // Act / Assert
    expect(viewerWhenOf('2026-09-10T06:57:00.000Z')).toBe('10 set, 1:57 a. m.');
    expect(viewerWhenOf('CON-IAA · 2.4 MB · 14 set')).toBe('CON-IAA · 2.4 MB · 14 set');
  });
  it('nothing or an impossible date gives an empty line', () => {
    expect(viewerWhenOf(undefined)).toBe('');
    expect(viewerWhenOf('2026-99-99T00:00:00Z')).toBe('');
  });
});
