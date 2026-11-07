import { useState } from 'react';
import { Trash2 } from 'lucide-react';
import { runStreetDelete, STREET_DELETE_ACTION, STREET_DELETE_ASKING, STREET_DELETE_IDLE, streetDeleteAsk, type StreetDeleteState, type WorkMapStreetRow, type WorkProgressResult } from '@lilachat/shared';

export type StreetDeleteSend = (streetId: string) => Promise<WorkProgressResult>;

/**
 * «Borrar calle» on each street of the panel (José 07/11: anyone deletes, an admin restores).
 * It asks first, naming the street, and shows Portal's refusal as it comes (a street with progress).
 */
export function StreetDelete({ street, send }: { street: WorkMapStreetRow; send: StreetDeleteSend }) {
  const [{ asking, busy, error }, setState] = useState<StreetDeleteState>(STREET_DELETE_IDLE);
  const ask = streetDeleteAsk(street.name);
  if (!asking) {
    return (
      <button type="button" data-testid={`borrar-calle-${street.id}`} onClick={() => setState(STREET_DELETE_ASKING)} aria-label={`${STREET_DELETE_ACTION} ${street.name}`} className="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-on-surface-variant hover:bg-background hover:text-error">
        <Trash2 size={16} />
      </button>
    );
  }
  return (
    <div data-testid={`confirmar-borrar-${street.id}`} role="alertdialog" aria-label={ask.title} className="mt-3 basis-full rounded-xl border border-error/30 bg-error/5 p-3">
      <p className="text-[14px] font-bold text-on-surface">{ask.title}</p>
      <p className="mt-1 text-[12px] text-on-surface-variant">{ask.hint}</p>
      {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
      <div className="mt-3 flex gap-2">
        <button type="button" onClick={() => setState(STREET_DELETE_IDLE)} disabled={busy} className="h-10 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold text-on-surface">Cancelar</button>
        <button type="button" data-testid={`borrar-calle-si-${street.id}`} onClick={() => void runStreetDelete(send, street.id, setState)} disabled={busy} className="h-10 flex-1 rounded-xl bg-error text-[13px] font-bold text-background disabled:opacity-60">{busy ? 'Borrando…' : 'Borrar'}</button>
      </div>
    </div>
  );
}
