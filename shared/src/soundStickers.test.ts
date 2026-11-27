import { describe, expect, it } from 'vitest';
import {
  clipHasOwnSound,
  clipWindowOf,
  isStickerClipMime,
  parseStickerSound,
  shouldReplaySound,
  stickerExportOf,
  stickerOptionsOf,
  soundPresetIdOf,
  stickerSoundLabelOf,
  soundPresetPath,
  STICKER_SOUND_PLAYS,
  STICKER_SOUND_PRESETS,
  stickerHasSound,
  VIDEO_STICKER_MAX_MS,
} from './soundStickers.js';

/** José 26/11: animated stickers with sound, like the ones WhatsApp started rolling out on 25/11. */
describe('clipWindowOf', () => {
  it('keeps a window of up to 6 seconds as asked', () => {
    expect(clipWindowOf(12_000, 18_000)).toEqual({ startMs: 12_000, durationMs: 6_000 });
  });

  it('cuts a longer window at 6 seconds from its start', () => {
    // Arrange: a 10 s selection
    const window = clipWindowOf(2_000, 12_000);
    // Assert
    expect(window).toEqual({ startMs: 2_000, durationMs: VIDEO_STICKER_MAX_MS });
  });

  it('reads numbers sent as form text and rounds them', () => {
    expect(clipWindowOf('1500.6', '4000')).toEqual({ startMs: 1_501, durationMs: 2_499 });
  });

  it('a negative start begins at zero', () => {
    expect(clipWindowOf(-300, 2_000)).toEqual({ startMs: 0, durationMs: 2_000 });
  });

  it('refuses an empty, reversed, too short or unreadable window', () => {
    expect(clipWindowOf(3_000, 3_000)).toBeNull();
    expect(clipWindowOf(5_000, 1_000)).toBeNull();
    expect(clipWindowOf(1_000, 1_200)).toBeNull();
    expect(clipWindowOf('abc', 2_000)).toBeNull();
    expect(clipWindowOf(undefined, undefined)).toBeNull();
  });
});

describe('parseStickerSound', () => {
  it('reads the four kinds of sound', () => {
    expect(parseStickerSound('original')).toEqual({ kind: 'original' });
    expect(parseStickerSound('none')).toEqual({ kind: 'none' });
    expect(parseStickerSound('file')).toEqual({ kind: 'file' });
    expect(parseStickerSound('preset:bocina')).toEqual({ kind: 'preset', presetId: 'bocina' });
  });

  it('an unknown preset or kind is not a sound', () => {
    expect(parseStickerSound('preset:../../etc/passwd')).toBeNull();
    expect(parseStickerSound('preset:')).toBeNull();
    expect(parseStickerSound('loud')).toBeNull();
    expect(parseStickerSound(undefined)).toBeNull();
  });
});

describe('sound presets', () => {
  it('every preset has a Spanish label and our own file under /sonidos', () => {
    expect(STICKER_SOUND_PRESETS.length).toBeGreaterThanOrEqual(4);
    for (const preset of STICKER_SOUND_PRESETS) {
      expect(preset.label.length).toBeGreaterThan(0);
      expect(soundPresetPath(preset.id)).toMatch(/^\/sonidos\/wink-[a-z]+\.mp3$/);
    }
  });

  it('an unknown preset has no path', () => {
    expect(soundPresetPath('nope')).toBeNull();
  });
});

describe('what a sound sticker is cut from', () => {
  it('a video or a GIF; a photo or a document is not', () => {
    expect(isStickerClipMime('video/mp4')).toBe(true);
    expect(isStickerClipMime('video/quicktime')).toBe(true);
    expect(isStickerClipMime('image/gif')).toBe(true);
    expect(isStickerClipMime('image/webp')).toBe(false);
    expect(isStickerClipMime('application/pdf')).toBe(false);
    expect(isStickerClipMime(undefined)).toBe(false);
  });

  it('only a video brings its own sound', () => {
    expect(clipHasOwnSound('video/mp4')).toBe(true);
    expect(clipHasOwnSound('image/gif')).toBe(false);
    expect(clipHasOwnSound(null)).toBe(false);
  });
});

