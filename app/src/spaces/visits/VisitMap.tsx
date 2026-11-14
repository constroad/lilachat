import { useState } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Polyline } from 'react-native-svg';
import { Building2 } from 'lucide-react-native';
import { routeTilesFor, VISIT_MAP_LOOK, visitMapOf, type BotBlock } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

/** OpenStreetMap asks every app to say who it is; a generic client gets blocked. */
const TILE_HEADERS = { 'User-Agent': 'Lilachat (https://lilachat.constroad.com)' };
const TILE = 256;
const PLACE_DOT = 24;
const PLACE_ICON = 13;

/** The visit's place (lv01): a building in the accent and «Lugar» beside it, never a number. */
function PlaceDot({ left, top }: { left: number; top: number }) {
  const colors = useColores();
  return (
    <View testID="mapa-lugar" pointerEvents="none" className="absolute flex-row items-center gap-1" style={{ left: left - PLACE_DOT / 2, top: top - PLACE_DOT / 2 }}>
      <View className="items-center justify-center rounded-full border-2 border-white bg-primary" style={{ width: PLACE_DOT, height: PLACE_DOT }}><Building2 size={PLACE_ICON} color={colors['on-primary']} /></View>
      <Text className="rounded bg-black/80 px-1 text-[9px] font-bold uppercase text-white">Lugar</Text>
    </View>
  );
}

/** One point with its label inside («1», «F»), as in the web's card. */
function PointDot({ left, top, n, index }: { left: number; top: number; n: number | string; index: number }) {
  return (
    <View testID={`punto-ruta-${index + 1}`} pointerEvents="none" className="absolute items-center justify-center rounded-full border-2 border-white bg-primary" style={{ left: left - VISIT_MAP_LOOK.dot / 2, top: top - VISIT_MAP_LOOK.dot / 2, width: VISIT_MAP_LOOK.dot, height: VISIT_MAP_LOOK.dot }}>
      <Text className="text-[10px] font-bold text-on-primary">{n}</Text>
    </View>
  );
}

/** The map drawn once its width is known: the place, the points joined by a fine dotted line, and the GPS badge. */
function VisitMapFrame({ block, width }: { block: Extract<BotBlock, { type: 'map' }>; width: number }) {
  const colors = useColores();
  const visit = visitMapOf(block);
  const box = { width, height: VISIT_MAP_LOOK.height };
  const all = visit.place ? [visit.place, ...visit.points] : visit.points.length ? visit.points : [{ lat: block.lat, lng: block.lng }];
  const map = routeTilesFor(all, box, VISIT_MAP_LOOK.maxZoom);
  const placeAt = visit.place ? map.points[0] : undefined;
  const dots = visit.place ? map.points.slice(1) : visit.points.length ? map.points : [];
  return (
    <>
      {map.tiles.map((tile) => <Image key={tile.url} source={{ uri: tile.url, headers: TILE_HEADERS }} recyclingKey={tile.url} transition={120} style={{ position: 'absolute', left: tile.left, top: tile.top, width: TILE, height: TILE }} />)}
      <Svg pointerEvents="none" width={box.width} height={box.height} style={{ position: 'absolute', left: 0, top: 0 }}>
        <Polyline points={map.points.map((point) => `${point.left},${point.top}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={2} strokeDasharray="1 5" strokeLinecap="round" strokeLinejoin="round" />
      </Svg>
      {placeAt ? <PlaceDot left={placeAt.left} top={placeAt.top} /> : null}
      {dots.map((point, index) => <PointDot key={`${point.left}-${point.top}-${index}`} left={point.left} top={point.top} n={visit.points[index]?.n ?? index + 1} index={index} />)}
      {visit.badge ? (
        <View testID="mapa-gps" className="absolute bottom-1.5 left-1.5 flex-row items-center gap-1 rounded-md bg-white/90 px-1.5 py-0.5">
          <View className="h-1.5 w-1.5 rounded-full bg-en-linea" />
          <Text className="font-mono text-[10px] font-semibold text-black/80">{visit.badge}</Text>
        </View>
      ) : null}
      <Text className="absolute bottom-0 right-0 bg-white/80 px-1 text-[9px] text-black/70">© OpenStreetMap</Text>
    </>
  );
}

/** A visit card's map (lv01): as wide as the card, measured with onLayout (the window lies inside a card). */
export function VisitMap({ block }: { block: Extract<BotBlock, { type: 'map' }> }) {
  const [width, setWidth] = useState(0);
  return (
    <View testID="bloque-mapa" onLayout={(event) => setWidth(Math.round(event.nativeEvent.layout.width))} className="overflow-hidden rounded-lg border border-outline/20 bg-background" style={{ height: VISIT_MAP_LOOK.height }}>
      {width ? <VisitMapFrame block={block} width={width} /> : null}
    </View>
  );
}
