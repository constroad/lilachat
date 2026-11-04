import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { playVoiceNote, resetVoicePlayerForTests, setVoiceNoteQueue, stopVoiceNote } from './voicePlayer';

const note = { id: 'c1:1', chatId: 'c1', url: 'https://x/1.m4a', authorName: 'Ana', durationS: 10, rate: 1.5, startShare: null };

/** José, 04/11: audios seguidos, uno detrás del otro, como WhatsApp. */
describe('voice notes in a row (web)', () => {
  let played: HTMLMediaElement[];

  beforeEach(() => {
    played = [];
    resetVoicePlayerForTests();
    vi.spyOn(HTMLMediaElement.prototype, 'play').mockImplementation(async function (this: HTMLMediaElement) {
      played.push(this);
    });
    vi.spyOn(HTMLMediaElement.prototype, 'pause').mockImplementation(() => undefined);
  });
  afterEach(() => vi.restoreAllMocks());

  const finish = () => played.at(-1)?.dispatchEvent(new Event('ended'));

  it('the next note starts when one ends, at the speed it was playing', () => {
    const next = vi.fn(() => ({ id: 'c1:2', chatId: 'c1', url: 'https://x/2.m4a', authorName: 'Beto', durationS: 5 }));
    setVoiceNoteQueue(next);
    playVoiceNote(note);

    finish();

    expect(next).toHaveBeenCalledWith('c1:1');
    expect(played).toHaveLength(2);
    expect(played[1]?.src).toBe('https://x/2.m4a');
    expect(played[1]?.playbackRate).toBe(1.5);
  });

  it('with nothing after it, it just ends', () => {
    setVoiceNoteQueue(() => null);
    playVoiceNote(note);

    finish();

    expect(played).toHaveLength(1);
  });

  it('stopping it by hand does not start the next', () => {
    const next = vi.fn(() => null);
    setVoiceNoteQueue(next);
    playVoiceNote(note);

    stopVoiceNote();

    expect(next).not.toHaveBeenCalled();
  });
});
