import { birthdayFieldError, type BirthdayDraft } from '@lilachat/shared';

/**
 * The three birthday boxes (day, month, optional year) and the error under
 * them, shared by «Completa tu perfil» and «Crea tu usuario» (José, 14/11: the
 * people invited by email were never asked). The error shows only once day and
 * month are typed (`birthdayFieldError`).
 */
export function BirthdayFields(props: { value: BirthdayDraft; onChange: (next: BirthdayDraft) => void; fieldClass: string }) {
  const { value, onChange, fieldClass } = props;
  const hint = birthdayFieldError(value);
  return (
    <>
      <div className="flex gap-2">
        <input data-testid="perfil-dia" aria-label="Día" className={`${fieldClass} w-20 text-center`} placeholder="Día" inputMode="numeric" maxLength={2} value={value.day} onChange={(event) => onChange({ ...value, day: event.target.value })} />
        <input data-testid="perfil-mes" aria-label="Mes" className={`${fieldClass} w-20 text-center`} placeholder="Mes" inputMode="numeric" maxLength={2} value={value.month} onChange={(event) => onChange({ ...value, month: event.target.value })} />
        <input data-testid="perfil-anio" aria-label="Año" className={`${fieldClass} min-w-0 flex-1 text-center`} placeholder="Año (opcional)" inputMode="numeric" maxLength={4} value={value.year} onChange={(event) => onChange({ ...value, year: event.target.value })} />
      </div>
      {hint ? <p data-testid="perfil-error-cumple" role="alert" className="mt-2 text-[13px] text-error">{hint}</p> : null}
    </>
  );
}
