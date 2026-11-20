import { useState, type ReactElement } from 'react';
import { Pressable, Text, View, useWindowDimensions } from 'react-native';
import { ArrowUp, ChevronDown, ChevronUp, Truck } from 'lucide-react-native';
import { ARRIVED_LABEL, arrivalKeyOf, canMoveNext, FINISHED_TITLE, isClosedStatus, MOVE_NEXT_LABEL, moveNext, openOrderOf, pageLine, QUEUE_BADGES, QUEUE_HINT, QUEUE_TITLE, queueCountsLine, queueVolumeLine, selectedUnitOf, SELECTED_TITLE, UNITS_CLOSE_HINT, UNLOADING_TITLE, unloadQueueOf, type QueuedUnit, type UnitsQueueViewProps, type RepeatSection } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';
import { Pill, ResultsStrip } from './ReportSections';
import { PLATE_FONT, UnitCardView, type Open } from './UnitCardView';

const NO_UNITS = 'Todavía no salió ningún volquete de planta.';
/** From this width (a tablet) the queue goes left and the unit right, as design pv2-04. */
const SIDE_BY_SIDE_FROM = 900;

type Props = UnitsQueueViewProps;

type RowProps = { unit: QueuedUnit; section: RepeatSection; selected: boolean; last: boolean; onOpen: Open; onSelect: (itemId: string) => void; onNext?: () => void };

/** One unit in line: its number, plate and line, its status or «Llegó», and «Siguiente ↑». */
function QueueRow({ unit, section, selected, last, onOpen, onSelect, onNext }: RowProps) {
  const colors = useColores();
  const away = unit.status === 'onTheWay';
  const arrival = away ? arrivalKeyOf(unit.item) : undefined;
  const unloading = unit.status === 'unloading';
  return (
    <View testID={`cola-${unit.item.id}`} className={`flex-row items-center gap-2 px-3 py-2 ${last ? '' : 'border-b border-outline/10'} ${selected ? 'bg-primary/10' : ''} ${away ? 'opacity-70' : ''}`}>
      <View className={`h-7 w-7 items-center justify-center rounded-full ${unloading ? 'bg-primary' : 'border border-outline/25'}`}>
        <Text className={`text-[13px] font-bold ${unloading ? 'text-on-primary' : 'text-on-surface-variant'}`}>{unit.position}</Text>
      </View>
      <Pressable testID={`elegir-${unit.item.id}`} disabled={away} onPress={() => onSelect(unit.item.id)} className="min-w-0 flex-1">
        <Text className="text-[15px] font-bold text-on-surface" style={{ fontFamily: PLATE_FONT }} numberOfLines={1}>{unit.plate}</Text>
        <Text className="text-[12px] text-on-surface-variant" numberOfLines={1}>{unit.line}</Text>
      </Pressable>
      {arrival ? (
        <Pressable testID={`llego-${unit.item.id}`} onPress={() => onOpen({ sectionId: section.id, itemId: unit.item.id, key: arrival })} accessibilityLabel={`${ARRIVED_LABEL} ${unit.plate}`} className="h-9 flex-row items-center gap-1.5 rounded-lg bg-primary px-3">
          <Truck size={16} color={colors['on-primary']} />
          <Text className="text-[13px] font-bold text-on-primary">{ARRIVED_LABEL}</Text>
        </Pressable>
      ) : away ? null : <Pill badge={QUEUE_BADGES[unit.status]} testID={`estado-cola-${unit.item.id}`} />}
      {onNext ? (
        <Pressable testID={`siguiente-${unit.item.id}`} onPress={onNext} accessibilityLabel={`${MOVE_NEXT_LABEL}: ${unit.plate}`} className="h-9 flex-row items-center gap-1 rounded-lg border border-outline/25 px-2">
          <Text className="text-[13px] font-semibold text-on-surface">{MOVE_NEXT_LABEL}</Text>
          <ArrowUp size={14} color={colors['on-surface']} />
        </Pressable>
      ) : null}
    </View>
  );
}

