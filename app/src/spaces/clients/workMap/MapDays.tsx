import { useMemo, useState } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { ALL_DAYS, mapDayOptions, mediaOfDay, type MapDayOption, type MapPhoto, type UnitDischarge } from '@lilachat/shared';
import { MAP_SHADOW } from './MapFloating';

/** «Todos» or one day of placement (José 09/11, Globofast): what the map shows of photos and units. */
export function useMapDays(photos: MapPhoto[], units: UnitDischarge[]) {
  const [day, setDay] = useState(ALL_DAYS);
  const options = useMemo(() => mapDayOptions(photos, units), [photos, units]);
  const shown = useMemo(() => mediaOfDay(photos, units, day), [photos, units, day]);
  const days = useMemo(() => options.slice(1).map((one) => one.key), [options]);
  return { day, setDay, options, days, photos: shown.photos };
}

/**
 * One chip per day with its color on the map; nothing with a single day. José 20/11 (design
 * mapa-v2): they float over the map, each day with how many photos and units it holds.
 */
export function MapDayChips(props: { options: MapDayOption[]; day: string; onDay: (day: string) => void }) {
  if (!props.options.length) return null;
  return (
    <ScrollView horizontal style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8, paddingHorizontal: 12, paddingBottom: 4 }} testID="mapa-dias">
      {props.options.map((option) => {
        const on = option.key === props.day;
        return (
          <Pressable key={option.key} testID={`mapa-dia-${option.key}`} accessibilityRole="button" accessibilityState={{ selected: on }} onPress={() => props.onDay(option.key)} className={`h-10 flex-row items-center gap-2 rounded-full border px-3.5 ${on ? 'border-primary bg-primary' : 'border-outline/15 bg-surface'}`} style={MAP_SHADOW}>
            {option.color ? <View className="h-3 w-3 rounded-full" style={{ backgroundColor: option.color }} /> : null}
            <Text className={`text-[14px] font-semibold ${on ? 'text-on-primary' : 'text-on-surface'}`}>{option.label}</Text>
            {option.color ? <Text className={`font-mono text-[12px] ${on ? 'text-on-primary/80' : 'text-on-surface-variant'}`}>{`· ${option.count}`}</Text> : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}
