import type { ReactNode } from 'react';
import { StreetDelete, type StreetDeleteSend } from './StreetDelete';
import { Pressable, Text, View } from 'react-native';
import { ChevronRight } from 'lucide-react-native';
import { useColores } from '../../../ui/tema';
import { metersLabel, NO_STRETCHES, stageStateLabel, workMapCutChip, workShares, type StageGroup, type WorkMapFilter, type WorkMapStreetRow, type WorkMapView } from '@lilachat/shared';

export const KICKER = 'font-mono text-[11px] font-bold uppercase tracking-[2px] text-on-surface-variant';

function StackedBar(props: { view: WorkMapView }) {
  return (
    <View testID="mapa-barra-trabajos" className="mt-3 h-3 flex-row overflow-hidden rounded-full bg-surface-variant">
      {workShares(props.view).map((share) => <View key={share.workId} className="h-full" style={{ width: `${share.percent}%`, backgroundColor: share.color }} />)}
    </View>
  );
}

function PanelHead(props: { view: WorkMapView; groups: StageGroup[]; badge?: ReactNode }) {
  const { view, groups } = props;
  const lengthM = groups.reduce((sum, group) => sum + group.lengthM, 0);
  return (
    <View>
      <View className="flex-row items-center justify-between gap-2">
        <Text className={KICKER}>Avance de la obra</Text>
        {props.badge}
      </View>
      <View testID="mapa-avance" className="mt-1 flex-row items-end justify-between gap-3">
        {view.totalM > 0 ? (
          <View className="min-w-0 flex-1 flex-row flex-wrap items-baseline gap-x-2">
            <Text className="text-[36px] font-extrabold text-on-surface">{String(view.percent).replace('.', ',')}<Text className="text-primary"> %</Text></Text>
            <Text className="text-[13px] text-on-surface-variant">{`${metersLabel(view.doneM)} de ${metersLabel(view.totalM)} avanzados`}</Text>
          </View>
        ) : <Text className="min-w-0 flex-1 text-[14px] text-on-surface-variant">{NO_STRETCHES}</Text>}
        <View className="items-end pb-1">
          <Text className="text-[11px] text-on-surface-variant">Longitud total</Text>
          <Text className="font-mono text-[15px] font-semibold text-on-surface">{metersLabel(lengthM)}</Text>
        </View>
      </View>
      <StackedBar view={view} />
    </View>
  );
}

function StreetCard(props: { street: WorkMapStreetRow; deleteStreet?: StreetDeleteSend; onOpen?: () => void }) {
  const { street } = props;
  const colors = useColores();
  return (
    <View testID={`mapa-calle-${street.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <View className="flex-row items-start justify-between gap-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-bold text-on-surface">{street.name}</Text>
        <Text className="rounded-md border border-outline/20 px-1.5 py-0.5 font-mono text-[12px] font-semibold text-on-surface">{metersLabel(street.lengthM)}</Text>
      </View>
      <View className="mt-3 h-2.5 overflow-hidden rounded-full bg-surface-variant">
        {street.segments.map((segment) => <View key={`${segment.workId}-${segment.fromPct}`} className="absolute inset-y-0" style={{ left: `${segment.fromPct}%`, width: `${segment.widthPct}%`, backgroundColor: segment.color }} />)}
      </View>
      <View className="mt-2 flex-row flex-wrap items-center justify-between">
        <Text className="min-w-0 flex-1 font-mono text-[12px] text-on-surface-variant">{street.status}</Text>
        {props.onOpen ? <Pressable testID={`ver-tramos-${street.id}`} onPress={props.onOpen} className="h-11 flex-row items-center"><Text className="text-[14px] font-semibold text-primary">Ver tramos</Text><ChevronRight size={16} color={colors.primary} /></Pressable> : null}
        {props.deleteStreet ? <StreetDelete street={street} send={props.deleteStreet} /> : null}
      </View>
    </View>
  );
}

function GroupTitle(props: { group: StageGroup }) {
  const state = stageStateLabel(props.group);
  const active = state === 'En ejecución';
  const count = props.group.streets.length;
  return (
    <View className="flex-row items-center justify-between gap-2 pb-2 pt-4">
      <View className="min-w-0 flex-1 flex-row items-center gap-2">
        <View className={`h-2 w-2 rounded-full ${active ? 'bg-primary' : 'bg-outline/50'}`} />
        <Text numberOfLines={1} className={`min-w-0 flex-1 font-mono text-[11px] font-bold uppercase tracking-[2px] ${active ? 'text-primary' : 'text-on-surface-variant'}`}>{props.group.name ? `${props.group.name} · ${state}` : state}</Text>
      </View>
      <Text className="text-[12px] text-on-surface-variant">{count === 1 ? '1 calle' : `${count} calles`}</Text>
    </View>
  );
}

/**
 * The sheet under the map (design `o-01-mapa-obra`, phone): the big figure with the bar by work,
 * the streets under their stage, and the day the map is cut at. Admins see the units of the runway
 * control report after the streets (`o-07`; audit 08/11 item 14: it came before them).
 */
export function WorkMapPanel(props: { view: WorkMapView; groups: StageGroup[]; filter: WorkMapFilter; badge?: ReactNode; top?: ReactNode; deleteStreet?: StreetDeleteSend; /** «Ver tramos» (o-03). */ onOpenStreet?: (streetId: string) => void }) {
  return (
    <View className="-mx-4 -mt-5 rounded-t-3xl border-t border-outline/15 bg-surface px-4 pb-4 pt-2">
      <View className="mb-3 h-1 w-10 self-center rounded-full bg-outline/30" />
      <PanelHead view={props.view} groups={props.groups} badge={props.badge} />
      {props.groups.map((group) => (
        <View key={group.id}>
          <GroupTitle group={group} />
          <View className="gap-3">{group.streets.map((street) => <StreetCard key={street.id} street={street} deleteStreet={props.deleteStreet} onOpen={props.onOpenStreet ? () => props.onOpenStreet?.(street.id) : undefined} />)}</View>
        </View>
      ))}
      {props.top ? <View className="mt-4">{props.top}</View> : null}
      <Text testID="mapa-corte-pie" className="mt-4 text-right font-mono text-[12px] text-on-surface-variant">Corte: {workMapCutChip(props.filter)}</Text>
    </View>
  );
}