/** The closed units fold away: they no longer need the person. */
function FinishedRows({ units, render }: { units: QueuedUnit[]; render: (unit: QueuedUnit, last: boolean) => ReactElement }) {
  const colors = useColores();
  const [open, setOpen] = useState(false);
  const Chevron = open ? ChevronUp : ChevronDown;
  if (!units.length) return null;
  return (
    <View className="border-t border-outline/10">
      <Pressable testID="ver-terminadas" onPress={() => setOpen(!open)} accessibilityState={{ expanded: open }} className="h-11 flex-row items-center gap-2 px-3">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{FINISHED_TITLE}</Text>
        <Text className="text-[12px] font-bold text-primary">{units.length}</Text>
        <Chevron size={16} color={colors.primary} />
      </Pressable>
      {open ? units.map((unit, index) => render(unit, index === units.length - 1)) : null}
    </View>
  );
}

/** The queue (pv2-01 below the card, pv2-04 left): the open units to reorder, the ones on their way, the closed ones folded. */
function QueueList({ queue, section, selectedId, onOpen, onSelect, onReorder }: { queue: QueuedUnit[]; section: RepeatSection; selectedId: string | null; onOpen: Open; onSelect: (itemId: string) => void; onReorder?: (order: string[]) => void }) {
  const order = openOrderOf(queue);
  const rowOf = (unit: QueuedUnit, last: boolean) => {
    const onNext = onReorder && canMoveNext(unit) ? () => onReorder(moveNext(order, unit.item.id)) : undefined;
    return <QueueRow key={unit.item.id} unit={unit} section={section} selected={unit.item.id === selectedId} last={last} onOpen={onOpen} onSelect={onSelect} onNext={onNext} />;
  };
  const inLine = queue.filter((unit) => !isClosedStatus(unit.status));
  return (
    <View testID="cola-descarga" className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
      <View className="flex-row items-baseline justify-between gap-2 px-3 pb-1 pt-3">
        <Text className="flex-1 text-[11px] font-bold uppercase tracking-[1.5px] text-primary" numberOfLines={1}>{QUEUE_TITLE}</Text>
        <Text className="text-[12px] text-on-surface-variant">{QUEUE_HINT}</Text>
      </View>
      {inLine.map((unit, index) => rowOf(unit, index === inLine.length - 1))}
      <FinishedRows units={queue.filter((unit) => isClosedStatus(unit.status))} render={rowOf} />
    </View>
  );
}

/**
 * The units of a control de pista as an unloading queue (José 20/11, designs pv2-01…pv2-04):
 * the unit on the card with its photos and «Terminar unidad», and the queue the person orders in
 * the field. On a tablet the queue goes left and the unit right. Nobody adds a unit; Portal lists
 * the order's dispatches.
 */
export function ReportUnitsView({ section, onOpen, onView, onAlbum, order, onReorder, selectedId, onSelect }: Props) {
  const { width } = useWindowDimensions();
  const queue = unloadQueueOf(section, order);
  const selected = selectedUnitOf(queue, selectedId);
  const head = [queueCountsLine(queue), queueVolumeLine(queue), pageLine(section)].filter(Boolean).join(' · ');
  const wide = width >= SIDE_BY_SIDE_FROM;
  const card = selected ? (
    <View className="gap-2" style={wide ? { flex: 7 } : undefined}>
      <Text className="text-[11px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">{selected.status === 'unloading' ? UNLOADING_TITLE : SELECTED_TITLE}</Text>
      <UnitCardView unit={selected} section={section} onOpen={onOpen} onView={onView} onAlbum={onAlbum} />
    </View>
  ) : null;
  const list = queue.length ? <View style={wide ? { flex: 5 } : undefined}><QueueList queue={queue} section={section} selectedId={selected?.item.id ?? null} onOpen={onOpen} onSelect={onSelect} onReorder={onReorder} /></View> : null;
  return (
    <View testID={`unidades-${section.id}`} className="gap-3">
      {section.summary.length ? <Text testID="resumen-unidades" className="text-[15px] font-bold text-on-surface">{section.summary.join(' · ')}</Text> : null}
      {head ? <Text testID="conteo-unidades" className="text-[14px] text-on-surface-variant">{head}</Text> : null}
      {section.items.length ? <Text testID="cierre-unidades" className="text-[13px] text-on-surface-variant">{UNITS_CLOSE_HINT}</Text> : null}
      {section.items.length === 0 ? <Text className="pt-4 text-center text-[14px] text-on-surface-variant">{NO_UNITS}</Text> : null}
      {wide ? <View className="flex-row items-start gap-3">{list}{card}</View> : <>{card}{list}</>}
      <ResultsStrip results={section.results} testID="resultados-unidades" />
    </View>
  );
}
