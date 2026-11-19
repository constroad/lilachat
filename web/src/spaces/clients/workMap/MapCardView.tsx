import { X } from 'lucide-react';
import type { MapCard, MapCardStatus, ViewableFile } from '@lilachat/shared';

export const PILL_CLASS = { error: 'border-error/30 bg-error/10 text-error', ok: 'border-en-linea/30 bg-en-linea/10 text-en-linea' } as const;

export function StatusPill(props: { status: MapCardStatus }) {
  return <span className={`shrink-0 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${PILL_CLASS[props.status.tone]}`}>{props.status.label}</span>;
}

function Thumbnails(props: { photos: ViewableFile[]; onPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void }) {
  return (
    <div className="mt-2 flex flex-wrap gap-1.5">
      {props.photos.map((photo, index) => (
        <button key={photo.url} type="button" data-testid={`tarjeta-foto-${index}`} aria-label={`Ver ${photo.name}`} onClick={() => props.onPhoto?.(photo, props.photos)} className="h-14 w-14 overflow-hidden rounded-lg border border-outline/20 bg-surface-variant">
          <img src={photo.thumbUrl ?? photo.url} alt="" loading="lazy" className="h-full w-full object-cover" />
        </button>
      ))}
    </div>
  );
}

/**
 * The small card of a drawing or an observation over the map (José 19/11): name, type, note,
 * size and the nearest drawings; an observation adds its state, dates and photos. A drawing adds
 * the observations at its same point with their photos (José 19/11: the patches' photos).
 */
export function MapCardView(props: { card: MapCard; onClose?: () => void; onPhoto?: (photo: ViewableFile, all: ViewableFile[]) => void }) {
  const { card } = props;
  return (
    <div data-testid={`tarjeta-${card.kind}-${card.id}`} className="w-[260px] rounded-xl border border-outline/20 bg-surface p-3 text-left text-on-surface shadow-lg">
      <div className="flex items-start gap-2">
        <div className="min-w-0 flex-1">
          <p className="line-clamp-4 text-[14px] font-bold leading-snug">{card.title}</p>
          {card.type ? <p className="text-[12px] text-on-surface-variant">{card.type}</p> : null}
        </div>
        {card.status ? <StatusPill status={card.status} /> : null}
        {props.onClose ? <button type="button" data-testid="tarjeta-cerrar" aria-label="Cerrar" onClick={props.onClose} className="-mr-1 -mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg text-on-surface-variant hover:bg-background"><X size={16} /></button> : null}
      </div>
      {card.note ? <p className="mt-1.5 text-[13px] text-on-surface">{card.note}</p> : null}
      {card.size ? <p data-testid="tarjeta-tamano" className="mt-1.5 font-mono text-[12px] font-semibold text-on-surface">{card.size}</p> : null}
      {card.dates.map((line) => <p key={line} className="mt-1 text-[12px] text-on-surface-variant">{line}</p>)}
      {card.near.length ? (
        <ul data-testid="tarjeta-cerca" className="mt-2 space-y-0.5 border-t border-outline/15 pt-2 text-[12px] text-on-surface-variant">
          {card.near.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      {card.observations.length ? (
        <ul data-testid="tarjeta-observaciones" className="mt-2 space-y-0.5 border-t border-outline/15 pt-2 text-[12px] font-semibold text-on-surface">
          {card.observations.map((line) => <li key={line}>{line}</li>)}
        </ul>
      ) : null}
      {card.photos.length ? <Thumbnails photos={card.photos} onPhoto={props.onPhoto} /> : null}
    </div>
  );
}
