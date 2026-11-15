import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ArFrame } from '../../../../modules/ar-measure/src';

const RETICLE_R = 26;

type Size = { width: number; height: number };

/**
 * Design la-02 over the camera: the reticle only while there is no floor under it.
 * With a floor, the reticle is a disc lying on it, drawn natively like the trace,
 * each side's meters and a closed zone's area (José 15/11, his reference app).
 */
export function ArOverlay({ frame, size }: { frame: ArFrame | null; size: Size }) {
  if (frame?.closed || frame?.floor) return null;
  const center = { x: size.width / 2, y: size.height / 2 };
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height }}>
      <Svg width={size.width} height={size.height}>
        <Circle cx={center.x} cy={center.y} r={RETICLE_R} fill="none" stroke="white" strokeWidth={3} strokeOpacity={0.5} strokeDasharray="6 6" />
        <Circle cx={center.x} cy={center.y} r={5} fill="white" fillOpacity={0.5} />
      </Svg>
    </View>
  );
}
