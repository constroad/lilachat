import { useState } from 'react';
import { Image, Pressable, Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Polygon, Text as SvgText } from 'react-native-svg';
import { arCornerName, arPlanOf, type ArDiagonalRow, type ArPoint, type ArSide, type ShotLabel } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { decimals } from './ZoneParts';

const PLAN_HEIGHT = 200;
/** The AR frame is as tall as the phone: shown whole (José 15/11: «solo una parte cortada»), up to this height. */
const PHOTO_MAX_HEIGHT = 460;
const PORTRAIT_RATIO = 9 / 19.5;
const MARGIN = 34;
/** Inside the drawn photo, like the server keeps its pills inside the frame (audit 15/11). */
const clamp = (value: number, min: number, max: number) => Math.min(Math.max(value, min), Math.max(min, max));
/** A label's box, centered on its side's middle (wide enough for «12 · 125,40 m»). */
const LABEL_BOX = { width: 132, height: 28 };
/** The figures' corner sits this far inside the photo, at its top right (where the server burns it). */
const PANEL_INSET = 8;

type View3 = 'photo' | 'plan';
type Props = { points: readonly ArPoint[]; sides: readonly ArSide[]; diagonals?: readonly Pick<ArDiagonalRow, 'from' | 'to'>[]; editing: number | null; photo: string | null; labels?: readonly ShotLabel[]; panel?: readonly string[]; onRetake: () => void };

/**
 * Design la-03's first card. José 15/11: «¿por qué no se ve la foto en el preview?»: the AR's
 * own frame with the contour opens first, big; «Plano» shows the zone from above with each
 * side's length. Without that frame, «Tomar foto» opens the camera.
 */
export function ArPlanCard(props: Props) {
  const [shown, setShown] = useState<View3>(props.photo ? 'photo' : 'plan');
  const view = props.photo ? shown : 'plan';
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{view === 'photo' ? 'Foto de la zona' : 'Plano desde arriba'}</Text>
        {props.photo ? <Switch value={view} onChange={setShown} /> : <Pressable testID="foto-zona-ar" onPress={props.onRetake} className="h-9 justify-center px-2"><Text className="text-[14px] font-semibold text-primary">Tomar foto</Text></Pressable>}
      </View>
      {view === 'photo' && props.photo ? <WholePhoto uri={props.photo} labels={props.labels} panel={props.panel} /> : <Plan {...props} />}
      <Text className="text-[12px] text-on-surface-variant">{props.photo ? 'Del AR, con el contorno marcado. Va al informe con la zona.' : 'Falta la foto de la zona.'}</Text>
    </View>
  );
}

/** A photo at its own proportions, whole, on a dark band when it is taller than the card allows. */
export function WholePhoto({ uri, testID = 'foto-zona-ar-vista', labels = [], panel = [] }: { uri: string; testID?: string; labels?: readonly ShotLabel[]; panel?: readonly string[] }) {
  const [ratio, setRatio] = useState(PORTRAIT_RATIO);
  return (
    <View className="items-center overflow-hidden rounded-xl bg-black">
      <View style={{ width: '100%', aspectRatio: ratio, maxHeight: PHOTO_MAX_HEIGHT }}>
        <Image testID={testID} source={{ uri }} onLoad={(event) => { const { width, height } = event.nativeEvent.source; if (width > 0 && height > 0) setRatio(width / height); }} style={{ width: '100%', height: '100%' }} resizeMode="contain" />
        {labels.length || panel.length ? <PhotoLabels labels={labels} panel={panel} ratio={ratio} /> : null}
      </View>
    </View>
  );
}

/**
 * José 15/11 («no se muestra el metraje»): each side's meters on the photo, where the server burns
 * them. With the height capped, «contain» letterboxes the photo: the labels follow the drawn image.
 */
