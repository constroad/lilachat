import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Polyline } from 'react-native-svg';
import { routeTilesFor, type RoutePoint } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** OpenStreetMap asks every app to say who it is; a generic client gets blocked. */
const TILE_HEADERS = { 'User-Agent': 'Lilachat (https://lilachat.constroad.com)' };
const BOX = { width: 260, height: 160 };
const DOT = 18;

/**
 * A route on a card (Portal 13/11, visits: lv01). The OpenStreetMap tiles that fit every point,
 * a dotted line in the order they came, and each point with its label (or its number without one).
 */
export function RouteMap(props: { points: readonly RoutePoint[] }) {
  const colors = useColores();
  const map = routeTilesFor(props.points, BOX);
  const line = map.points.map((point) => `${point.left},${point.top}`).join(' ');
  return (
    <View testID="mapa-ruta" className="overflow-hidden rounded-lg bg-surface-variant" style={{ width: BOX.width, height: BOX.height }}>
      {map.tiles.map((tile) => (
        <Image key={tile.url} source={{ uri: tile.url, headers: TILE_HEADERS }} recyclingKey={tile.url} transition={120} style={{ position: 'absolute', left: tile.left, top: tile.top, width: 256, height: 256 }} />
      ))}
      <Svg pointerEvents="none" width={BOX.width} height={BOX.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Polyline points={line} fill="none" stroke={colors.primary} strokeWidth={2.5} strokeDasharray="6 5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {map.points.map((point, index) => (
        <View key={`${point.left}-${point.top}-${index}`} testID={`punto-ruta-${index + 1}`} pointerEvents="none" className="absolute flex-row items-center gap-1" style={{ left: point.left - DOT / 2, top: point.top - DOT / 2 }}>
          <View className="items-center justify-center rounded-full border-2 border-white bg-primary" style={{ width: DOT, height: DOT }}>
            {point.label ? null : <Text className="text-[10px] font-bold text-on-primary">{index + 1}</Text>}
          </View>
          {point.label ? <Text className="rounded bg-white/90 px-1 text-[10px] font-semibold text-black/80">{point.label}</Text> : null}
        </View>
      ))}
      <Text className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</Text>
    </View>
  );
}
