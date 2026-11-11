import { act, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ANIMATED_STICKER_PLAY_MS } from '@lilachat/shared';
import { LottieSticker } from './LottieSticker';

const lottie = vi.hoisted(() => ({ play: vi.fn() }));
vi.mock('./lottiePlayer', () => ({ playLottieSticker: lottie.play }));

const player = () => ({ pause: vi.fn(), play: vi.fn(), destroy: vi.fn() });
const sticker = (fallback = <span data-testid="webp">webp</span>) => <LottieSticker testId="s1" lottieUrl="/stickers/lila-mov/cone-go.json" webpUrl="/stickers/lila-mov/cone-go.webp" side={160} fallback={fallback} />;

/** José 11/11: the animated pack plays as Lottie, like Telegram; the WebP stays as the fallback. */
describe('LottieSticker', () => {
  // Braces: a hook that returns the mock makes vitest call it again as cleanup.
  beforeEach(() => {
    lottie.play.mockReset();
  });
  afterEach(() => vi.useRealTimers());

  it('shows the still WebP while loading, then plays the Lottie', async () => {
    const animation = player();
    let resolve!: (value: ReturnType<typeof player>) => void;
    lottie.play.mockReturnValue(new Promise((done) => (resolve = done)));
    const { container } = render(sticker());
    expect(container.querySelector('img')?.getAttribute('src')).toBe('/stickers/lila-mov/cone-go.webp');
    await act(async () => resolve(animation));
    expect(screen.getByTestId('s1').dataset.lottie).toBe('playing');
    expect(container.querySelector('img')).toBeNull();
    expect(lottie.play).toHaveBeenCalledWith(screen.getByTestId('s1'), '/stickers/lila-mov/cone-go.json');
  });

  it('stops after a while like WhatsApp, and a click plays it again', async () => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    const animation = player();
    lottie.play.mockResolvedValue(animation);
    render(sticker());
    await act(async () => undefined);
    await act(async () => vi.advanceTimersByTime(ANIMATED_STICKER_PLAY_MS));
    expect(animation.pause).toHaveBeenCalled();
    await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByRole('button', { name: 'Reproducir el sticker' }));
    expect(animation.play).toHaveBeenCalled();
    expect(screen.getByRole('button', { name: 'Sticker' })).toBeInTheDocument();
  });

  it('falls back to the WebP sticker when the Lottie cannot load', async () => {
    lottie.play.mockRejectedValue(new Error('lottie 404'));
    render(sticker());
    await act(async () => undefined);
    expect(screen.getByTestId('webp')).toBeInTheDocument();
  });

  it('frees the player when the bubble leaves', async () => {
    const animation = player();
    lottie.play.mockResolvedValue(animation);
    const { unmount } = render(sticker());
    await act(async () => undefined);
    unmount();
    expect(animation.destroy).toHaveBeenCalled();
  });
});
