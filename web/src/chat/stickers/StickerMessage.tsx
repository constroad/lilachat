import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Volume2, VolumeX } from 'lucide-react';
import { ANIMATED_STICKER_PLAY_MS, lottieUrlOf, stickerHasSound, stickerIsAnimated } from '@lilachat/shared';
import { LottieSticker } from './LottieSticker';
import { startStickerSound, type SoundLoop } from './stickerSoundLoop';
import type { MensajeEnPantalla } from '../types';

/** Side of a sticker in the conversation, like the app (160) and WhatsApp Web. */
const SIDE_IN_CHAT = 160;

/**
 * A sticker on the web (20/10): the image alone, no bubble, with the sender's
 * name in a group. Time and checks go below, like the rest; keeping it or
 * making it a favorite is in the message menu.
 */
export function StickerMessage({ message, url, author, quote }: { message: MensajeEnPantalla; url: string; author: ReactNode; quote?: ReactNode }) {
  const audioUrl = stickerHasSound(message.media) ? message.media?.audioUrl : undefined;
  const sound = useStickerSound(audioUrl);
  const testId = `sticker-${message.clientKey}`;
  return (
    <div className={message.estado === 'fallido' ? 'opacity-70' : ''}>
      {author}
      {/* A sticker sent as a reply shows what it answers above it, as WhatsApp does (20/10). */}
      {quote ? <div className="mb-1 max-w-[260px] rounded-xl border border-outline/15 bg-surface p-1.5 text-on-surface empty:hidden">{quote}</div> : null}
      <div className="relative" style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }}>
        {lottieUrlOf(url) ? (
          <LottieSticker testId={testId} lottieUrl={lottieUrlOf(url)!} webpUrl={url} side={SIDE_IN_CHAT} fallback={<AnimatedSticker testId={testId} url={url} keepPlaying={sound.playing} />} />
        ) : stickerIsAnimated({ url, animated: message.media?.animated }) ? (
          <AnimatedSticker testId={testId} url={url} keepPlaying={sound.playing} />
        ) : (
          <img data-testid={testId} src={url} alt="Sticker" loading="lazy" width={SIDE_IN_CHAT} height={SIDE_IN_CHAT} className="object-contain drop-shadow-sm" style={{ width: SIDE_IN_CHAT, height: SIDE_IN_CHAT }} />
        )}
        {audioUrl ? <SoundButton playing={sound.playing} onToggle={sound.toggle} /> : null}
      </div>
    </div>
  );
}

/** The speaker of a sticker with sound: muted until clicked, never autoplay (José 26/11, design ss-03). */
function useStickerSound(audioUrl: string | undefined) {
  const [playing, setPlaying] = useState(false);
  const loop = useRef<SoundLoop | null>(null);
  // Leaving the chat (or the message going away) stops its sound.
  useEffect(() => () => loop.current?.stop(), []);
  const toggle = () => {
    if (loop.current) return loop.current.stop();
    if (!audioUrl) return;
    setPlaying(true);
    loop.current = startStickerSound(audioUrl, () => {
      loop.current = null;
      setPlaying(false);
    });
  };
  return { playing, toggle };
}

function SoundButton({ playing, onToggle }: { playing: boolean; onToggle: () => void }) {
  const Icon = playing ? Volume2 : VolumeX;
  return (
    <button
      type="button"
      data-testid="sticker-sonido"
      aria-pressed={playing}
      aria-label={playing ? 'Detener el sonido' : 'Escuchar el sticker'}
      title={playing ? 'Detener el sonido' : 'Escuchar el sticker'}
      onClick={onToggle}
      className={`absolute -right-1 bottom-1 grid h-9 w-9 place-items-center rounded-full shadow-md transition-colors ${playing ? 'border-2 border-primary bg-surface text-primary' : 'bg-on-surface/70 text-surface hover:bg-on-surface/85'}`}
    >
      <Icon size={17} />
    </button>
  );
}

/**
 * An animated sticker (backlog 31) plays for a while and stops on the frame it
 * was on, like WhatsApp; a click plays it again. A browser cannot pause an
 * animated image: the frame is copied to a canvas laid over it.
 */
function AnimatedSticker({ testId, url, keepPlaying = false }: { testId: string; url: string; keepPlaying?: boolean }) {
  const image = useRef<HTMLImageElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  // While its sound plays, it moves from its first frame and does not freeze (José 26/11).
  useEffect(() => {
    if (!keepPlaying) return;
    setStopped(false);
    setRound((before) => before + 1);
  }, [keepPlaying]);
  useEffect(() => {
    if (keepPlaying) return;
    const timer = window.setTimeout(() => {
      const canvas = still.current;
      // An image that did not load (broken) cannot be copied: it is left as it is.
      if (!canvas || !image.current?.complete || !image.current.naturalWidth) return;
      canvas.getContext('2d')?.drawImage(image.current, 0, 0, canvas.width, canvas.height);
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [round, keepPlaying]);
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
