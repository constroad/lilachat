import { useState } from 'react';
import { Text, View, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Polygon, Text as SvgText } from 'react-native-svg';
import { arPlanOf, type ArPoint, type ArSide } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { decimals } from './ZoneParts';

const PLAN_HEIGHT = 200;
const MARGIN = 34;

/** Design la-03, «Plano desde arriba · Del AR»: the zone as the AR saw it, each side with its length. */
export function ArPlanCard({ points, sides, editing }: { points: readonly ArPoint[]; sides: readonly ArSide[]; editing: number | null }) {
  const colors = useColores();
  const [width, setWidth] = useState(0);
  const plan = width ? arPlanOf(points, { width, height: PLAN_HEIGHT }, MARGIN) : [];
  return (
    <View className="gap-2 rounded-2xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-center justify-between">
        <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Plano desde arriba</Text>
        <Text className="rounded-md border border-primary/40 px-1.5 py-0.5 text-[10px] font-bold uppercase text-primary">Del AR</Text>
      </View>
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
            {plan.map((point, index) => <Circle key={`p${index}`} cx={point.x} cy={point.y} r={5} fill={colors.primary} />)}
          </Svg>
        ) : null}
      </View>
    </View>
  );
}
