import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Check, Clock, Undo2, X } from 'lucide-react-native';
import { BY_APPROVE_PILL, byApproveActions, byApproveDetail, loadPendingProgress, PENDING_EXPLAIN, PENDING_LOADING, PENDING_MINE, pendingDetail, pendingTitle, REJECTED_PILL, rejectedOf, resolvePendingProgress, UNDO_LABEL, undoableIds, undoQuestion, type ByApproveList, type ByApproveProgress, type MapEditSend, type PendingDecision, type PendingProgress, type PendingState, type WorkMap } from '@lilachat/shared';
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

/** José 28/11: «POR APROBAR» or a red «RECHAZADO» on each row. */
export function StatePill(props: { rejected: boolean }) {
  return (
    <View className={`self-start rounded-full px-2 py-0.5 ${props.rejected ? 'bg-error/15' : 'bg-primary/15'}`}>
      <Text className={`text-[11px] font-bold tracking-[1px] ${props.rejected ? 'text-error' : 'text-primary'}`}>{props.rejected ? REJECTED_PILL : BY_APPROVE_PILL}</Text>
    </View>
  );
}

/** «Deshacer» on the caller's own pending progress: asks once, then Portal deletes it or says why not. */
export function UndoProgress(props: { id: string; toM: number; onUndo: (id: string) => Promise<string | null> }) {
  const colors = useColores();
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undo = () => {
    setBusy(true);
    void props.onUndo(props.id).then((failure) => { setBusy(false); setError(failure); if (!failure) setAsking(false); });
  };
  if (!asking) {
    return (
      <Pressable testID={`deshacer-avance-${props.id}`} onPress={() => { setError(null); setAsking(true); }} className="mt-2 min-h-[44px] flex-row items-center justify-center gap-1.5 self-start rounded-xl border border-outline/25 px-4">
        <Undo2 size={16} color={colors['on-surface']} />
        <Text className="text-[14px] font-semibold text-on-surface">{UNDO_LABEL}</Text>
      </Pressable>
    );
  }
  return (
    <View className="mt-2 rounded-xl border border-error/30 bg-surface-variant p-3">
      <Text className="text-[14px] font-semibold text-on-surface">{undoQuestion(props.toM)}</Text>
      {error ? <Text accessibilityRole="alert" className="mt-1 text-[13px] font-semibold text-error">{error}</Text> : null}
      <View className="mt-2 flex-row gap-2">
        <Pressable testID={`deshacer-si-${props.id}`} disabled={busy} onPress={undo} className="min-h-[48px] flex-1 items-center justify-center rounded-xl bg-error"><Text className="text-[14px] font-semibold text-background">{busy ? 'Deshaciendo…' : 'Sí, deshacer'}</Text></Pressable>
        <Pressable disabled={busy} onPress={() => setAsking(false)} className="min-h-[48px] flex-1 items-center justify-center rounded-xl border border-outline/25"><Text className="text-[14px] font-semibold text-on-surface">No</Text></Pressable>
      </View>
    </View>
  );
}

/** The list of what waits next to the map (José 28/11): loaded with it, again after each change. */
export function useByApprove(send: MapEditSend | undefined, reloadKey: unknown) {
  const [list, setList] = useState<ByApproveList | null>(null);
  const sender = useRef(send);
  sender.current = send;
  const actions = useMemo(() => byApproveActions(sender, setList), []);
  useEffect(actions.load, [reloadKey, actions]);
  return { list, undo: actions.undo };
}

function RejectedRow(props: { map: WorkMap; item: ByApproveProgress }) {
  return (
    <View testID={`avance-rechazado-${props.item.id}`} className="gap-1 rounded-xl border border-error/25 bg-surface p-3">
      <StatePill rejected />
      <Text className="text-[15px] font-semibold text-on-surface">{byApproveDetail(props.map, props.item)}</Text>
      {props.item.rejectNote ? <Text className="text-[13px] text-error">{props.item.rejectNote}</Text> : null}
    </View>
  );
}

type Undo = { toM: number; onUndo: (id: string) => Promise<string | null> } | null;

function PendingRow(props: { item: PendingProgress; admin: boolean; undo: Undo; onResolve: (decision: PendingDecision) => Promise<string | null> }) {
  const [busy, setBusy] = useState<PendingDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const resolve = (decision: PendingDecision) => {
    setBusy(decision);
    void props.onResolve(decision).then((failure) => { setError(failure); setBusy(null); });
  };
  return (
    <View testID={`avance-pendiente-${props.item.id}`} className="gap-1 rounded-xl border border-outline/15 bg-surface p-3">
      <StatePill rejected={false} />
      <Text className="text-[15px] font-semibold text-on-surface">{pendingDetail(props.item)}</Text>
      {props.item.note ? <Text className="mt-0.5 text-[13px] text-on-surface-variant">{props.item.note}</Text> : null}
      {error ? <Text accessibilityRole="alert" className="mt-2 text-[14px] font-semibold text-error">{error}</Text> : null}
      {props.undo ? <UndoProgress id={props.item.id} toM={props.undo.toM} onUndo={props.undo.onUndo} /> : null}
      {props.admin ? <Decide id={props.item.id} busy={busy} onResolve={resolve} /> : null}
    </View>
  );
}

/**
 * «Por aprobar» above the map on the phone (José 09/11: the progress sent «disappeared»). An admin
 * approves or rejects it here; anyone else sees what they marked. Asked again when the map reloads.
 */
type ByApproveProps = { list: ByApproveList | null; map: WorkMap; onUndo: (id: string) => Promise<string | null> };

/** «Deshacer» for a row when it is the caller's newest pending one of its street and work. */
function undoFor(byApprove: ByApproveProps | undefined, id: string): Undo {
  if (!byApprove || !undoableIds(byApprove.list).has(id)) return null;
  const toM = byApprove.list?.items.find((one) => one.id === id)?.toM;
  return typeof toM === 'number' ? { toM, onUndo: byApprove.onUndo } : null;
}

export function PendingProgressCard(props: { send: MapEditSend; admin: boolean; reloadKey: unknown; onList?: (items: PendingProgress[]) => void; byApprove?: ByApproveProps }) {
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
  const items = list.state === 'ready' ? list.pending.items : [];
  const rejected = props.byApprove ? rejectedOf(props.byApprove.list) : [];
  if (!items.length && !rejected.length) return null;
  const resolve = (id: string) => async (decision: PendingDecision) => {
    const failure = await resolvePendingProgress(send.current, id, decision);
    if (!failure) load();
    return failure;
  };
  return (
    <View testID="avances-por-aprobar" className="gap-3">
      <View>
        <View className="flex-row items-center gap-1.5"><Clock size={14} color={colors['on-surface-variant']} /><Text className={KICKER}>Pendiente de aprobar</Text></View>
        <Text className="text-[16px] font-semibold text-on-surface">{pendingTitle(items.length, list.state === 'ready' && list.pending.more)}</Text>
        <Text className="mt-0.5 text-[13px] text-on-surface-variant">{props.admin ? PENDING_EXPLAIN : PENDING_MINE}</Text>
      </View>
      {items.map((item) => <PendingRow key={item.id} item={item} admin={props.admin} undo={undoFor(props.byApprove, item.id)} onResolve={resolve(item.id)} />)}
      {props.byApprove ? rejected.map((item) => <RejectedRow key={item.id} map={props.byApprove!.map} item={item} />) : null}
    </View>
  );
}
