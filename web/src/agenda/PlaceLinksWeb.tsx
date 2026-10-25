import { MapPin, Navigation } from 'lucide-react';
import { placeLinks } from '@lilachat/shared';

const LINK = 'inline-flex min-h-[32px] items-center gap-1 rounded-lg bg-background px-2.5 text-[12px] font-medium text-primary hover:bg-primary/10';

/**
 * Where a reminder happens (José 25/10): the place and two ways to go — Google Maps or Waze — the
 * web's version of the app's «¿Maps o Waze?». They open in another tab without handing over the origin.
 */
export function PlaceLinksWeb({ location }: { location: string | undefined }) {
  const links = placeLinks(location);
  if (!links) return null;
  return (
    <div data-testid="ubicacion-del-recordatorio" className="mt-2 flex flex-wrap items-center gap-x-2 gap-y-1">
      <span className="flex min-w-0 items-center gap-1 text-[13px] text-on-surface">
        <MapPin size={14} className="shrink-0 text-on-surface-variant" />
        <span className="break-words">{location}</span>
      </span>
      <a href={links.maps} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Google Maps" className={LINK}>
        <Navigation size={12} /> Maps
      </a>
      <a href={links.waze} target="_blank" rel="noopener noreferrer" aria-label="Abrir en Waze" className={LINK}>
        <Navigation size={12} /> Waze
      </a>
    </div>
  );
}
