import { afterEach, describe, expect, it, vi } from 'vitest';
import { STICKER_SOUND_PLAYS } from '@lilachat/shared';
import { startStickerSound, stopStickerSound, type SoundElement } from './stickerSoundLoop';

/** A fake `<audio>`: counts its plays and lets the test end each one. */
function fakeAudio(fails = false) {
  const audio: SoundElement & { plays: number; paused: boolean; end: () => void } = {
    plays: 0,
    paused: true,
    currentTime: 0,
    onended: null,
    play: vi.fn(async () => {
      if (fails) throw new DOMException('blocked', 'NotAllowedError');
      audio.plays += 1;
      audio.paused = false;
    }),
    pause: vi.fn(() => {
      audio.paused = true;
    }),
    end: () => audio.onended?.(new Event('ended')),
  };
  return audio;
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 0));

/** José 26/11 (design ss-03): a tap on the speaker plays the sound three times, like WhatsApp. */
describe('the sound of a sticker', () => {
  afterEach(() => stopStickerSound());

  it('plays three times in a row and then says it ended', async () => {
    const audio = fakeAudio();
    const onEnd = vi.fn();
    startStickerSound('https://storage.test/s.m4a', onEnd, () => audio);
    for (let play = 1; play <= STICKER_SOUND_PLAYS; play += 1) {
      await settle();
      expect(audio.plays).toBe(play);
      expect(onEnd).not.toHaveBeenCalled();
      audio.end();
    }
    await settle();
    expect(audio.plays).toBe(STICKER_SOUND_PLAYS);
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('each play starts from the beginning', async () => {
    const audio = fakeAudio();
    startStickerSound('https://storage.test/s.m4a', vi.fn(), () => audio);
    await settle();
    audio.currentTime = 1.4;
    audio.end();
    expect(audio.currentTime).toBe(0);
  });

  it('a second tap stops it at once, and an ended event after that does nothing', async () => {
    const audio = fakeAudio();
    const onEnd = vi.fn();
    const loop = startStickerSound('https://storage.test/s.m4a', onEnd, () => audio);
    await settle();
    loop.stop();
    expect(audio.paused).toBe(true);
    expect(onEnd).toHaveBeenCalledTimes(1);
    audio.end();
    await settle();
    expect(audio.plays).toBe(1);
    loop.stop();
    expect(onEnd).toHaveBeenCalledTimes(1);
  });

  it('another sound sticker that starts stops the one that was playing', async () => {
    const first = fakeAudio();
    const second = fakeAudio();
    const firstEnded = vi.fn();
    startStickerSound('https://storage.test/a.m4a', firstEnded, () => first);
    await settle();
    startStickerSound('https://storage.test/b.m4a', vi.fn(), () => second);
    await settle();
    expect(first.paused).toBe(true);
    expect(firstEnded).toHaveBeenCalledTimes(1);
    expect(second.plays).toBe(1);
  });

  it('a browser that blocks the play ends it quietly, without an error', async () => {
    const audio = fakeAudio(true);
    const onEnd = vi.fn();
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);
    startStickerSound('https://storage.test/s.m4a', onEnd, () => audio);
    await settle();
    expect(onEnd).toHaveBeenCalledTimes(1);
    warn.mockRestore();
  });
});
