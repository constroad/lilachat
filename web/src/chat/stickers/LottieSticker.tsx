import { useEffect, useRef, useState, type ReactNode } from 'react';
import type { AnimationItem } from 'lottie-web';
import { ANIMATED_STICKER_PLAY_MS } from '@lilachat/shared';
import { playLottieSticker } from './lottiePlayer';

type LoadState = 'loading' | 'playing' | 'failed';

/**
 * A sticker of the animated pack as Lottie (José 11/11): vector and 60 fps,
 * like Telegram's. It plays for a while and stops where it was, like WhatsApp;
 * a click plays it again. While it loads its WebP shows still under it; if it
 * cannot load, `fallback` (the WebP sticker) takes its place.
 */
export function LottieSticker({ testId, lottieUrl, webpUrl, side, fallback }: { testId: string; lottieUrl: string; webpUrl: string; side: number; fallback: ReactNode }) {
  const box = useRef<HTMLDivElement>(null);
  const player = useRef<AnimationItem | null>(null);
  const [state, setState] = useState<LoadState>('loading');
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);

  useEffect(() => {
    let gone = false;
    if (!box.current) return;
    playLottieSticker(box.current, lottieUrl)
      .then((animation) => {
        if (gone) return animation.destroy();
        player.current = animation;
        setState('playing');
      })
      .catch(() => !gone && setState('failed'));
    return () => {
      gone = true;
      player.current?.destroy();
      player.current = null;
    };
  }, [lottieUrl]);

  useEffect(() => {
    if (state !== 'playing') return;
    const timer = window.setTimeout(() => {
      player.current?.pause();
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [state, round]);

  if (state === 'failed') return <>{fallback}</>;
  const replay = () => {
    if (!stopped) return;
    player.current?.play();
    setStopped(false);
    setRound((before) => before + 1);
  };
  return (
    <button type="button" aria-label={stopped ? 'Reproducir el sticker' : 'Sticker'} onClick={replay} className="relative block" style={{ width: side, height: side }}>
      <div ref={box} data-testid={testId} data-lottie={state} className="absolute inset-0 drop-shadow-sm" />
      {state === 'loading' ? <img src={webpUrl} alt="" aria-hidden className="absolute inset-0 object-contain" style={{ width: side, height: side }} /> : null}
    </button>
  );
}
