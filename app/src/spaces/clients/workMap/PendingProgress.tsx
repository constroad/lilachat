import { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Clock, X } from 'lucide-react-native';
import { loadPendingProgress, PENDING_EXPLAIN, PENDING_LOADING, PENDING_MINE, pendingDetail, pendingTitle, resolvePendingProgress, type MapEditSend, type PendingDecision, type PendingProgress, type PendingState } from '@lilachat/shared';
import { useColores } from '../../../ui/tema';

const KICKER = 'text-[12px] font-bold uppercase tracking-[1.5px] text-on-surface-variant';

/** The admin's two buttons; «Rechazar» asks once more, a tap on the wrong one costs a day's metrado. */
function Decide(props: { id: string; busy: PendingDecision | null; onResolve: (decision: PendingDecision) => void }) {
  const colors = useColores();
  const [rejecting, setRejecting] = useState(false);
  if (rejecting) {
    return (
      <View className="mt-3 rounded-xl border border-error/30 bg-surface-variant p-3">
        <Text className="text-[14px] font-semibold text-on-surface">¿Rechazar este avance? No suma al metrado.</Text>
        <View className="mt-2 flex-row gap-2">
          <Pressable testID={`rechazar-si-${props.id}`} disabled={props.busy !== null} onPress={() => props.onResolve('rechazar')} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[14px] font-semibold text-background">{props.busy === 'rechazar' ? 'Rechazando…' : 'Sí, rechazar'}</Text></Pressable>
          <Pressable onPress={() => setRejecting(false)} className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-outline/25"><Text className="text-[14px] font-semibold text-on-surface">No</Text></Pressable>
        </View>
      </View>
    );
  }
  return (
    <View className="mt-3 flex-row gap-2">
      <Pressable testID={`aprobar-avance-${props.id}`} disabled={props.busy !== null} onPress={() => props.onResolve('aprobar')} className="min-h-[48px] flex-1 flex-row items-center justify-center gap-1.5 rounded-xl bg-primary">
        <Check size={18} color={colors['on-primary']} />
        <Text className="text-[15px] font-semibold text-on-primary">{props.busy === 'aprobar' ? 'Aprobando…' : 'Aprobar'}</Text>
      </Pressable>
      <Pressable testID={`rechazar-avance-${props.id}`} disabled={props.busy !== null} onPress={() => setRejecting(true)} className="min-h-[48px] flex-row items-center justify-center gap-1.5 rounded-xl border border-outline/25 px-4">
        <X size={18} color={colors['on-surface']} />
        <Text className="text-[15px] font-semibold text-on-surface">Rechazar</Text>
      </Pressable>
    </View>
  );
}

function PendingRow(props: { item: PendingProgress; admin: boolean; onResolve: (decision: PendingDecision) => Promise<string | null> }) {
  const [busy, setBusy] = useState<PendingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolve = (decision: PendingDecision) => {
    setBusy(decision);
    void props.onResolve(decision).then((failure) => { setError(failure); setBusy(null); });
  };
  return (
    <View testID={`avance-pendiente-${props.item.id}`} className="rounded-xl border border-outline/15 bg-surface p-3">
      <Text className="text-[15px] font-semibold text-on-surface">{pendingDetail(props.item)}</Text>
      {props.item.note ? <Text className="mt-0.5 text-[13px] text-on-surface-variant">{props.item.note}</Text> : null}
      {error ? <Text accessibilityRole="alert" className="mt-2 text-[14px] font-semibold text-error">{error}</Text> : null}
      {props.admin ? <Decide id={props.item.id} busy={busy} onResolve={resolve} /> : null}
    </View>
  );
}

/**
 * «Por aprobar» above the map on the phone (José 09/11: the progress sent «disappeared»). An admin
 * approves or rejects it here; anyone else sees what they marked. Asked again when the map reloads.
 */
export function PendingProgressCard(props: { send: MapEditSend; admin: boolean; reloadKey: unknown; onList?: (items: PendingProgress[]) => void }) {
  const colors = useColores();
  const [list, setList] = useState<PendingState>(PENDING_LOADING);
  const send = useRef(props.send);
  send.current = props.send;
  const onList = useRef(props.onList);
  onList.current = props.onList;
  const load = () => void loadPendingProgress(send.current).then((next) => {
    setList(next);
    onList.current?.(next.state === 'ready' ? next.pending.items : []);
  });
  useEffect(load, [props.reloadKey]);
  if (list.state !== 'ready' || !list.pending.items.length) return null;
  const resolve = (id: string) => async (decision: PendingDecision) => {
    const failure = await resolvePendingProgress(send.current, id, decision);
    if (!failure) load();
    return failure;
  };
  return (
    <View testID="avances-por-aprobar" className="gap-3">
      <View>
        <View className="flex-row items-center gap-1.5"><Clock size={14} color={colors['on-surface-variant']} /><Text className={KICKER}>Pendiente de aprobar</Text></View>
        <Text className="text-[16px] font-semibold text-on-surface">{pendingTitle(list.pending.items.length, list.pending.more)}</Text>
        <Text className="mt-0.5 text-[13px] text-on-surface-variant">{props.admin ? PENDING_EXPLAIN : PENDING_MINE}</Text>
      </View>
      {list.pending.items.map((item) => <PendingRow key={item.id} item={item} admin={props.admin} onResolve={resolve(item.id)} />)}
    </View>
  );
}
