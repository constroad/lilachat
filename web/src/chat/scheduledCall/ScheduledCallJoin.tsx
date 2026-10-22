import { useEffect, useState } from 'react';
import { Phone, Video } from 'lucide-react';
import { CALL_JOIN_EARLY_MS, callJoinState, formatClock, msUntilJoinChange, type AgendaEvent } from '@lilachat/shared';
import { useCalls } from '../../calls/CallProvider';

/** setTimeout cannot wait longer than this; a later change waits for the next render. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The join row of a scheduled call's card on the web (pending 42): «Unirse»
 * from 10 minutes before until it is over, waking exactly when that changes.
 */
export function ScheduledCallJoin({ event, video }: { event: AgendaEvent; video: boolean }) {
  const { call } = useCalls();
  const [now, setNow] = useState(() => Date.now());
  const state = callJoinState(event.startsAt, now, event.endsAt);

  useEffect(() => {
    const wait = msUntilJoinChange(event.startsAt, now, event.endsAt);
    if (wait === null || wait > MAX_TIMER_MS) return;
    const timer = window.setTimeout(() => setNow(Date.now()), wait);
    return () => window.clearTimeout(timer);
  }, [event.startsAt, event.endsAt, now]);

  if (state === 'over') return <p className="mt-3 text-[12px] text-on-surface-variant">Esta llamada ya pasó.</p>;
  if (state === 'early') {
    const opens = new Date(Date.parse(event.startsAt) - CALL_JOIN_EARLY_MS).toISOString();
    return <p data-testid={`llamada-pronto-${event.id}`} className="mt-3 text-[12px] text-on-surface-variant">Podrás unirte desde las {formatClock(opens)}</p>;
  }
  const Icon = video ? Video : Phone;
  const name = event.chat?.name ?? event.chat?.phone ?? event.title;
  return (
    <button type="button" data-testid={`btn-unirse-llamada-${event.id}`} onClick={() => call(event.chatId, name, video)} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-full bg-primary text-sm font-semibold text-on-primary">
      <Icon size={16} /> Unirse a la llamada
    </button>
  );
}
