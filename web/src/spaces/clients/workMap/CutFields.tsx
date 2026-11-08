import { CalendarDays } from 'lucide-react';
import { workMapCutDays, workMapCutLabel, workMapDayFilter, workMapStageFilter, type CutOption, type WorkMap, type WorkMapFilter } from '@lilachat/shared';

export const PANEL_LABEL = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';
const FIELD = 'mt-1 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[14px] text-on-surface outline-none focus:border-primary';

type Props = { map: WorkMap; filter: WorkMapFilter; onFilter: (filter: WorkMapFilter) => void };

/** «Etapa de obra» (o-08): the stage the share is cut at; the map follows it. */
export function StageField(props: Props & { options: CutOption[] }) {
  return (
    <label className="block">
      <span className={PANEL_LABEL}>Etapa de obra</span>
      <select data-testid="corte-etapa" value={props.filter.stageId ?? ''} onChange={(event) => props.onFilter(workMapStageFilter(props.map, props.filter, event.target.value))} className={FIELD}>
        {props.options.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}
      </select>
    </label>
  );
}

/** «Hasta el día»: only days with approved progress, since any other day draws the same map. */
export function DayField(props: Props) {
  const days = workMapCutDays(props.map);
  return (
    <label className="block">
      <span className={PANEL_LABEL}>Hasta el día</span>
      <span className="relative block">
        <select data-testid="corte-dia" value={props.filter.untilDay ?? ''} onChange={(event) => props.onFilter(workMapDayFilter(props.filter, event.target.value))} className={`${FIELD} appearance-none pr-10`}>
          <option value="">Hasta hoy</option>
          {days.map((day) => <option key={day} value={day}>{workMapCutLabel(day)}</option>)}
        </select>
        <CalendarDays size={16} aria-hidden className="pointer-events-none absolute right-3 top-1/2 mt-0.5 -translate-y-1/2 text-primary" />
      </span>
    </label>
  );
}
