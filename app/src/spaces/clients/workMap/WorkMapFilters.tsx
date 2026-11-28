import { useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { CalendarDays, Check, ChevronDown } from 'lucide-react-native';
import { mapLegendEntries, workChoiceLabel, workChoicesOf, workMapCutChip, workMapCutDays, workMapCutLabel, workMapDayFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Sheet } from '../../../ui/Sheet';
import { useColores } from '../../../ui/tema';
import { KICKER } from './WorkMapPanel';
import { MAP_SHADOW } from './MapFloating';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };
type Choice = { testID: string; label: string; on: boolean; pick: () => void; color?: string | null };

const FLOATING = 'h-11 flex-row items-center gap-1.5 rounded-full border border-outline/15 bg-surface px-3.5';

function ChoiceSheet(props: { title: string; open: boolean; onClose: () => void; choices: Choice[] }) {
  const colors = useColores();
  return (
    <Sheet visible={props.open} onClose={props.onClose} className="px-4 pt-2">
      <Text className={`${KICKER} mb-2`}>{props.title}</Text>
      {props.choices.map((choice) => (
        <Pressable key={choice.testID} testID={choice.testID} accessibilityState={{ selected: choice.on }} onPress={() => { choice.pick(); props.onClose(); }} className="min-h-[48px] flex-row items-center justify-between border-b border-outline/10">
          <View className="flex-1 flex-row items-center gap-2">
            {choice.color ? <View className="h-3 w-3 rounded-full border-[1.5px] border-on-surface/40" style={{ backgroundColor: choice.color }} /> : null}
            <Text className={`flex-1 text-[15px] ${choice.on ? 'font-semibold text-primary' : 'text-on-surface'}`}>{choice.label}</Text>
          </View>
          {choice.on ? <Check size={18} color={colors.primary} /> : null}
        </Pressable>
      ))}
    </Sheet>
  );
}

/** «Hasta hoy ▾» over the map (design mapa-v2): only days with approved progress; with one, it only says it. */
function CutChip(props: FilterProps) {
  const { map, filter, onFilter } = props;
  const colors = useColores();
  const [picking, setPicking] = useState(false);
  const days = workMapCutDays(map);
  const choosable = days.length > 1;
  return (
    <>
      <Pressable testID="mapa-corte" disabled={!choosable} onPress={() => setPicking(true)} className={FLOATING} style={MAP_SHADOW}>
        <CalendarDays size={16} color={colors['on-surface-variant']} />
        <Text className="text-[14px] font-semibold text-on-surface">{workMapCutChip(filter)}</Text>
        {choosable ? <ChevronDown size={16} color={colors['on-surface-variant']} /> : null}
      </Pressable>
      <ChoiceSheet title="Avance hasta el día" open={picking} onClose={() => setPicking(false)} choices={[
        { testID: 'mapa-corte-hoy', label: 'Hasta hoy', on: !filter.untilDay, pick: () => onFilter(workMapDayFilter(filter, '')) },
        ...days.map((day) => ({ testID: `mapa-corte-${day}`, label: workMapCutLabel(day), on: filter.untilDay === day, pick: () => onFilter(workMapDayFilter(filter, day)) })),
      ]} />
    </>
  );
}

/** The works as a select, not a row of chips (José 09/11), floating beside the cut. */
function WorkChip(props: FilterProps) {
  const { view, filter, onFilter } = props;
  const colors = useColores();
  const [picking, setPicking] = useState(false);
  if (!view.works.length) return null;
  const chosen = view.works.find((work) => work.id === filter.workId);
  return (
    <>
      <Pressable testID="mapa-trabajo" onPress={() => setPicking(true)} className={`${FLOATING} max-w-[220px]`} style={MAP_SHADOW}>
        {chosen ? <View className="h-2.5 w-2.5 rounded-full border-[1.5px] border-on-surface/40" style={{ backgroundColor: chosen.color }} /> : null}
        <Text numberOfLines={1} className="shrink text-[14px] font-semibold text-on-surface">{workChoiceLabel(view, filter.workId)}</Text>
        <ChevronDown size={16} color={colors['on-surface-variant']} />
      </Pressable>
      <ChoiceSheet title="Trabajo" open={picking} onClose={() => setPicking(false)} choices={workChoicesOf(view).map((choice) => ({
        testID: choice.id ? `mapa-trabajo-${choice.id}` : 'mapa-trabajo-todos', label: choice.label, color: choice.color, on: (filter.workId ?? '') === choice.id,
        pick: () => onFilter(workMapWorkFilter(filter, choice.id || undefined)),
      }))} />
    </>
  );
}

/**
 * The cut and the work floating over the map (José 20/11, design mapa-v2). The stages are chips in
 * «Capas y leyenda»; the legend opens from its ⓘ.
 */
export function WorkMapFilters(props: FilterProps) {
  return (
    <View className="flex-row flex-wrap items-center gap-2">
      <CutChip {...props} />
      <WorkChip {...props} />
    </View>
  );
}

/** «Convenciones» at the foot of the map: one line per work, what is still to build and what waits approval. */
export function WorkMapLegend(props: { view: WorkMapView; waiting: number }) {
  if (!props.view.works.length) return null;
  return (
    <View testID="mapa-leyenda" className="gap-1.5 rounded-xl border border-outline/15 bg-surface px-3 py-2" style={MAP_SHADOW}>
      {mapLegendEntries(props.view, props.waiting).map((entry) => (
        <View key={entry.key} className="flex-row items-center gap-2">
          {entry.kind === 'todo' ? <View className="w-4 border-t-2 border-dashed border-on-surface-variant/60" />
            : entry.kind === 'waiting' ? <View className="w-4 border-t-[3px] border-dashed border-on-surface/50" />
            : <View className="h-1.5 w-4 rounded-full border border-on-surface/40" style={{ backgroundColor: entry.color ?? undefined }} />}
          <Text className={`text-[13px] ${entry.kind === 'work' ? 'font-medium text-on-surface' : 'text-on-surface-variant'}`}>{entry.label}</Text>
        </View>
      ))}
    </View>
  );
}
