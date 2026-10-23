import { Minus, Plus } from 'lucide-react';
import { describeRepeat, ETIQUETA_DE_REPETICION, formatClock, limaMonthDay, limaWeekday, type Recurrence, type RepeatRule } from '@lilachat/shared';

const OPTIONS: Recurrence[] = ['once', 'daily', 'weekly', 'monthly'];
/** Monday first, as the week is read in Peru; the value is `Date.getDay`. */
const WEEK = [
  { day: 1, letter: 'L', name: 'lunes' },
  { day: 2, letter: 'M', name: 'martes' },
  { day: 3, letter: 'M', name: 'miércoles' },
  { day: 4, letter: 'J', name: 'jueves' },
  { day: 5, letter: 'V', name: 'viernes' },
  { day: 6, letter: 'S', name: 'sábado' },
  { day: 0, letter: 'D', name: 'domingo' },
] as const;
const UNIT: Partial<Record<Recurrence, [string, string]>> = { daily: ['día', 'días'], weekly: ['semana', 'semanas'], monthly: ['mes', 'meses'] };
const MAX_EVERY = 99;

/**
 * «Repetir» on the web, the same as the app's (pending 65; design
 * `r150-repetir`): weekdays, the month's day or last day, every N, and the
 * sentence that says it.
 */
export function RepeatPickerWeb(props: { recurrence: Recurrence; rule: RepeatRule | undefined; startsAt: Date; onChange: (recurrence: Recurrence, rule: RepeatRule | undefined) => void }) {
  const { recurrence, rule, startsAt } = props;
  const valid = !Number.isNaN(startsAt.getTime());
  const every = rule?.every ?? 1;
  const choose = (next: Recurrence) => {
    if (next === 'weekly') return props.onChange(next, { weekdays: rule?.weekdays?.length ? rule.weekdays : valid ? [limaWeekday(startsAt)] : [1] });
    if (next === 'monthly') return props.onChange(next, { monthDay: rule?.monthDay ?? 'same', ...(valid ? { day: limaMonthDay(startsAt) } : {}) });
    props.onChange(next, undefined);
  };
  const toggleDay = (day: number) => {
    const days = rule?.weekdays ?? [];
    const next = days.includes(day) ? days.filter((one) => one !== day) : [...days, day];
    // At least one day: an empty week would never ring.
    if (next.length) props.onChange('weekly', { ...rule, weekdays: next });
  };
  const setEvery = (value: number) => props.onChange(recurrence, { ...rule, every: Math.min(MAX_EVERY, Math.max(1, value)) });
  const summary = valid ? describeRepeat(recurrence, rule, formatClock(startsAt), limaMonthDay(startsAt)) : '';
  const unit = UNIT[recurrence];
  const monthDayLabel = valid ? `El día ${limaMonthDay(startsAt)} de cada mes` : 'El mismo día de cada mes';

  return (
    <div>
      <div role="tablist" className="mt-1 grid grid-cols-4 gap-1 rounded-xl bg-background p-1">
        {OPTIONS.map((option) => (
          <button key={option} type="button" role="tab" data-testid={`repetir-${option}`} aria-selected={recurrence === option} onClick={() => choose(option)} className={`min-h-[40px] rounded-lg text-[13px] font-medium ${recurrence === option ? 'bg-surface text-primary shadow-sm' : 'text-on-surface-variant'}`}>
            {ETIQUETA_DE_REPETICION[option]}
          </button>
        ))}
      </div>
      {recurrence === 'weekly' ? (
        <div className="mt-2 rounded-xl border border-outline/15 p-3">
          <p className="text-[12px] text-on-surface-variant">Días de la semana:</p>
          <div className="mt-2 flex justify-between gap-1">
            {WEEK.map(({ day, letter, name }) => {
              const on = Boolean(rule?.weekdays?.includes(day));
              return (
                <button key={day} type="button" data-testid={`dia-${day}`} aria-label={name} aria-pressed={on} onClick={() => toggleDay(day)} className={`grid h-9 w-9 place-items-center rounded-full border text-[13px] font-semibold ${on ? 'border-primary bg-primary text-on-primary' : 'border-outline/30 text-on-surface hover:bg-background'}`}>
                  {letter}
                </button>
              );
            })}
          </div>
        </div>
      ) : null}
      {recurrence === 'monthly' ? (
        <div role="radiogroup" className="mt-2 rounded-xl border border-outline/15 p-1">
          {([['same', monthDayLabel], ['last', 'El último día del mes (28, 29, 30 o 31)']] as const).map(([value, label]) => (
            <label key={value} className="flex min-h-[40px] cursor-pointer items-center gap-2 rounded-lg px-2 text-[13px] hover:bg-background">
              <input type="radio" name="mensual" data-testid={`mensual-${value}`} checked={(rule?.monthDay ?? 'same') === value} onChange={() => props.onChange('monthly', { ...rule, monthDay: value, ...(valid ? { day: limaMonthDay(startsAt) } : {}) })} className="accent-primary" />
              {label}
            </label>
          ))}
          <p className="px-2 pb-1 text-[11px] text-on-surface-variant">El último día es también «el día antes del 1 del mes siguiente».</p>
        </div>
      ) : null}
      {unit ? (
        <div className="mt-2 flex items-center gap-2 text-[13px]">
          Cada
          <button type="button" data-testid="cada-menos" aria-label="Menos" onClick={() => setEvery(every - 1)} className="grid h-8 w-8 place-items-center rounded-full bg-background hover:bg-primary/10"><Minus size={14} /></button>
          <span data-testid="cada-valor" className="min-w-[20px] text-center font-semibold">{every}</span>
          <button type="button" data-testid="cada-mas" aria-label="Más" onClick={() => setEvery(every + 1)} className="grid h-8 w-8 place-items-center rounded-full bg-background hover:bg-primary/10"><Plus size={14} /></button>
          {every === 1 ? unit[0] : unit[1]}
        </div>
      ) : null}
      {summary ? <p data-testid="resumen-repetir" className="mt-2 text-[12px] text-on-surface-variant">{summary}</p> : null}
    </div>
  );
}
