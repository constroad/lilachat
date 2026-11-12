import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Camera, CheckCircle2, LocateFixed, Play, Video, X } from 'lucide-react';
import { clipLength, gpsLine, liftAction, liftRequest, OBSERVATION_NOTE_MAX, observationPlace, observationWriteStore, registerAction, registerRequest, type EvidenceFile, type Observation, type ObservationDocument, type ObservationLiftRequest, type ObservationRegisterRequest, type WorkMapPoint } from '@lilachat/shared';
import { EvidenceInput } from '../ServiceDriveWeb';
import { observationWriteDeps, prepared, type DriveFile } from '../useDriveUpload';
import type { ServiceAskTarget } from '../useServiceAsk';

/**
 * Registering and lifting from the browser (José 11/11 via Portal: an iPhone
 * has no APK, so the mobile PWA is the field's form too). Same rules as the
 * APK (stitch-design §5-ter): the camera at the first tap, the GPS by itself,
 * the note optional, and the button at the bottom always does the next step.
 */
export type ObservationTo = { target: ServiceAskTarget; chatId: string; serviceId: string };
type FieldPoint = WorkMapPoint & { precision?: number };
type WebEvidence = { file: EvidenceFile<DriveFile>; preview: { url: string; mime: string; seconds?: number } };
type Kind = 'photo' | 'video';

const FIX_TIMEOUT_MS = 10_000;

/** The browser's position with its «±N m»; null when it gives none in time. */
export function fieldPointNow(): Promise<FieldPoint | null> {
  return new Promise((resolve) => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) return resolve(null);
    navigator.geolocation.getCurrentPosition(
      (position) => resolve({ lat: position.coords.latitude, lng: position.coords.longitude, precision: position.coords.accuracy }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: FIX_TIMEOUT_MS, maximumAge: 0 }
    );
  });
}

function usePlace(first: Promise<FieldPoint | null>) {
  const [place, setPlace] = useState<{ state: 'reading' } | { state: 'ready'; point: FieldPoint } | { state: 'missing' }>({ state: 'reading' });
  const settle = useCallback(async (reading: Promise<FieldPoint | null>) => {
    setPlace({ state: 'reading' });
    const point = await reading;
    setPlace(point ? { state: 'ready', point } : { state: 'missing' });
  }, []);
  useEffect(() => {
    void settle(first);
  }, [settle, first]);
  return { place, retry: () => void settle(fieldPointNow()) };
}

/** What was taken, before it leaves; each preview is freed when it goes. */
function useWebEvidence(first: File | null) {
  const [items, setItems] = useState<WebEvidence[]>([]);
  const add = useCallback(async (file: File | undefined) => {
    if (!file) return;
    const ready = await prepared(file);
    const preview = { url: URL.createObjectURL(ready.source.blob), mime: ready.facts.mime, ...(ready.facts.seconds ? { seconds: ready.facts.seconds } : {}) };
    setItems((current) => [...current, { file: { key: crypto.randomUUID(), ...ready }, preview }]);
  }, []);
  const remove = useCallback((key: string) => setItems((current) => current.filter((one) => {
    if (one.file.key === key) URL.revokeObjectURL(one.preview.url);
    return one.file.key !== key;
  })), []);
  const added = useRef(false);
  useEffect(() => {
    if (first && !added.current) void add(first);
    added.current = true;
  }, [first, add]);
  return { items, add, remove };
}

function useWrite(to: ObservationTo, onDone: (reportId: string) => void) {
  const store = useMemo(() => observationWriteStore(), []);
  const { busy, line } = useSyncExternalStore(store.subscribe, store.get);
  const run = async (request: ObservationRegisterRequest | ObservationLiftRequest, note: string, items: readonly WebEvidence[], done: string) => {
    const reportId = await store.run(observationWriteDeps(to, request), note, items.map((one) => one.file), done);
    if (reportId) onDone(reportId);
  };
  return { busy, line, run };
}

