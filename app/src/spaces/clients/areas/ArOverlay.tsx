import { View } from 'react-native';
import Svg, { Circle, Line, Polyline, Text as SvgText } from 'react-native-svg';
import type { ArFrame, ScreenPoint } from '../../../../modules/ar-measure/src';
import { useColores } from '../../../ui/tema';

const CORNER_R = 14;
const RETICLE_R = 26;

type Size = { width: number; height: number };

/** The native view reports pixels; the overlay draws in the layout's points. */
const scaled = (point: ScreenPoint, ratio: number) => ({ x: point.x * ratio, y: point.y * ratio, visible: point.visible });

/**
 * Design la-02 over the camera: the corners already marked (numbered), the
 * sides between them, a dashed line from the last one to where the next would
 * go, and the reticle at the center (filled when there is floor under it).
 */
export function ArOverlay({ frame, size }: { frame: ArFrame | null; size: Size }) {
  const colors = useColores();
  const ratio = frame?.width ? size.width / frame.width : 1;
  const corners = (frame?.corners ?? []).map((point) => scaled(point, ratio));
  const aim = frame?.aim ? scaled(frame.aim, ratio) : null;
  const last = corners[corners.length - 1];
  const center = { x: size.width / 2, y: size.height / 2 };
  const floor = Boolean(frame?.floor);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height }}>
      <Svg width={size.width} height={size.height}>
        {corners.length >= 2 ? <Polyline points={corners.map((point) => `${point.x},${point.y}`).join(' ')} fill="none" stroke={colors.primary} strokeWidth={4} /> : null}
        {last && aim && floor ? <Line x1={last.x} y1={last.y} x2={aim.x} y2={aim.y} stroke="white" strokeWidth={3} strokeDasharray="10,8" /> : null}
        {corners.map((point, index) => (point.visible ? <Circle key={`c${index}`} cx={point.x} cy={point.y} r={CORNER_R} fill={colors.primary} stroke="white" strokeWidth={3} /> : null))}
        {corners.map((point, index) => (point.visible ? <SvgText key={`n${index}`} x={point.x} y={point.y + 5} fontSize={14} fontWeight="bold" fill="white" textAnchor="middle">{String(index + 1)}</SvgText> : null))}
        <Circle cx={center.x} cy={center.y} r={RETICLE_R} fill="none" stroke="white" strokeWidth={3} strokeOpacity={floor ? 1 : 0.5} />
        <Circle cx={center.x} cy={center.y} r={6} fill={floor ? colors.primary : 'white'} fillOpacity={floor ? 1 : 0.5} />
      </Svg>
    </View>
  );
}
