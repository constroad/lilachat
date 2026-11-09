import { Suspense, useMemo, useRef, useState } from 'react';
import { Camera, Check, Crosshair, Minus, Plus, Send, X } from 'lucide-react';
import { addManualPhoto, GPS_UNAVAILABLE, manualEndFromGps, MANUAL_PHOTOS_MAX, MANUAL_STEP_M, manualDraftFor, manualFigures, nudgeManualEnd, pickManualWork, progressPreviewOf, manualStepOf, MANUAL_STEPS, runManualProgress, stationLabel, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { DrivePhotoInput } from '../ServiceDriveWeb';
import { readGpsOnce } from './useGpsWalk';
import { KICKER } from './WorkMapPanel';
import { lazyChunk } from '../../../ui/lazyChunk';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));

/** The four steps of the form (design o-06), with the current one marked: where the person is. */
function ManualSteps(props: { draft: ManualProgressDraft }) {
  const step = manualStepOf(props.draft);
  return (
    <ol data-testid="avance-pasos" data-paso={step} className="grid grid-cols-4 gap-1.5">
      {MANUAL_STEPS.map((label, index) => {
        const at = index + 1;
        return <li key={label} aria-current={at === step ? 'step' : undefined} className={`flex h-9 items-center justify-center gap-1 rounded-lg border text-[12px] font-semibold ${at === step ? 'border-primary bg-primary text-on-primary' : at < step ? 'border-primary/30 text-primary' : 'border-outline/20 text-on-surface-variant'}`}><span className="font-mono">{at}</span><span className="truncate">{label}</span></li>;
      })}
    </ol>
  );
}

/** The street over the form (design o-06): what is done, and the new stretch up to «Hasta dónde». */
export function ProgressPreview(props: { map: WorkMap; streetId: string; draft: Pick<ManualProgressDraft, 'workId' | 'fromM' | 'toM'> }) {
  const preview = useMemo(() => progressPreviewOf(props.map, props.streetId, props.draft), [props.map, props.streetId, props.draft]);
  return (
    <div data-testid="avance-mapa" className="relative h-[220px] overflow-hidden rounded-xl border-[1.5px] border-outline/15 bg-surface-variant">
      <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-surface-variant" />}>
        <WorkMapCanvas view={preview.view} expanded={false} stretches={preview.stretch} stations={preview.stations} />
      </Suspense>
    </div>
  );
}

const CARD = 'rounded-xl border-[1.5px] border-outline/15 bg-surface p-4';
const CHIP = 'flex h-9 items-center gap-1.5 rounded-full border px-3 text-[13px] font-semibold';
const STEP = 'flex h-14 flex-col items-center justify-center rounded-xl border border-outline/20 bg-surface text-[15px] font-bold font-mono text-on-surface disabled:opacity-50';
type Answer = { ok: boolean; message: string } | null;
/** `initial`: the form already filled, as the prime coat report suggests it (#253). */
type Props = { map: WorkMap; streetId: string; lengthM: number; widthM?: number; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<File>; initial?: ManualProgressDraft; onDone: () => void };

