import { useState } from 'react';
import { ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Line, Path } from 'react-native-svg';
import { barColumns, barFractions, linePath, type BotBlock } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { TONE_CLASS, TONE_COLOR } from './tones';

type Chart = Extract<BotBlock, { type: 'chart' }>;
const BAR_V_HEIGHT = 96;
const LINE_HEIGHT = 80;
const LINE_WIDTH = 260;

const shown = (point: Chart['points'][number], unit?: string) => point.display ?? `${point.value}${unit ? ` ${unit}` : ''}`;

/** Horizontal bars (tanks, cash by project): label and value over a thin bar, like `r155-avisos-canal`. */
function BarsH({ chart }: { chart: Chart }) {
  const colors = useColores();
  const fractions = barFractions(chart.points, chart.max);
  return (
    <View className="gap-2" testID="bloque-grafico-barras-h">
      {chart.points.map((point, index) => (
        <View key={`${point.label}-${index}`}>
          <View className="flex-row items-baseline justify-between gap-2">
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[12px] text-on-surface">{point.label}{point.note ? <Text className={`text-[11px] font-bold ${TONE_CLASS[point.tone].text}`}>{`  ${point.note}`}</Text> : null}</Text>
            <Text className={`text-[12px] font-semibold ${point.tone === 'error' ? 'text-error' : 'text-on-surface'}`} style={{ fontVariant: ['tabular-nums'] }}>{shown(point, chart.unit)}</Text>
          </View>
          <View className="mt-1 h-1.5 overflow-hidden rounded-full bg-surface-variant">
            <View className="h-full rounded-full" style={{ width: `${Math.round(fractions[index]! * 100)}%`, backgroundColor: colors[TONE_COLOR[point.tone]] }} />
          </View>
        </View>
      ))}
    </View>
  );
}

/** Vertical bars (rain per day): the value on top, the label and its note below. A week shares the card's width; a month scrolls. */
function BarsV({ chart }: { chart: Chart }) {
  const colors = useColores();
  const [width, setWidth] = useState(0);
  const fractions = barFractions(chart.points, chart.max);
  const layout = barColumns(width, chart.points.length);
  const columns = chart.points.map((point, index) => (
    <View key={`${point.label}-${index}`} className="items-center" style={{ width: layout.column }}>
      <Text numberOfLines={1} adjustsFontSizeToFit className={`text-[12px] font-bold ${TONE_CLASS[point.tone].text}`} style={{ fontVariant: ['tabular-nums'] }}>{shown(point, chart.unit)}</Text>
      <View style={{ height: BAR_V_HEIGHT, justifyContent: 'flex-end' }}>
        <View className="rounded-t-md" style={{ width: layout.bar, height: Math.max(3, Math.round(fractions[index]! * BAR_V_HEIGHT)), backgroundColor: colors[TONE_COLOR[point.tone]] }} />
      </View>
      <Text numberOfLines={1} adjustsFontSizeToFit className="mt-1 text-[12px] font-semibold text-on-surface">{point.label}</Text>
      {point.note ? <Text numberOfLines={1} className="text-[11px] text-on-surface-variant">{point.note}</Text> : null}
    </View>
  ));
  return (
    <View testID="bloque-grafico-barras-v" onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
      {layout.scroll ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ alignItems: 'flex-end' }}>{columns}</ScrollView>
      ) : (
        <View className="flex-row items-end">{width > 0 ? columns : null}</View>
      )}
    </View>
  );
}

/** A line (a tank over the week): the path, the threshold dashed and today's point marked. */
function LineChart({ chart }: { chart: Chart }) {
  const colors = useColores();
  const values = chart.points.map((point) => point.value);
  const path = linePath(values, LINE_WIDTH, LINE_HEIGHT);
  const last = path.split(' ').pop()!.replace(/^[ML]/, '').split(',').map(Number);
  const top = Math.max(...values);
  const span = top - Math.min(...values) || 1;
  const thresholdY = chart.threshold ? ((top - chart.threshold.value) / span) * LINE_HEIGHT : null;
  return (
    <View testID="bloque-grafico-linea">
      <Svg width="100%" height={LINE_HEIGHT + 8} viewBox={`-4 -4 ${LINE_WIDTH + 8} ${LINE_HEIGHT + 8}`} preserveAspectRatio="none">
        {thresholdY !== null && thresholdY >= 0 && thresholdY <= LINE_HEIGHT ? <Line x1={0} x2={LINE_WIDTH} y1={thresholdY} y2={thresholdY} stroke={colors.error} strokeDasharray="4 4" strokeWidth={1} /> : null}
        <Path d={path} stroke={colors.primary} strokeWidth={2} fill="none" />
        <Circle cx={last[0]} cy={last[1]} r={4} fill={colors.primary} />
      </Svg>
      <View className="mt-1 flex-row justify-between">
        <Text className="text-[11px] text-on-surface-variant">{chart.points[0]!.label}</Text>
        <Text className="text-[11px] font-semibold text-on-surface">{chart.points.at(-1)!.label} · {shown(chart.points.at(-1)!, chart.unit)}</Text>
      </View>
    </View>
  );
}

export function BlockChart({ chart }: { chart: Chart }) {
  if (chart.kind === 'bar-v') return <BarsV chart={chart} />;
  if (chart.kind === 'line') return <LineChart chart={chart} />;
  return <BarsH chart={chart} />;
}
