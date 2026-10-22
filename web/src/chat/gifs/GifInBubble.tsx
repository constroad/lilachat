import { useEffect, useRef, useState } from 'react';
import { Play } from 'lucide-react';
import { ANIMATED_STICKER_PLAY_MS } from '@lilachat/shared';

/**
 * A GIF in the bubble (backlog 37): it moves for a while and stops on its
 * frame, like the animated stickers; a click on a stopped one plays it again,
 * and on a moving one opens the viewer. A browser cannot pause an animated
 * image, so the frame is copied to a canvas laid over it.
 */
export function GifInBubble(props: { testId: string; url: string; alt: string; width?: number; height?: number; onOpen: () => void }) {
  const image = useRef<HTMLImageElement>(null);
  const still = useRef<HTMLCanvasElement>(null);
  const [stopped, setStopped] = useState(false);
  const [round, setRound] = useState(0);
  useEffect(() => {
    const timer = window.setTimeout(() => {
      const canvas = still.current;
      // An image that did not load (broken) cannot be copied: it is left as it is.
      if (!canvas || !image.current?.complete || !image.current.naturalWidth) return;
      canvas.width = image.current.naturalWidth;
      canvas.height = image.current.naturalHeight;
      canvas.getContext('2d')?.drawImage(image.current, 0, 0, canvas.width, canvas.height);
      setStopped(true);
    }, ANIMATED_STICKER_PLAY_MS);
    return () => window.clearTimeout(timer);
  }, [round]);
  const click = () => {
    if (!stopped) return props.onOpen();
    setStopped(false);
    setRound((before) => before + 1);
  };
  const shape = props.width && props.height ? { aspectRatio: `${props.width} / ${props.height}` } : undefined;
  return (
    <button type="button" data-testid={props.testId} aria-label={stopped ? 'Reproducir el GIF' : 'Ver el GIF'} onClick={click} className="relative mb-1 block w-full overflow-hidden rounded-lg">
      {/* A new key restarts the animation from its first frame. */}
      <img key={round} ref={image} src={props.url} alt={props.alt} className={`max-h-64 w-full object-cover ${stopped ? 'invisible' : ''}`} style={shape} />
      <canvas ref={still} className={`absolute inset-0 h-full w-full object-cover ${stopped ? '' : 'hidden'}`} />
      <span className="absolute bottom-2 left-2 inline-flex items-center gap-1 rounded-md bg-black/55 px-1.5 py-0.5 text-[11px] font-bold text-white">
        {stopped ? <Play size={11} fill="currentColor" /> : null}
        GIF
      </span>
    </button>
  );
}
