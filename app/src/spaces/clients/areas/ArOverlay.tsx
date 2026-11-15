import { Text, View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import { arLiveLabel } from '@lilachat/shared';
import type { ArFrame, ScreenPoint } from '../../../../modules/ar-measure/src';
import { useColores } from '../../../ui/tema';

const RETICLE_R = 26;
const LABEL_LIFT = 30;
const LIVE_BELOW = 40;

type Size = { width: number; height: number };

/** The native view reports pixels; the overlay draws in the layout's points. */
const scaled = (point: ScreenPoint, ratio: number) => ({ x: point.x * ratio, y: point.y * ratio, visible: point.visible });

/**
 * Design la-02 over the camera. The lines and dots are drawn natively on the
 * camera image (José 15/11: drawn from here they swam); this layer only writes
 * each corner's number, each side's meters, the side growing to the reticle,
 * and the reticle, which turns solid when it snaps to the first corner.
 */
export function ArOverlay({ frame, size }: { frame: ArFrame | null; size: Size }) {
  const colors = useColores();
  const ratio = frame?.width ? size.width / frame.width : 1;
  const corners = (frame?.corners ?? []).map((point) => scaled(point, ratio));
  const center = { x: size.width / 2, y: size.height / 2 };
  const floor = Boolean(frame?.floor);
  const live = arLiveLabel(frame?.live);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height }}>
      {corners.map((point, index) => (point.visible ? <Tag key={`n${index}`} x={point.x} y={point.y - LABEL_LIFT} text={String(index + 1)} strong /> : null))}
      {(frame?.sides ?? []).map((meters, index) => {
        const from = corners[index];
        const to = corners[index + 1];
        return from?.visible && to?.visible ? <Tag key={`s${index}`} x={(from.x + to.x) / 2} y={(from.y + to.y) / 2} text={arLiveLabel(meters) ?? ''} /> : null;
      })}
      <Svg width={size.width} height={size.height} style={{ position: 'absolute' }}>
        <Circle cx={center.x} cy={center.y} r={RETICLE_R} fill={frame?.closing ? colors.primary : 'none'} fillOpacity={0.35} stroke="white" strokeWidth={3} strokeOpacity={floor ? 1 : 0.5} />
        <Circle cx={center.x} cy={center.y} r={6} fill={floor ? colors.primary : 'white'} fillOpacity={floor ? 1 : 0.5} />
      </Svg>
      {live ? <Tag testID="ar-medida-viva" x={center.x} y={center.y + LIVE_BELOW} text={frame?.closing ? `Cerrar · ${live}` : live} strong /> : null}
    </View>
  );
}

/** A pill centered on a point of the camera. */
function Tag(props: { x: number; y: number; text: string; strong?: boolean; testID?: string }) {
  return (
    <View testID={props.testID} style={{ position: 'absolute', left: props.x - 60, top: props.y - 14, width: 120, alignItems: 'center' }}>
      <Text className={`overflow-hidden rounded-full px-2.5 py-1 text-[13px] font-bold ${props.strong ? 'bg-primary text-on-primary' : 'bg-black/70 text-white'}`} style={{ fontVariant: ['tabular-nums'] }}>{props.text}</Text>
    </View>
  );
}
