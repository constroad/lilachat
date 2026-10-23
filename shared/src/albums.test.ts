import { describe, expect, it } from 'vitest';
import { albumGrid, albumLayout, isAlbumId, newAlbumId } from './albums.js';

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

describe('the album as a grid, like WhatsApp (pending 81, José 23/10)', () => {
  it('two side by side, three as one big and two small, four as a 2×2', () => {
    expect(albumGrid(2)).toEqual([
      { index: 0, x: 0, y: 0, w: 0.5, h: 1 },
      { index: 1, x: 0.5, y: 0, w: 0.5, h: 1 },
    ]);
    expect(albumGrid(3)).toEqual([
      { index: 0, x: 0, y: 0, w: 1, h: 0.5 },
      { index: 1, x: 0, y: 0.5, w: 0.5, h: 0.5 },
      { index: 2, x: 0.5, y: 0.5, w: 0.5, h: 0.5 },
    ]);
    expect(albumGrid(4).map((tile) => [tile.x, tile.y, tile.more])).toEqual([[0, 0, undefined], [0.5, 0, undefined], [0, 0.5, undefined], [0.5, 0.5, undefined]]);
  });

  it('five or more show four, and the fourth says how many more', () => {
    expect(albumGrid(9)).toHaveLength(4);
    expect(albumGrid(9)[3]).toEqual({ index: 3, x: 0.5, y: 0.5, w: 0.5, h: 0.5, more: 5 });
    expect(albumGrid(5)[3]!.more).toBe(1);
  });

  it('less than two is not an album', () => {
    expect(albumGrid(1)).toEqual([]);
    expect(albumGrid(0)).toEqual([]);
  });
});
