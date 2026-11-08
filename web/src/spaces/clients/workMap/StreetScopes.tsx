import { useMemo, useState } from 'react';
import { ArrowLeft, Pencil, Plus, TrendingUp, Trash2 } from 'lucide-react';
import { metersLabel, type ManualPhotoUpload, scopeDraftFor, sendWorkScopeDelete, streetDetailOf, workScopeDeleteRequest, type MapEditSend, type ScopeDraft, type StreetLayer, type ManualProgressDraft, type StreetScopeRow, type StretchState, type WorkMap } from '@lilachat/shared';
import { KICKER } from './WorkMapPanel';
import { ManualProgress, ProgressPreview } from './ManualProgress';

/** «Ver calle» (o-03): the street alone on the map, without a stretch being recorded. */
const STREET_ONLY = { workId: null, fromM: 0, toM: 0 };
import { ScopeForm } from './ScopeForm';

const BAR = 'relative h-2.5 overflow-hidden rounded-full bg-surface-variant';

function LayerRow({ layer }: { layer: StreetLayer }) {
  return (
    <li data-testid={`calle-capa-${layer.workId}`} className="grid grid-cols-[96px_1fr_auto] items-center gap-3 text-[12px]">
      <span className="truncate font-semibold text-on-surface">{layer.name}</span>
      <span className={BAR}><span className="absolute inset-y-0 left-0" style={{ width: `${layer.percent}%`, backgroundColor: layer.color }} /></span>
      <span className="font-mono tabular-nums text-on-surface-variant">{metersLabel(layer.doneM)}</span>
    </li>
  );
}

/** A stretch with its size, stage and works; edit and a two-step delete (logical, an admin restores it). */
/** The state pill of o-03, with the theme's tones (the agenda's pills). */
const STATE_TONE: Record<StretchState, string> = {
  Pendiente: 'border-outline/20 bg-background text-on-surface-variant',
  'En proceso': 'border-tertiary/30 bg-tertiary/10 text-tertiary',
  Terminado: 'border-primary/40 bg-primary/15 text-primary',
};

