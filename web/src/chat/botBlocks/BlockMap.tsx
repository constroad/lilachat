import type { BotBlock } from '@lilachat/shared';
import { LocationCardWeb } from '../LocationCardWeb';

/** A card's place (José via agentes 09/11): the chat's location card, a still map; a click opens the full one. */
export function BlockMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  return (
    <div data-testid="bloque-mapa" className="flex flex-col gap-1">
      {block.label ? <p className="line-clamp-2 text-[13px] font-semibold">{block.label}</p> : null}
      <LocationCardWeb location={{ lat: block.lat, lng: block.lng, ...(block.precisionM !== undefined ? { accuracy: block.precisionM } : {}) }} mio={false} />
    </div>
  );
}
