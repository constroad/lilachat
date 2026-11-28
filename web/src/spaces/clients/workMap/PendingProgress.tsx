import { useEffect, useMemo, useRef, useState } from 'react';
import { Check, Clock, Undo2, X } from 'lucide-react';
import { BY_APPROVE_PILL, byApproveActions, byApproveDetail, loadPendingProgress, PENDING_EXPLAIN, PENDING_LOADING, PENDING_MINE, pendingDetail, pendingTitle, REJECTED_PILL, rejectedOf, resolvePendingProgress, UNDO_LABEL, undoableIds, undoQuestion, type ByApproveList, type ByApproveProgress, type MapEditSend, type PendingDecision, type PendingProgress, type PendingState, type WorkMap } from '@lilachat/shared';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';

/** José 28/11: «POR APROBAR» or a red «RECHAZADO» on each row. */
export function StatePill(props: { rejected: boolean }) {
  return <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-bold tracking-[0.08em] ${props.rejected ? 'bg-error/15 text-error' : 'bg-primary/15 text-primary'}`}>{props.rejected ? REJECTED_PILL : BY_APPROVE_PILL}</span>;
}

/** «Deshacer» on the caller's own pending progress: asks once, then Portal deletes it or says why not. */
export function UndoProgress(props: { id: string; toM: number; onUndo: (id: string) => Promise<string | null> }) {
  const [asking, setAsking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const undo = async () => {
    setBusy(true);
    const failure = await props.onUndo(props.id);
    setBusy(false);
    setError(failure);
    if (!failure) setAsking(false);
  };
  if (!asking) {
    return <button type="button" data-testid={`deshacer-avance-${props.id}`} onClick={() => { setError(null); setAsking(true); }} className="mt-2 flex h-10 items-center gap-1.5 rounded-xl border border-outline/25 px-4 text-[13px] font-semibold text-on-surface hover:bg-background"><Undo2 size={15} />{UNDO_LABEL}</button>;
  }
  return (
    <div className="mt-2 rounded-xl border border-error/30 bg-error/5 p-3">
      <p className="text-[13px] font-semibold text-on-surface">{undoQuestion(props.toM)}</p>
      {error ? <p role="alert" className="mt-1 text-[12px] font-semibold text-error">{error}</p> : null}
      <div className="mt-2 flex gap-2">
        <button type="button" data-testid={`deshacer-si-${props.id}`} disabled={busy} onClick={() => void undo()} className="h-10 flex-1 rounded-xl bg-error text-[13px] font-semibold text-background disabled:opacity-60">{busy ? 'Deshaciendo…' : 'Sí, deshacer'}</button>
        <button type="button" disabled={busy} onClick={() => setAsking(false)} className="h-10 flex-1 rounded-xl border border-outline/25 text-[13px] font-semibold text-on-surface">No</button>
      </div>
    </div>
  );
}

/** The list of what waits next to the map (José 28/11): loaded with it, again after each change. */
export function useByApprove(send: MapEditSend | undefined, reloadKey: unknown) {
  const [list, setList] = useState<ByApproveList | null>(null);
  // The sender is new on every render: the latest one answers.
  const sender = useRef(send);
  sender.current = send;
  const actions = useMemo(() => byApproveActions(sender, setList), []);
  useEffect(actions.load, [reloadKey, actions]);
  return { list, undo: actions.undo };
}

function RejectedRow(props: { map: WorkMap; item: ByApproveProgress }) {
  return (
    <li data-testid={`avance-rechazado-${props.item.id}`} className="space-y-1 rounded-xl border border-error/25 bg-surface p-3">
      <StatePill rejected />
      <p className="text-[14px] font-semibold text-on-surface">{byApproveDetail(props.map, props.item)}</p>
      {props.item.rejectNote ? <p className="text-[12px] text-error">{props.item.rejectNote}</p> : null}
    </li>
  );
}

type Undo = { toM: number; onUndo: (id: string) => Promise<string | null> } | null;

function PendingRow(props: { item: PendingProgress; admin: boolean; undo: Undo; onResolve: (decision: PendingDecision) => Promise<string | null> }) {
  const [busy, setBusy] = useState<PendingDecision | null>(null);
  const [rejecting, setRejecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const resolve = async (decision: PendingDecision) => {
    setBusy(decision);
    setError(await props.onResolve(decision));
    setBusy(null);
  };
  const { item } = props;
  return (
    <li data-testid={`avance-pendiente-${item.id}`} className="space-y-1 rounded-xl border border-outline/15 bg-surface p-3">
      <StatePill rejected={false} />
      <p className="text-[14px] font-semibold text-on-surface">{pendingDetail(item)}</p>
      {item.note ? <p className="mt-0.5 text-[12px] text-on-surface-variant">{item.note}</p> : null}
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      {props.undo ? <UndoProgress id={item.id} toM={props.undo.toM} onUndo={props.undo.onUndo} /> : null}
      {props.admin && !rejecting ? (
        <div className="mt-3 flex gap-2">
          <button type="button" data-testid={`aprobar-avance-${item.id}`} disabled={busy !== null} onClick={() => void resolve('aprobar')} className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-60"><Check size={16} />{busy === 'aprobar' ? 'Aprobando…' : 'Aprobar'}</button>
          <button type="button" data-testid={`rechazar-avance-${item.id}`} disabled={busy !== null} onClick={() => setRejecting(true)} className="flex h-11 items-center justify-center gap-1.5 rounded-xl border border-outline/25 px-4 text-[14px] font-semibold text-on-surface disabled:opacity-60"><X size={16} /> Rechazar</button>
        </div>
      ) : null}
      {props.admin && rejecting ? (
        <div className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3">
          <p className="text-[13px] font-semibold text-on-surface">¿Rechazar este avance? No suma al metrado.</p>
          <div className="mt-2 flex gap-2">
            <button type="button" data-testid={`rechazar-si-${item.id}`} disabled={busy !== null} onClick={() => void resolve('rechazar')} className="h-10 flex-1 rounded-xl bg-error text-[13px] font-semibold text-background disabled:opacity-60">{busy === 'rechazar' ? 'Rechazando…' : 'Sí, rechazar'}</button>
            <button type="button" onClick={() => setRejecting(false)} className="h-10 flex-1 rounded-xl border border-outline/25 text-[13px] font-semibold text-on-surface">No</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

/**
 * «Por aprobar» above the map (José 09/11: the progress sent «disappeared» until someone approved it
 * in Portal). An admin approves or rejects it here; anyone else sees what they marked. Asked again
 * when `reloadKey` changes (the map reloads after every edit, a new progress included).
 */
type ByApproveProps = { list: ByApproveList | null; map: WorkMap; onUndo: (id: string) => Promise<string | null> };

/** «Deshacer» for a row when it is the caller's newest pending one of its street and work. */
function undoFor(byApprove: ByApproveProps | undefined, id: string): Undo {
  if (!byApprove || !undoableIds(byApprove.list).has(id)) return null;
  const toM = byApprove.list?.items.find((one) => one.id === id)?.toM;
  return typeof toM === 'number' ? { toM, onUndo: byApprove.onUndo } : null;
}

export function PendingProgressCard(props: { send: MapEditSend; admin: boolean; reloadKey: unknown; onList?: (items: PendingProgress[]) => void; byApprove?: ByApproveProps }) {
  const [list, setList] = useState<PendingState>(PENDING_LOADING);
  // The sender is new on every render: the latest one answers.
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
  const more = list.state === 'ready' && list.pending.more;
  const rejected = props.byApprove ? rejectedOf(props.byApprove.list) : [];
  if (!items.length && !rejected.length) return null;
  const resolve = (id: string) => async (decision: PendingDecision) => {
    const failure = await resolvePendingProgress(send.current, id, decision);
    if (!failure) load();
    return failure;
  };
  return (
    <section data-testid="avances-por-aprobar" className="space-y-3">
      <header>
        <p className={`${KICKER} flex items-center gap-1.5`}><Clock size={13} /> Pendiente de aprobar</p>
        <p className="text-[15px] font-semibold text-on-surface">{pendingTitle(items.length, more)}</p>
        <p className="mt-0.5 text-[12px] text-on-surface-variant">{props.admin ? PENDING_EXPLAIN : PENDING_MINE}</p>
      </header>
      <ul className="space-y-2">
        {items.map((item) => <PendingRow key={item.id} item={item} admin={props.admin} undo={undoFor(props.byApprove, item.id)} onResolve={resolve(item.id)} />)}
        {props.byApprove ? rejected.map((item) => <RejectedRow key={item.id} map={props.byApprove!.map} item={item} />) : null}
      </ul>
    </section>
  );
}
