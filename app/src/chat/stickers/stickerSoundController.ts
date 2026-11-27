import { shouldReplaySound } from '@lilachat/shared';

/**
 * The sound of a sticker in the chat (José 26/11, design ss-03): it never
 * plays by itself; a tap on its speaker plays it `STICKER_SOUND_PLAYS` times
 * in a row, a second tap stops it, and only one sticker sounds at a time.
 * The player is created on the tap and released when it ends: players kept
 * alive made the app slow (`winkSounds.ts`, 21/10). Pure: the player comes in.
 */
export type LoopPlayer = {
  play: () => void;
  /** Back to the beginning, for the next play. */
  rewind: () => void;
  release: () => void;
};

export type CreateLoopPlayer = (url: string, onFinished: () => void) => LoopPlayer;

type Current = { id: string; player: LoopPlayer; playsDone: number };

export function createStickerSoundController(createPlayer: CreateLoopPlayer, report: (where: string, error: unknown) => void) {
  let current: Current | null = null;
  const listeners = new Set<() => void>();
  const announce = () => listeners.forEach((listener) => listener());

  const release = (player: LoopPlayer) => {
    try {
      player.release();
    } catch (error) {
      report('stickerSound.release', error);
    }
  };

  /** Stops what is sounding (only `id`'s, when given). */
  const stop = (id?: string) => {
    if (!current || (id !== undefined && current.id !== id)) return;
    const { player } = current;
    current = null;
    release(player);
    announce();
  };

  const finished = (id: string) => {
    if (current?.id !== id) return;
    current.playsDone += 1;
    if (!shouldReplaySound(current.playsDone)) return stop(id);
    try {
      current.player.rewind();
      current.player.play();
    } catch (error) {
      report('stickerSound.replay', error);
      stop(id);
    }
  };

  const start = (id: string, url: string) => {
    stop();
    try {
      const player = createPlayer(url, () => finished(id));
      current = { id, player, playsDone: 0 };
      player.play();
    } catch (error) {
      report('stickerSound.play', error);
      stop();
      return;
    }
    announce();
  };

  /** The speaker's tap: plays this sticker's sound (stopping any other), or stops it. */
  const toggle = (id: string, url: string) => (current?.id === id ? stop(id) : start(id, url));

  return {
    toggle,
    stop,
    playingId: (): string | null => current?.id ?? null,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => void listeners.delete(listener);
    },
  };
}

export type StickerSoundController = ReturnType<typeof createStickerSoundController>;

/** The sound's key for a message: the same in the chat, a channel row and a thread, so one at a time holds everywhere. */
export const stickerSoundKey = (message: { chatId: string; seq: number }): string => `${message.chatId}:${message.seq}`;
