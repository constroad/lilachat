import { useState } from 'react';
import { advanceChips, advanceShort, advanceToMinutes, ADVANCE_FULL_TEXT, ADVANCE_INVALID_TEXT, MAX_ADVANCES, toggleAdvance, type AdvanceUnit } from '@lilachat/shared';

const UNITS: { value: AdvanceUnit; label: string }[] = [
  { value: 'min', label: 'minutos' },
  { value: 'h', label: 'horas' },
  { value: 'dia', label: 'días' },
];
const CHIP = 'min-h-[36px] rounded-full border px-3 text-[13px] font-medium';

/**
 * «Avisar antes» of a reminder (José 25/10): the usual advances as chips — several can be on at once —
 * and «Otro» for a custom amount. The same as the app's (`AdvanceField`).
 */
export function AdvanceFieldWeb(props: { value: number[]; onChange: (next: number[]) => void }) {
  const [custom, setCustom] = useState(false);
  const [amount, setAmount] = useState('');
  const [unit, setUnit] = useState<AdvanceUnit>('min');
  const [error, setError] = useState('');

  const addCustom = () => {
    const minutes = advanceToMinutes(Number(amount), unit);
    if (minutes === null || amount.trim() === '') return setError(ADVANCE_INVALID_TEXT);
    if (props.value.length >= MAX_ADVANCES && !props.value.includes(minutes)) return setError(ADVANCE_FULL_TEXT);
    setError('');
    if (!props.value.includes(minutes)) props.onChange(toggleAdvance(props.value, minutes));
    setAmount('');
    setCustom(false);
  };

  return (
    <div>
      <div className="mt-1 flex flex-wrap gap-1.5">
        {advanceChips(props.value).map((minutes) => {
          const on = props.value.includes(minutes);
          return (
            <button key={minutes} type="button" data-testid={`aviso-${minutes}`} aria-pressed={on} onClick={() => props.onChange(toggleAdvance(props.value, minutes))} className={`${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/25 bg-background text-on-surface-variant'}`}>
              {advanceShort(minutes)}
            </button>
          );
        })}
        <button type="button" data-testid="aviso-otro" aria-expanded={custom} onClick={() => setCustom((before) => !before)} className={`${CHIP} border-dashed border-outline/40 bg-background text-primary`}>
          Otro…
        </button>
      </div>
      {custom ? (
        <div className="mt-2 flex items-center gap-2">
          <input data-testid="aviso-otro-cantidad" inputMode="numeric" value={amount} onChange={(event) => { setAmount(event.target.value.replace(/\D/g, '')); setError(''); }} placeholder="30" aria-label="Cantidad de tiempo antes" className="h-10 w-20 rounded-xl border border-outline/25 bg-background px-3 text-sm outline-none focus:border-primary" />
          <select data-testid="aviso-otro-unidad" value={unit} onChange={(event) => setUnit(event.target.value as AdvanceUnit)} aria-label="Unidad" className="h-10 rounded-xl border border-outline/25 bg-background px-2 text-sm">
            {UNITS.map((one) => (
              <option key={one.value} value={one.value}>
                {one.label}
              </option>
            ))}
          </select>
          <button type="button" data-testid="aviso-otro-agregar" onClick={addCustom} className="h-10 rounded-xl bg-primary px-3 text-[13px] font-semibold text-on-primary">
            Agregar
          </button>
        </div>
      ) : null}
      {error ? <p role="alert" className="mt-1 text-[12px] text-error">{error}</p> : null}
      <p className="mt-1 text-[12px] text-on-surface-variant">{props.value.length === 0 ? 'Sin aviso previo: solo suena a la hora.' : 'Suena antes y también a la hora.'}</p>
    </div>
  );
}
