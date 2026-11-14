import { useContext } from 'react';
import { Text, View } from 'react-native';
import type { BotBlock } from '@lilachat/shared';
import { LocationCard } from '../location/LocationCard';
import { InVisitCardContext } from '../../spaces/visits/visitCardContext';
import { VisitMap } from '../../spaces/visits/VisitMap';
import { RouteMap } from './RouteMap';

/**
 * A card's place (José via agentes 09/11): the chat's location card, a still map; a tap opens the
 * full one. With a route (Portal 13/11, visits), the points joined by a dotted line.
 */
export function BlockMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  // A visit card (lv01): the place and its points; «Abrir croquis» is the card's own button.
  if (useContext(InVisitCardContext)) return <VisitMap block={block} />;
  return (
    <View testID="bloque-mapa" className="gap-1">
      {block.label ? <Text className="text-[13px] font-semibold text-on-surface">{block.label}</Text> : null}
      {block.points && block.points.length > 1 ? (
        <RouteMap points={block.points} />
      ) : (
        <LocationCard location={{ lat: block.lat, lng: block.lng, ...(block.precisionM !== undefined ? { accuracy: block.precisionM } : {}) }} mine={false} />
      )}
    </View>
  );
}
