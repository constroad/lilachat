import { useMemo, useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { isLayerOn, layerRowsOf, NO_HIDDEN_LAYERS, NO_WORKS_YET, WORK_NOT_ASSIGNED, toggleLayer, workMapStageFilter, type MapLayerGroup, type MapLayers, type ReportPhotoLayerRow, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { Interruptor } from '../../../ui/Interruptor';
import { KICKER } from './WorkMapPanel';

/** The layers the map hides; everything starts on (José 19/11, design cc-04). */
export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayers>(NO_HIDDEN_LAYERS);
  return { layers, toggle: (group: MapLayerGroup, key: string) => setLayers((before) => toggleLayer(before, group, key)) };
}

const ROW = 'min-h-[52px] flex-row items-center gap-3 border-b border-outline/10';

function Section(props: { title: string; aside?: string; children: ReactNode }) {
  return (
    <View className="mt-3">
      <View className="mb-1 flex-row justify-between">
        <Text className={KICKER}>{props.title}</Text>
        {props.aside ? <Text className="text-[12px] text-on-surface-variant">{props.aside}</Text> : null}
      </View>
      {props.children}
    </View>
  );
}

function StageChips(props: { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void }) {
  if (!props.map.stages.length) return null;
  const chip = (id: string, label: string) => {
    const on = (props.filter.stageId ?? '') === id;
    return (
      <Pressable key={id || 'todas'} testID={`capas-etapa-${id || 'todas'}`} accessibilityState={{ selected: on }} onPress={() => props.onFilter(workMapStageFilter(props.map, props.filter, id))} className={`min-h-[40px] justify-center rounded-lg border px-3 ${on ? 'border-primary bg-primary/10' : 'border-outline/20 bg-surface'}`}>
        <Text className={`text-[14px] font-semibold ${on ? 'text-primary' : 'text-on-surface'}`}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <Section title={`Etapas · ${props.map.stages.length}`}>
      <View className="flex-row flex-wrap gap-2 pt-1">{[chip('', 'Todas'), ...props.map.stages.map((stage) => chip(stage.id, stage.name))]}</View>
    </Section>
  );
}

/** «Fotos» and its sub-layers, one per report type (José 19/11). */
type PhotoLayersProps = { count: number; shown: boolean; onToggle: () => void; reports: readonly ReportPhotoLayerRow[]; onToggleReport: (type: string) => void };
type PanelProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; layers: MapLayers; onToggle: (group: MapLayerGroup, key: string) => void; photos?: PhotoLayersProps; /** «Hasta hoy», the work, the days and the legend (José 28/11: off the top of the map). */ controls?: ReactNode };

/**
 * «Fotos» with a sub-row per report type (José 19/11, as Portal): each its switch and count. The
 * sub-rows hang from «Fotos»: with «Fotos» off no photo shows, whatever its own switch says.
 */
function PhotoLayers({ photos }: { photos: PhotoLayersProps }) {
  return (
    <Section title={`Fotos · ${photos.count}`}>
      <View className={ROW}>
        <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface">Fotos de obra ubicadas</Text>
        <Interruptor testID="capa-fotos" value={photos.shown} onValueChange={photos.onToggle} />
      </View>
      <View testID="capa-fotos-informes" className={`ml-3 border-l-2 border-outline/15 pl-3 ${photos.shown ? '' : 'opacity-50'}`}>
        {photos.reports.map((report) => (
          <View key={report.type} className={ROW}>
            <Text numberOfLines={1} className="min-w-0 flex-1 text-[15px] text-on-surface">{`${report.label} (${report.count})`}</Text>
            <Interruptor testID={`capa-fotos-${report.type}`} value={report.shown} onValueChange={() => photos.onToggleReport(report.type)} />
          </View>
        ))}
      </View>
    </Section>
  );
}

/**
 * «Capas y leyenda» (José 19/11, design cc-04 mobile, the sheet over the map): the works (partidas)
 * in their color with a switch, the stages as chips, the drawings by type, the observations by state
 * and the field photos. A switch only hides what the map draws; the figures stay those of the filter.
 */
export function MapLayersPanel(props: PanelProps) {
  const rows = useMemo(() => layerRowsOf(props.view, props.map.marks ?? [], props.map.observations ?? [], props.map, props.filter), [props.view, props.map, props.filter]);
  const on = (group: MapLayerGroup, key: string) => isLayerOn(props.layers, group, key);
  return (
    <View testID="mapa-capas" className="mb-2">
      <Text className="text-[13px] font-bold uppercase tracking-[1.5px] text-primary">Ver</Text>
      {props.controls ? <Section title="Corte y leyenda">{props.controls}</Section> : null}
      {rows.works.length ? (
        <Section title={`Partidas (trabajos) · ${rows.works.length}`} aside="Avance">
          {rows.works.map((work) => (
            <View key={work.id} className={ROW}>
              <View className="h-3.5 w-3.5 rounded-full border-[1.5px] border-on-surface/40" style={{ backgroundColor: work.color }} />
              <View className="min-w-0 flex-1">
                <Text className="text-[15px] font-semibold text-on-surface" numberOfLines={1}>{work.name}</Text>
                <Text className="text-[12px] text-on-surface-variant">{work.assigned ? `${work.percent} % de avance` : WORK_NOT_ASSIGNED}</Text>
              </View>
              <Interruptor testID={`capa-trabajo-${work.id}`} value={on('works', work.id)} onValueChange={() => props.onToggle('works', work.id)} />
            </View>
          ))}
        </Section>
      ) : (
        <Section title="Partidas (trabajos)">
          <Text testID="capas-sin-trabajos" className="py-2 text-[14px] text-on-surface-variant">{NO_WORKS_YET}</Text>
        </Section>
      )}
      <StageChips map={props.map} filter={props.filter} onFilter={props.onFilter} />
      {rows.marks.length ? (
        <Section title={`Dibujos · ${rows.marks.reduce((sum, group) => sum + group.count, 0)}`}>
          {rows.marks.map((group) => (
            <View key={group.type} className={ROW}>
              <View className="h-3.5 w-3.5 rounded-[3px]" style={{ backgroundColor: group.color }} />
              <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface" numberOfLines={1}>{`${group.label} · ${group.count}`}</Text>
              <Interruptor testID={`capa-dibujo-${group.type}`} value={on('marks', group.type)} onValueChange={() => props.onToggle('marks', group.type)} />
            </View>
          ))}
        </Section>
      ) : null}
      {rows.observations.length ? (
        <Section title={`Observaciones · ${rows.observations.reduce((sum, one) => sum + one.count, 0)}`}>
          {rows.observations.map((one) => (
            <View key={one.key} className={ROW}>
              <View className={`h-3.5 w-3.5 rounded-full ${one.key === 'open' ? 'bg-error' : 'bg-en-linea'}`} />
              <Text className="min-w-0 flex-1 text-[15px] font-semibold text-on-surface">{`${one.label} (${one.count})`}</Text>
              <Interruptor testID={`capa-observacion-${one.key}`} value={on('observations', one.key)} onValueChange={() => props.onToggle('observations', one.key)} />
            </View>
          ))}
        </Section>
      ) : null}
      {props.photos && props.photos.count > 0 ? <PhotoLayers photos={props.photos} /> : null}
    </View>
  );
}