/** Step 3: photos already in the service's Drive; Portal only takes those as evidence. */
function Photos(props: { count: number; uploadPhoto?: ManualPhotoUpload<File>; onPhoto: (mediaId: string) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  if (!props.uploadPhoto) return null;
  const upload = props.uploadPhoto;
  const pick = async (file: File | undefined) => {
    if (!file) return;
    setBusy(true);
    setError(null);
    const result = await upload(file);
    setBusy(false);
    if (result.ok) props.onPhoto(result.mediaId);
    else setError(result.message);
  };
  return (
    <section className={CARD}>
      <p className={KICKER}>3 · Foto en campo</p>
      <p className="mt-1 text-[12px] text-on-surface-variant">Va al Drive del servicio con su fecha y hora.</p>
      <DrivePhotoInput ref={input} testId="avance-foto-archivo" onFile={(file) => void pick(file)} />
      <button type="button" data-testid="avance-foto" disabled={busy || props.count >= MANUAL_PHOTOS_MAX} onClick={() => input.current?.click()} className="mt-3 flex h-11 w-full items-center justify-center gap-2 rounded-xl border border-dashed border-primary/40 text-[14px] font-semibold text-primary disabled:opacity-60"><Camera size={16} />{busy ? 'Subiendo…' : 'Agregar foto'}</button>
      <p data-testid="avance-fotos" className="mt-2 text-[12px] text-on-surface-variant">{props.count} de {MANUAL_PHOTOS_MAX} fotos</p>
      {error ? <p role="alert" className="mt-1 text-[13px] font-semibold text-error">{error}</p> : null}
    </section>
  );
}

/** Design o-06: which work, up to where, a photo and send; it waits for an admin's approval. */
export function ManualProgress(props: Props) {
  const start = useMemo(() => manualDraftFor(props.map, props.streetId), [props.map, props.streetId]);
  const [draft, setDraft] = useState<ManualProgressDraft>(props.initial ?? start.draft);
  const [entryId] = useState(() => crypto.randomUUID());
  const [answer, setAnswer] = useState<Answer>(null);
  const [sending, setSending] = useState(false);
  const [locating, setLocating] = useState(false);
  const change = (next: ManualProgressDraft) => { setAnswer(null); setDraft(next); };
  const line = props.map.streets.find((street) => street.id === props.streetId)?.line ?? [];
  const fromGps = async () => {
    setLocating(true);
    const fix = await readGpsOnce();
    setLocating(false);
    const placed = fix ? manualEndFromGps(draft, line, props.lengthM, fix) : { problem: GPS_UNAVAILABLE };
    if ('draft' in placed) change(placed.draft);
    else setAnswer({ ok: false, message: placed.problem });
  };
  const submit = async () => {
    setSending(true);
    const result = await runManualProgress({ map: props.map, streetId: props.streetId, lengthM: props.lengthM, draft, entryId, send: props.send, now: new Date() });
    setSending(false);
    setAnswer(result);
  };
  if (answer?.ok) {
    return (
      <section data-testid="avance-manual" className={CARD}>
        <p role="status" data-testid="avance-manual-respuesta" className="flex items-start gap-2 text-[14px] font-semibold text-on-surface"><Check size={18} className="shrink-0 text-primary" />{answer.message}</p>
        <button type="button" onClick={props.onDone} className="mt-3 h-11 w-full rounded-xl border border-outline/20 text-[14px] font-semibold">Listo</button>
      </section>
    );
  }
  return (
    <div data-testid="avance-manual" className="space-y-3">
      <ProgressPreview map={props.map} streetId={props.streetId} draft={draft} />
      <ManualSteps draft={draft} />
      <section className={CARD}>
        <p className={`${KICKER} text-primary`}>Registrar avance</p>
        <p className="mt-2 text-[12px] font-semibold uppercase text-on-surface-variant">1 · Trabajo</p>
        <div className="mt-1 flex flex-wrap gap-2">
          {start.works.map((work) => {
            const on = draft.workId === work.id;
            return <button key={work.id} type="button" aria-pressed={on} data-testid={`avance-manual-trabajo-${work.id}`} onClick={() => change(pickManualWork(props.map, props.streetId, draft, work.id))} className={`${CHIP} ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 text-on-surface'}`}><span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full ring-1 ring-on-surface/25" style={{ backgroundColor: work.color }} />{work.name}</button>;
          })}
          {start.works.length ? null : <p className="text-[13px] text-on-surface-variant">Esta calle no tiene trabajos en sus tramos. Agrega un tramo con su trabajo primero.</p>}
        </div>
      </section>
      <section className={CARD}>
        <p className="text-[12px] font-semibold uppercase text-on-surface-variant">2 · ¿Hasta dónde avanzó?</p>
        <div className="mt-2 grid grid-cols-2 divide-x divide-outline/15">
          <div className="pr-3">
            <p className={KICKER}>Punto de partida</p>
            <p data-testid="avance-manual-desde" className="font-mono text-2xl font-bold tabular-nums text-on-surface">{stationLabel(draft.fromM)}</p>
            <p className="text-[12px] text-on-surface-variant">Sigue donde quedó</p>
          </div>
          <label className="pl-3">
            <span className={`${KICKER} text-primary`}>Hasta dónde (m)</span>
            <input data-testid="avance-manual-hasta" type="number" inputMode="decimal" min={draft.fromM} value={draft.toM} onChange={(event) => change({ ...draft, toM: Number(event.target.value.replace(',', '.')) || 0 })} className="mt-0.5 h-11 w-full rounded-xl border border-outline/25 bg-background px-3 font-mono text-xl font-bold tabular-nums text-primary outline-none focus:border-primary" />
            <span data-testid="avance-manual-hasta-progresiva" className="mt-0.5 block font-mono text-[12px] text-on-surface-variant">Progresiva {stationLabel(draft.toM)}</span>
          </label>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2">
          <button type="button" data-testid="avance-manual-menos" onClick={() => change(nudgeManualEnd(draft, -MANUAL_STEP_M, props.lengthM))} className={STEP}><span className="flex items-center gap-1"><Minus size={14} />{MANUAL_STEP_M} m</span><span className="font-sans text-[11px] font-medium text-on-surface-variant">Retroceder</span></button>
          <button type="button" data-testid="avance-manual-gps" disabled={locating} onClick={() => void fromGps()} className={`${STEP} border-primary/30 bg-primary/5 text-primary`}><Crosshair size={16} /><span className="font-sans text-[11px] font-semibold">{locating ? 'Ubicando…' : 'Mi GPS'}</span></button>
          <button type="button" data-testid="avance-manual-mas" onClick={() => change(nudgeManualEnd(draft, MANUAL_STEP_M, props.lengthM))} className={`${STEP} text-primary`}><span className="flex items-center gap-1"><Plus size={14} />{MANUAL_STEP_M} m</span><span className="font-sans text-[11px] font-medium text-on-surface-variant">Avanzar</span></button>
        </div>
        <p className="mt-3 rounded-xl bg-background p-3 text-[12px] text-on-surface-variant">Metrado de la jornada: <b data-testid="avance-manual-metrado" className="font-mono text-[14px] text-on-surface">{manualFigures(draft, props.widthM)}</b></p>
      </section>
      <Photos count={draft.photoIds.length} uploadPhoto={props.uploadPhoto} onPhoto={(mediaId) => change(addManualPhoto(draft, mediaId))} />
      <section className={CARD}>
        <p className="text-[12px] font-semibold uppercase text-on-surface-variant">4 · Enviar</p>
        <textarea data-testid="avance-manual-nota" value={draft.note} maxLength={280} rows={2} placeholder="Nota (opcional)" onChange={(event) => change({ ...draft, note: event.target.value })} className="mt-2 w-full rounded-xl border border-outline/25 bg-background p-3 text-[14px] outline-none focus:border-primary" />
        <p className="mt-1 text-[12px] text-on-surface-variant">Queda pendiente hasta que un admin lo apruebe.</p>
        {answer ? <p role="alert" data-testid="avance-manual-error" className="mt-2 text-[13px] font-semibold text-error">{answer.message}</p> : null}
        <div className="mt-3 flex gap-2">
          <button type="button" onClick={props.onDone} className="flex h-11 flex-1 items-center justify-center gap-1 rounded-xl border border-outline/20 text-[14px] font-semibold"><X size={14} />Cancelar</button>
          <button type="button" data-testid="avance-manual-enviar" disabled={sending} onClick={() => void submit()} className="flex h-11 flex-[2] items-center justify-center gap-2 rounded-xl bg-primary text-[14px] font-semibold text-on-primary disabled:opacity-60"><Send size={16} />{sending ? 'Enviando…' : 'Registrar avance'}</button>
        </div>
      </section>
    </div>
  );
}
