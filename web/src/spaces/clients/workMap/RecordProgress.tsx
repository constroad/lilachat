import { Suspense, useMemo, useRef, useState } from 'react';
import { Camera, Crosshair, Hand, Map as MapIcon, X } from 'lucide-react';
import { GPS_UNAVAILABLE, MANUAL_NOTE_MAX, RECORD_ADD_NOTE, RECORD_NOTE_PLACEHOLDER, layerDraftFor, manualEndFromGps, pickManualWork, progressPreviewOf, RECORD_CHANGE, RECORD_PENDING_NOTE, RECORD_PHOTO_AND_SEND, RECORD_SEND, RECORD_TO_ME, RECORD_WHOLE, RECORD_WITHOUT_PHOTO, recordDropAt, recordHint, recordMapOf, recordProblem, recordSummary, recordTitle, recordWholeStreet, runManualProgress, youAreOn, type GpsStreet, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type StreetEnd, type WorkMap, type WorkMapPoint, type WorkMapWork } from '@lilachat/shared';
import { DrivePhotoInput } from '../ServiceDriveWeb';
import type { PickerHandle } from '../../../chat/camera/cameraRequests';
import { lazyChunk } from '../../../ui/lazyChunk';
import { readGpsOnce } from './useGpsWalk';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));
const OUTLINE_BUTTON = 'flex h-11 flex-1 items-center justify-center gap-2 rounded-xl border border-outline/25 bg-surface text-[15px] font-semibold text-on-surface disabled:opacity-60';

type Answer = { ok: boolean; message: string } | null;
const STREET_ONLY = { workId: null, fromM: 0, toM: 0 };
/** A chip of the pickers: 44 px, wrapped so «Cambiar» is never cut (José 28/11). */
const PICKER_CHIP = 'flex h-11 min-w-0 max-w-full items-center gap-2 rounded-xl';
export type RecordScreenProps = { map: WorkMap; streetId: string; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<File>; initial?: ManualProgressDraft; /** The layer picked on opening (ma01), when the street carries it. */ workId?: string | null; located: GpsStreet | null; onChangeStreet: () => void; onClose: () => void; onAnswer: (answer: { ok: true; message: string }) => void };

/** The work (one chip per work the street carries) and the street with «Cambiar» (design ma04). */
function Pickers(props: { works: WorkMapWork[]; workId: string | null; streetName: string; onWork: (workId: string) => void; onChangeStreet: () => void }) {
  return (
    <div data-testid="avance-selectores" className="flex flex-wrap gap-2 px-3 py-2">
      {props.works.map((work) => {
        const on = work.id === props.workId;
        return (
          <button key={work.id} type="button" aria-pressed={on} data-testid={`avance-manual-trabajo-${work.id}`} onClick={() => props.onWork(work.id)} className={`${PICKER_CHIP} border-[1.5px] px-3 text-[15px] font-bold ${on ? 'border-primary bg-primary/10 text-primary' : 'border-outline/20 bg-surface text-on-surface'}`}>
            {/* Ringed: a near-black layer (#111827) still shows its dot on the dark theme. */}
            <span aria-hidden className="h-3.5 w-3.5 shrink-0 rounded-sm border border-outline/60" style={{ backgroundColor: work.color }} /><span className="truncate">{work.name}</span>
          </button>
        );
      })}
      <div className={`${PICKER_CHIP} border border-outline/20 bg-surface-variant pl-3`}>
        <span aria-hidden className="h-2.5 w-2.5 shrink-0 rounded-full bg-en-linea" />
        <span data-testid="avance-calle-nombre" className="truncate text-[15px] font-semibold text-on-surface">{props.streetName}</span>
        <button type="button" data-testid="avance-cambiar-calle" onClick={props.onChangeStreet} className="h-11 shrink-0 px-3 text-[14px] font-bold text-primary underline">{RECORD_CHANGE}</button>
      </div>
    </div>
  );
}

/** «AVANCE: +46 m», «0+120 → 0+166», the bar and «Metrado 276 m²» (design ma04). */
function Summary(props: { draft: ManualProgressDraft; lengthM: number; widthM?: number }) {
  const summary = recordSummary(props.draft, props.lengthM, props.widthM);
  return (
    <div className="space-y-1.5">
      <div className="flex items-end justify-between gap-3">
        <p className="flex items-baseline gap-2"><span className="text-[13px] font-bold uppercase text-on-surface-variant">Avance:</span><b data-testid="avance-manual-metrado" className="text-[28px] leading-none text-on-surface">{summary.gain}</b></p>
        <div className="text-right">
          <p className="text-[12px] font-bold uppercase text-on-surface-variant">Tramo</p>
          <p data-testid="avance-manual-tramo" className="rounded-lg border border-outline/20 bg-surface-variant px-2 py-0.5 font-mono text-[15px] font-semibold text-on-surface">{summary.stretch}</p>
        </div>
      </div>
      <div aria-hidden className="flex h-2 overflow-hidden rounded-full bg-surface-variant">
        <span className="bg-primary" style={{ width: `${summary.donePct}%` }} />
        <span className="bg-warning" style={{ width: `${summary.newPct}%` }} />
      </div>
      <div className="flex items-center justify-between text-[14px] text-on-surface-variant">
        <p>{summary.area ? <b data-testid="avance-manual-area" className="text-on-surface">Metrado {summary.area}</b> : null}{summary.areaHow ? ` · ${summary.areaHow}` : ''}</p>
        <p className="font-mono text-[13px]">{summary.total}</p>
      </div>
    </div>
  );
}

