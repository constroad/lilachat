import { useEffect } from 'react';
import { Text, View } from 'react-native';
import { Image } from 'expo-image';
import Svg, { Defs, Path, Pattern, Rect } from 'react-native-svg';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, { runOnJS, useAnimatedProps, useAnimatedStyle, useSharedValue, type SharedValue } from 'react-native-reanimated';
import type { Layer, Point } from '@lilachat/shared';
import { useColores } from '../../ui/tema';

const CHECKER = 14;
/** Distance (px) at which a moving layer snaps to the center and the guide shows. */
const SNAP = 8;
const BOX_PADDING = 8;
const HANDLE = 22;
const ROTATE_HANDLE_GAP = 26;
/** Minimum pencil step (fraction of the side) so a stroke is not thousands of points. */
const PEN_STEP = 0.004;

const AnimatedPath = Animated.createAnimatedComponent(Path);

export type LayerTransform = { x: number; y: number; scale: number; rotation: number };

/** The checkered background: «this is transparent». */
function Checkers({ width, height }: { width: number; height: number }) {
  return (
    <Svg width={width} height={height} style={{ position: 'absolute' }}>
      <Defs>
        <Pattern id="checkers" width={CHECKER * 2} height={CHECKER * 2} patternUnits="userSpaceOnUse">
          <Rect width={CHECKER * 2} height={CHECKER * 2} fill="#E5E7EB" />
          <Rect width={CHECKER} height={CHECKER} fill="#F3F4F6" />
          <Rect x={CHECKER} y={CHECKER} width={CHECKER} height={CHECKER} fill="#F3F4F6" />
        </Pattern>
      </Defs>
      <Rect width={width} height={height} fill="url(#checkers)" />
    </Svg>
  );
}

const strokePath = (points: Point[], side: number) => points.map((point, index) => `${index ? 'L' : 'M'}${(point.x * side).toFixed(1)} ${(point.y * side).toFixed(1)}`).join(' ');

