import { shouldReplaySound } from '@lilachat/shared';

/** What the loop needs of an `<audio>` (a fake one in the tests). */
export type SoundElement = { play: () => Promise<void>; pause: () => void; currentTime: number; onended: ((event: Event) => void) | null };
export type SoundLoop = { stop: () => void };

/** Only one sticker sounds at a time in the whole page. */
let current: SoundLoop | null = null;

const createAudio = (url: string): SoundElement => new Audio(url);

/**
 * A tap on a sticker's speaker (José 26/11, design ss-03): its sound plays
 * `STICKER_SOUND_PLAYS` times in a row, like WhatsApp. Another sound sticker
 * that starts stops this one; `onEnd` runs once, whether it ended or was stopped.
 */
export function startStickerSound(url: string, onEnd: () => void, makeAudio: (url: string) => SoundElement = createAudio): SoundLoop {
  current?.stop();
  const audio = makeAudio(url);
  let playsDone = 0;
  let finished = false;
  const loop: SoundLoop = {
    stop: () => {
      if (finished) return;
      finished = true;
      audio.onended = null;
      audio.pause();
      if (current === loop) current = null;
      onEnd();
    },
  };
  const playOnce = () => {
    audio.currentTime = 0;
    audio.play().catch((error: unknown) => {
      console.warn('[stickers] sound did not play:', error instanceof Error ? error.message : error);
      loop.stop();
    });
  };
  audio.onended = () => {
    playsDone += 1;
    if (shouldReplaySound(playsDone)) playOnce();
    else loop.stop();
  };
  current = loop;
  playOnce();
  return loop;
}

/** Stops whatever sticker is sounding (leaving the chat, the tests). */
export function stopStickerSound(): void {
  current?.stop();
}