/** One street: the ring from where the work stopped, the summary and «Tomar foto y registrar». */
function useRecord(props: RecordScreenProps) {
  const street = props.map.streets.find((one) => one.id === props.streetId);
  const lengthM = street?.lengthM ?? 0;
  const start = useMemo(() => layerDraftFor(props.map, props.streetId, props.workId ?? null), [props.map, props.streetId, props.workId]);
  const [draft, setDraft] = useState<ManualProgressDraft>(props.initial ?? start.draft);
  const [drops, setDrops] = useState(0);
  const [entryId] = useState(() => crypto.randomUUID());
  const [answer, setAnswer] = useState<Answer>(null);
  const [busy, setBusy] = useState<'gps' | 'send' | null>(null);
  const change = (next: ManualProgressDraft) => { setAnswer(null); setDraft(next); };
  const drop = (_end: StreetEnd, point: WorkMapPoint) => { setDrops((count) => count + 1); change(recordDropAt(draft, street?.line ?? [], lengthM, point)); };
  const toMe = async () => {
    setBusy('gps');
    const fix = await readGpsOnce();
    setBusy(null);
    const placed = fix ? manualEndFromGps(draft, street?.line ?? [], lengthM, fix) : { problem: GPS_UNAVAILABLE };
    if ('draft' in placed) { setDrops((count) => count + 1); change(placed.draft); } else setAnswer({ ok: false, message: placed.problem });
  };
  const problem = () => {
    const found = recordProblem(props.map, props.streetId, lengthM, draft);
    if (found) setAnswer({ ok: false, message: found });
    return found;
  };
  const send = async (photoIds: string[]) => {
    setBusy('send');
    const sent = await runManualProgress({ map: props.map, streetId: props.streetId, lengthM, draft: { ...draft, photoIds: [...draft.photoIds, ...photoIds] }, entryId, send: props.send, now: new Date() });
    setBusy(null);
    if (sent.ok) props.onAnswer({ ok: true, message: sent.message });
    else setAnswer(sent);
  };
  /** The photo taken: to the service's Drive first, then the progress with its id. */
  const withPhoto = async (file: File | undefined) => {
    if (!file || !props.uploadPhoto) return;
    setBusy('send');
    const uploaded = await props.uploadPhoto(file);
    if (uploaded.ok) return send([uploaded.mediaId]);
    setBusy(null);
    return setAnswer(uploaded);
  };
  return { street, lengthM, works: start.works, draft, drops, answer, busy, change, drop, toMe, problem, send, withPhoto };
}

/** «Agregar nota» (as o-06 had it): folded so it never pushes the main button down; dictation fits in it. */
function NoteField(props: { note: string; onNote: (note: string) => void }) {
  const [open, setOpen] = useState(props.note.length > 0);
  if (!open) return <button type="button" data-testid="avance-nota-abrir" onClick={() => setOpen(true)} className="h-9 text-[14px] font-semibold text-primary underline">{RECORD_ADD_NOTE}</button>;
  return <textarea data-testid="avance-manual-nota" autoFocus value={props.note} maxLength={MANUAL_NOTE_MAX} rows={2} placeholder={RECORD_NOTE_PLACEHOLDER} onChange={(event) => props.onNote(event.target.value)} className="w-full rounded-xl border border-outline/25 bg-background p-3 text-[15px] text-on-surface outline-none focus:border-primary" />;
}

