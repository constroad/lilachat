import { ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { fitVideo, type VideoEmbed } from '@lilachat/shared';

/** Room for the bar on top and a margin around the video (px). */
const CHROME = { width: 48, height: 120 };

const roomFor = () => ({ width: window.innerWidth - CHROME.width, height: window.innerHeight - CHROME.height });

/**
 * A YouTube, TikTok, Instagram or Facebook video played over the chat with
 * the site's own player (pending 6), like WhatsApp Web. Escape or the X
 * closes it; «Abrir en …» goes to the site in a new tab.
 */
export function VideoEmbedOverlay({ video, link, onClose }: { video: VideoEmbed; link: string; onClose: () => void }) {
  const [room, setRoom] = useState(roomFor);
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => event.key === 'Escape' && onClose();
    const onResize = () => setRoom(roomFor());
    window.addEventListener('keydown', onKey);
    window.addEventListener('resize', onResize);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', onResize);
    };
  }, [onClose]);
  const size = fitVideo(video.aspect, room);
  return createPortal(
    <div data-testid="reproductor-video" role="dialog" aria-label={`Video de ${video.label}`} className="fixed inset-0 z-50 flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center gap-2 px-3 py-2 text-white" onClick={(event) => event.stopPropagation()}>
        <button type="button" data-testid="btn-cerrar-video" aria-label="Cerrar el video" onClick={onClose} className="grid h-11 w-11 place-items-center rounded-full hover:bg-white/10">
          <X size={22} />
        </button>
        <span className="flex-1 text-[15px] font-semibold">{video.label}</span>
        <a data-testid="btn-abrir-video-afuera" href={link} target="_blank" rel="noopener noreferrer" className="flex h-10 items-center gap-1.5 rounded-full px-3 text-[13px] font-semibold hover:bg-white/10">
          <ExternalLink size={16} /> Abrir en {video.label}
        </a>
      </div>
      <div className="flex flex-1 items-center justify-center">
        <iframe
          title={`Video de ${video.label}`}
          src={video.embedUrl}
          width={size.width}
          height={size.height}
          allow="autoplay; encrypted-media; picture-in-picture; fullscreen"
          allowFullScreen
          referrerPolicy="strict-origin-when-cross-origin"
          className="rounded-lg border-0 bg-black"
          onClick={(event) => event.stopPropagation()}
        />
      </div>
    </div>,
    document.body,
  );
}
