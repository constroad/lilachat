import { CalendarDays } from 'lucide-react';
import { workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

const CHIP = 'flex h-8 shrink-0 items-center gap-1.5 rounded-lg border px-3 text-[12px] font-semibold';
const CHIP_ON = 'border-primary bg-primary text-on-primary';
const CHIP_OFF = 'border-outline/20 bg-surface text-on-surface hover:bg-background';
/** A white card over the map (o-01): its border carries the hierarchy, its shadow almost none. */
const FLOATING = 'rounded-xl border border-outline/15 bg-surface shadow-sm';
const SELECT = 'h-8 min-w-0 rounded-lg bg-transparent pr-1 text-[13px] font-semibold text-primary outline-none';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };

function WorkChips(props: FilterProps) {
  const { view, filter } = props;
  if (!view.works.length) return null;
  return (
    <div className="flex min-w-0 gap-1.5 overflow-x-auto">
      <button type="button" data-testid="mapa-trabajo-todos" aria-pressed={!filter.workId} onClick={() => props.onFilter(workMapWorkFilter(filter))} className={`${CHIP} ${filter.workId ? CHIP_OFF : CHIP_ON}`}>Todos</button>
      {view.works.map((work) => (
        <button key={work.id} type="button" data-testid={`mapa-trabajo-${work.id}`} aria-pressed={filter.workId === work.id} onClick={() => props.onFilter(workMapWorkFilter(filter, work.id))} className={`${CHIP} ${filter.workId === work.id ? CHIP_ON : CHIP_OFF}`}>
          <span aria-hidden className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: work.color }} />
          {work.name} <span className="font-mono tabular-nums">{work.percent}%</span>
        </button>
      ))}
    </div>
  );
}

function StageSelect(props: FilterProps) {
  const { map, filter } = props;
  if (!map.stages.length) return null;
  return (
    <label className="flex h-10 shrink-0 items-center gap-2 px-3">
      <span className={KICKER}>Etapa</span>
      <select data-testid="mapa-etapa" aria-label="Etapa" value={filter.stageId ?? ''} onChange={(event) => props.onFilter(workMapStageFilter(map, filter, event.target.value))} className={SELECT}>
        <option value="">Todas</option>
        {map.stages.map((stage) => <option key={stage.id} value={stage.id}>{stage.name}</option>)}
      </select>
    </label>
  );
}

/** The day the map is cut at; with a single day there is nothing to choose and it only says it. */
function CutSelect(props: FilterProps) {
  const days = workMapCutDays(props.map);
  return (
    <label className="flex h-10 shrink-0 items-center gap-2 px-3 text-[13px] font-semibold text-on-surface">
      <CalendarDays size={15} className="shrink-0 text-on-surface-variant" />
      {days.length > 1 ? (
        <select data-testid="mapa-corte" aria-label="Avance hasta el día" value={props.filter.untilDay ?? ''} onChange={(event) => props.onFilter(workMapDayFilter(props.filter, event.target.value))} className={`${SELECT} text-on-surface`}>
          <option value="">Hasta hoy</option>
          {days.map((day) => <option key={day} value={day}>{workMapCutLabel(day)}</option>)}
        </select>
      ) : 'Hasta hoy'}
    </label>
  );
}

/** Works, stage and day: cards floating over the map on a wide screen, rows over it on a narrow one (o-01). */
export function MapFilters(props: FilterProps & { floating: boolean }) {
  if (props.floating) {
    return (
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start gap-2 pr-12">
        {props.view.works.length ? <div className={`pointer-events-auto max-w-full p-1.5 ${FLOATING}`}><WorkChips {...props} /></div> : null}
        {props.map.stages.length ? <div className={`pointer-events-auto ${FLOATING}`}><StageSelect {...props} /></div> : null}
        <div className={`pointer-events-auto ${FLOATING}`}><CutSelect {...props} /></div>
      </div>
    );
  }
  return (
    <div className="shrink-0 space-y-2 border-b border-outline/15 bg-surface px-4 py-2">
      <div className="flex items-center gap-2">
        {props.map.stages.length ? <div className="rounded-lg border border-primary/30 bg-primary/10"><StageSelect {...props} /></div> : null}
        <span className="font-mono text-[12px] text-on-surface-variant">{props.view.streets.length === 1 ? '1 calle' : `${props.view.streets.length} calles`}</span>
        <div className="ml-auto rounded-lg border border-outline/20"><CutSelect {...props} /></div>
      </div>
      <WorkChips {...props} />
    </div>
  );
}

/** «Convenciones» (o-01): each work's line, and the dashed one still to build. */
export function MapLegend(props: { view: WorkMapView; compact: boolean }) {
  const pending = <span className="flex items-center gap-2 text-[12px] text-on-surface-variant"><span aria-hidden className="w-4 shrink-0 border-t-2 border-dashed border-on-surface-variant/60" />Pendiente de ejecución</span>;
  // On a phone it floated over the top-left of the map and hid the streets there (José 08/11, tutorial video): a row above the map.
  if (props.compact) {
    return (
      <div data-testid="mapa-leyenda" className="flex flex-wrap items-center gap-x-4 gap-y-1 px-4 pb-2 text-[12px] font-medium text-on-surface">
        {props.view.works.map((work) => (
          <span key={work.id} className="flex items-center gap-2"><span aria-hidden className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: work.color }} />{work.name}</span>
        ))}
        {pending}
      </div>
    );
  }
  return (
    <div data-testid="mapa-leyenda" className={`pointer-events-none absolute bottom-4 left-4 z-10 max-w-[320px] p-3 ${FLOATING}`}>
      <p className={`${KICKER} mb-2`}>Convenciones</p>
      <div className="grid grid-cols-2 gap-x-4 gap-y-1.5 text-[12px] font-medium text-on-surface">
        {props.view.works.map((work) => (
          <span key={work.id} className="flex items-center gap-2"><span aria-hidden className="h-1 w-4 shrink-0 rounded-full" style={{ backgroundColor: work.color }} />{work.name}</span>
        ))}
      </div>
      <p className="mt-2 border-t border-outline/10 pt-2">{pending}</p>
    </div>
  );
}
