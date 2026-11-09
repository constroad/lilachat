import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { useDismiss } from './MapMoreMenu';
import { mapLegendEntries, workChoiceLabel, workChoicesOf, workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

/** A white card over the map (o-01): its border carries the hierarchy, its shadow almost none. */
const FLOATING = 'rounded-xl border border-outline/15 bg-surface shadow-sm';
const SELECT = 'h-8 min-w-0 rounded-lg bg-transparent pr-1 text-[13px] font-semibold text-primary outline-none';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };

const DOT = 'h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-on-surface/25';

/** The works as a list that opens (José 09/11: not chips, not the browser's select): each with its color. */
function WorkSelect(props: FilterProps) {
  const { view, filter } = props;
  const [open, setOpen] = useState(false);
  const holder = useDismiss(open, () => setOpen(false));
  if (!view.works.length) return null;
  const color = view.works.find((work) => work.id === filter.workId)?.color;
  const pick = (id: string) => {
    setOpen(false);
    props.onFilter(workMapWorkFilter(filter, id || undefined));
  };
  return (
    <div ref={holder} className="relative min-w-0">
      <button type="button" data-testid="mapa-trabajo" aria-haspopup="listbox" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className="flex h-10 w-full min-w-0 items-center gap-2 px-3 text-left">
        <span className={KICKER}>Trabajo</span>
        {color ? <span aria-hidden className={DOT} style={{ backgroundColor: color }} /> : null}
        <span className="min-w-0 max-w-[260px] flex-1 truncate text-[13px] font-semibold text-primary">{workChoiceLabel(view, filter.workId)}</span>
        <ChevronDown size={14} className={`shrink-0 text-primary transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open ? (
        <ul role="listbox" data-testid="mapa-trabajo-lista" className="absolute left-0 top-full z-30 mt-1 w-max min-w-full max-w-[340px] rounded-xl border border-outline/15 bg-surface p-1.5 shadow-lg">
          {workChoicesOf(view).map((choice) => {
            const on = (filter.workId ?? '') === choice.id;
            return (
              <li key={choice.id || 'todos'} role="option" aria-selected={on}>
                <button type="button" data-testid={`mapa-trabajo-${choice.id || 'todos'}`} onClick={() => pick(choice.id)} className={`flex min-h-10 w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-[13px] font-semibold hover:bg-background ${on ? 'text-primary' : 'text-on-surface'}`}>
                  {choice.color ? <span aria-hidden className={DOT} style={{ backgroundColor: choice.color }} /> : <span aria-hidden className="h-2.5 w-2.5 shrink-0" />}
                  <span className="min-w-0 flex-1">{choice.label}</span>
                  {on ? <Check size={14} className="shrink-0" /> : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
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
export function MapFilters(props: FilterProps & { floating: boolean; waiting: number }) {
  if (props.floating) {
    return (
      <div className="pointer-events-none absolute inset-x-4 top-4 z-10 flex flex-wrap items-start gap-2 pr-12">
        {props.view.works.length ? <div className={`pointer-events-auto max-w-full ${FLOATING}`}><WorkSelect {...props} /></div> : null}
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
      {props.view.works.length ? <div className="min-w-0 rounded-lg border border-outline/20"><WorkSelect {...props} /></div> : null}
      <MapLegend view={props.view} waiting={props.waiting} compact />
    </div>
  );
}

const swatchOf = (entry: ReturnType<typeof mapLegendEntries>[number]) => {
  if (entry.kind === 'todo') return <span aria-hidden className="w-4 shrink-0 border-t-2 border-dashed border-on-surface-variant/60" />;
  // An approval waits: the wide, pale band the map draws over the street.
  if (entry.kind === 'waiting') return <span aria-hidden className="h-2.5 w-4 shrink-0 rounded-full bg-on-surface/30" />;
  return <span aria-hidden className="h-1 w-4 shrink-0 rounded-full ring-1 ring-on-surface/20" style={{ backgroundColor: entry.color ?? undefined }} />;
};

/**
 * «Convenciones» (o-01), folded until asked (José 09/11): open, one line per work, what is still to
 * build and, when something waits, what is to approve. Over the map's corner on a wide screen.
 */
export function MapLegend(props: { view: WorkMapView; waiting: number; compact: boolean }) {
  const [open, setOpen] = useState(false);
  const entries = mapLegendEntries(props.view, props.waiting);
  const toggle = (
    <button type="button" data-testid="mapa-leyenda-abrir" aria-expanded={open} onClick={() => setOpen((shown) => !shown)} className="flex h-9 items-center gap-2 px-3 text-[12px] font-semibold text-on-surface">
      <span className="flex -space-x-1">{props.view.works.slice(0, 4).map((work) => <span key={work.id} aria-hidden className="h-2.5 w-2.5 rounded-full ring-1 ring-on-surface/25" style={{ backgroundColor: work.color }} />)}</span>
      Leyenda <ChevronDown size={14} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
    </button>
  );
  const list = open ? (
    <ul data-testid="mapa-leyenda" className="space-y-1.5 px-3 pb-3 text-[12px] font-medium text-on-surface">
      {entries.map((entry) => <li key={entry.key} className={`flex items-center gap-2 ${entry.kind === 'work' ? '' : 'text-on-surface-variant'}`}>{swatchOf(entry)}<span className="min-w-0">{entry.label}</span></li>)}
    </ul>
  ) : null;
  if (props.compact) return <div className="rounded-lg border border-outline/20">{toggle}{list}</div>;
  return <div className={`absolute bottom-4 left-4 z-10 max-w-[320px] ${FLOATING}`}>{list}{toggle}</div>;
}
