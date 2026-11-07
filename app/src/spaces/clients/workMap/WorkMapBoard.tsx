import { useMemo, useState, type ReactNode } from 'react';
import { Linking, Pressable, ScrollView, Text, View } from 'react-native';
import { ExternalLink, Maximize2, X } from 'lucide-react-native';
import { metersLabel, workMapHeadline, workMapStageFilter, workMapView, type WorkMap, type WorkMapFilter, type WorkMapStreetRow, type WorkMapView } from '@lilachat/shared';
import { Modal } from '../../../ui/Modal';
import { useColores } from '../../../ui/tema';
import { useMargenes } from '../../../ui/useMargenes';
import { WorkMapSurface } from './WorkMapSurface';

function Pill(props: { testID: string; on: boolean; color?: string; label: string; onPress: () => void }) {
  return (
    <Pressable testID={props.testID} accessibilityState={{ selected: props.on }} onPress={props.onPress} className={`min-h-[40px] flex-row items-center gap-1.5 rounded-full border px-3 ${props.on ? 'border-primary bg-primary' : 'border-outline/20 bg-surface'}`}>
      {props.color ? <View className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: props.color }} /> : null}
      <Text className={`text-[14px] font-semibold ${props.on ? 'text-on-primary' : 'text-on-surface'}`}>{props.label}</Text>
    </Pressable>
  );
}

const PillRow = (props: { children: ReactNode }) => (
  <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 8 }}>{props.children}</ScrollView>
);

function Filters(props: { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void }) {
  const { map, view, filter, onFilter } = props;
  const stage = filter.stageId ? { stageId: filter.stageId } : {};
  return (
    <>
      {map.stages.length ? (
        <PillRow>
          <Pill testID="mapa-etapa-todas" on={!filter.stageId} label="Todas las etapas" onPress={() => onFilter(workMapStageFilter(map, filter, ''))} />
          {map.stages.map((row) => <Pill key={row.id} testID={`mapa-etapa-${row.id}`} on={filter.stageId === row.id} label={row.name} onPress={() => onFilter(workMapStageFilter(map, filter, row.id))} />)}
        </PillRow>
      ) : null}
      {view.works.length ? (
        <PillRow>
          <Pill testID="mapa-trabajo-todos" on={!filter.workId} label="Todos" onPress={() => onFilter(stage)} />
          {view.works.map((work) => <Pill key={work.id} testID={`mapa-trabajo-${work.id}`} on={filter.workId === work.id} color={work.color} label={`${work.name} ${work.percent} %`} onPress={() => onFilter({ ...stage, workId: work.id })} />)}
        </PillRow>
      ) : null}
    </>
  );
}

function StreetCard(props: { street: WorkMapStreetRow }) {
  const { street } = props;
  return (
    <View testID={`mapa-calle-${street.id}`} className="rounded-xl border border-outline/15 bg-surface p-3">
      <View className="flex-row items-center justify-between gap-2">
        <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface">{street.name}</Text>
        <Text className="text-[13px] text-on-surface-variant">{metersLabel(street.lengthM)}</Text>
      </View>
      <View className="mt-2 h-2 overflow-hidden rounded-full bg-surface-variant">
        {street.segments.map((segment) => <View key={`${segment.workId}-${segment.fromPct}`} className="absolute inset-y-0" style={{ left: `${segment.fromPct}%`, width: `${segment.widthPct}%`, backgroundColor: segment.color }} />)}
      </View>
      <Text className="mt-1.5 text-[13px] text-on-surface-variant">{street.status}</Text>
    </View>
  );
}

function FullMap(props: { view: WorkMapView; open: boolean; onClose: () => void }) {
  const colors = useColores();
  const margins = useMargenes();
  return (
    <Modal visible={props.open} animationType="slide" onRequestClose={props.onClose}>
      <View className="flex-1 bg-background">
        {props.open ? <WorkMapSurface view={props.view} moves /> : null}
        <Pressable testID="mapa-cerrar-completo" accessibilityLabel="Cerrar el mapa" onPress={props.onClose} className="absolute right-3 h-12 w-12 items-center justify-center rounded-full bg-surface" style={{ top: margins.cabecera + 8 }}>
          <X size={22} color={colors['on-surface']} />
        </Pressable>
      </View>
    </Modal>
  );
}

/** The map, its figures and its streets (design `o-01-mapa-obra`), read only. */
export function WorkMapBoard(props: { map: WorkMap; pageUrl: string; height: number }) {
  const { map, pageUrl, height } = props;
  const colors = useColores();
  const [filter, setFilter] = useState<WorkMapFilter>({});
  const [wide, setWide] = useState(false);
  const view = useMemo(() => workMapView(map, filter), [map, filter]);
  return (
    <View testID="mapa-servicio" className="gap-3">
      <View>
        <Text className="text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant">Avance de la obra</Text>
        <Text testID="mapa-avance" className="text-[17px] font-semibold text-on-surface">{workMapHeadline(view)}</Text>
      </View>
      <Filters map={map} view={view} filter={filter} onFilter={setFilter} />
      <View pointerEvents="none" className="overflow-hidden rounded-2xl border border-outline/15" style={{ height }}>
        {wide ? null : <WorkMapSurface view={view} moves={false} />}
      </View>
      <View className="flex-row gap-2">
        <Pressable testID="mapa-pantalla-completa" onPress={() => setWide(true)} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-2 rounded-xl bg-primary">
          <Maximize2 size={18} color={colors['on-primary']} />
          <Text className="text-[15px] font-semibold text-on-primary">Ver mapa completo</Text>
        </Pressable>
        <Pressable testID="mapa-abrir" onPress={() => void Linking.openURL(pageUrl)} className="min-h-[48px] flex-row items-center justify-center gap-2 rounded-xl border border-outline/20 px-4">
          <ExternalLink size={18} color={colors['on-surface']} />
          <Text className="text-[15px] font-semibold text-on-surface">Portal</Text>
        </Pressable>
      </View>
      {view.streets.map((street) => <StreetCard key={street.id} street={street} />)}
      <FullMap view={view} open={wide} onClose={() => setWide(false)} />
    </View>
  );
}
