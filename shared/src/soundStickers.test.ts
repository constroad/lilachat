import { describe, expect, it } from 'vitest';
import {
  clipWindowOf,
  parseStickerSound,
  shouldReplaySound,
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
