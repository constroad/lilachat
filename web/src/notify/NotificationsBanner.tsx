import { useState } from 'react';
import { BellRing } from 'lucide-react';
import { enablePush, pushState } from '../push';
import { OFFER_KEY, shouldOfferNotifications } from './notificationsOffer';

function readSnooze(): number | null {
  try {
    const saved = window.localStorage.getItem(OFFER_KEY);
    return saved ? Number(saved) : null;
  } catch {
    return null;
  }
}

/**
 * «Activa las notificaciones…» on top of the conversation (design
 * `n-02-web-lista-plegada`; José, 21/10): «Activar» asks the browser and
 * subscribes the push; «Ahora no» snoozes it 14 days.
 */
export function NotificationsBanner({ jwt }: { jwt: string }) {
  const [visible, setVisible] = useState(() => shouldOfferNotifications(pushState(), readSnooze(), Date.now()));
  const [error, setError] = useState('');
  if (!visible) return null;
  const snooze = () => {
    try {
      window.localStorage.setItem(OFFER_KEY, String(Date.now()));
    } catch {
      // Not remembered: it will be offered again next time.
    }
    setVisible(false);
  };
  const turnOn = async () => {
    const result = await enablePush(jwt);
    if (result.ok) setVisible(false);
    else setError(result.message ?? 'No se pudieron activar.');
  };
  return (
    <div data-testid="franja-notificaciones" role="region" aria-label="Notificaciones" className="flex flex-wrap items-center gap-3 border-b border-outline/15 bg-surface px-4 py-2.5">
      <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/10 text-primary">
        <BellRing size={18} />
      </span>
      <p className="min-w-0 flex-1 text-[13px] font-semibold text-on-surface">
        Activa las notificaciones para enterarte de los mensajes, zumbidos y guiños cuando la pestaña no esté a la vista
        {error ? <span role="alert" className="block text-[12px] font-normal text-error">{error}</span> : null}
      </p>
      <button type="button" data-testid="btn-notificaciones-ahora-no" onClick={snooze} className="min-h-[36px] rounded-lg border border-outline/20 px-3 text-[13px] font-semibold hover:bg-background">
        Ahora no
      </button>
      <button type="button" data-testid="btn-notificaciones-activar" onClick={() => void turnOn()} className="min-h-[36px] rounded-lg bg-primary px-3 text-[13px] font-bold text-on-primary">
        Activar
      </button>
    </div>
  );
}
