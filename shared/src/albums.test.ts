import { describe, expect, it } from 'vitest';
import { albumLayout, isAlbumId, newAlbumId } from './albums.js';

const photo = (seq: number, album?: string, extra: Record<string, unknown> = {}) => ({ seq, senderId: 'ana', kind: 'image', media: { album }, ...extra });

describe('albumLayout (pending 12)', () => {
  it('photos in a row with the same album become one card: the first draws it, the rest draw nothing', () => {
    // Arrange
    const rows = [photo(1), photo(2, 'album1'), photo(3, 'album1'), photo(4, 'album1'), photo(5)];
    // Act
    const layout = albumLayout(rows);
    // Assert
    expect(layout.get(2)).toEqual({ role: 'head', seqs: [2, 3, 4] });
    expect(layout.get(3)).toEqual({ role: 'member', head: 2 });
    expect(layout.get(4)).toEqual({ role: 'member', head: 2 });
    expect(layout.has(1)).toBe(false);
    expect(layout.has(5)).toBe(false);
  });

  it('a lone photo of an album is just a photo', () => {
    expect(albumLayout([photo(1, 'album1'), photo(2)]).size).toBe(0);
  });

  it('another message in between splits the album, and another sender too', () => {
    const layout = albumLayout([photo(1, 'album1'), photo(2, 'album1'), { seq: 3, senderId: 'beto', kind: 'text' }, photo(4, 'album1'), photo(5, 'album1', { senderId: 'beto' })]);
    expect(layout.get(1)).toEqual({ role: 'head', seqs: [1, 2] });
    expect(layout.has(4)).toBe(false);
    expect(layout.has(5)).toBe(false);
  });

  it('a deleted photo leaves the album, and videos count', () => {
    const layout = albumLayout([photo(1, 'album1', { deletedAt: 'x' }), photo(2, 'album1', { kind: 'video' }), photo(3, 'album1')]);
    expect(layout.get(2)).toEqual({ role: 'head', seqs: [2, 3] });
  });
});

describe('album ids', () => {
  it('a new id is valid and two are different', () => {
    const first = newAlbumId(() => 0.5, 1_792_700_000_000);
    expect(isAlbumId(first)).toBe(true);
    expect(newAlbumId(() => 0.25, 1_792_700_000_000)).not.toBe(first);
  });

  it('anything else is not an album id', () => {
    expect(isAlbumId('a b')).toBe(false);
    expect(isAlbumId('x'.repeat(41))).toBe(false);
    expect(isAlbumId(undefined)).toBe(false);
  });
});
