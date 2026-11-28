import { useEffect, useMemo, useRef, useState } from 'react';
import { Undo2 } from 'lucide-react';
import { byApproveActions, UNDO_LABEL, undoQuestion, type ByApproveList, type MapEditSend } from '@lilachat/shared';

/** «Deshacer» on a record (José 28/11: no approval, but a mistake can be taken back): asks once, then Portal does it or says why not. */
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

/** What Portal still keeps pending, next to the map (José 28/11: it counts as done): loaded with it, again after each change. */
export function useByApprove(send: MapEditSend | undefined, reloadKey: unknown) {
  const [list, setList] = useState<ByApproveList | null>(null);
  // The sender is new on every render: the latest one answers.
  const sender = useRef(send);
  sender.current = send;
  const actions = useMemo(() => byApproveActions(sender, setList), []);
  useEffect(actions.load, [reloadKey, actions]);
  return { list, undo: actions.undo, reload: actions.load };
}