/** The foot: the summary, «Hasta mi ubicación» / «Toda la calle» and the big «Tomar foto y registrar». */
function RecordFoot(props: { record: ReturnType<typeof useRecord>; map: WorkMap; streetId: string; canPhoto: boolean }) {
  const { record } = props;
  const camera = useRef<PickerHandle>(null);
  const primary = () => {
    if (record.problem()) return;
    if (props.canPhoto) camera.current?.click();
    else void record.send([]);
  };
  return (
    <div className="space-y-2">
      <Summary draft={record.draft} lengthM={record.lengthM} widthM={record.street?.widthM} />
      <NoteField note={record.draft.note} onNote={(note) => record.change({ ...record.draft, note })} />
      <div className="flex gap-2">
        <button type="button" data-testid="avance-manual-gps" disabled={record.busy !== null} onClick={() => void record.toMe()} className={OUTLINE_BUTTON}><Crosshair size={18} className="text-primary" />{record.busy === 'gps' ? 'Ubicando…' : RECORD_TO_ME}</button>
        <button type="button" data-testid="avance-toda-la-calle" disabled={record.busy !== null} onClick={() => record.change(recordWholeStreet(props.map, props.streetId, record.draft, record.lengthM))} className={OUTLINE_BUTTON}><MapIcon size={18} />{RECORD_WHOLE}</button>
      </div>
      {record.answer ? <p role="alert" data-testid="avance-manual-error" className="text-[14px] font-semibold text-error">{record.answer.message}</p> : null}
      {props.canPhoto ? <DrivePhotoInput ref={camera} testId="avance-foto-archivo" onFile={(file) => void record.withPhoto(file)} /> : null}
      <button type="button" data-testid="avance-manual-enviar" disabled={record.busy !== null} onClick={primary} className="flex h-[52px] w-full items-center justify-center gap-2 rounded-xl bg-primary text-[16px] font-bold text-on-primary disabled:opacity-60">
        {props.canPhoto ? <Camera size={20} /> : null}{record.busy === 'send' ? 'Enviando…' : props.canPhoto ? RECORD_PHOTO_AND_SEND : RECORD_SEND}
      </button>
      {props.canPhoto ? <button type="button" data-testid="avance-sin-foto" disabled={record.busy !== null} onClick={() => { if (!record.problem()) void record.send([]); }} className="h-9 w-full text-[13px] font-semibold text-on-surface-variant underline">{RECORD_WITHOUT_PHOTO}</button> : null}
      <p className="text-center text-[11px] text-on-surface-variant">{RECORD_PENDING_NOTE}</p>
    </div>
  );
}

/** Design ma04 on the web: the map on top and the foot below; side by side on a wide screen. */
export function RecordScreen(props: RecordScreenProps) {
  const record = useRecord(props);
  const shown = useMemo(() => recordMapOf(props.map, props.streetId, record.draft, record.drops), [props.map, props.streetId, record.draft, record.drops]);
  // Framed once per street: the ring moving does not move the camera.
  const view = useMemo(() => progressPreviewOf(props.map, props.streetId, STREET_ONLY).view, [props.map, props.streetId]);
  const workName = record.works.find((work) => work.id === record.draft.workId)?.name;
  return (
    <div data-testid="avance-manual" className="flex min-h-0 flex-1 flex-col">
      {/* The hint lives in the top bar, on the surface token (José 28/11: no light banner on dark). */}
      <div className="flex items-center gap-2 border-b border-outline/15 bg-surface px-4 py-1.5">
        <div className="min-w-0 flex-1">
          <p data-testid="avance-titulo" className="truncate text-[18px] font-bold text-on-surface">{recordTitle(workName ?? null)}</p>
          {workName ? <p data-testid="avance-pista" className="flex items-center gap-1.5 text-[13px] text-on-surface-variant"><Hand size={14} className="shrink-0 text-warning" /><span className="truncate">{recordHint(workName)}</span></p> : null}
        </div>
        <button type="button" data-testid="avance-cerrar" aria-label="Cerrar" onClick={props.onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface"><X size={22} /></button>
      </div>
      <Pickers works={record.works} workId={record.draft.workId} streetName={record.street?.name ?? ''} onWork={(workId) => record.change(pickManualWork(props.map, props.streetId, record.draft, workId))} onChangeStreet={props.onChangeStreet} />
      <div className="flex min-h-0 flex-1 flex-col md:flex-row">
        <div className="relative min-h-[240px] flex-1 overflow-hidden bg-surface-variant">
          <Suspense fallback={<div className="absolute inset-0 animate-pulse bg-surface-variant" />}>
            <WorkMapCanvas view={view} expanded stretches={shown.stretch} pending={shown.pending} stations={shown.stations} handles={shown.handles} onHandleDrop={record.drop} />
          </Suspense>
          {props.located ? <p data-testid="avance-ubicado" className="pointer-events-none absolute right-3 top-3 rounded-xl border border-outline/20 bg-surface px-3 py-2 text-[14px] text-on-surface shadow-md">{youAreOn(props.located)}</p> : null}
        </div>
        <div className="max-h-[40dvh] overflow-y-auto rounded-t-3xl bg-surface p-3 md:max-h-none md:w-[380px] md:rounded-none">
          <RecordFoot record={record} map={props.map} streetId={props.streetId} canPhoto={Boolean(props.uploadPhoto)} />
        </div>
      </div>
    </div>
  );
}
