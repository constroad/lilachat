import { useState, type ReactNode } from 'react';
import { Play, Video } from 'lucide-react';
import { duracionDeVoz } from '@lilachat/shared';
import { photoBubbleStyle } from './photoBubbleStyle';
import { AnilloDeSubida } from './AnilloDeSubida';

type PictureMedia = { url: string; thumbUrl?: string; mime?: string; width?: number; height?: number; durationMs?: number; stamped?: boolean };

/**
 * A photo or video filling its bubble, like WhatsApp Web (José 26/11): one
 * width, its own shape, the video's length bottom-left and, without a caption,
 * the time over the picture. A WhatsApp video carries no size: the frame takes
 * the picture's own once it loads.
 */
export function PictureInBubble(props: { testId: string; media: PictureMedia; alt: string; uploading: boolean; progress?: number; onOpen: () => void; overlay?: ReactNode }) {
  const { media } = props;
  const [natural, setNatural] = useState<{ width: number; height: number } | null>(null);
  const frame = photoBubbleStyle(media.width && media.height ? media : { ...media, ...natural });
  const video = Boolean(media.mime?.startsWith('video/'));
  const source = media.thumbUrl || (video ? null : media.url);
  return (
    <button type="button" data-testid={props.testId} onClick={() => !props.uploading && props.onOpen()} className="relative block overflow-hidden rounded-[13px] bg-black/40" style={{ width: frame.width, maxWidth: frame.maxWidth, aspectRatio: frame.aspectRatio }}>
      {source ? (
        <img
          src={source}
          alt={props.alt}
          loading="lazy"
          onLoad={(event) => setNatural({ width: event.currentTarget.naturalWidth, height: event.currentTarget.naturalHeight })}
          className="h-full w-full object-cover"
          style={frame.objectPosition ? { objectPosition: frame.objectPosition } : undefined}
        />
      ) : (
        <span data-testid={`${props.testId}-sin-miniatura`} className="block h-full w-full bg-black" />
      )}
      {props.uploading ? <AnilloDeSubida razon={props.progress} /> : null}
      {video && !props.uploading ? (
        <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white"><Play size={22} fill="currentColor" /></span></span>
      ) : null}
      {video && media.durationMs && !props.overlay ? <MediaShade /> : null}
      {video && media.durationMs ? (
        <span data-testid={`duracion-${props.testId}`} className="absolute bottom-1.5 left-2 flex items-center gap-1 text-[11px] font-medium text-white">
          <Video size={13} aria-hidden />
          {duracionDeVoz(media.durationMs)}
        </span>
      ) : null}
      {props.overlay ? <MediaTimeOverlay>{props.overlay}</MediaTimeOverlay> : null}
    </button>
  );
}

/** The dark fade at the foot of a picture, so white text reads over a bright photo. */
function MediaShade() {
  return <span aria-hidden className="pointer-events-none absolute inset-x-0 bottom-0 h-12 rounded-b-[13px] bg-gradient-to-t from-black/60 to-transparent" />;
}

/** The time and ticks over a captionless photo, video, GIF or album, bottom-right, like WhatsApp. */
export function MediaTimeOverlay(props: { children: ReactNode }) {
  return (
    <>
      <MediaShade />
      <span className="pointer-events-none absolute bottom-1 right-2">{props.children}</span>
    </>
  );
}
