import { ExternalLink, MapPin } from 'lucide-react';
import { accuracyLabel, locationMapLink, mapTilesFor, type SharedLocation } from '@lilachat/shared';

const MAP = { width: 260, height: 140 };
const PIN = 30;

/**
 * A location shared in the chat (pending 11, design `r152-ubicacion`): a
 * still map from the OpenStreetMap tiles with the pin in the middle, the
 * accuracy and «Abrir en el mapa». The web shows it; sending one is the
 * phone's (WhatsApp Web does not send locations either).
 */
export function LocationCardWeb({ location, mio }: { location: SharedLocation; mio: boolean }) {
  const map = mapTilesFor(location, MAP);
  const link = locationMapLink(location);
  const radius = Math.min(map.accuracyRadius, MAP.width);
  return (
    <div data-testid="tarjeta-ubicacion" className="mb-1 w-[260px]">
      <a href={link} target="_blank" rel="noopener noreferrer" aria-label="Abrir la ubicación en el mapa" className="relative block overflow-hidden rounded-lg bg-background" style={MAP}>
        {map.tiles.map((tile) => (
          <img key={tile.url} src={tile.url} alt="" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
        ))}
        {radius > 6 ? <span className="absolute rounded-full border border-primary/60 bg-primary/15" style={{ left: map.pin.left - radius, top: map.pin.top - radius, width: radius * 2, height: radius * 2 }} /> : null}
        <span data-testid="pin-ubicacion" className="absolute text-primary" style={{ left: map.pin.left - PIN / 2, top: map.pin.top - PIN }}>
          <MapPin size={PIN} fill="currentColor" stroke="white" strokeWidth={1.5} />
        </span>
        <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
      </a>
      <p className="mt-2 text-[14px] font-semibold">Ubicación</p>
      {location.accuracy !== undefined ? <p className="text-[12px] opacity-75">{accuracyLabel(location.accuracy)}</p> : null}
      <a data-testid="btn-abrir-mapa" href={link} target="_blank" rel="noopener noreferrer" className={`mt-2 flex h-9 items-center justify-center gap-1.5 rounded-lg border text-[13px] font-semibold ${mio ? 'border-white/30' : 'border-primary/25 bg-primary/[0.06] text-primary'}`}>
        Abrir en el mapa <ExternalLink size={14} />
      </a>
    </div>
  );
}
