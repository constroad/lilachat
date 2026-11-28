import { useMemo, useState } from 'react';
import { isLayerOn, layerRowsOf, NO_HIDDEN_LAYERS, NO_WORKS_YET, WORK_NOT_ASSIGNED, toggleLayer, workMapStageFilter, type MapLayerGroup, type MapLayers, type ReportPhotoLayerRow, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

/** The layers the map hides; everything starts on (José 19/11, design cc-04). */
export function useMapLayers() {
  const [layers, setLayers] = useState<MapLayers>(NO_HIDDEN_LAYERS);
  const [open, setOpen] = useState(true);
  return { layers, toggle: (group: MapLayerGroup, key: string) => setLayers((before) => toggleLayer(before, group, key)), open, setOpen };
}

function Switch(props: { on: boolean; label: string; testId: string; onToggle: () => void }) {
  return (
    <button type="button" role="switch" aria-checked={props.on} aria-label={props.label} data-testid={props.testId} onClick={props.onToggle} className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${props.on ? 'bg-primary' : 'bg-outline/30'}`}>
      <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-surface shadow transition-all ${props.on ? 'left-[22px]' : 'left-0.5'}`} />
    </button>
  );
}

const ROW = 'flex min-h-12 items-center gap-3 rounded-xl border border-outline/15 bg-surface px-3 py-2';
const Dot = ({ color, square }: { color: string; square?: boolean }) => <span aria-hidden className={`h-3 w-3 shrink-0 ring-1 ring-on-surface/20 ${square ? 'rounded-[3px]' : 'rounded-full'}`} style={{ backgroundColor: color }} />;

function Section(props: { title: string; aside?: string; children: React.ReactNode }) {
  return (
    <section className="border-b border-outline/15 px-4 py-3 md:px-5">
      <p className={`mb-2 flex justify-between ${KICKER}`}>{props.title}{props.aside ? <span className="normal-case tracking-normal">{props.aside}</span> : null}</p>
      <div className="flex flex-col gap-2">{props.children}</div>
    </section>
  );
}

function StageChips(props: { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void }) {
  if (!props.map.stages.length) return null;
  const chip = (id: string, label: string) => {
    const on = (props.filter.stageId ?? '') === id;
    return <button key={id || 'todas'} type="button" data-testid={`capas-etapa-${id || 'todas'}`} aria-pressed={on} onClick={() => props.onFilter(workMapStageFilter(props.map, props.filter, id))} className={`h-8 rounded-lg border px-3 text-[13px] font-semibold ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline/20 bg-surface text-on-surface hover:bg-background'}`}>{label}</button>;
  };
  return (
    <Section title={`Etapas · ${props.map.stages.length}`}>
      <div className="flex flex-wrap gap-1.5">{[chip('', 'Todas'), ...props.map.stages.map((stage) => chip(stage.id, stage.name))]}</div>
    </Section>
  );
}

/** «Fotos» and its sub-layers, one per report type (José 19/11). */
export type PhotoLayersProps = { count: number; shown: boolean; onToggle: () => void; reports: readonly ReportPhotoLayerRow[]; onToggleReport: (type: string) => void };
type PanelProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void; layers: MapLayers; onToggle: (group: MapLayerGroup, key: string) => void; photos?: PhotoLayersProps };

/**
 * «Fotos» with a sub-row per report type (José 19/11, as Portal): each its switch and count. The
 * sub-rows hang from «Fotos»: with «Fotos» off no photo shows, whatever its own switch says.
 */
