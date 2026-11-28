import { useState } from 'react';
import { CalendarDays, Check, ChevronDown } from 'lucide-react';
import { useDismiss } from './MapMoreMenu';
import { workChoiceLabel, workChoicesOf, workMapCutDays, workMapCutLabel, workMapDayFilter, workMapWorkFilter, type WorkMap, type WorkMapFilter, type WorkMapView } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

/** A white card over the map (o-01): its border carries the hierarchy, its shadow almost none. */
const FLOATING = 'rounded-xl border border-outline/15 bg-surface shadow-md';
const SELECT = 'h-8 min-w-0 rounded-lg bg-transparent pr-1 text-[13px] font-semibold text-primary outline-none';

type FilterProps = { map: WorkMap; view: WorkMapView; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };

const DOT = 'h-2.5 w-2.5 shrink-0 rounded-full ring-[1.5px] ring-on-surface/40';

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

/**
 * Work and day (o-01) as cards floating over the map, on a computer and on a phone (José 20/11,
 * design mapa-v2: «Hasta hoy ▾» over the map). The parent places the row. The stages are chips in
 * «Capas y leyenda».
 */
export function MapFilters(props: FilterProps) {
  return (
    <div className="pointer-events-none flex max-w-full flex-wrap items-start gap-2">
      <div className={`pointer-events-auto ${FLOATING}`}><CutSelect {...props} /></div>
      {props.view.works.length ? <div className={`pointer-events-auto min-w-0 max-w-full ${FLOATING}`}><WorkSelect {...props} /></div> : null}
    </div>
  );
}
