import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Polygon } from 'react-native-svg';
import { fieldGeoMapOf, type FieldGeo } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** OpenStreetMap asks every app to say who it is; a generic client gets blocked. */
const TILE_HEADERS = { 'User-Agent': 'Lilachat (https://lilachat.constroad.com)' };
const BOX = { width: 280, height: 160 };
const PIN = 12;
const FILL_OPACITY = 0.18;

/** Where a field read from a KML sits (fase 3): the lot's outline filled and the named points. A still map. */
export function FieldGeoMap({ geo, testID }: { geo: FieldGeo; testID?: string }) {
  const colors = useColores();
  const map = fieldGeoMapOf(geo, BOX);
  const outline = map.outline.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <View testID={testID} className="mt-2 overflow-hidden rounded-lg border border-outline/20 bg-surface-variant" style={{ width: BOX.width, height: BOX.height }}>
      {map.tiles.map((tile) => (
        <Image key={tile.url} source={{ uri: tile.url, headers: TILE_HEADERS }} recyclingKey={tile.url} transition={120} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <Svg pointerEvents="none" width={BOX.width} height={BOX.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        {outline ? <Polygon points={outline} fill={colors.primary} fillOpacity={FILL_OPACITY} stroke={colors.primary} strokeWidth={2} strokeLinejoin="round" /> : null}
      </Svg>
      {map.pins.map((pin, index) => (
        <View key={`${pin.left}-${pin.top}-${index}`} pointerEvents="none" className="absolute flex-row items-center gap-1" style={{ left: pin.left - PIN / 2, top: pin.top - PIN / 2 }}>
          <View className="rounded-full border-2 border-white bg-primary" style={{ width: PIN, height: PIN }} />
          {pin.label ? <Text className="rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80">{pin.label}</Text> : null}
        </View>
      ))}
      <Text className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</Text>
    </View>
  );
}