function PhotoLabels({ labels, panel, ratio }: { labels: readonly ShotLabel[]; panel: readonly string[]; ratio: number }) {
  const [box, setBox] = useState({ width: 0, height: 0 });
  const drawn = box.width / box.height > ratio ? { width: box.height * ratio, height: box.height } : { width: box.width, height: box.width / ratio };
  const left = (box.width - drawn.width) / 2;
  const top = (box.height - drawn.height) / 2;
  return (
    <View pointerEvents="none" testID="metros-en-foto" onLayout={(event) => setBox(event.nativeEvent.layout)} style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
      {box.width ? labels.map((label) => (
        <View key={label.text} style={{ position: 'absolute', left: clamp(left + label.x * drawn.width - LABEL_BOX.width / 2, left, left + drawn.width - LABEL_BOX.width), top: clamp(top + label.y * drawn.height - LABEL_BOX.height / 2, top, top + drawn.height - LABEL_BOX.height), width: LABEL_BOX.width, height: LABEL_BOX.height }} className="items-center justify-center">
          <Text className="rounded-full border border-white/90 bg-black/85 px-2 py-0.5 text-[12px] font-bold text-white" style={{ fontVariant: ['tabular-nums'] }}>{label.text}</Text>
        </View>
      )) : null}
      {box.width && panel.length ? (
        <View testID="resumen-en-foto" style={{ position: 'absolute', top: top + PANEL_INSET, right: box.width - left - drawn.width + PANEL_INSET }} className="gap-0.5 rounded-lg bg-black/80 px-2 py-1">
          {panel.map((line, index) => <Text key={line} className={`text-[11px] text-white ${index === 0 ? 'font-bold' : 'font-semibold'}`} style={{ fontVariant: ['tabular-nums'] }}>{line}</Text>)}
        </View>
      ) : null}
    </View>
  );
}

function Switch({ value, onChange }: { value: View3; onChange: (next: View3) => void }) {
  return (
    <View className="flex-row rounded-lg border border-outline/30 p-0.5">
      {(['photo', 'plan'] as const).map((option) => (
        <Pressable key={option} testID={`vista-${option}`} onPress={() => onChange(option)} className={`h-8 justify-center rounded-md px-3 ${value === option ? 'bg-primary' : ''}`}>
          <Text className={`text-[12px] font-bold uppercase ${value === option ? 'text-on-primary' : 'text-on-surface-variant'}`}>{option === 'photo' ? 'Foto' : 'Plano'}</Text>
        </Pressable>
      ))}
    </View>
  );
}

function Plan({ points, sides, diagonals = [], editing }: Props) {
  const colors = useColores();
  const [width, setWidth] = useState(0);
  const plan = width ? arPlanOf(points, { width, height: PLAN_HEIGHT }, MARGIN) : [];
  return (
    <View testID="plano-ar" onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)} style={{ height: PLAN_HEIGHT }} className="rounded-xl bg-surface-variant">
      {plan.length >= 3 ? (
        <Svg width={width} height={PLAN_HEIGHT}>
          <Polygon points={plan.map((point) => `${point.x},${point.y}`).join(' ')} fill={colors.primary} fillOpacity={0.12} stroke={colors.primary} strokeWidth={3} />
          {sides.map((side) => {
            const from = plan[side.index]!;
            const to = plan[(side.index + 1) % plan.length]!;
            const color = side.index === editing || side.flag === 'block' ? colors.error : colors.primary;
            return <SvgText key={`s${side.index}`} x={(from.x + to.x) / 2} y={(from.y + to.y) / 2 - 6} fontSize={12} fontWeight="bold" fill={color} textAnchor="middle">{`${side.index + 1} · ${decimals(side.meters, 2)} m`}</SvgText>;
          })}
          {diagonals.map(({ from, to }) => <Line key={`d${to}`} x1={plan[from]!.x} y1={plan[from]!.y} x2={plan[to]!.x} y2={plan[to]!.y} stroke={colors.primary} strokeWidth={2} strokeDasharray="6 4" />)}
          {plan.map((point, index) => <Circle key={`p${index}`} cx={point.x} cy={point.y} r={5} fill={colors.primary} />)}
          {plan.length >= 4 ? plan.map((point, index) => <SvgText key={`n${index}`} x={point.x + 8} y={point.y + 14} fontSize={11} fontWeight="bold" fill={colors['on-surface-variant']}>{arCornerName(index)}</SvgText>) : null}
        </Svg>
      ) : null}
    </View>
  );
}
