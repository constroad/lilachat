import { Text, View } from 'react-native';
import Svg, { Ellipse, Line, Rect } from 'react-native-svg';
import { tankFill, type TankItem } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { TONE_CLASS, TONE_COLOR } from './tones';

const BODY = { width: 44, height: 76 };

/** A tank drawn, not photographed (José, 23/10): the cylinder, its liquid at the real level and the dashed minimum. */
export function TankDrawing({ tank, scale = 1 }: { tank: TankItem; scale?: number }) {
  const colors = useColores();
  const width = BODY.width * scale;
  const height = BODY.height * scale;
  const fill = tankFill(tank.level, height);
  const minY = tank.min !== undefined ? height - tank.min * height : null;
  const lid = 5 * scale;
  return (
    <Svg width={width + 2} height={height + lid * 2 + 2} viewBox={`-1 ${-lid - 1} ${width + 2} ${height + lid * 2 + 2}`}>
      <Rect x={0} y={0} width={width} height={height} rx={4 * scale} fill={colors['surface-variant']} stroke={colors.outline} strokeWidth={1} />
      {fill.height > 0 ? <Rect x={1} y={fill.y} width={width - 2} height={fill.height} rx={3 * scale} fill={colors[TONE_COLOR[tank.tone === 'neutral' ? 'info' : tank.tone]]} /> : null}
      <Ellipse cx={width / 2} cy={0} rx={width / 2} ry={lid} fill={colors.surface} stroke={colors.outline} strokeWidth={1} />
      {minY !== null ? <Line x1={-1} x2={width + 1} y1={minY} y2={minY} stroke={colors.error} strokeWidth={1} strokeDasharray="3 3" /> : null}
    </Svg>
  );
}

function TankFacts({ tank, big }: { tank: TankItem; big: boolean }) {
  return (
    <View className="min-w-0 flex-1">
      <Text numberOfLines={1} className="text-[11px] font-bold uppercase tracking-wider text-on-surface-variant">{tank.name}</Text>
      <Text className={`${big ? 'text-[26px]' : 'text-[15px]'} font-bold ${tank.tone === 'error' ? 'text-error' : 'text-on-surface'}`} style={{ fontVariant: ['tabular-nums'] }}>{tank.value}</Text>
      {tank.sub ? <Text numberOfLines={1} className="text-[12px] text-on-surface-variant">{tank.sub}</Text> : null}
      {tank.delta ? <View className={`mt-1 self-start rounded-md border px-1.5 py-0.5 ${TONE_CLASS.neutral.soft}`}><Text className="text-[11px] font-semibold text-on-surface">{tank.delta}</Text></View> : null}
    </View>
  );
}

/** One tank big, several in a grid of two (`r155-asistencia-tanque`, `r155-tanques-detalle`). */
export function BlockTank({ items }: { items: TankItem[] }) {
  if (items.length === 1) {
    return (
      <View testID="bloque-tanque" className="flex-row items-center gap-3">
        <TankDrawing tank={items[0]!} />
        <TankFacts tank={items[0]!} big />
      </View>
    );
  }
  return (
    <View testID="bloque-tanques" className="flex-row flex-wrap" style={{ gap: 8 }}>
      {items.map((tank) => (
        <View key={tank.name} className={`flex-row items-center gap-2 rounded-xl border px-2 py-2 ${tank.tone === 'error' ? TONE_CLASS.error.soft : 'border-outline/15'}`} style={{ width: '48%' }}>
          <TankDrawing tank={tank} scale={0.6} />
          <TankFacts tank={tank} big={false} />
        </View>
      ))}
    </View>
  );
}
