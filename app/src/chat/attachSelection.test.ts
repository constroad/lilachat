import { describe, expect, it } from 'vitest';
import { mediaTypeOf, toggleSelection, toPickedPhoto } from './attachSelection';
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
