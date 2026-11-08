import { useState } from 'react';
import { Pencil, Trash2 } from 'lucide-react';
import { deleteLayer, layerDeleteQuestion, renameLayer, type MapEditSend, type MapLayerKind } from '@lilachat/shared';

type Mode = 'idle' | 'rename' | 'ask';
type Props = { kind: MapLayerKind; id: string; name: string; layers: Array<{ id: string; name: string }>; send: MapEditSend };
const ICON = 'flex h-9 w-9 items-center justify-center rounded-lg text-on-surface-variant hover:bg-outline/10';
const FIELD = 'h-10 min-w-0 flex-1 rounded-xl border border-outline/25 bg-background px-3 text-[14px] text-on-surface outline-none focus:border-primary';

/** «Renombrar» and «Borrar» on a stage or a work (Portal c1c35c58); Portal's refusal shows under it. */
export function LayerActions(props: Props) {
  const [mode, setMode] = useState<Mode>('idle');
  const [draft, setDraft] = useState(props.name);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const testId = `${props.kind === 'stages' ? 'etapa' : 'trabajo'}-${props.id}`;
  const run = async (action: () => Promise<string | null>) => {
    setBusy(true);
    const failure = await action();
    setBusy(false);
    setError(failure);
    if (!failure) setMode('idle');
  };
  const open = (next: Mode) => { setError(null); setDraft(props.name); setMode(next); };
  // Open, it takes the whole row of its card (the parent wraps) and goes last.
  return (
    <div className={mode === 'idle' ? 'shrink-0' : 'order-last basis-full'}>
      {mode === 'idle' ? (
        <div className="flex gap-0.5">
          <button type="button" data-testid={`renombrar-${testId}`} aria-label={`Renombrar ${props.name}`} onClick={() => open('rename')} className={ICON}><Pencil size={15} /></button>
          <button type="button" data-testid={`borrar-${testId}`} aria-label={`Borrar ${props.name}`} onClick={() => open('ask')} className={ICON}><Trash2 size={15} /></button>
        </div>
      ) : null}
      {mode === 'rename' ? (
        <form className="mt-2 flex gap-2" onSubmit={(event) => { event.preventDefault(); void run(() => renameLayer(props.send, props.kind, props.id, draft, props.layers)); }}>
          <input data-testid={`nombre-${testId}`} value={draft} maxLength={60} autoFocus onChange={(event) => setDraft(event.target.value)} className={FIELD} />
          <button type="button" disabled={busy} onClick={() => setMode('idle')} className="h-10 rounded-xl border border-outline/20 px-3 text-[13px] font-semibold text-on-surface">Cancelar</button>
          <button type="submit" data-testid={`guardar-${testId}`} disabled={busy} className="h-10 rounded-xl bg-primary px-3 text-[13px] font-semibold text-on-primary disabled:opacity-60">{busy ? 'Guardando…' : 'Guardar'}</button>
        </form>
      ) : null}
      {mode === 'ask' ? (
        <div className="mt-2 rounded-xl border border-error/30 bg-error/5 p-3">
          <p className="text-[13px] font-semibold text-on-surface">{layerDeleteQuestion(props.kind, props.name)}</p>
          <div className="mt-2 flex gap-2">
            <button type="button" disabled={busy} onClick={() => setMode('idle')} className="h-10 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold text-on-surface">Cancelar</button>
            <button type="button" data-testid={`borrar-si-${testId}`} disabled={busy} onClick={() => void run(() => deleteLayer(props.send, props.kind, props.id))} className="h-10 flex-1 rounded-xl bg-error text-[13px] font-bold text-background disabled:opacity-60">{busy ? 'Borrando…' : 'Borrar'}</button>
          </div>
        </div>
      ) : null}
      {error ? <p role="alert" data-testid={`error-${testId}`} className="mt-1.5 text-[12px] font-semibold text-error">{error}</p> : null}
    </div>
  );
}
