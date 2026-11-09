import { Text, View } from 'react-native';
import type { BotBlock } from '@lilachat/shared';
import { LocationCard } from '../location/LocationCard';

/** A card's place (José via agentes 09/11): the chat's location card, a still map; a tap opens the full one. */
export function BlockMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  return (
    <View testID="bloque-mapa" className="gap-1">
      {block.label ? <Text numberOfLines={2} className="text-[13px] font-semibold text-on-surface">{block.label}</Text> : null}
      <LocationCard location={{ lat: block.lat, lng: block.lng, ...(block.precisionM !== undefined ? { accuracy: block.precisionM } : {}) }} mine={false} />
    </View>
  );
}
