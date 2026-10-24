import { useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import Svg, { Circle, Path, Text as SvgText } from 'react-native-svg';
import { Cloud, CloudFog, CloudLightning, CloudRain, CloudSun, Sun, type LucideIcon } from 'lucide-react-native';
import { dayTemperature, hourLabel, pointLabel, weatherCurve, weatherFacts, type WeatherBlock, type WeatherIcon, type WeatherSeries } from '@lilachat/shared';
import { useColores } from '../../ui/tema';
import { TONE_CLASS, TONE_COLOR } from './tones';

const ICONS: Record<WeatherIcon, LucideIcon> = { sun: Sun, partly: CloudSun, cloud: Cloud, rain: CloudRain, storm: CloudLightning, fog: CloudFog };
const TABS: { key: WeatherSeries; label: string }[] = [{ key: 'temp', label: 'Temperatura' }, { key: 'rain', label: 'Precipitaciones' }, { key: 'wind', label: 'Viento' }];
const CURVE = { height: 104, pad: 22, side: 16 };

/**
 * /clima like Google's (pending 96, design e-33): the chosen day's now, its
 * curve by hours with three tabs, and the strip of days; a day's dot is its
 * risk to pave. The web's `BlockWeather` is its twin; the geometry is shared.
 */
export function BlockWeather({ block }: { block: WeatherBlock }) {
  const colors = useColores();
  const [dayIndex, setDayIndex] = useState(0);
  const [series, setSeries] = useState<WeatherSeries>('temp');
  const [width, setWidth] = useState(0);
  const day = block.days[Math.min(dayIndex, block.days.length - 1)]!;
  const Icon = ICONS[day.icon];
  const temperature = dayTemperature(day);
  const inner = Math.max(0, width - CURVE.side * 2);
  const curve = weatherCurve(day.hours, series, inner, CURVE.height, CURVE.pad);
  return (
    <View testID="bloque-clima" accessibilityLabel={block.place ? `Clima en ${block.place}` : undefined} className="gap-3">
      <View className="flex-row items-start justify-between gap-3">
        <View className="flex-row items-center gap-2">
          <Icon size={40} strokeWidth={1.5} color={colors['on-surface-variant']} />
          {temperature !== undefined ? <Text testID="clima-temperatura" className="text-[36px] font-bold text-on-surface" style={{ fontVariant: ['tabular-nums'] }}>{`${Math.round(temperature)} °C`}</Text> : null}
        </View>
        <View className="min-w-0 flex-1 items-end">
          {day.summary ? <Text className="text-right text-[14px] font-semibold text-on-surface">{day.summary}</Text> : null}
          {weatherFacts(day).map((fact) => <Text key={fact.label} className="text-right text-[12px] text-on-surface-variant">{`${fact.label} `}<Text className="font-semibold text-on-surface">{fact.value}</Text></Text>)}
        </View>
      </View>
      {day.risk ? (
        <View testID="clima-riesgo" className={`flex-row items-center gap-1.5 self-start rounded-full border px-2.5 py-1 ${TONE_CLASS[day.risk.tone].soft}`}>
          <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: colors[TONE_COLOR[day.risk.tone]] }} />
          <Text className={`text-[13px] font-bold ${TONE_CLASS[day.risk.tone].text}`}>{day.risk.label}</Text>
        </View>
      ) : null}
      {day.note ? <Text className="text-[12px] text-on-surface-variant">{day.note}</Text> : null}
      {day.hours.length ? (
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)}>
          <View className="flex-row gap-4 border-b border-outline/15">
            {TABS.map((tab) => (
              <Pressable key={tab.key} testID={`clima-pestana-${tab.key}`} accessibilityRole="tab" accessibilityState={{ selected: series === tab.key }} onPress={() => setSeries(tab.key)} className={`min-h-[36px] justify-center border-b-2 ${series === tab.key ? 'border-primary' : 'border-transparent'}`}>
                <Text className={`text-[13px] font-semibold ${series === tab.key ? 'text-primary' : 'text-on-surface-variant'}`}>{tab.label}</Text>
              </Pressable>
            ))}
          </View>
          {width > 0 && curve.points.length ? (
            <Svg testID="clima-curva" width={width} height={CURVE.height + 4} style={{ marginTop: 8 }}>
              <Path d={curve.area} fill={colors.primary} fillOpacity={0.15} translateX={CURVE.side} />
              <Path d={curve.line} stroke={colors.primary} strokeWidth={2} fill="none" translateX={CURVE.side} />
              {curve.points.map((point) => (
                <Circle key={`c-${point.index}`} cx={point.x + CURVE.side} cy={point.y} r={3.5} fill={colors.surface} stroke={colors.primary} strokeWidth={2} />
              ))}
              {curve.points.map((point) => (
                <SvgText key={`t-${point.index}`} x={point.x + CURVE.side} y={point.y - 8} textAnchor="middle" fontSize={11} fontWeight="600" fill={colors['on-surface']}>{pointLabel(day.hours[point.index]!, series)}</SvgText>
              ))}
            </Svg>
          ) : <Text className="py-6 text-center text-[12px] text-on-surface-variant">{width > 0 ? 'Sin datos por hora' : ' '}</Text>}
          <View className="flex-row justify-between">
            {day.hours.map((hour) => <Text key={hour.at} className="text-[10px] text-on-surface-variant">{hourLabel(hour.at)}</Text>)}
          </View>
        </View>
      ) : null}
      {block.days.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 6 }}>
          {block.days.map((one, index) => {
            const DayIcon = ICONS[one.icon];
            const chosen = index === dayIndex;
            return (
              <Pressable key={`${one.label}-${index}`} testID={`clima-dia-${index}`} accessibilityState={{ selected: chosen }} onPress={() => setDayIndex(index)} className={`min-w-[56px] items-center gap-0.5 rounded-xl px-2 py-1.5 ${chosen ? 'border-2 border-primary' : 'border border-outline/20'}`}>
                {one.risk ? <View accessibilityLabel={one.risk.label} className="absolute right-1 top-1 h-2 w-2 rounded-full" style={{ backgroundColor: colors[TONE_COLOR[one.risk.tone]] }} /> : null}
                <Text className={`text-[12px] ${chosen ? 'font-bold text-primary' : 'text-on-surface'}`}>{one.label}</Text>
                <DayIcon size={16} color={colors['on-surface-variant']} />
                {one.max !== undefined ? <Text className="text-[12px] font-bold text-on-surface">{`${Math.round(one.max)}°`}</Text> : null}
                {one.min !== undefined ? <Text className="text-[11px] text-on-surface-variant">{`${Math.round(one.min)}°`}</Text> : null}
              </Pressable>
            );
          })}
        </ScrollView>
      ) : null}
    </View>
  );
}