describe('stickerHasSound', () => {
  it('only a sticker whose media carries a sound url', () => {
    expect(stickerHasSound({ audioUrl: 'https://x/files/a.m4a' })).toBe(true);
    expect(stickerHasSound({ audioUrl: '' })).toBe(false);
    expect(stickerHasSound({})).toBe(false);
    expect(stickerHasSound(null)).toBe(false);
  });
});

describe('shouldReplaySound', () => {
  it('plays three times in a row, like WhatsApp, then stops', () => {
    expect(STICKER_SOUND_PLAYS).toBe(3);
    expect(shouldReplaySound(1)).toBe(true);
    expect(shouldReplaySound(2)).toBe(true);
    expect(shouldReplaySound(3)).toBe(false);
  });
});

/** José 27/11: «exportarlo para usarlo en WhatsApp». WhatsApp takes no sound from outside: a video for its «Crear sticker». */
describe('stickerExportOf', () => {
  const animated = { mime: 'image/webp', animated: true };
  it('an animated or sounding picture gives the video and the picture', () => {
    expect(stickerExportOf({ ...animated, audioUrl: 'https://x/a.m4a' })).toEqual({ video: true, picture: true });
    expect(stickerExportOf(animated)).toEqual({ video: true, picture: true });
    expect(stickerExportOf({ mime: 'image/png', audioUrl: 'https://x/a.m4a' })).toEqual({ video: true, picture: true });
  });

  it('a still sticker without sound is only a picture', () => {
    expect(stickerExportOf({ mime: 'image/webp' })).toEqual({ video: false, picture: true });
  });

  it('a pack animation that is not a picture cannot leave', () => {
    expect(stickerExportOf({ mime: 'application/json', animated: true })).toEqual({ video: false, picture: false });
  });
});

describe('stickerSoundLabelOf', () => {
  it('names a preset, says when it is the person own, or that it has none', () => {
    expect(stickerSoundLabelOf({ audioUrl: 'https://lilachat.constroad.com/sonidos/wink-laugh.mp3' })).toBe('Risa');
    expect(stickerSoundLabelOf({ audioUrl: 'https://lilachat.constroad.com/files/x/sticker-sonido.m4a' })).toBe('Sonido propio');
    expect(stickerSoundLabelOf({})).toBeNull();
  });
});

/** The options of a saved sticker (designs sa-01, sa-02, sa-03): the same on the web and the APK. */
describe('stickerOptionsOf', () => {
  const mine = { id: '6739f0c2a1b2c3d4e5f60701', mime: 'image/webp', animated: true, favorite: false };
  it('without sound: «Agregar sonido» first, and export', () => {
    expect(stickerOptionsOf(mine)).toEqual({ sound: 'Agregar sonido', canRemoveSound: false, soundLine: 'Animado · sin sonido', canExport: true, favorite: 'Agregar a Favoritos', canRemove: true });
  });

  it('with sound: change it or take it away, and it says which one', () => {
    const options = stickerOptionsOf({ ...mine, favorite: true, audioUrl: 'https://x/sonidos/wink-laugh.mp3' });
    expect(options).toMatchObject({ sound: 'Cambiar sonido', canRemoveSound: true, soundLine: 'Animado · con sonido · Risa', favorite: 'Quitar de Favoritos' });
  });

  it('a still one says so; a pack one is not «mine» to remove; a pack animation cannot leave', () => {
    expect(stickerOptionsOf({ ...mine, animated: false }).soundLine).toBe('Sin sonido');
    expect(stickerOptionsOf({ ...mine, id: 'pack:lila-1/dog' }).canRemove).toBe(false);
    expect(stickerOptionsOf({ ...mine, mime: 'application/json' }).canExport).toBe(false);
  });
});

describe('soundPresetIdOf', () => {
  it('the preset behind a sound url, or null for one of the person', () => {
    expect(soundPresetIdOf('https://x/sonidos/wink-horn.mp3')).toBe('bocina');
    expect(soundPresetIdOf('https://x/files/sticker-sonido.m4a')).toBeNull();
    expect(soundPresetIdOf(undefined)).toBeNull();
  });
});
