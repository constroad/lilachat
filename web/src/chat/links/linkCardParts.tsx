import { GalleryHorizontal, Link2, Play } from 'lucide-react';
import { useCallback, useState, type ReactNode } from 'react';
import { platformLabel, videoEmbedFor, type LinkCard, type LinkPlatform, type VideoEmbed } from '@lilachat/shared';
import { VideoEmbedOverlay } from '../VideoEmbedOverlay';

/**
 * The pieces every stored link card shares (designs nl-01, nl-02, nl-03):
 * the 3:4 thumbnail, the platform pill and the date.
 */
const PLATFORM_TINT: Record<LinkPlatform, string> = {
  instagram: 'bg-primary/10 text-primary',
  facebook: 'bg-secondary/10 text-secondary',
  youtube: 'bg-error/10 text-error',
  tiktok: 'bg-on-surface/10 text-on-surface',
  web: 'bg-outline/15 text-on-surface-variant',
};
const PLAYS = new Set<LinkCard['format']>(['reel', 'video', 'short']);
const DATE_DIGITS = 2;

function PlaceholderIcon({ link, size }: { link: LinkCard; size: number }) {
  if (PLAYS.has(link.format)) return <Play size={size} fill="currentColor" aria-hidden />;
  if (link.format === 'post') return <GalleryHorizontal size={size} aria-hidden />;
  return <Link2 size={size} aria-hidden />;
}

/** The thumbnail, or a flat tint of its network with a play for a video (a broken image leaves the tint). */
export function LinkThumb({ link, className, iconSize = 18 }: { link: LinkCard; className: string; iconSize?: number }) {
  const [broken, setBroken] = useState(false);
  const image = broken ? undefined : link.imageUrl;
  return (
    <span data-testid="miniatura-enlace" className={`relative grid shrink-0 place-items-center overflow-hidden rounded-thumb ${PLATFORM_TINT[link.platform]} ${className}`}>
      {image ? <img src={image} alt="" loading="lazy" referrerPolicy="no-referrer" onError={() => setBroken(true)} className="absolute inset-0 h-full w-full object-cover" /> : null}
      <span className={`relative grid place-items-center rounded-full ${image ? 'h-8 w-8 bg-black/55 text-white' : ''}`}>
        <PlaceholderIcon link={link} size={iconSize} />
      </span>
    </span>
  );
}

/** «INSTAGRAM · REEL» on one line, never two (INVENTARIO: Stitch wrapped it). */
export function PlatformPill({ link }: { link: LinkCard }) {
  return <span className="inline-block max-w-full truncate whitespace-nowrap rounded-md bg-on-surface-variant/10 px-1.5 py-0.5 text-[10px] font-bold uppercase text-on-surface-variant">{platformLabel(link)}</span>;
}

/** «17/11», the day it was saved. */
export function dayMonthOf(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '';
  return `${String(date.getDate()).padStart(DATE_DIGITS, '0')}/${String(date.getMonth() + 1).padStart(DATE_DIGITS, '0')}`;
}

/** Who posted it, or the site when the network did not say. */
export function authorOf(link: LinkCard): string {
  if (link.author) return link.author;
  try {
    return new URL(link.url).hostname.replace(/^www\./, '');
  } catch {
    return link.url;
  }
}

/** The line under the author: what the post says, or why there is nothing to say. */
export function summaryOf(link: LinkCard): string {
  if (link.status === 'unreadable') return 'La red no lo muestra sin iniciar sesión';
  if (link.status === 'pending') return 'Lila lo está leyendo…';
  if (link.commentBait) return `El post no trae contenido: solo pide comentar ${link.commentBait}`;
  return link.text ?? '';
}

/** Opening a link: a supported video plays over the chat (pending 6); anything else, a new tab. */
export function useLinkPlayer(): { open: (url: string) => void; overlay: ReactNode } {
  const [playing, setPlaying] = useState<{ video: VideoEmbed; url: string } | null>(null);
  const open = useCallback((url: string) => {
    const video = videoEmbedFor(url);
    if (video) setPlaying({ video, url });
    else window.open(url, '_blank', 'noopener,noreferrer');
  }, []);
  const overlay = playing ? <VideoEmbedOverlay video={playing.video} link={playing.url} onClose={() => setPlaying(null)} /> : null;
  return { open, overlay };
}
