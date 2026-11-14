import type { BotBlock } from '@lilachat/shared';
import { LocationCardWeb } from '../LocationCardWeb';
import { RouteMapWeb } from './RouteMapWeb';

/**
 * A card's place (José via agentes 09/11): the chat's location card, a still map; a click opens the
 * full one. With a route (Portal 13/11, visits), the points joined by a dotted line.
 */
export function BlockMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  return (
    <div data-testid="bloque-mapa" className="flex flex-col gap-1">
      {block.label ? <p className="break-words text-[13px] font-semibold">{block.label}</p> : null}
      {block.points && block.points.length > 1 ? (
        <RouteMapWeb points={block.points} />
      ) : (
        <LocationCardWeb location={{ lat: block.lat, lng: block.lng, ...(block.precisionM !== undefined ? { accuracy: block.precisionM } : {}) }} mio={false} />
      )}
    </div>
  );
}
