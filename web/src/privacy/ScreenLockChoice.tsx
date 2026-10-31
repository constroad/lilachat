import { useState, type FormEvent } from 'react';
import { LockKeyhole } from 'lucide-react';
import { createLock, LOCK_AFTER_LABEL, LOCK_AFTER_MINUTES, LOCK_NOW_EVENT, newPasswordError, passwordMatches, readLock, saveLock, type LockAfter } from './screenLock';

const FIELD = 'h-10 w-full rounded-lg border border-outline/25 bg-background px-2 text-sm';
const DEFAULT_AFTER: LockAfter = 15;

/** «Bloqueo de pantalla» in the settings panel (R31/10, like WhatsApp Web): opens in place. */
export function ScreenLockChoice(props: { userId: string }) {
  const [lock, setLock] = useState(() => readLock(props.userId));
  const [open, setOpen] = useState(false);
  const store = (next: Awaited<ReturnType<typeof createLock>> | null) => {
    saveLock(props.userId, next);
    setLock(next);
  };
  return (
    <div>
      <button type="button" data-testid="btn-bloqueo-pantalla" aria-expanded={open} onClick={() => setOpen((before) => !before)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        <LockKeyhole size={16} />
        <span className="min-w-0 flex-1">Bloqueo de pantalla</span>
        <span className="text-xs text-on-surface-variant">{lock ? `Tras ${LOCK_AFTER_LABEL[lock.afterMinutes]}` : 'Desactivado'}</span>
      </button>
      {open ? <div className="mb-1 ml-9 mr-2 space-y-2 py-1">{lock ? <LockOn lock={lock} onChange={store} /> : <LockOff onCreate={store} />}</div> : null}
    </div>
  );
}

function AfterSelect(props: { value: LockAfter; onChange: (value: LockAfter) => void }) {
  return (
    <label className="block text-xs text-on-surface-variant">
      Bloquear tras no usarla
      <select data-testid="select-bloqueo-tras" value={props.value} onChange={(event) => props.onChange(Number(event.target.value) as LockAfter)} className={`${FIELD} mt-1 text-on-surface`}>
        {LOCK_AFTER_MINUTES.map((minutes) => <option key={minutes} value={minutes}>{LOCK_AFTER_LABEL[minutes]}</option>)}
      </select>
    </label>
  );
}

function LockOff(props: { onCreate: (lock: Awaited<ReturnType<typeof createLock>>) => void }) {
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [after, setAfter] = useState<LockAfter>(DEFAULT_AFTER);
  const [error, setError] = useState('');
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const problem = newPasswordError(password, confirmation);
    if (problem) return setError(problem);
    props.onCreate(await createLock(password, after));
  };
  return (
    <form onSubmit={(event) => void submit(event)} className="space-y-2">
      <p className="text-xs text-on-surface-variant">Solo para esta computadora. Si la olvidas, cierras sesión y vuelves a entrar.</p>
      <input type="password" data-testid="input-clave-nueva" aria-label="Contraseña nueva" placeholder="Contraseña nueva" autoComplete="new-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} className={FIELD} />
      <input type="password" data-testid="input-clave-repetida" aria-label="Repite la contraseña" placeholder="Repite la contraseña" autoComplete="new-password" value={confirmation} onChange={(event) => { setConfirmation(event.target.value); setError(''); }} className={FIELD} />
      <AfterSelect value={after} onChange={setAfter} />
      {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
      <button type="submit" data-testid="btn-activar-bloqueo" className="h-9 w-full rounded-full bg-primary text-sm font-semibold text-on-primary">Activar</button>
    </form>
  );
}

function LockOn(props: { lock: Awaited<ReturnType<typeof createLock>>; onChange: (lock: Awaited<ReturnType<typeof createLock>> | null) => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const turnOff = async (event: FormEvent) => {
    event.preventDefault();
    if (await passwordMatches(props.lock, password)) return props.onChange(null);
    setPassword('');
    setError('Contraseña incorrecta.');
  };
  return (
    <>
      <AfterSelect value={props.lock.afterMinutes} onChange={(afterMinutes) => props.onChange({ ...props.lock, afterMinutes })} />
      <button type="button" data-testid="btn-bloquear-ahora" onClick={() => window.dispatchEvent(new Event(LOCK_NOW_EVENT))} className="h-9 w-full rounded-full border border-outline/25 text-sm font-semibold hover:bg-background">Bloquear ahora</button>
      <form onSubmit={(event) => void turnOff(event)} className="space-y-2 border-t border-outline/10 pt-2">
        <input type="password" data-testid="input-clave-desactivar" aria-label="Contraseña para desactivar" placeholder="Contraseña para desactivar" autoComplete="current-password" value={password} onChange={(event) => { setPassword(event.target.value); setError(''); }} className={FIELD} />
        {error ? <p role="alert" className="text-xs text-error">{error}</p> : null}
        <button type="submit" data-testid="btn-desactivar-bloqueo" disabled={!password} className="h-9 w-full rounded-full text-sm font-semibold text-error hover:bg-error/5 disabled:opacity-50">Desactivar</button>
      </form>
    </>
  );
}