/** The thumbnails and the two big buttons that open the camera (56 dp and more). */
function EvidenceStrip(props: { items: readonly WebEvidence[]; busy: boolean; onAdd: (file: File | undefined) => void; onRemove: (key: string) => void; inputs: Record<Kind, React.RefObject<HTMLInputElement>> }) {
  return (
    <div className="space-y-2">
      {props.items.length ? (
        <div className="flex gap-2 overflow-x-auto">
          {props.items.map((one, index) => (
            <div key={one.file.key} data-testid={`evidencia-${index}`} className="relative h-24 w-24 shrink-0 overflow-hidden rounded-xl border border-outline/20 bg-surface-variant">
              {one.preview.mime.startsWith('video/') ? <span className="grid h-full place-items-center"><Play size={22} className="text-primary" /></span> : <img src={one.preview.url} alt="" className="h-full w-full object-cover" />}
              {one.preview.seconds ? <span className="absolute bottom-1 right-1 rounded bg-surface px-1 font-mono text-[11px] font-bold text-primary">{clipLength(one.preview.seconds)}</span> : null}
              <button type="button" aria-label="Quitar" onClick={() => props.onRemove(one.file.key)} className="absolute right-1 top-1 grid h-8 w-8 place-items-center rounded-full bg-surface/90"><X size={14} /></button>
            </div>
          ))}
        </div>
      ) : null}
      <div className="grid grid-cols-2 gap-2">
        <button type="button" data-testid="tomar-foto" disabled={props.busy} onClick={() => props.inputs.photo.current?.click()} className="flex min-h-[64px] flex-col items-center justify-center rounded-xl bg-primary text-sm font-bold uppercase text-on-primary disabled:opacity-50"><Camera size={20} /> Foto</button>
        <button type="button" data-testid="grabar-video" disabled={props.busy} onClick={() => props.inputs.video.current?.click()} className="flex min-h-[64px] flex-col items-center justify-center rounded-xl border-[1.5px] border-primary text-sm font-bold uppercase text-primary disabled:opacity-50"><Video size={20} /> Video <span className="text-[10px] font-normal normal-case text-on-surface-variant">máx. 30 s</span></button>
      </div>
      <EvidenceInput ref={props.inputs.photo} testId="entrada-foto" kind="photo" onFile={props.onAdd} />
      <EvidenceInput ref={props.inputs.video} testId="entrada-video" kind="video" onFile={props.onAdd} />
    </div>
  );
}

function BottomButton(props: { testId: string; label: string; tone: 'primary' | 'ok'; icon: React.ReactNode; busy: boolean; line: string | null; onClick: () => void }) {
  return (
    <div className="sticky bottom-0 -mx-4 space-y-1 border-t border-outline/10 bg-surface px-4 pb-4 pt-3">
      <button type="button" data-testid={props.testId} disabled={props.busy} onClick={props.onClick} className={`flex min-h-[56px] w-full items-center justify-center gap-2 rounded-2xl text-base font-bold text-on-primary disabled:opacity-50 ${props.tone === 'ok' ? 'bg-en-linea' : 'bg-primary'}`}>{props.icon} {props.label}</button>
      {props.line ? <p data-testid={`${props.testId}-nota`} className="text-center text-sm text-on-surface-variant">{props.line}</p> : null}
    </div>
  );
}

const useInputs = (): Record<Kind, React.RefObject<HTMLInputElement>> => ({ photo: useRef<HTMLInputElement>(null), video: useRef<HTMLInputElement>(null) });

