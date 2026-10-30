import { MapPin } from 'lucide-react';
import { mapTilesFor, type SharedLocation } from '@lilachat/shared';

const PIN = 30;

/** The OpenStreetMap tiles around a point with the pin in the middle (pending 11/12): the card and the big map. */
export function TileMapWeb(props: { location: SharedLocation; width: number; height: number; zoom?: number }) {
  const map = mapTilesFor(props.location, { width: props.width, height: props.height }, props.zoom);
  const radius = Math.min(map.accuracyRadius, Math.max(props.width, props.height));
  return (
    <span className="relative block overflow-hidden bg-background" style={{ width: props.width, height: props.height }}>
      {map.tiles.map((tile) => (
        <img key={tile.url} src={tile.url} alt="" loading="lazy" draggable={false} className="absolute max-w-none" style={{ left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      {radius > 6 ? <span className="absolute rounded-full border border-primary/60 bg-primary/15" style={{ left: map.pin.left - radius, top: map.pin.top - radius, width: radius * 2, height: radius * 2 }} /> : null}
      <span data-testid="pin-ubicacion" className="absolute text-primary" style={{ left: map.pin.left - PIN / 2, top: map.pin.top - PIN }}>
        <MapPin size={PIN} fill="currentColor" stroke="white" strokeWidth={1.5} />
      </span>
      <span className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</span>
    </span>
  );
}
