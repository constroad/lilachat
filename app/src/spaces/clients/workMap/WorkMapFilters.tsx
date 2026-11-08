import { useState, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { CalendarDays, Check, ChevronDown } from 'lucide-react-native';
import { workMapCutChip, workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };
type Choice = { testID: string; label: string; on: boolean; pick: () => void };

function ChoiceSheet(props: { title: string; open: boolean; onClose: () => void; choices: Choice[] }) {
  const colors = useColores();
  return (
    <Sheet visible={props.open} onClose={props.onClose} className="px-4 pt-2">
      <Text className={`${KICKER} mb-2`}>{props.title}</Text>
      {props.choices.map((choice) => (
        <Pressable key={choice.testID} testID={choice.testID} accessibilityState={{ selected: choice.on }} onPress={() => { choice.pick(); props.onClose(); }} className="min-h-[48px] flex-row items-center justify-between border-b border-outline/10">
          <Text className={`text-[15px] ${choice.on ? 'font-semibold text-primary' : 'text-on-surface'}`}>{choice.label}</Text>
          {choice.on ? <Check size={18} color={colors.primary} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

function Chip(props: { testID: string; tinted?: boolean; icon?: ReactNode; label: string; onPress?: () => void }) {
  const colors = useColores();
  return (
    <Pressable testID={props.testID} disabled={!props.onPress} onPress={props.onPress} className={`min-h-[40px] flex-row items-center gap-1.5 rounded-lg border px-3 ${props.tinted ? 'border-primary/30 bg-primary/10' : 'border-outline/20 bg-surface'}`}>
      {props.icon}
      <Text className={`text-[14px] font-semibold ${props.tinted ? 'text-primary' : 'text-on-surface'}`}>{props.label}</Text>
      {props.onPress ? <ChevronDown size={16} color={props.tinted ? colors.primary : colors['on-surface-variant']} /> : null}
    </Pressable>
  );
}

/** Stage and day as chips that open their list, as the design's phone (o-01); one stage less to scroll sideways. */
function StageAndDay(props: FilterProps) {
  const { map, view, filter, onFilter } = props;
  const colors = useColores();
  const [picking, setPicking] = useState<'stage' | 'day' | null>(null);
  const days = workMapCutDays(map);
  const stage = map.stages.find((one) => one.id === filter.stageId);
  const close = () => setPicking(null);
  return (
    <View className="flex-row items-center gap-2">
      {map.stages.length ? <Chip testID="mapa-etapa" tinted label={stage?.name ?? 'Todas las etapas'} onPress={() => setPicking('stage')} /> : null}
      <Text className="font-mono text-[12px] text-on-surface-variant">{view.streets.length === 1 ? '1 calle' : `${view.streets.length} calles`}</Text>
      <View className="ml-auto">
        <Chip testID="mapa-corte" icon={<CalendarDays size={16} color={colors['on-surface-variant']} />} label={workMapCutChip(filter)} onPress={days.length > 1 ? () => setPicking('day') : undefined} />
      </View>
      <ChoiceSheet title="Etapa" open={picking === 'stage'} onClose={close} choices={[
        { testID: 'mapa-etapa-todas', label: 'Todas las etapas', on: !filter.stageId, pick: () => onFilter(workMapStageFilter(map, filter, '')) },
        ...map.stages.map((one) => ({ testID: `mapa-etapa-${one.id}`, label: one.name, on: filter.stageId === one.id, pick: () => onFilter(workMapStageFilter(map, filter, one.id)) })),
      ]} />
      <ChoiceSheet title="Avance hasta el día" open={picking === 'day'} onClose={close} choices={[
        { testID: 'mapa-corte-hoy', label: 'Hasta hoy', on: !filter.untilDay, pick: () => onFilter(workMapDayFilter(filter, '')) },
        ...days.map((day) => ({ testID: `mapa-corte-${day}`, label: workMapCutLabel(day), on: filter.untilDay === day, pick: () => onFilter(workMapDayFilter(filter, day)) })),
      ]} />
    </View>
  );
}

function WorkChips(props: FilterProps) {
  const { view, filter, onFilter } = props;
  if (!view.works.length) return null;
  const chip = (on: boolean) => `min-h-[36px] flex-row items-center gap-1.5 rounded-lg border px-3 ${on ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`;
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>
      <Pressable testID="mapa-trabajo-todos" accessibilityState={{ selected: !filter.workId }} onPress={() => onFilter(workMapWorkFilter(filter))} className={chip(!filter.workId)}>
        <Text className={`text-[13px] font-semibold ${filter.workId ? 'text-on-surface' : 'text-on-primary'}`}>Todos</Text>
      </Pressable>
      {view.works.map((work) => {
        const on = filter.workId === work.id;
        return (
          <Pressable key={work.id} testID={`mapa-trabajo-${work.id}`} accessibilityState={{ selected: on }} onPress={() => onFilter(workMapWorkFilter(filter, work.id))} className={chip(on)}>
            <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />
            <Text className={`text-[13px] font-semibold ${on ? 'text-on-primary' : 'text-on-surface'}`}>{work.name} <Text className="font-mono">{work.percent}%</Text></Text>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** The rows over the map (o-01, phone): stage, how many streets, the cut day, and the works. */
export function WorkMapFilters(props: FilterProps) {
  return (
    <View className="gap-2">
      <StageAndDay {...props} />
      <WorkChips {...props} />
    </View>
  );
}

/** «Convenciones» over the map: each work's line and the dashed one still to build. */
/** A row above the map: floating over its top-left it hid the streets there (José 08/11, tutorial video). */
export function WorkMapLegend(props: { view: WorkMapView }) {
  return (
    <View testID="mapa-leyenda" className="flex-row flex-wrap items-center gap-x-3 gap-y-1">
      <View className="flex-row flex-wrap gap-x-3 gap-y-1">
        {props.view.works.map((work) => (
          <View key={work.id} className="flex-row items-center gap-1.5"><View className="h-1 w-4 rounded-full" style={{ backgroundColor: work.color }} /><Text className="text-[12px] font-medium text-on-surface">{work.name}</Text></View>
        ))}
      </View>
      <View className="flex-row items-center gap-1.5">
        <View className="w-4 border-t-2 border-dashed border-on-surface-variant/60" />
        <Text className="text-[12px] text-on-surface-variant">Pendiente de ejecución</Text>
      </View>
    </View>
  );
}
