import { useRef, useSyncExternalStore } from 'react';
import { PictureInPicture2, X } from 'lucide-react';
import { closeMiniPlayer, miniPlayerVideo, subscribeMiniPlayer } from './miniPlayer';

const canFloatOutside = (): boolean => typeof document !== 'undefined' && 'pictureInPictureEnabled' in document && document.pictureInPictureEnabled;

/**
 * The floating mini player (pending 14): bottom right on a computer, along the
 * bottom on a phone, over whatever is open but above the composer (in the E2E
 * it covered the send button). «Flotar» hands it to the
 * browser's Picture-in-Picture, which keeps it on top even in another tab.
 */
export function MiniVideoPlayer() {
  const video = useSyncExternalStore(subscribeMiniPlayer, miniPlayerVideo, () => null);
  const element = useRef<HTMLVideoElement>(null);
  if (!video) return null;

  const floatOutside = () => {
    void element.current?.requestPictureInPicture().catch(() => undefined);
  };

  return (
    <div data-testid="mini-reproductor" role="region" aria-label="Mini reproductor" className="fixed inset-x-4 bottom-24 z-50 overflow-hidden rounded-2xl bg-black shadow-2xl sm:left-auto sm:w-[360px]">
      <div className="flex items-center gap-1 px-3 py-1.5 text-white">
        <p className="min-w-0 flex-1 truncate text-[13px]">{video.title}</p>
        {canFloatOutside() ? (
          <button type="button" data-testid="btn-flotar-video" aria-label="Flotar fuera de la pestaña" title="Flotar fuera de la pestaña" onClick={floatOutside} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
            <PictureInPicture2 size={18} />
          </button>
        ) : null}
        <button type="button" data-testid="btn-cerrar-mini-reproductor" aria-label="Cerrar el mini reproductor" onClick={closeMiniPlayer} className="grid h-9 w-9 place-items-center rounded-full hover:bg-white/10">
          <X size={18} />
        </button>
      </div>
      <video
        key={video.url}
        ref={element}
        data-testid="mini-reproductor-video"
        src={video.url}
        poster={video.poster}
        controls
        autoPlay
        playsInline
        onLoadedMetadata={(event) => {
          event.currentTarget.currentTime = video.startAt;
          // A browser that blocks playing on its own leaves the controls to press play.
          void event.currentTarget.play().catch(() => undefined);
        }}
        className="aspect-video w-full bg-black"
      />
    </div>
  );
}
