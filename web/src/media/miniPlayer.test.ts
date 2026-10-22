import { describe, expect, it, vi } from 'vitest';
import { closeMiniPlayer, miniPlayerVideo, openMiniPlayer, subscribeMiniPlayer } from './miniPlayer';

describe('miniPlayer (pending 14)', () => {
  it('a video goes to the mini player with where it was, and whoever listens hears it', () => {
    // Arrange
    const listener = vi.fn();
    const stop = subscribeMiniPlayer(listener);
    // Act
    openMiniPlayer({ url: 'https://x/v.mp4', poster: 'https://x/t.jpg', startAt: 12.5, title: 'Video de Ana' });
    // Assert
    expect(miniPlayerVideo()).toEqual({ url: 'https://x/v.mp4', poster: 'https://x/t.jpg', startAt: 12.5, title: 'Video de Ana' });
    expect(listener).toHaveBeenCalledTimes(1);
    stop();
    closeMiniPlayer();
  });

  it('closing it leaves nothing playing', () => {
    openMiniPlayer({ url: 'https://x/v.mp4', startAt: 0, title: 'Video' });
    closeMiniPlayer();
    expect(miniPlayerVideo()).toBeNull();
  });

  it('a negative or broken time starts from the beginning', () => {
    openMiniPlayer({ url: 'https://x/v.mp4', startAt: Number.NaN, title: 'Video' });
    expect(miniPlayerVideo()?.startAt).toBe(0);
    closeMiniPlayer();
  });
});