function PhotoLayers({ photos }: { photos: PhotoLayersProps }) {
  return (
    <Section title={`Fotos · ${photos.count}`}>
      <div className={ROW}>
        <span className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">Fotos de obra ubicadas</span>
        <Switch on={photos.shown} label="Mostrar las fotos" testId="capa-fotos" onToggle={photos.onToggle} />
      </div>
      <div data-testid="capa-fotos-informes" className={`ml-4 flex flex-col gap-2 border-l-2 border-outline/15 pl-3 ${photos.shown ? '' : 'opacity-50'}`}>
        {photos.reports.map((report) => (
          <div key={report.type} className={ROW}>
            <span className="min-w-0 flex-1 truncate text-[14px] text-on-surface">{report.label} <span className="text-on-surface-variant">{`(${report.count})`}</span></span>
            <Switch on={report.shown} label={`Mostrar las fotos de ${report.label}`} testId={`capa-fotos-${report.type}`} onToggle={() => photos.onToggleReport(report.type)} />
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * «Capas y leyenda» (José 19/11, design cc-04): the works (partidas) in their color with a switch,
 * the stages as chips, the drawings by type, the observations by state and the field photos. A
 * switch only hides what the map draws; the figures below stay those of the filter.
 */
export function MapLayersPanel(props: PanelProps) {
  const rows = useMemo(() => layerRowsOf(props.view, props.map.marks ?? [], props.map.observations ?? [], props.map.works), [props.view, props.map]);
  const on = (group: MapLayerGroup, key: string) => isLayerOn(props.layers, group, key);
  return (
    <div data-testid="mapa-capas" className="shrink-0 bg-surface">
      <p className="px-4 pt-4 md:px-5"><span className={KICKER}>Capas y leyenda</span></p>
      {rows.works.length ? (
        <Section title={`Partidas (trabajos) · ${rows.works.length}`} aside="Avance">
          {rows.works.map((work) => (
            <div key={work.id} className={ROW}>
              <Dot color={work.color} />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">{work.name}</span>
              <span className="font-mono text-[13px] tabular-nums text-on-surface-variant">{work.assigned ? `${work.percent} %` : WORK_NOT_ASSIGNED}</span>
              <Switch on={on('works', work.id)} label={`Mostrar ${work.name}`} testId={`capa-trabajo-${work.id}`} onToggle={() => props.onToggle('works', work.id)} />
            </div>
          ))}
        </Section>
      ) : (
        <Section title="Partidas (trabajos)">
          <p data-testid="capas-sin-trabajos" className="py-2 text-[14px] text-on-surface-variant">{NO_WORKS_YET}</p>
        </Section>
      )}
      <StageChips map={props.map} filter={props.filter} onFilter={props.onFilter} />
      {rows.marks.length ? (
        <Section title={`Dibujos · ${rows.marks.reduce((sum, group) => sum + group.count, 0)}`}>
          {rows.marks.map((group) => (
            <div key={group.type} className={ROW}>
              <Dot color={group.color} square />
              <span className="min-w-0 flex-1 truncate text-[14px] font-semibold text-on-surface">{`${group.label} · ${group.count}`}</span>
              <Switch on={on('marks', group.type)} label={`Mostrar ${group.label}`} testId={`capa-dibujo-${group.type}`} onToggle={() => props.onToggle('marks', group.type)} />
            </div>
          ))}
        </Section>
      ) : null}
      {rows.observations.length ? (
        <Section title={`Observaciones · ${rows.observations.reduce((sum, one) => sum + one.count, 0)}`}>
          {rows.observations.map((one) => (
            <div key={one.key} className={ROW}>
              <span aria-hidden className={`h-3 w-3 shrink-0 rounded-full ${one.key === 'open' ? 'bg-error' : 'bg-en-linea'}`} />
              <span className="min-w-0 flex-1 text-[14px] font-semibold text-on-surface">{one.label} <span className="text-on-surface-variant">{`(${one.count})`}</span></span>
              <Switch on={on('observations', one.key)} label={`Mostrar ${one.label}`} testId={`capa-observacion-${one.key}`} onToggle={() => props.onToggle('observations', one.key)} />
            </div>
          ))}
        </Section>
      ) : null}
      {props.photos && props.photos.count > 0 ? <PhotoLayers photos={props.photos} /> : null}
    </div>
  );
}