/** «Nueva observación» after the first shot (design `ob-02`). The entry's key lives as long as the panel. */
export function NewObservationWeb(props: { to: ObservationTo; report: ObservationDocument; first: File; reading: Promise<FieldPoint | null>; onBack: () => void; onDone: (reportId: string) => void }) {
  const [entryId] = useState(() => crypto.randomUUID());
  const [note, setNote] = useState('');
  const place = usePlace(props.reading);
  const evidence = useWebEvidence(props.first);
  const write = useWrite(props.to, props.onDone);
  const inputs = useInputs();
  const here = place.place.state === 'ready' ? place.place.point : null;
  const action = registerAction(place.place.state);
  const street = here ? observationPlace({ id: 'aqui', code: '', note: '', at: null, status: 'open', media: [], liftMedia: [], lat: here.lat, lng: here.lng }, props.report.map) : null;
  const press = () => {
    if (action.kind === 'gps-retry') return place.retry();
    if (here) void write.run(registerRequest(props.report, entryId, here, 'web'), note, evidence.items, 'registrada');
  };
  return (
    <section data-testid="nueva-observacion-web" className="space-y-3 rounded-xl border border-outline/20 bg-surface p-4 pb-0">
      <div className="flex items-center justify-between">
        <h3 className="text-lg font-bold">Nueva observación</h3>
        <button type="button" onClick={props.onBack} className="h-11 rounded-lg px-3 text-sm font-semibold text-on-surface-variant">Cancelar</button>
      </div>
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-on-surface-variant">Evidencias ({evidence.items.length})</p>
      <EvidenceStrip items={evidence.items} busy={write.busy} onAdd={(file) => void evidence.add(file)} onRemove={evidence.remove} inputs={inputs} />
      <p data-testid="gps-nueva" className={`text-sm font-semibold ${place.place.state === 'missing' ? 'text-error' : 'text-primary'}`}>{here ? gpsLine(here.precision) : place.place.state === 'reading' ? 'Buscando GPS…' : 'Sin GPS'}{street ? ` · ${street}` : ''}</p>
      <textarea data-testid="nota-observacion" value={note} onChange={(event) => setNote(event.target.value)} maxLength={OBSERVATION_NOTE_MAX} placeholder="Qué se ve, dónde y cuánto (opcional)" className="min-h-[88px] w-full rounded-xl border border-outline/20 bg-background p-3 text-base" />
      <BottomButton testId="registrar-observacion" label={action.label} tone="primary" icon={action.kind === 'register' ? <CheckCircle2 size={18} /> : <LocateFixed size={18} />} busy={write.busy || action.kind === 'gps-wait'} line={write.line} onClick={press} />
    </section>
  );
}

/** The «after» of a pending observation (design `ob-03`): the button takes the photo until there is one, then lifts it. */
export function LiftObservationWeb(props: { to: ObservationTo; report: ObservationDocument; observation: Observation; onDone: (reportId: string) => void }) {
  const [note, setNote] = useState('');
  const evidence = useWebEvidence(null);
  const write = useWrite(props.to, props.onDone);
  const inputs = useInputs();
  const action = liftAction(evidence.items.length);
  const press = () => (action.kind === 'take-after' ? inputs.photo.current?.click() : void write.run(liftRequest(props.report, props.observation.id), note, evidence.items, 'levantada'));
  return (
    <div data-testid={`levantar-${props.observation.code}`} className="space-y-2 border-t border-outline/15 px-4 pt-3">
      <p className="text-[11px] font-bold uppercase tracking-[0.18em] text-primary">Levantar · después</p>
      <EvidenceStrip items={evidence.items} busy={write.busy} onAdd={(file) => void evidence.add(file)} onRemove={evidence.remove} inputs={inputs} />
      <textarea data-testid="nota-levantamiento" value={note} onChange={(event) => setNote(event.target.value)} maxLength={OBSERVATION_NOTE_MAX} placeholder="Cómo se corrigió (opcional)" className="min-h-[64px] w-full rounded-xl border border-outline/20 bg-background p-3 text-base" />
      <BottomButton testId="marcar-levantada" label={action.label} tone={action.kind === 'lift' ? 'ok' : 'primary'} icon={action.kind === 'lift' ? <CheckCircle2 size={18} /> : <Camera size={18} />} busy={write.busy} line={write.line} onClick={press} />
    </div>
  );
}
