import { describe, expect, it, vi } from 'vitest';
import { STICKER_SOUND_PLAYS } from '@lilachat/shared';
import { createStickerSoundController, type LoopPlayer } from './stickerSoundController';

type FakePlayer = LoopPlayer & { url: string; finish: () => void; plays: number; rewinds: number; released: boolean };

function setup(options: { failOn?: 'create' | 'rewind'; replay?: (playsDone: number) => boolean } = {}) {
  const players: FakePlayer[] = [];
  const report = vi.fn();
  const controller = createStickerSoundController((url, onFinished) => {
    if (options.failOn === 'create') throw new Error('no player');
    const player: FakePlayer = {
      url,
      plays: 0,
      rewinds: 0,
      released: false,
      play: () => void (player.plays += 1),
      rewind: () => {
        if (options.failOn === 'rewind') throw new Error('gone');
        player.rewinds += 1;
      },
      release: () => void (player.released = true),
      finish: onFinished,
    };
    players.push(player);
    return player;
  }, report, options.replay ? { replay: options.replay } : undefined);
  return { controller, players, report };
}

/** José 26/11 (design ss-03): muted until tapped; a tap plays it three times; another tap stops it. */
describe('createStickerSoundController', () => {
  it('plays the sound three times in a row and then lets the player go', () => {
    const { controller, players } = setup();
    controller.toggle('m1', 'https://x/a.m4a');
    for (let done = 1; done < STICKER_SOUND_PLAYS; done += 1) players[0]!.finish();
    expect(players[0]!.plays).toBe(STICKER_SOUND_PLAYS);
    expect(controller.playingId()).toBe('m1');

    players[0]!.finish();

    expect(players[0]!.plays).toBe(STICKER_SOUND_PLAYS);
    expect(players[0]!.rewinds).toBe(STICKER_SOUND_PLAYS - 1);
    expect(players[0]!.released).toBe(true);
    expect(controller.playingId()).toBeNull();
  });

  it('stops on a second tap', () => {
    const { controller, players } = setup();
    controller.toggle('m1', 'https://x/a.m4a');
    controller.toggle('m1', 'https://x/a.m4a');
    expect(players[0]!.released).toBe(true);
    expect(controller.playingId()).toBeNull();
  });

  it('lets only one sticker sound: another one stops the first', () => {
    const { controller, players } = setup();
    controller.toggle('m1', 'https://x/a.m4a');
    controller.toggle('m2', 'https://x/b.m4a');
    expect(players[0]!.released).toBe(true);
    expect(controller.playingId()).toBe('m2');
    players[0]!.finish();
    expect(players[1]!.plays).toBe(1);
  });

  it('stops only the sticker asked for when it leaves the screen', () => {
    const { controller, players } = setup();
    controller.toggle('m1', 'https://x/a.m4a');
    controller.stop('m2');
    expect(controller.playingId()).toBe('m1');
    controller.stop('m1');
    expect(players[0]!.released).toBe(true);
  });

  it('tells its listeners when what sounds changes', () => {
    const { controller } = setup();
    const listener = vi.fn();
    const unsubscribe = controller.subscribe(listener);
    controller.toggle('m1', 'https://x/a.m4a');
    controller.stop();
    unsubscribe();
    controller.toggle('m1', 'https://x/a.m4a');
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('never throws: a player that fails is reported and nothing stays playing', () => {
    const failing = setup({ failOn: 'create' });
    expect(() => failing.controller.toggle('m1', 'https://x/a.m4a')).not.toThrow();
    expect(failing.controller.playingId()).toBeNull();
    expect(failing.report).toHaveBeenCalledWith('stickerSound.play', expect.any(Error));

    const broken = setup({ failOn: 'rewind' });
    broken.controller.toggle('m1', 'https://x/a.m4a');
    broken.players[0]!.finish();
    expect(broken.controller.playingId()).toBeNull();
    expect(broken.players[0]!.released).toBe(true);
  });
});

/** José 27/11: «el botón de play es recontra inestable… no tiene ningún feedback». A sheet's listen plays once and says when it ends. */
describe('createStickerSoundController as a preview', () => {
  it('plays a preview once and tells its listeners when it ends, so the button goes back to «Escuchar»', () => {
    const { controller, players } = setup({ replay: () => false });
    const listener = vi.fn();
    controller.subscribe(listener);
    controller.toggle('file:///voz.m4a', 'file:///voz.m4a');
    expect(controller.playingId()).toBe('file:///voz.m4a');
    players[0]!.finish();
    expect(players[0]!.plays).toBe(1);
    expect(players[0]!.released).toBe(true);
    expect(controller.playingId()).toBeNull();
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it('play() starts the same sound again from the beginning instead of stopping it', () => {
    const { controller, players } = setup({ replay: () => false });
    controller.play('a', 'file:///a.m4a');
    controller.play('a', 'file:///a.m4a');
    expect(players).toHaveLength(2);
    expect(players[0]!.released).toBe(true);
    expect(controller.playingId()).toBe('a');
  });
});

/** José 26/11: chats, channels and threads draw the same message; one key makes «one at a time» hold across them. */
describe('stickerSoundKey', () => {
  it('names a message by its chat and its number', async () => {
    const { stickerSoundKey } = await import('./stickerSoundController');
    expect(stickerSoundKey({ chatId: 'c1', seq: 42 })).toBe('c1:42');
    expect(stickerSoundKey({ chatId: 'c1', seq: 42 })).toBe(stickerSoundKey({ chatId: 'c1', seq: 42 }));
    expect(stickerSoundKey({ chatId: 'c2', seq: 42 })).not.toBe(stickerSoundKey({ chatId: 'c1', seq: 42 }));
  });
});
