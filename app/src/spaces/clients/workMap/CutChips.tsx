import { Pressable, ScrollView, Text, View } from 'react-native';
import { workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, type CutOption, type WorkMap, type WorkMapFilter } from '@lilachat/shared';

export const SHEET_LABEL = 'text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';
const CHIP = 'h-10 justify-center rounded-xl border px-3';

type Props = { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };

function ChipRow(props: { testID: string; label: string; options: CutOption[]; selected: string; onPick: (id: string) => void }) {
  return (
    <View className="gap-1.5">
      <Text className={SHEET_LABEL}>{props.label}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
        {props.options.map((option) => {
          const on = option.id === props.selected;
          return (
            <Pressable key={option.id || 'all'} testID={`${props.testID}-${option.id || 'todo'}`} accessibilityState={{ selected: on }} onPress={() => props.onPick(option.id)} className={`${CHIP} ${on ? 'border-primary bg-primary/10' : 'border-outline/20 bg-surface'}`}>
              <Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`}>{option.label}</Text>
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

/** «Etapa de obra»: the stage the cut takes; the map behind follows it. */
export const StageChips = (props: Props & { options: CutOption[]; label?: string }) =>
  (props.map.stages.length ? <ChipRow testID="corte-etapa" label={props.label ?? 'Etapa de obra'} options={props.options} selected={props.filter.stageId ?? ''} onPick={(id) => props.onFilter(workMapStageFilter(props.map, props.filter, id))} /> : null);

/** «Hasta el día»: only days with approved progress, since any other day draws the same map. */
export function DayChips(props: Props) {
  const options = [{ id: '', label: 'Hasta hoy' }, ...workMapCutDays(props.map).map((day) => ({ id: day, label: workMapCutLabel(day) }))];
  return <ChipRow testID="corte-dia" label="Hasta el día" options={options} selected={props.filter.untilDay ?? ''} onPick={(day) => props.onFilter(workMapDayFilter(props.filter, day))} />;
}
