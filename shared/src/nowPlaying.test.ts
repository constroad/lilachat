import { describe, expect, it } from 'vitest';
import { nowPlayingLabel, nowPlayingProgress, showsNowPlayingBar, type NowPlaying } from './nowPlaying.js';

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
