import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { AudioStatus } from 'expo-audio';

type Listener = (status: Partial<AudioStatus>) => void;
const players: { source: string; listener: Listener | null; play: ReturnType<typeof vi.fn>; setPlaybackRate: ReturnType<typeof vi.fn> }[] = [];

vi.mock('expo-audio', () => ({
  createAudioPlayer: (source: string) => {
    const player = {
      source,
      listener: null as Listener | null,
      play: vi.fn(),
      pause: vi.fn(),
      seekTo: vi.fn(async () => undefined),
      setPlaybackRate: vi.fn(),
      setActiveForLockScreen: vi.fn(),
      addListener(_event: string, listener: Listener) {
        player.listener = listener;
        return { remove: () => undefined };
      },
    };
    players.push(player);
    return player;
  },
  setAudioModeAsync: async () => undefined,
}));
vi.mock('./notaDeVozMotor', () => ({ tomarElAudio: vi.fn(), soltarElAudio: vi.fn() }));
vi.mock('./audioMode', () => ({ playbackAudioMode: () => ({}) }));
vi.mock('./releasePlayer', () => ({ releasePlayer: vi.fn() }));
vi.mock('../ui/reportarError', () => ({ reportarError: vi.fn() }));

const { playVoiceNote, setVoiceNoteQueue, stopVoiceNote } = await import('./voicePlayer');

const note = { id: 'c1:1', url: 'file:///1.m4a', authorName: 'Ana', durationS: 10, rate: 1.5, startShare: null };
const finish = () => players.at(-1)?.listener?.({ isLoaded: true, duration: 10, currentTime: 10, playing: false, didJustFinish: true });

/** José, 04/11: voice notes in a row play one after the other, like WhatsApp. */
describe('voice notes in a row', () => {
  beforeEach(() => {
    players.length = 0;
    stopVoiceNote();
    setVoiceNoteQueue(() => null);
  });

  it('the next note starts when one ends, at the speed it was playing', () => {
    const next = vi.fn(() => ({ id: 'c1:2', url: 'file:///2.m4a', authorName: 'Beto', durationS: 5 }));
    setVoiceNoteQueue(next);
    playVoiceNote(note);

    finish();

    expect(next).toHaveBeenCalledWith('c1:1');
    expect(players.map((player) => player.source)).toEqual(['file:///1.m4a', 'file:///2.m4a']);
    players[1]?.listener?.({ isLoaded: true, duration: 5, currentTime: 0, playing: false, didJustFinish: false });
    expect(players[1]?.setPlaybackRate).toHaveBeenCalledWith(1.5);
    expect(players[1]?.play).toHaveBeenCalled();
  });

  it('with nothing after it, it just ends', () => {
    playVoiceNote(note);

    finish();

    expect(players).toHaveLength(1);
  });

  it('stopping it by hand does not start the next', () => {
    const next = vi.fn(() => null);
    setVoiceNoteQueue(next);
    playVoiceNote(note);

    stopVoiceNote();

    expect(next).not.toHaveBeenCalled();
  });
});
