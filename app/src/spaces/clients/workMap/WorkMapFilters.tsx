import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarDays, Check, ChevronDown } from 'lucide-react-native';
import { mapLegendEntries, workChoiceLabel, workChoicesOf, workMapCutChip, workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };
type Choice = { testID: string; label: string; on: boolean; pick: () => void; color?: string | null };

function ChoiceSheet(props: { title: string; open: boolean; onClose: () => void; choices: Choice[] }) {
  const colors = useColores();
  return (
    <Sheet visible={props.open} onClose={props.onClose} className="px-4 pt-2">
      <Text className={`${KICKER} mb-2`}>{props.title}</Text>
      {props.choices.map((choice) => (
        <Pressable key={choice.testID} testID={choice.testID} accessibilityState={{ selected: choice.on }} onPress={() => { choice.pick(); props.onClose(); }} className="min-h-[48px] flex-row items-center justify-between border-b border-outline/10">
          <View className="flex-1 flex-row items-center gap-2">
            {choice.color ? <View className="h-3 w-3 rounded-full" style={{ backgroundColor: choice.color }} /> : null}
            <Text className={`flex-1 text-[15px] ${choice.on ? 'font-semibold text-primary' : 'text-on-surface'}`}>{choice.label}</Text>
          </View>
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

/** The works as a select, not a row of chips (José 09/11), and the legend folded beside it. */
function WorkAndLegend(props: FilterProps & { waiting: number }) {
  const { view, filter, onFilter } = props;
  const colors = useColores();
  const [picking, setPicking] = useState(false);
  const [legend, setLegend] = useState(false);
  const chosen = view.works.find((work) => work.id === filter.workId);
  return (
    <View className="gap-2">
      <View className="flex-row gap-2">
        {view.works.length ? (
          <Pressable testID="mapa-trabajo" onPress={() => setPicking(true)} className="min-h-[44px] flex-1 flex-row items-center gap-2 rounded-lg border border-outline/20 bg-surface px-3">
            {chosen ? <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: chosen.color }} /> : null}
            <Text numberOfLines={1} className="flex-1 text-[14px] font-semibold text-on-surface">{workChoiceLabel(view, filter.workId)}</Text>
            <ChevronDown size={16} color={colors['on-surface-variant']} />
          </Pressable>
        ) : <View className="flex-1" />}
        <Pressable testID="mapa-leyenda-abrir" accessibilityState={{ expanded: legend }} onPress={() => setLegend(!legend)} className="min-h-[44px] flex-row items-center gap-1.5 rounded-lg border border-outline/20 bg-surface px-3">
          <Text className="text-[14px] font-semibold text-on-surface">Leyenda</Text>
          <ChevronDown size={16} color={colors['on-surface-variant']} style={{ transform: [{ rotate: legend ? '180deg' : '0deg' }] }} />
        </Pressable>
      </View>
      {legend ? <WorkMapLegend view={view} waiting={props.waiting} /> : null}
      <ChoiceSheet title="Trabajo" open={picking} onClose={() => setPicking(false)} choices={workChoicesOf(view).map((choice) => ({
        testID: choice.id ? `mapa-trabajo-${choice.id}` : 'mapa-trabajo-todos', label: choice.label, color: choice.color, on: (filter.workId ?? '') === choice.id,
        pick: () => onFilter(workMapWorkFilter(filter, choice.id || undefined)),
      }))} />
    </View>
  );
}

/** The rows over the map (o-01, phone): stage, how many streets, the cut day, the work and the legend. */
export function WorkMapFilters(props: FilterProps & { waiting: number }) {
  return (
    <View className="gap-2">
      <StageAndDay {...props} />
      <WorkAndLegend {...props} />
    </View>
  );
}

/** «Convenciones», opened from «Leyenda»: one line per work, what is still to build and what waits approval. */
function WorkMapLegend(props: { view: WorkMapView; waiting: number }) {
  return (
    <View testID="mapa-leyenda" className="gap-1.5 rounded-lg border border-outline/15 bg-surface px-3 py-2">
      {mapLegendEntries(props.view, props.waiting).map((entry) => (
        <View key={entry.key} className="flex-row items-center gap-2">
          {entry.kind === 'todo' ? <View className="w-4 border-t-2 border-dashed border-on-surface-variant/60" />
            : entry.kind === 'waiting' ? <View className="h-2.5 w-4 rounded-full bg-on-surface/30" />
            : <View className="h-1 w-4 rounded-full" style={{ backgroundColor: entry.color ?? undefined }} />}
          <Text className={`flex-1 text-[13px] ${entry.kind === 'work' ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>{entry.label}</Text>
        </View>
      ))}
    </View>
  );
}
