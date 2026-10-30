import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import { MapPin } from 'lucide-react-native';
import { mapTilesFor, type SharedLocation } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** OpenStreetMap asks every app to say who it is; a generic client gets blocked. */
const TILE_HEADERS = { 'User-Agent': 'Lilachat (https://lilachat.constroad.com)' };
const PIN = 30;

/**
 * A small still map of a point (pending 11): the OpenStreetMap tiles around
 * it, the pin in the middle and, when known, the accuracy circle. No map SDK
 * and no paid service; the attribution OpenStreetMap asks for goes in a corner.
 */
export function MapSnippet(props: { location: SharedLocation; width: number; height: number; zoom?: number; testID?: string }) {
  const colors = useColores();
  const map = mapTilesFor(props.location, { width: props.width, height: props.height }, props.zoom);
  const radius = Math.min(map.accuracyRadius, Math.max(props.width, props.height));
  return (
    <View testID={props.testID} className="overflow-hidden bg-surface-variant" style={{ width: props.width, height: props.height }}>
      {map.tiles.map((tile) => (
        <Image key={tile.url} source={{ uri: tile.url, headers: TILE_HEADERS }} recyclingKey={tile.url} transition={120} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      {radius > 6 ? (
        <View pointerEvents="none" className="absolute rounded-full border border-primary/60 bg-primary/15" style={{ left: map.pin.left - radius, top: map.pin.top - radius, width: radius * 2, height: radius * 2 }} />
      ) : null}
      <View pointerEvents="none" className="absolute" style={{ left: map.pin.left - PIN / 2, top: map.pin.top - PIN }}>
        <MapPin size={PIN} color="white" fill={colors.primary} strokeWidth={1.5} />
      </View>
      <Text className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</Text>
    </View>
  );
}
