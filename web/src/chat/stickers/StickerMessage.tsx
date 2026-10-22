import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ANIMATED_STICKER_PLAY_MS, stickerIsAnimated } from '@lilachat/shared';
import type { MensajeEnPantalla } from '../types';

/** Side of a sticker in the conversation, like the app (160) and WhatsApp Web. */
const SIDE_IN_CHAT = 160;

/**
 * A sticker on the web (20/10): the image alone, no bubble, with the sender's
 * name in a group. Time and checks go below, like the rest; keeping it or
 * making it a favorite is in the message menu.
 */
export function StickerMessage({ message, url, author, quote }: { message: MensajeEnPantalla; url: string; author: ReactNode; quote?: ReactNode }) {
  return (
    <div className={message.estado === 'fallido' ? 'opacity-70' : ''}>
      {author}
      {/* A sticker sent as a reply shows what it answers above it, as WhatsApp does (20/10). */}
      {quote ? <div className="mb-1 max-w-[260px] rounded-xl border border-outline/15 bg-surface p-1.5 text-on-surface empty:hidden">{quote}</div> : null}
      {stickerIsAnimated({ url, animated: message.media?.animated }) ? (
        <AnimatedSticker testId={`sticker-${message.clientKey}`} url={url} />
      ) : (
        <img data-testid={`sticker-${message.clientKey}`} src={url} alt="Sticker" loading="lazy" width={SIDE_IN_CHAT} height={SIDE_IN_CHAT} className="object-contain drop-shadow-sm" style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }} />
      )}
    </div>
  );
}

/**
 * An animated sticker (backlog 31) plays for a while and stops on the frame it
 * was on, like WhatsApp; a click plays it again. A browser cannot pause an
 * animated image: the frame is copied to a canvas laid over it.
 */
function AnimatedSticker({ testId, url }: { testId: string; url: string }) {
  const image = useRef<HTMLImageElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = still.current;
      // An image that did not load (broken) cannot be copied: it is left as it is.
      if (!canvas || !image.current?.complete || !image.current.naturalWidth) return;
      canvas.getContext('2d')?.drawImage(image.current, 0, 0, canvas.width, canvas.height);
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [round]);
  const replay = () => {
    if (!stopped) return;
    setStopped(false);
    setRound((before) => before + 1);
  };
  return (
    <button type="button" aria-label={stopped ? 'Reproducir el sticker' : 'Sticker'} onClick={replay} className="relative block" style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }}>
      {/* A new key restarts the animation from its first frame. */}
      <img key={round} ref={image} data-testid={testId} src={url} alt="Sticker" width={SIDE_IN_CHAT} height={SIDE_IN_CHAT} className={`object-contain drop-shadow-sm ${stopped ? 'invisible' : ''}`} style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }} />
      <canvas ref={still} width={SIDE_IN_CHAT * 2} height={SIDE_IN_CHAT * 2} className={`absolute inset-0 drop-shadow-sm ${stopped ? '' : 'hidden'}`} style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }} />
    </button>
  );
}
