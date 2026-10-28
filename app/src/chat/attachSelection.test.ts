import { describe, expect, it } from 'vitest';
import { appendGalleryPage, documentsToSend, mediaTypeOf, toggleSelection, toPickedPhoto, mediaAccessFrom, MAX_DOCUMENTS_AT_ONCE } from './attachSelection';
import { MAXIMO_DE_FOTOS } from './envioDeFotos';

/** The gallery under the clip (José, 20/10: «WhatsApp and Telegram show my gallery right away»). */
describe('toggleSelection', () => {
  it('adds in tap order and removes on a second tap', () => {
    expect(toggleSelection([], 'a')).toEqual(['a']);
    expect(toggleSelection(['a'], 'b')).toEqual(['a', 'b']);
    expect(toggleSelection(['a', 'b', 'c'], 'b')).toEqual(['a', 'c']);
  });

  it('stops at the same limit as the photo preview', () => {
    const full = Array.from({ length: MAXIMO_DE_FOTOS }, (_, index) => `p${index}`);
    expect(toggleSelection(full, 'extra')).toBe(full);
  });
});

describe('a gallery item to send', () => {
  it('a photo keeps its size and gets an image type from its name', () => {
    expect(toPickedPhoto({ uri: 'file:///DCIM/IMG_1.jpg', filename: 'IMG_1.jpg', width: 4000, height: 3000, mediaType: 'photo' })).toEqual({ uri: 'file:///DCIM/IMG_1.jpg', fileName: 'IMG_1.jpg', mimeType: 'image/jpeg', width: 4000, height: 3000 });
  });

  it('a video goes as video; unknown names fall back to safe types', () => {
    expect(mediaTypeOf('clip.MP4', 'video')).toBe('video/mp4');
    expect(mediaTypeOf('screen.png', 'photo')).toBe('image/png');
    expect(mediaTypeOf('photo.heic', 'photo')).toBe('image/heic');
    expect(mediaTypeOf('noext', 'photo')).toBe('image/jpeg');
    expect(mediaTypeOf('noext', 'video')).toBe('video/mp4');
  });
});

/** José, 20/10: «toco el clip y no están las imágenes y videos, y sí le di acceso» (Android 14 limited access). */
describe('mediaAccessFrom', () => {
  it('full access shows the gallery; limited access says so', () => {
    expect(mediaAccessFrom({ granted: true, canAskAgain: true, accessPrivileges: 'all' })).toBe('granted');
    expect(mediaAccessFrom({ granted: true, canAskAgain: true, accessPrivileges: 'limited' })).toBe('limited');
    expect(mediaAccessFrom({ granted: true, canAskAgain: true })).toBe('granted');
  });

  it('without access: ask again while Android allows it, otherwise the settings', () => {
    expect(mediaAccessFrom({ granted: false, canAskAgain: true })).toBe('ask');
    expect(mediaAccessFrom({ granted: false, canAskAgain: false })).toBe('denied');
  });
});

describe('documentsToSend (pending 112, José 28/10: only one file could be attached)', () => {
  const asset = (name: string, extra: { mimeType?: string; size?: number } = {}) => ({ uri: `file:///cache/${name}`, name, ...extra });

  it('every chosen document goes, in the order chosen, untouched', () => {
    // Act
    const files = documentsToSend([asset('guia.pdf', { mimeType: 'application/pdf', size: 1200 }), asset('foto.jpg', { mimeType: 'image/jpeg', size: 900 })]);
    // Assert
    expect(files).toEqual([
      { uri: 'file:///cache/guia.pdf', fileName: 'guia.pdf', mimeType: 'application/pdf', sizeBytes: 1200, hd: true },
      { uri: 'file:///cache/foto.jpg', fileName: 'foto.jpg', mimeType: 'image/jpeg', sizeBytes: 900, hd: true },
    ]);
  });

  it('an unknown type or size still goes', () => {
    expect(documentsToSend([asset('plano.dwg')])).toEqual([{ uri: 'file:///cache/plano.dwg', fileName: 'plano.dwg', mimeType: 'application/octet-stream', sizeBytes: 0, hd: true }]);
  });

  it('at most MAX_DOCUMENTS_AT_ONCE; none chosen is nothing', () => {
    const many = Array.from({ length: MAX_DOCUMENTS_AT_ONCE + 5 }, (_, index) => asset(`f${index}.pdf`));
    expect(documentsToSend(many)).toHaveLength(MAX_DOCUMENTS_AT_ONCE);
    expect(documentsToSend(undefined)).toEqual([]);
  });
});

describe('appendGalleryPage (pending 113, José 28/10: the gallery showed only some photos)', () => {
  const tile = (id: string) => ({ id });

  it('the next page goes after what is already listed, in the phone order', () => {
    // Arrange
    const shown = [tile('1'), tile('2')];
    // Act
    const next = appendGalleryPage(shown, [tile('3'), tile('4')]);
    // Assert
    expect(next.map((one) => one.id)).toEqual(['1', '2', '3', '4']);
  });

  it('a photo taken while scrolling shifts the pages: a repeated one is not listed twice', () => {
    const next = appendGalleryPage([tile('1'), tile('2')], [tile('2'), tile('3')]);
    expect(next.map((one) => one.id)).toEqual(['1', '2', '3']);
  });

  it('an empty page keeps the same list, so nothing redraws', () => {
    const shown = [tile('1')];
    expect(appendGalleryPage(shown, [])).toBe(shown);
  });
});
