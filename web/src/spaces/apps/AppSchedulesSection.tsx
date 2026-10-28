import { useState } from 'react';
import { AlertCircle, Clock, Trash2 } from 'lucide-react';
import { lastRunProblem, scheduleLine, scheduleWhere, type AppSchedules, type ScheduleRow, type SuggestedSchedule } from '@lilachat/shared';
import { deleteAppSchedule, setAppScheduleActive } from '../spacesApi';

type SectionProps = { jwt: string; spaceId: string; appId: string; state: AppSchedules; onChanged: () => void; onSuggestion: (suggestion: SuggestedSchedule) => void };

/**
 * «Horarios» of an app (design d-03): the commands that run at a time and
 * post their report, how the last run went, and what the app suggests, to
 * create with one tap. The switch pauses one; only an admin changes them.
 */
export function AppSchedulesSection(props: SectionProps) {
  const { schedules, suggested, canEdit } = props.state;
  if (!schedules.length && !(canEdit && suggested.length)) return null;
  return (
    <>
      {schedules.length ? (
        <section data-testid="horarios-de-la-app" className="overflow-hidden rounded-2xl border border-outline/15 bg-surface">
          <div className="flex items-start justify-between border-b border-outline/10 px-5 py-4">
            <span>
              <span className="block text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Automatización</span>
              <span className="block text-[15px] font-bold uppercase">Horarios</span>
            </span>
            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 text-[13px] font-bold tabular-nums text-primary">{schedules.length}</span>
          </div>
          <div className="divide-y divide-outline/10">
            {schedules.map((row) => <ScheduleItem key={row.id} {...props} row={row} canEdit={canEdit} />)}
          </div>
        </section>
      ) : null}
      {canEdit && suggested.length ? (
        <section data-testid="horarios-sugeridos" className="rounded-2xl border border-dashed border-outline/30 p-4">
          <p className="mb-3 flex justify-between text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Sugeridos por la app <span className="normal-case tracking-normal text-on-surface-variant">{suggested.length === 1 ? '1 disponible' : `${suggested.length} disponibles`}</span></p>
          <div className="space-y-2">
            {suggested.map((suggestion, index) => (
              <div key={`${suggestion.command}-${suggestion.time}-${index}`} data-testid={`sugerido-${index}`} className="flex items-center gap-3 rounded-xl border border-outline/15 bg-background/50 px-3 py-2">
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-mono text-[14px]">/{suggestion.command}{suggestion.text ? ` ${suggestion.text}` : ''}</span>
                  <span className="block truncate text-[13px] text-on-surface-variant">{scheduleLine(suggestion, '')}</span>
                </span>
                <button type="button" data-testid={`crear-sugerido-${index}`} onClick={() => props.onSuggestion(suggestion)} className="h-9 shrink-0 rounded-lg border border-primary px-3 text-[14px] font-semibold text-primary">Crear</button>
              </div>
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}

function ScheduleItem(props: SectionProps & { row: ScheduleRow; canEdit: boolean }) {
  const { row } = props;
  const [active, setActive] = useState(row.active);
  const [error, setError] = useState<string | null>(null);
  const problem = lastRunProblem(row.lastRun);
  const toggle = async (next: boolean) => {
    setActive(next);
    const result = await setAppScheduleActive(props.jwt, props.spaceId, props.appId, row.id, next);
    if (!result.ok) {
      setActive(!next);
      setError(result.message);
    }
  };
  const remove = async () => {
    const result = await deleteAppSchedule(props.jwt, props.spaceId, props.appId, row.id);
    if (!result.ok) return setError(result.message);
    props.onChanged();
  };
  return (
    <div data-testid={`horario-${row.id}`} className={`flex items-center gap-3 px-5 py-3 ${problem ? 'bg-error/5' : ''}`}>
      <span className="grid h-10 w-10 shrink-0 place-items-center rounded-lg border border-outline/15 bg-primary/5 text-primary"><Clock size={18} /></span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-mono text-[15px]">/{row.command}{row.text ? ` ${row.text}` : ''}</span>
        <span className="block truncate text-[13px] text-on-surface-variant">{scheduleLine(row, scheduleWhere(row.where))}</span>
        {problem ? <span data-testid={`horario-error-${row.id}`} className="mt-0.5 flex items-center gap-1 text-[12px] font-semibold text-error"><AlertCircle size={13} /> {problem}</span> : null}
        {error ? <span role="alert" className="block text-[12px] text-error">{error}</span> : null}
      </span>
      {props.canEdit ? <button type="button" aria-label={`Borrar el horario de /${row.command}`} data-testid={`borrar-horario-${row.id}`} onClick={() => void remove()} className="grid h-9 w-9 shrink-0 place-items-center rounded-full text-on-surface-variant hover:bg-background"><Trash2 size={16} /></button> : null}
      <input type="checkbox" role="switch" aria-label={`Horario de /${row.command} activo`} data-testid={`activo-${row.id}`} checked={active} disabled={!props.canEdit} onChange={(event) => void toggle(event.target.checked)} className="h-5 w-5 shrink-0 accent-primary" />
    </div>
  );
}
