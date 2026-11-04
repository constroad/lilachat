import { describe, expect, it } from 'vitest';
import { nextVoiceMessage, nowPlayingLabel, nowPlayingProgress, showsNowPlayingBar, type NowPlaying } from './nowPlaying.js';

const playing: NowPlaying = { id: 'c1:12', chatId: 'c1', authorName: 'Ana Torres', playing: true, currentS: 24.4, durationS: 72, rate: 1.5, loaded: true };

/** Backlog 34 (José, 21/10; design `a-02-audio-en-curso`): a voice note keeps playing outside its chat, with a bar on top. */
describe('now playing', () => {
  it('the bar shows outside the note\'s chat while a note is in the session, playing or paused (also paused at the start)', () => {
    expect(showsNowPlayingBar(playing, null)).toBe(true);
    expect(showsNowPlayingBar(playing, 'c2')).toBe(true);
    expect(showsNowPlayingBar(playing, 'c1')).toBe(false);
    expect(showsNowPlayingBar({ ...playing, playing: false, currentS: 0 }, null)).toBe(true);
    expect(showsNowPlayingBar(null, null)).toBe(false);
  });

  it('«Nota de voz · 0:24 de 1:12» and how far it went', () => {
    expect(nowPlayingLabel(playing)).toBe('Nota de voz · 0:24 de 1:12');
    expect(nowPlayingProgress(playing)).toBeCloseTo(24.4 / 72);
    expect(nowPlayingProgress({ ...playing, durationS: 0 })).toBe(0);
    expect(nowPlayingProgress({ ...playing, currentS: 99 })).toBe(1);
  });
});

/** José, 04/11: «cuando hay varios audios seguidos deberia de poder seguir el siguiete audio al terminar el anterior […] como lo hace whatsapp». */
describe('the next voice note', () => {
  const voice = (seq: number) => ({ seq, media: { url: `https://x/${seq}.m4a`, mime: 'audio/mp4' } });
  const text = (seq: number) => ({ seq });

  it('the very next message plays when it is a voice note too', () => {
    expect(nextVoiceMessage([voice(1), voice(2), voice(3)], 'c1:1', 'c1')?.seq).toBe(2);
  });

  it('a text in between ends the run, and so does the last note', () => {
    expect(nextVoiceMessage([voice(1), text(2), voice(3)], 'c1:1', 'c1')).toBeNull();
    expect(nextVoiceMessage([voice(1), voice(2)], 'c1:2', 'c1')).toBeNull();
  });

  it('follows the seq, not the order of the list (a list drawn newest first)', () => {
    expect(nextVoiceMessage([voice(9), voice(5), voice(4)], 'c1:4', 'c1')?.seq).toBe(5);
  });

  it('a gap in the seq is no message: the thread replies left out of the chat do not end the run', () => {
    expect(nextVoiceMessage([voice(4), voice(7)], 'c1:4', 'c1')?.seq).toBe(7);
  });

  it('a row still sending has no seq and does not count', () => {
    expect(nextVoiceMessage([voice(1), { media: { url: 'file:///a.m4a', mime: 'audio/mp4' } }, voice(2)], 'c1:1', 'c1')?.seq).toBe(2);
  });

  it('a note out of this list has no next: it is another chat, or a thread of this one', () => {
    expect(nextVoiceMessage([voice(1), voice(2)], 'c2:1', 'c1')).toBeNull();
    expect(nextVoiceMessage([voice(1), voice(3)], 'c1:2', 'c1')).toBeNull();
  });

  it('a note without its file yet does not play', () => {
    expect(nextVoiceMessage([voice(1), { seq: 2, media: { mime: 'audio/mp4' } }], 'c1:1', 'c1')).toBeNull();
  });

  it('a photo is not a voice note', () => {
    expect(nextVoiceMessage([voice(1), { seq: 2, media: { url: 'https://x/2.jpg', mime: 'image/jpeg' } }], 'c1:1', 'c1')).toBeNull();
  });
});
