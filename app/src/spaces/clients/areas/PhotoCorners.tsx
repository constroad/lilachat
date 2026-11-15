import { useEffect, useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { photoPointOf, photoSideLabel, screenPointOf, type PhotoPoint, type PhotoSide } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const BOX_HEIGHT = 260;
const CORNER_R = 13;
export const MAX_CORNERS = 8;

type Size = { width: number; height: number };

/** The photo's own size, read once from the file. */
function usePhotoSize(uri: string): Size | null {
  const [size, setSize] = useState<Size | null>(null);
  useEffect(() => {
    Image.getSize(uri, (width, height) => setSize({ width, height }), () => setSize(null));
  }, [uri]);
  return size;
}

/**
 * Design la-05: the zone's photo with the corners touched on it, numbered, the
 * shape closed between them and each side's length on it. A touch adds the next
 * corner (up to eight); «Deshacer» takes the last one off.
 */
export function PhotoCorners(props: { uri: string; points: readonly PhotoPoint[]; sides: readonly PhotoSide[]; onTouch: (point: PhotoPoint) => void }) {
  const colors = useColores();
  const photo = usePhotoSize(props.uri);
  const [box, setBox] = useState<Size | null>(null);
  const onLayout = (event: LayoutChangeEvent) => setBox({ width: event.nativeEvent.layout.width, height: BOX_HEIGHT });
  const drawn = box && photo ? props.points.map((point) => screenPointOf(point, box, photo)) : [];
  const touch = (x: number, y: number) => {
    if (!box || !photo || props.points.length >= MAX_CORNERS) return;
    const point = photoPointOf({ x, y }, box, photo);
    if (point) props.onTouch(point);
  };
  return (
    <Pressable testID="foto-esquinas" onLayout={onLayout} onPress={(event) => touch(event.nativeEvent.locationX, event.nativeEvent.locationY)} style={{ height: BOX_HEIGHT }} className="overflow-hidden rounded-xl bg-surface-variant">
      <Image source={{ uri: props.uri }} resizeMode="contain" style={{ width: '100%', height: BOX_HEIGHT }} />
      {box ? (
        <Svg width={box.width} height={BOX_HEIGHT} style={{ position: 'absolute', left: 0, top: 0 }} pointerEvents="none">
          {drawn.length >= 2 ? <Polygon points={drawn.map((point) => `${point.x},${point.y}`).join(' ')} fill={colors.primary} fillOpacity={0.15} stroke={colors.primary} strokeWidth={3} /> : null}
          {props.sides.map((side) => <SideLabel key={side.index} side={side} drawn={drawn} color={colors.primary} />)}
          {drawn.map((point, index) => (
            <Circle key={`c${index}`} cx={point.x} cy={point.y} r={CORNER_R} fill={colors.primary} stroke="white" strokeWidth={2} />
          ))}
          {drawn.map((point, index) => (
            <SvgText key={`n${index}`} x={point.x} y={point.y + 4} fontSize={12} fontWeight="bold" fill="white" textAnchor="middle">{String(index + 1)}</SvgText>
          ))}
        </Svg>
      ) : null}
      {!props.points.length ? <View pointerEvents="none" className="absolute inset-x-0 bottom-2 items-center"><Text className="rounded-full bg-surface px-3 py-1 text-[13px] text-on-surface">Toca la primera esquina</Text></View> : null}
    </Pressable>
  );
}

/** «L1 2,00 m» at the middle of its side. */
function SideLabel(props: { side: PhotoSide; drawn: readonly PhotoPoint[]; color: string }) {
  const from = props.drawn[props.side.index];
  const to = props.drawn[(props.side.index + 1) % props.drawn.length];
  if (!from || !to) return null;
  return <SvgText x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} fontSize={11} fontWeight="bold" fill={props.color} textAnchor="middle">{photoSideLabel(props.side)}</SvgText>;
}
