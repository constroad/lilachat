import { useEffect, useRef, useState } from 'react';
import { Check, Clock, X } from 'lucide-react';
import { loadPendingProgress, PENDING_EXPLAIN, PENDING_LOADING, PENDING_MINE, pendingDetail, pendingTitle, resolvePendingProgress, type MapEditSend, type PendingDecision, type PendingProgress, type PendingState } from '@lilachat/shared';

const KICKER = 'text-[11px] font-bold uppercase tracking-[0.12em] text-on-surface-variant';

function PendingRow(props: { item: PendingProgress; admin: boolean; onResolve: (decision: PendingDecision) => Promise<string | null> }) {
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
    <li data-testid={`avance-pendiente-${item.id}`} className="rounded-xl border border-outline/15 bg-surface p-3">
      <p className="text-[14px] font-semibold text-on-surface">{pendingDetail(item)}</p>
      {item.note ? <p className="mt-0.5 text-[12px] text-on-surface-variant">{item.note}</p> : null}
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
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
export function PendingProgressCard(props: { send: MapEditSend; admin: boolean; reloadKey: unknown }) {
  const [list, setList] = useState<PendingState>(PENDING_LOADING);
  // The sender is new on every render: the latest one answers.
  const send = useRef(props.send);
  send.current = props.send;
  const load = () => void loadPendingProgress(send.current).then(setList);
  useEffect(load, [props.reloadKey]);
  if (list.state !== 'ready' || !list.pending.items.length) return null;
  const { items, more } = list.pending;
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
      <ul className="space-y-2">{items.map((item) => <PendingRow key={item.id} item={item} admin={props.admin} onResolve={resolve(item.id)} />)}</ul>
    </section>
  );
}
