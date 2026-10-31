import { useEffect, useRef, useState, type FormEvent } from 'react';
import { Lock } from 'lucide-react';
import { Logo } from '../ui/Logo';
import { isIdleTooLong, LOCK_CHANGED_EVENT, LOCK_NOW_EVENT, passwordMatches, readLock, saveLock, type ScreenLock } from './screenLock';

/** How often an unlocked, idle web checks whether it is time to lock (a local timer, no request). */
const IDLE_CHECK_MS = 15_000;
const ACTIVITY_EVENTS = ['pointerdown', 'keydown', 'mousemove', 'wheel', 'touchstart'] as const;

/**
 * The web's screen lock (R31/10, like WhatsApp Web): with a lock set, it opens
 * locked, locks after the chosen idle time and with «Bloquear ahora». The
 * chats keep running underneath; the lock only covers them.
 */
export function ScreenLockGate(props: { userId: string; onForgot: () => void }) {
  const [lock, setLock] = useState(() => readLock(props.userId));
  const [locked, setLocked] = useState(() => readLock(props.userId) !== null);
  const lastActivity = useRef(Date.now());

  useEffect(() => {
    const reread = () => {
      const next = readLock(props.userId);
      setLock(next);
      if (!next) setLocked(false);
    };
    const lockNow = () => setLocked(readLock(props.userId) !== null);
    window.addEventListener(LOCK_CHANGED_EVENT, reread);
    window.addEventListener(LOCK_NOW_EVENT, lockNow);
    return () => {
      window.removeEventListener(LOCK_CHANGED_EVENT, reread);
      window.removeEventListener(LOCK_NOW_EVENT, lockNow);
    };
  }, [props.userId]);

  useEffect(() => {
    if (!lock || locked) return;
    lastActivity.current = Date.now();
    const touch = () => {
      lastActivity.current = Date.now();
    };
    const check = () => {
      if (isIdleTooLong(lastActivity.current, Date.now(), lock.afterMinutes)) setLocked(true);
    };
    ACTIVITY_EVENTS.forEach((name) => window.addEventListener(name, touch, { passive: true }));
    document.addEventListener('visibilitychange', check);
    const timer = window.setInterval(check, IDLE_CHECK_MS);
    return () => {
      ACTIVITY_EVENTS.forEach((name) => window.removeEventListener(name, touch));
      document.removeEventListener('visibilitychange', check);
      window.clearInterval(timer);
    };
  }, [lock, locked]);

  if (!lock || !locked) return null;
  return (
    <LockScreen
      lock={lock}
      onUnlock={() => setLocked(false)}
      onForgot={() => {
        saveLock(props.userId, null);
        props.onForgot();
      }}
    />
  );
}

function LockScreen(props: { lock: ScreenLock; onUnlock: () => void; onForgot: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setChecking(true);
    const ok = await passwordMatches(props.lock, password);
    setChecking(false);
    if (ok) return props.onUnlock();
    setPassword('');
    setError('Contraseña incorrecta.');
  };
  return (
    <div role="dialog" aria-modal="true" aria-label="Lilachat está bloqueado" data-testid="pantalla-bloqueada" className="fixed inset-0 z-[70] grid place-items-center bg-background p-4">
      <form onSubmit={(event) => void submit(event)} className="w-full max-w-sm rounded-2xl border border-outline/15 bg-surface p-6 text-center shadow-sm">
        <div className="mx-auto mb-3 w-fit"><Logo size={48} /></div>
        <h1 className="flex items-center justify-center gap-2 text-[18px] font-bold"><Lock size={18} />Lilachat está bloqueado</h1>
        <p className="mt-1 text-[13px] text-on-surface-variant">Escribe tu contraseña para ver tus chats.</p>
        <input
          type="password"
          data-testid="input-clave-bloqueo"
          autoFocus
          autoComplete="current-password"
          aria-label="Contraseña"
          aria-invalid={error ? true : undefined}
          aria-describedby={error ? 'error-bloqueo' : undefined}
          value={password}
          onChange={(event) => {
            setPassword(event.target.value);
            setError('');
          }}
          className="mt-4 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 text-[15px]"
        />
        {error ? <p id="error-bloqueo" role="alert" className="mt-2 text-left text-[13px] text-error">{error}</p> : null}
        <button type="submit" data-testid="btn-desbloquear" disabled={!password || checking} className="mt-4 h-11 w-full rounded-full bg-primary text-[15px] font-semibold text-on-primary disabled:opacity-50">
          {checking ? 'Revisando…' : 'Desbloquear'}
        </button>
        <button type="button" data-testid="btn-olvide-clave" onClick={props.onForgot} className="mt-3 text-[13px] font-semibold text-primary hover:underline">
          ¿Olvidaste la contraseña? Cerrar sesión
        </button>
      </form>
    </div>
  );
}
