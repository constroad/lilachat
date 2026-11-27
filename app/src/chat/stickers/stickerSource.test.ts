import { describe, expect, it } from 'vitest';
import { chatGifCacheName, chatGifClip, chatGifRefusal, clipMimeOf, GIF_STICKER_WINDOW, initialSoundOf, initialTrimOf, isGifClip, stickerSourceKind } from './stickerSource';

/** José 26/11 (design sc-01a): one «Crear» tile; what was picked decides the editor. */
describe('stickerSourceKind', () => {
  it('sends a video to the clip editor, even when the picker does not know its type', () => {
    // Arrange
    const typed = { uri: 'file:///a.mp4', type: 'video', mimeType: 'video/mp4' };
    const untyped = { uri: 'file:///b', type: 'video', mimeType: null };
    // Act & Assert
    expect(stickerSourceKind(typed)).toBe('clip');
    expect(stickerSourceKind(untyped)).toBe('clip');
  });

  it('sends a GIF to the clip editor by its type or by its name', () => {
    expect(stickerSourceKind({ uri: 'file:///x', type: 'image', mimeType: 'image/gif' })).toBe('clip');
    expect(stickerSourceKind({ uri: 'file:///x', type: 'image', mimeType: null, fileName: 'risa.GIF' })).toBe('clip');
    expect(stickerSourceKind({ uri: 'file:///cache/risa.gif', type: 'image' })).toBe('clip');
  });

  it('sends any other image to the photo editor', () => {
    expect(stickerSourceKind({ uri: 'file:///a.jpg', type: 'image', mimeType: 'image/jpeg' })).toBe('photo');
    expect(stickerSourceKind({ uri: 'file:///a.webp', type: 'image', mimeType: 'image/webp', fileName: 'a.webp' })).toBe('photo');
    expect(stickerSourceKind({ uri: 'file:///unknown' })).toBe('photo');
  });
});

describe('clipMimeOf', () => {
  it('names the clip type the upload sends', () => {
    expect(clipMimeOf({ uri: 'file:///a', mimeType: 'video/quicktime' })).toBe('video/quicktime');
    expect(clipMimeOf({ uri: 'file:///a', type: 'video' })).toBe('video/mp4');
    expect(clipMimeOf({ uri: 'file:///a.gif' })).toBe('image/gif');
    expect(clipMimeOf({ uri: 'file:///a.png', mimeType: 'image/png' })).toBeNull();
  });
});

/** expo-video cannot play a GIF: it is taken whole from its start (the server clamps it to its length). */
describe('the GIF window', () => {
  it('takes a GIF from 0 to 6 s, without asking its length', () => {
    expect(initialTrimOf({ mime: 'image/gif' })).toEqual({ startMs: 0, endMs: 6_000 });
    expect(GIF_STICKER_WINDOW).toEqual({ startMs: 0, endMs: 6_000 });
  });

  it('keeps the trim of a video as before', () => {
    expect(initialTrimOf({ mime: 'video/mp4', durationMs: 12_000 })).toEqual({ startMs: 0, endMs: 6_000 });
    expect(initialTrimOf({ mime: 'video/mp4', durationMs: 2_500 })).toEqual({ startMs: 0, endMs: 2_500 });
    expect(initialTrimOf({ mime: 'video/mp4' })).toBeNull();
  });

  it('tells a GIF clip from a video one', () => {
    expect(isGifClip({ mime: 'image/gif' })).toBe(true);
    expect(isGifClip({ mime: 'video/mp4' })).toBe(false);
  });
});

describe('initialSoundOf', () => {
  it('starts a video with its own sound and a GIF with none', () => {
    expect(initialSoundOf('video/mp4')).toEqual({ kind: 'original' });
    expect(initialSoundOf('image/gif')).toEqual({ kind: 'none' });
  });
});

/** A GIF of a chat opens the same editor (José 26/11): downloaded first, never from a secret chat. */
describe('a GIF of a chat', () => {
  it('refuses a GIF without address or one of a secret chat (already decrypted on the phone)', () => {
    expect(chatGifRefusal('')).toBe('No se encontró el GIF.');
    expect(chatGifRefusal('file:///data/secret.gif')).toBe('Un GIF de un chat secreto no se puede convertir en sticker.');
    expect(chatGifRefusal('https://lilachat.test/media/a.gif')).toBeNull();
  });

  it('caches each GIF under its own name and uploads it as a GIF', () => {
    expect(chatGifCacheName('c1', 9)).toBe('sticker-gif-c1-9.gif');
    expect(chatGifClip('file:///cache/sticker-gif-c1-9.gif')).toEqual({ uri: 'file:///cache/sticker-gif-c1-9.gif', name: 'sticker.gif', mime: 'image/gif' });
  });
});