function ScopeCard(props: { row: StreetScopeRow; send?: MapEditSend; onEdit: () => void }) {
  const { row } = props;
  const [asking, setAsking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const remove = async (send: MapEditSend) => {
    setBusy(true);
    const result = await send(workScopeDeleteRequest(row.id), sendWorkScopeDelete);
    setBusy(false);
    if (!result.ok) setError(result.message);
  };
  return (
    <li data-testid={`tramo-${row.id}`} className="rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p className="text-[14px] font-bold text-on-surface">{row.title}: <span className="font-mono">{row.range}</span></p>
          <p className="mt-0.5 font-mono text-[12px] text-on-surface-variant">{row.summary}</p>
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          {row.state ? <span data-testid={`tramo-estado-${row.id}`} className={`rounded-md border px-1.5 py-0.5 text-[11px] font-bold uppercase ${STATE_TONE[row.state]}`}>{row.state}</span> : null}
          {row.stageName ? <span className="rounded-md border border-primary/30 px-1.5 py-0.5 text-[11px] font-bold uppercase text-primary">{row.stageName}</span> : null}
        </div>
      </div>
      {row.works.length ? (
        <div className="mt-3 flex flex-wrap gap-2">
          {row.works.map((work) => <span key={work.workId} className="flex items-center gap-1.5 rounded-lg border border-outline/15 px-2 py-1 text-[12px]"><span aria-hidden className="h-2 w-2 rounded-full" style={{ backgroundColor: work.color }} />{work.name} <b className="font-mono">{work.percent} %</b></span>)}
        </div>
      ) : <p className="mt-2 text-[12px] text-on-surface-variant">Sin trabajos asignados</p>}
      {props.send ? (
        <div className="mt-3 flex justify-end gap-1">
          <button type="button" data-testid={`editar-tramo-${row.id}`} onClick={props.onEdit} aria-label={`Editar ${row.title}`} className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant hover:bg-background"><Pencil size={16} /></button>
          <button type="button" data-testid={`borrar-tramo-${row.id}`} onClick={() => setAsking(true)} aria-label={`Borrar ${row.title}`} className="grid h-9 w-9 place-items-center rounded-lg text-on-surface-variant hover:bg-background hover:text-error"><Trash2 size={16} /></button>
        </div>
      ) : null}
      {asking && props.send ? (
        <div role="alertdialog" aria-label={`¿Borrar ${row.title}?`} className="mt-3 rounded-xl border border-error/30 bg-error/5 p-3">
          <p className="text-[14px] font-bold">¿Borrar {row.title} ({row.range})?</p>
          <p className="mt-1 text-[12px] text-on-surface-variant">Un admin puede restaurarlo. Un tramo con avance aprobado no se borra.</p>
          {error ? <p role="alert" className="mt-2 text-[13px] font-semibold text-error">{error}</p> : null}
          <div className="mt-3 flex gap-2">
            <button type="button" disabled={busy} onClick={() => { setAsking(false); setError(null); }} className="h-10 flex-1 rounded-xl border border-outline/20 text-[13px] font-semibold">Cancelar</button>
            <button type="button" data-testid={`borrar-tramo-si-${row.id}`} disabled={busy} onClick={() => void remove(props.send!)} className="h-10 flex-1 rounded-xl bg-error text-[13px] font-bold text-background disabled:opacity-60">{busy ? 'Borrando…' : 'Borrar'}</button>
          </div>
        </div>
      ) : null}
    </li>
  );
}

type Editing = { draft: ScopeDraft; scopeId?: string } | null;

/** Design o-03: a street, what each work did on it, and its stretches to add, edit or delete (José 07/11: everyone updates). */
export function StreetScopes(props: { map: WorkMap; streetId: string; send?: MapEditSend; /** Photos of «Registrar avance» (o-06). */ uploadPhoto?: ManualPhotoUpload<File>; /** «Registrar avance» from the map opens the form straight away. */ startRecording?: boolean; /** The form already filled (#253). */ recordDraft?: ManualProgressDraft; onBack: () => void }) {
  const detail = useMemo(() => streetDetailOf(props.map, props.streetId), [props.map, props.streetId]);
  const [editing, setEditing] = useState<Editing>(null);
  const [recording, setRecording] = useState(Boolean(props.startRecording || props.recordDraft));
  if (!detail) return <p className="p-4 text-[14px] text-on-surface-variant">Esta calle ya no está en el mapa.</p>;
  const editOf = (row: StreetScopeRow): Editing => ({ scopeId: row.id, draft: { fromM: row.scope.fromM, toM: row.scope.toM, workIds: row.scope.workIds, stageId: row.scope.stageId ?? null, widthM: row.scope.widthM ?? null } });
  return (
    <div data-testid="calle-detalle" className="min-h-0 flex-1 overflow-y-auto bg-background p-4 md:p-5">
      <button type="button" data-testid="calle-volver" onClick={props.onBack} className="flex items-center gap-1 text-[13px] font-semibold text-primary"><ArrowLeft size={16} />Todas las calles</button>
      <div className="mt-2 flex items-start justify-between gap-2">
        <p className="text-xl font-extrabold tracking-tight text-on-surface">{detail.name}</p>
        <span className="shrink-0 rounded-lg border border-outline/20 px-2 py-1 font-mono text-[12px] font-semibold">{detail.headline}</span>
      </div>
      {recording ? null : <div className="mt-4"><ProgressPreview map={props.map} streetId={detail.id} draft={STREET_ONLY} /></div>}
      {props.send && !recording ? <button type="button" data-testid="avance-manual-abrir" onClick={() => setRecording(true)} className="mt-4 flex h-12 w-full items-center justify-center gap-2 rounded-xl bg-primary text-[15px] font-semibold text-on-primary"><TrendingUp size={18} />Registrar avance</button> : null}
      {props.send && recording ? <div className="mt-4"><ManualProgress map={props.map} streetId={detail.id} lengthM={detail.lengthM} widthM={detail.widthM ?? undefined} send={props.send} uploadPhoto={props.uploadPhoto} initial={props.recordDraft} onDone={() => setRecording(false)} /></div> : null}
      {detail.layers.length ? (
        <section className="mt-4 rounded-xl border-[1.5px] border-outline/15 bg-surface p-4">
          <p className={KICKER}>Avance por trabajo</p>
          <ul className="mt-3 space-y-2">{detail.layers.map((layer) => <LayerRow key={layer.workId} layer={layer} />)}</ul>
        </section>
      ) : null}
      <div className="mt-5 flex items-center justify-between">
        <p className={KICKER}>Tramos definidos ({detail.scopes.length})</p>
        {props.send && !editing ? <button type="button" data-testid="tramo-agregar" onClick={() => setEditing({ draft: scopeDraftFor(detail.lengthM) })} className="flex h-9 items-center gap-1.5 rounded-xl border border-primary/30 px-3 text-[13px] font-semibold text-primary"><Plus size={14} />Agregar tramo</button> : null}
      </div>
      <div className="mt-3 space-y-3">
        {editing && props.send ? <ScopeForm map={props.map} streetId={detail.id} lengthM={detail.lengthM} initial={editing.draft} scopeId={editing.scopeId} send={props.send} onDone={() => setEditing(null)} /> : null}
        {detail.scopes.length ? <ul className="space-y-3">{detail.scopes.map((row) => <ScopeCard key={row.id} row={row} send={props.send} onEdit={() => setEditing(editOf(row))} />)}</ul> : <p className="text-[13px] text-on-surface-variant">Esta calle todavía no tiene tramos. Agrega uno para asignarle trabajos y etapa.</p>}
      </div>
    </div>
  );
}
