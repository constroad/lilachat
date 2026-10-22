import { useEffect, useState } from 'react';
import { Pressable, Text } from 'react-native';
import { Phone, Video } from 'lucide-react-native';
import { CALL_JOIN_EARLY_MS, callJoinState, formatClock, msUntilJoinChange, type AgendaEvent } from '@lilachat/shared';
import { useLlamadas } from '../../calls/ProveedorDeLlamadas';
import { useColores } from '../../ui/tema';

/** setTimeout cannot wait longer than this; a later change waits for the next render. */
const MAX_TIMER_MS = 2_147_483_647;

/**
 * The join row of a scheduled call's card (pending 42): «Unirse» from 10
 * minutes before until it is over. The card wakes up exactly when that
 * changes, without ticking.
 */
export function ScheduledCallJoin({ event, video }: { event: AgendaEvent; video: boolean }) {
  const colors = useColores();
  const { llamar } = useLlamadas();
  const [now, setNow] = useState(() => Date.now());
  const state = callJoinState(event.startsAt, now, event.endsAt);

  useEffect(() => {
    const wait = msUntilJoinChange(event.startsAt, now, event.endsAt);
    if (wait === null || wait > MAX_TIMER_MS) return;
    const timer = setTimeout(() => setNow(Date.now()), wait);
    return () => clearTimeout(timer);
  }, [event.startsAt, event.endsAt, now]);

  if (state === 'over') return <Text className="text-[12px] text-on-surface-variant">Esta llamada ya pasó.</Text>;
  if (state === 'early') {
    const opens = new Date(Date.parse(event.startsAt) - CALL_JOIN_EARLY_MS).toISOString();
    return <Text testID={`llamada-pronto-${event.id}`} className="text-[12px] text-on-surface-variant">Podrás unirte desde las {formatClock(opens)}</Text>;
  }
  const Icon = video ? Video : Phone;
  const name = event.chat?.name ?? event.chat?.phone ?? event.title;
  return (
    <Pressable testID={`btn-unirse-llamada-${event.id}`} onPress={() => llamar(event.chatId, name, video)} className="min-h-[44px] flex-row items-center justify-center gap-2 rounded-full bg-primary">
      <Icon size={16} color={colors['on-primary']} />
      <Text className="text-sm font-semibold text-on-primary">Unirse a la llamada</Text>
    </Pressable>
  );
}
