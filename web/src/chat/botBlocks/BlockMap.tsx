import { useContext, useEffect, useRef, useState } from 'react';
import type { BotBlock } from '@lilachat/shared';
import { InVisitCardContext } from '../../spaces/visits/visitActionContext';
import { LocationCardWeb } from '../LocationCardWeb';
import { RouteMapWeb } from './RouteMapWeb';

/**
 * A card's place (José via agentes 09/11): the chat's location card, a still map; a click opens the
 * full one. With a route (Portal 13/11, visits), the points joined by a dotted line.
 */
/** A visit card's map (lv01): as wide as the card, the place apart and the points numbered. */
function VisitMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  const [width, setWidth] = useState(0);
  const frame = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const node = frame.current;
    if (!node) return;
    setWidth(Math.round(node.clientWidth));
    if (typeof ResizeObserver === 'undefined') return;
    const observer = new ResizeObserver(() => setWidth(Math.round(node.clientWidth)));
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
  return (
    <div ref={frame} data-testid="bloque-mapa" className="w-full">
      <RouteMapWeb points={block.points ?? []} place={{ lat: block.lat, lng: block.lng }} box={{ width: width || VISIT_MAP_FALLBACK_WIDTH, height: VISIT_MAP_HEIGHT }} />
    </div>
  );
}
const VISIT_MAP_HEIGHT = 170;
const VISIT_MAP_FALLBACK_WIDTH = 320;

export function BlockMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  // A visit card (lv01): the place and its points on the map; «Abrir croquis» is the card's own button.
  const inVisit = useContext(InVisitCardContext);
  if (inVisit) return <VisitMap block={block} />;
  const route = block.points;
  return (
    <div data-testid="bloque-mapa" className="flex flex-col gap-1">
      {block.label ? <p className="break-words text-[13px] font-semibold">{block.label}</p> : null}
      {route && route.length > 1 ? (
        <RouteMapWeb points={route} />
      ) : (
        <LocationCardWeb location={{ lat: block.lat, lng: block.lng, ...(block.precisionM !== undefined ? { accuracy: block.precisionM } : {}) }} mio={false} />
      )}
    </div>
  );
}
