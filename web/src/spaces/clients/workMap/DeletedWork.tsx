import { useEffect, useMemo, useRef, useState } from 'react';
import { RotateCcw, X } from 'lucide-react';
import { DELETED_LOADING, loadDeletedRows, NOTHING_DELETED, restoreDeleted, type DeletedList, type DeletedRow, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';

function Row(props: { row: DeletedRow; send: MapEditSend; onRestored: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const restore = async () => {
    setBusy(true);
    const failure = await restoreDeleted(props.send, props.row);
    setBusy(false);
    if (failure) setError(failure);
    else props.onRestored();
  };
  return (
    <li data-testid={`borrado-${props.row.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <p className="text-[14px] font-bold text-on-surface">{props.row.title}</p>
      <p className="mt-0.5 text-[12px] text-on-surface-variant">{props.row.detail}</p>
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      <button type="button" data-testid={`restaurar-${props.row.id}`} disabled={busy} onClick={() => void restore()} className="mt-3 flex h-10 w-full items-center justify-center gap-2 rounded-xl border border-primary/30 text-[13px] font-semibold text-primary disabled:opacity-60"><RotateCcw size={14} />{busy ? 'Restaurando…' : 'Restaurar'}</button>
    </li>
  );
}

/** «Borrados» (admins, José 07/11): the streets and stretches deleted from the map, each with «Restaurar». */
export function DeletedWork(props: { map: WorkMap; send: MapEditSend; onClose: () => void }) {
  const [list, setList] = useState<DeletedList>(DELETED_LOADING);
  const names = useMemo(() => new Map(props.map.streets.map((street) => [street.id, street.name])), [props.map]);
  const load = useMemo(() => () => { setList(DELETED_LOADING); void loadDeletedRows(props.send, names).then(setList); }, [props.send, names]);
  /** Asked once on open (the sender is new on every render); «Restaurar» asks again. */
  const asked = useRef(false);
  useEffect(() => {
    if (asked.current) return;
    asked.current = true;
    void loadDeletedRows(props.send, names).then(setList);
  }, [props.send, names]);
  return (
    <div data-testid="mapa-borrados" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-5">
      <div className="flex items-start justify-between gap-2 border-b border-outline/15 pb-4">
        <div>
          <p className={`${KICKER} text-primary`}>Solo admins</p>
          <p className="mt-1 text-2xl font-extrabold tracking-tight text-on-surface">Borrados</p>
          <p className="mt-0.5 text-[12px] text-on-surface-variant">Una calle vuelve con los tramos que se borraron con ella.</p>
        </div>
        <button type="button" data-testid="mapa-borrados-cerrar" aria-label="Cerrar borrados" onClick={props.onClose} className="grid h-9 w-9 shrink-0 place-items-center rounded-xl border border-outline/20 text-on-surface"><X size={16} /></button>
      </div>
      {list.state === 'loading' ? <div className="mt-4 h-24 animate-pulse rounded-xl bg-surface-variant" /> : null}
      {list.state === 'failed' ? <p role="alert" className="mt-4 text-[14px] font-semibold text-error">{list.message}</p> : null}
      {list.state === 'ready' && !list.rows.length ? <p className="mt-4 text-[14px] text-on-surface-variant">{NOTHING_DELETED}</p> : null}
      {list.state === 'ready' && list.rows.length ? <ul className="mt-4 space-y-3">{list.rows.map((row) => <Row key={row.id} row={row} send={props.send} onRestored={load} />)}</ul> : null}
    </div>
  );
}
