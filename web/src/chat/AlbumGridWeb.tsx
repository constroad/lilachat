import { useState } from 'react';
import { ChevronLeft, ChevronRight, Play } from 'lucide-react';
import type { MensajeEnPantalla } from './types';

/**
 * Several photos or videos sent together, as one card (pending 12, design
 * `r148-album`): arrows on the sides, «2/5» on top, the dots below, and a
 * click opens the viewer on that photo. Another page's caption shows on it;
 * the first one's goes under the card like any photo.
 */
export function AlbumCarouselWeb(props: { items: readonly MensajeEnPantalla[]; onOpen: (message: MensajeEnPantalla) => void }) {
  const { items } = props;
  const [page, setPage] = useState(0);
  const current = items[page] ?? items[0]!;
  const media = current.media;
  const go = (step: number) => setPage((was) => Math.max(0, Math.min(items.length - 1, was + step)));
  const arrow = 'absolute top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full bg-black/45 text-white hover:bg-black/60';
  return (
    <div data-testid={`album-${items[0]!.seq}`} className="relative mb-1 overflow-hidden rounded-lg bg-black">
      <button type="button" data-testid={`album-foto-${current.seq}`} onClick={() => props.onOpen(current)} className="relative block w-full">
        <img src={media?.thumbUrl || media?.url} alt={current.body ?? 'Foto'} className="max-h-72 w-full object-cover" style={{ aspectRatio: media?.width && media.height ? `${media.width} / ${media.height}` : '4 / 3' }} />
        {media?.mime?.startsWith('video/') ? (
          <span className="absolute inset-0 grid place-items-center"><span className="grid h-12 w-12 place-items-center rounded-full bg-black/50 text-white"><Play size={22} fill="currentColor" /></span></span>
        ) : null}
      </button>
      <span data-testid={`album-contador-${items[0]!.seq}`} className="pointer-events-none absolute right-2 top-2 rounded-full bg-black/55 px-2.5 py-0.5 text-[12px] font-semibold text-white">
        {page + 1}/{items.length}
      </span>
      {page > 0 ? <button type="button" aria-label="Foto anterior" onClick={() => go(-1)} className={`${arrow} left-2`}><ChevronLeft size={18} /></button> : null}
      {page < items.length - 1 ? <button type="button" aria-label="Foto siguiente" data-testid="album-siguiente" onClick={() => go(1)} className={`${arrow} right-2`}><ChevronRight size={18} /></button> : null}
      {page > 0 && current.body ? <p className="pointer-events-none absolute inset-x-0 bottom-6 truncate bg-black/45 px-3 py-1 text-[13px] text-white">{current.body}</p> : null}
      <div className="flex h-6 items-center justify-center gap-1.5 bg-black/20">
        {items.map((item, index) => (
          <button key={item.seq} type="button" aria-label={`Foto ${index + 1}`} onClick={() => setPage(index)} className={`rounded-full ${index === page ? 'h-2 w-2 bg-white' : 'h-1.5 w-1.5 bg-white/60'}`} />
        ))}
      </div>
    </div>
  );
}
