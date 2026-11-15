import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { ArFrame } from '../../../../modules/ar-measure/src';
import { useColores } from '../../../ui/tema';

const RETICLE_R = 26;

type Size = { width: number; height: number };

/**
 * Design la-02 over the camera: only the reticle. The trace, each side's meters,
 * the growing side and a closed zone's area are drawn natively on the camera
 * image (José 15/11: labels drawn from here swam behind the camera). The reticle
 * fills when it snaps to the first corner and hides once the zone is closed.
 */
export function ArOverlay({ frame, size }: { frame: ArFrame | null; size: Size }) {
  const colors = useColores();
  if (frame?.closed) return null;
  const center = { x: size.width / 2, y: size.height / 2 };
  const floor = Boolean(frame?.floor);
  return (
    <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, width: size.width, height: size.height }}>
      <Svg width={size.width} height={size.height}>
        <Circle cx={center.x} cy={center.y} r={RETICLE_R} fill={frame?.closing ? colors.primary : 'none'} fillOpacity={0.35} stroke="white" strokeWidth={3} strokeOpacity={floor ? 1 : 0.5} />
        <Circle cx={center.x} cy={center.y} r={6} fill={floor ? colors.primary : 'white'} fillOpacity={floor ? 1 : 0.5} />
      </Svg>
    </View>
  );
}
