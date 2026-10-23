import { useEffect, useState } from 'react';
import { CircleDot } from 'lucide-react';
import { PRESENCE_MODES, type PresenceMode } from '@lilachat/shared';
import { api } from '../api';

type Prefs = { mode: PresenceMode; lastSeenHidden: boolean };

/** The dot of each mode, as in the design (`r148-estado`). */
const DOT: Record<PresenceMode, string> = { auto: 'bg-en-linea', away: 'bg-warning', busy: 'bg-error', invisible: 'border-2 border-outline' };

/**
 * «Estado» in the web's settings (pending 15): how the others see me and
 * whether my «últ. vez» shows, the same as in the app. Saved at once.
 */
export function PresenceChoice({ jwt }: { jwt: string }) {
  const [open, setOpen] = useState(false);
  const [prefs, setPrefs] = useState<Prefs>({ mode: 'auto', lastSeenHidden: false });
  const [error, setError] = useState('');

  useEffect(() => {
    void api<Prefs>('/me/presence', { jwt }).then((response) => response.ok && setPrefs(response.data));
  }, [jwt]);

  const change = (next: Prefs) => {
    const before = prefs;
    setPrefs(next);
    setError('');
    void api<Prefs>('/me/presence', { jwt, method: 'PUT', body: next }).then((response) => {
      if (response.ok) return;
      setPrefs(before);
      setError(response.message);
    });
  };
  const current = PRESENCE_MODES.find((one) => one.mode === prefs.mode);

  return (
    <div className="border-b border-outline/10 pb-1">
      <button type="button" data-testid="btn-estado" aria-expanded={open} onClick={() => setOpen((was) => !was)} className="flex min-h-[44px] w-full items-center gap-3 rounded-lg px-3 text-left text-sm hover:bg-background">
        <CircleDot size={16} />
        <span className="min-w-0 flex-1">Estado</span>
        <span className="flex items-center gap-1.5 text-[12px] text-on-surface-variant">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[prefs.mode]}`} />
          {current?.label}
        </span>
      </button>
      {open ? (
        <div className="px-1 pb-1">
          {PRESENCE_MODES.map((option) => (
            <button key={option.mode} type="button" role="radio" aria-checked={prefs.mode === option.mode} data-testid={`estado-${option.mode}`} onClick={() => change({ ...prefs, mode: option.mode })} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-2 text-left hover:bg-background">
              <span className={`mt-1 h-2.5 w-2.5 shrink-0 rounded-full ${DOT[option.mode]}`} />
              <span className="min-w-0 flex-1">
                <span className={`block text-[13px] ${prefs.mode === option.mode ? 'font-semibold text-primary' : ''}`}>{option.label}</span>
                <span className="block text-[11px] leading-4 text-on-surface-variant">{option.hint}</span>
              </span>
            </button>
          ))}
          <label className="flex cursor-pointer items-center gap-2 rounded-lg px-2 py-2 text-[13px] hover:bg-background">
            <input type="checkbox" data-testid="sw-ultima-vez" checked={!prefs.lastSeenHidden} onChange={(event) => change({ ...prefs, lastSeenHidden: !event.target.checked })} className="accent-primary" />
            Mostrar mi última vez
          </label>
          {error ? <p role="alert" className="px-2 text-[12px] text-error">{error}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