/** A drawn line: a full-size SVG that does not take touches. */
function StrokeView({ layer, side }: { layer: Layer; side: number }) {
  return (
    <Svg width={side} height={side} style={{ position: 'absolute' }} pointerEvents="none">
      <Path d={strokePath(layer.points ?? [], side)} stroke={layer.color} strokeWidth={(layer.width ?? 0.02) * side} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

type Guides = { vertical: SharedValue<number>; horizontal: SharedValue<number> };

/**
 * Text or emoji: drag to move (snaps to the center), pinch to scale, two
 * fingers to rotate; when selected, a dashed box with a rotation handle on top
 * and a scale handle on the corner (design `s1-app-crear-sticker`).
 */
function LayerView(props: { layer: Layer; side: number; selected: boolean; guides: Guides; onSelect: () => void; onEditText: () => void; onTransform: (change: LayerTransform) => void }) {
  const { layer, side, guides } = props;
  const colors = useColores();
  const x = useSharedValue(layer.x * side);
  const y = useSharedValue(layer.y * side);
  const factor = useSharedValue(1);
  const angle = useSharedValue(layer.rotation);
  const width = useSharedValue(0);
  const height = useSharedValue(0);
  const start = useSharedValue({ x: 0, y: 0, factor: 1, angle: 0, px: 0, py: 0 });
  useEffect(() => {
    x.value = layer.x * side;
    y.value = layer.y * side;
    angle.value = layer.rotation;
    factor.value = 1;
  }, [layer.x, layer.y, layer.rotation, layer.scale, side, x, y, angle, factor]);

  const commit = () => {
    'worklet';
    guides.vertical.value = 0;
    guides.horizontal.value = 0;
    runOnJS(props.onTransform)({ x: x.value / side, y: y.value / side, scale: layer.scale * factor.value, rotation: angle.value });
  };
  const move = Gesture.Pan()
    .onStart(() => {
      start.value = { ...start.value, x: x.value, y: y.value };
      runOnJS(props.onSelect)();
    })
    .onUpdate((event) => {
      const nextX = start.value.x + event.translationX;
      const nextY = start.value.y + event.translationY;
      const nearX = Math.abs(nextX - side / 2) < SNAP;
      const nearY = Math.abs(nextY - side / 2) < SNAP;
      x.value = nearX ? side / 2 : nextX;
      y.value = nearY ? side / 2 : nextY;
      guides.vertical.value = nearX ? 1 : 0;
      guides.horizontal.value = nearY ? 1 : 0;
    })
    .onEnd(commit);
  const pinch = Gesture.Pinch()
    .onStart(() => {
      start.value = { ...start.value, factor: factor.value };
    })
    .onUpdate((event) => {
      factor.value = start.value.factor * event.scale;
    })
    .onEnd(commit);
  const twist = Gesture.Rotation()
    .onStart(() => {
      start.value = { ...start.value, angle: angle.value };
    })
    .onUpdate((event) => {
      angle.value = start.value.angle + event.rotation;
    })
    .onEnd(commit);
  const tap = Gesture.Tap().onEnd(() => runOnJS(props.selected && layer.kind === 'text' ? props.onEditText : props.onSelect)());

  /** A handle drag, in canvas coordinates: from where the handle was to where the finger is, around the center. */
  const handle = (kind: 'rotate' | 'scale', offsetX: () => number, offsetY: () => number) =>
    Gesture.Pan()
      .onStart(() => {
        const cosine = Math.cos(angle.value);
        const sine = Math.sin(angle.value);
        start.value = { x: x.value, y: y.value, factor: factor.value, angle: angle.value, px: x.value + offsetX() * cosine - offsetY() * sine, py: y.value + offsetX() * sine + offsetY() * cosine };
      })
      .onUpdate((event) => {
        const fromX = start.value.px - start.value.x;
        const fromY = start.value.py - start.value.y;
        const toX = fromX + event.translationX;
        const toY = fromY + event.translationY;
        if (kind === 'rotate') angle.value = start.value.angle + Math.atan2(toY, toX) - Math.atan2(fromY, fromX);
        else factor.value = start.value.factor * (Math.hypot(toX, toY) / Math.max(1, Math.hypot(fromX, fromY)));
      })
      .onEnd(commit);
  const halfWidth = () => {
    'worklet';
    return (width.value * factor.value) / 2 + BOX_PADDING;
  };
  const halfHeight = () => {
    'worklet';
    return (height.value * factor.value) / 2 + BOX_PADDING;
  };
  const rotateHandle = handle('rotate', () => { 'worklet'; return 0; }, () => { 'worklet'; return -halfHeight() - ROTATE_HANDLE_GAP; });
  const scaleHandle = handle('scale', halfWidth, halfHeight);

  const bodyStyle = useAnimatedStyle(() => ({
    transform: [{ translateX: x.value - width.value / 2 }, { translateY: y.value - height.value / 2 }, { rotate: `${angle.value}rad` }, { scale: factor.value }],
  }));
  // The shared values are read right here (not through `halfWidth`): Reanimated only re-runs a style for values it sees in its own body.
  const boxStyle = useAnimatedStyle(() => {
    const boxWidth = width.value * factor.value + 2 * BOX_PADDING;
    const boxHeight = height.value * factor.value + 2 * BOX_PADDING;
    return { width: boxWidth, height: boxHeight, transform: [{ translateX: x.value - boxWidth / 2 }, { translateY: y.value - boxHeight / 2 }, { rotate: `${angle.value}rad` }] };
  });
  const isText = layer.kind === 'text';
  return (
    <>
      <GestureDetector gesture={Gesture.Simultaneous(move, pinch, twist, tap)}>
        <Animated.View
          testID={`capa-${layer.kind}`}
          onLayout={(event) => {
            width.value = event.nativeEvent.layout.width;
            height.value = event.nativeEvent.layout.height;
          }}
          style={[{ position: 'absolute', left: 0, top: 0, paddingHorizontal: 4 }, bodyStyle]}
        >
          <Text style={{ fontSize: layer.scale * side, fontWeight: '900', color: layer.color, textShadowColor: isText ? '#000' : 'transparent', textShadowRadius: isText ? 5 : 0, textShadowOffset: { width: 0, height: 1 } }}>{layer.text}</Text>
        </Animated.View>
      </GestureDetector>
      {props.selected ? (
        <Animated.View pointerEvents="box-none" style={[{ position: 'absolute', left: 0, top: 0, borderWidth: 2, borderStyle: 'dashed', borderColor: colors.primary, borderRadius: 6 }, boxStyle]}>
          <GestureDetector gesture={rotateHandle}>
            <View testID="manija-rotar" hitSlop={12} style={{ position: 'absolute', alignSelf: 'center', top: -ROTATE_HANDLE_GAP - HANDLE / 2, width: HANDLE, height: HANDLE, borderRadius: HANDLE / 2, borderWidth: 2.5, borderColor: colors.primary, backgroundColor: 'white' }} />
          </GestureDetector>
          {(['top', 'bottom'] as const).flatMap((vertical) => (['left', 'right'] as const).map((side) => ({ vertical, side }))).map(({ vertical, side: horizontal }) => (
            <GestureDetector key={`${vertical}-${horizontal}`} gesture={vertical === 'bottom' && horizontal === 'right' ? scaleHandle : Gesture.Tap()}>
              <View testID={vertical === 'bottom' && horizontal === 'right' ? 'manija-escalar' : undefined} hitSlop={12} style={{ position: 'absolute', [vertical]: -HANDLE / 2, [horizontal]: -HANDLE / 2, width: HANDLE - 4, height: HANDLE - 4, borderRadius: HANDLE, borderWidth: 2.5, borderColor: colors.primary, backgroundColor: 'white' }} />
            </GestureDetector>
          ))}
        </Animated.View>
      ) : null}
    </>
  );
}

/** The pencil: a finger line drawn live, handed over when the finger lifts. */
function PenOverlay({ side, color, width, onStroke }: { side: number; color: string; width: number; onStroke: (points: Point[]) => void }) {
  const points = useSharedValue<Point[]>([]);
  const path = useSharedValue('');
  const draw = Gesture.Pan()
    .minDistance(0)
    .onBegin((event) => {
      points.value = [{ x: event.x / side, y: event.y / side }];
      path.value = `M${event.x} ${event.y}`;
    })
    .onUpdate((event) => {
      const last = points.value[points.value.length - 1];
      const next = { x: event.x / side, y: event.y / side };
      if (last && Math.hypot(next.x - last.x, next.y - last.y) < PEN_STEP) return;
      points.value = [...points.value, next];
      path.value = `${path.value} L${event.x} ${event.y}`;
    })
    .onFinalize(() => {
      runOnJS(onStroke)(points.value);
      points.value = [];
      path.value = '';
    });
  const animatedProps = useAnimatedProps(() => ({ d: path.value }));
  return (
    <GestureDetector gesture={draw}>
      <View testID="lienzo-lapiz" style={{ position: 'absolute', width: side, height: side }}>
        <Svg width={side} height={side} pointerEvents="none">
          <AnimatedPath animatedProps={animatedProps} stroke={color} strokeWidth={width * side} strokeLinecap="round" strokeLinejoin="round" fill="none" />
        </Svg>
      </View>
    </GestureDetector>
  );
}

/**
 * The editor canvas (design `s1-app-crear-sticker`): a tall checkered card
 * with the square sticker in the middle, the photo, the layers on top and,
 * while moving one, the center guides.
 */
export function StickerCanvas(props: {
  width: number;
  height: number;
  image: string | null;
  layers: Layer[];
  selection: string | null;
  cutoutBadge: boolean;
  pen: { color: string; width: number } | null;
  onSelect: (id: string | null) => void;
  onEditText: (id: string) => void;
  onTransform: (id: string, change: LayerTransform) => void;
  onStroke: (points: Point[]) => void;
}) {
  const side = Math.min(props.width, props.height);
  const colors = useColores();
  const vertical = useSharedValue(0);
  const horizontal = useSharedValue(0);
  const verticalStyle = useAnimatedStyle(() => ({ opacity: vertical.value }));
  const horizontalStyle = useAnimatedStyle(() => ({ opacity: horizontal.value }));
  const deselect = Gesture.Tap().onEnd(() => runOnJS(props.onSelect)(null));
  return (
    <View testID="lienzo-sticker" style={{ width: props.width, height: props.height, borderRadius: 28, overflow: 'hidden' }}>
      <Checkers width={props.width} height={props.height} />
      <GestureDetector gesture={deselect}>
        <View style={{ position: 'absolute', width: props.width, height: props.height }} />
      </GestureDetector>
      <View style={{ position: 'absolute', left: (props.width - side) / 2, top: (props.height - side) / 2, width: side, height: side }}>
        {props.image ? <Image source={{ uri: props.image }} style={{ width: side, height: side }} contentFit="contain" transition={80} pointerEvents="none" /> : null}
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', left: side / 2 - 0.5, top: 0, width: 1, height: side, backgroundColor: colors.primary }, verticalStyle]} />
        <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: side / 2 - 0.5, left: 0, height: 1, width: side, backgroundColor: colors.primary }, horizontalStyle]} />
        {props.layers.map((layer) =>
          layer.kind === 'stroke' ? (
            <StrokeView key={layer.id} layer={layer} side={side} />
          ) : (
            <LayerView
              key={layer.id}
              layer={layer}
              side={side}
              selected={layer.id === props.selection}
              guides={{ vertical, horizontal }}
              onSelect={() => props.onSelect(layer.id)}
              onEditText={() => props.onEditText(layer.id)}
              onTransform={(change) => props.onTransform(layer.id, change)}
            />
          )
        )}
        {props.pen ? <PenOverlay side={side} color={props.pen.color} width={props.pen.width} onStroke={props.onStroke} /> : null}
      </View>
      {props.cutoutBadge ? (
        <View testID="pastilla-fondo-eliminado" className="absolute left-4 top-4 flex-row items-center gap-2 rounded-full px-3 py-1.5" style={{ backgroundColor: 'rgba(17,17,17,0.6)' }}>
          <View className="h-2 w-2 rounded-full" style={{ backgroundColor: colors['en-linea'] }} />
          <Text className="text-[13px]" style={{ color: 'white' }}>Fondo eliminado</Text>
        </View>
      ) : null}
    </View>
  );
}
