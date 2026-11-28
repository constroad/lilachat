import { Suspense, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronRight, X } from 'lucide-react';
import { layerRecordMap, locateRecordStreet, type RecordLocation, progressPreviewOf, RECORD_LOCATING, RECORD_WHICH_STREET, recordStageOf, recordStreetChoices, type ManualPhotoUpload, type ManualProgressDraft, type MapEditSend, type WorkMap } from '@lilachat/shared';
import { lazyChunk } from '../../../ui/lazyChunk';
import { readGpsOnce } from './useGpsWalk';
import { RecordScreen } from './RecordProgress';

const WorkMapCanvas = lazyChunk(() => import('./WorkMapCanvas'));

/** The street in the street's detail (design o-03): what is done on it. */
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

/** One GPS read when the screen opens: which worked street the phone is on (design ma04). */
function useLocatedStreet(map: WorkMap): RecordLocation {
  const [located, setLocated] = useState<RecordLocation>(null);
  const latest = useRef(map);
  latest.current = map;
  useEffect(() => { const stop = locateRecordStreet(readGpsOnce, () => latest.current, setLocated); return stop; }, []);
  return located;
}

/** «¿En qué calle?»: the GPS could not tell, or the person tapped «Cambiar». */
function StreetChooser(props: { map: WorkMap; problem: string | null; locating: boolean; onPick: (streetId: string) => void; onClose: () => void }) {
  const streets = recordStreetChoices(props.map);
  return (
    <div data-testid="avance-elegir-calle" className="min-h-0 flex-1 overflow-y-auto p-4 md:mx-auto md:w-full md:max-w-xl">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xl font-extrabold text-on-surface">{RECORD_WHICH_STREET}</p>
        <button type="button" aria-label="Cerrar" onClick={props.onClose} className="flex h-11 w-11 items-center justify-center rounded-full text-on-surface"><X size={20} /></button>
      </div>
      {props.locating ? <p data-testid="avance-ubicando" className="mt-1 text-[14px] text-on-surface-variant">{RECORD_LOCATING}</p> : null}
      {props.problem ? <p className="mt-1 text-[14px] text-on-surface-variant">{props.problem}</p> : null}
      <ul className="mt-4 space-y-2">
        {streets.map((street) => <li key={street.id}><button type="button" data-testid={`avance-calle-${street.id}`} onClick={() => props.onPick(street.id)} className="flex h-12 w-full items-center justify-between rounded-xl border border-outline/20 bg-surface px-4 text-left text-[15px] font-semibold text-on-surface hover:bg-background">{street.name}<ChevronRight size={16} /></button></li>)}
      </ul>
    </div>
  );
}

function Sent(props: { message: string; onDone: () => void }) {
  return (
    <div className="m-auto w-full max-w-md space-y-4 p-6">
      <p role="status" data-testid="avance-manual-respuesta" className="flex items-start gap-2 text-[16px] font-semibold text-on-surface"><Check size={20} className="shrink-0 text-primary" />{props.message}</p>
      <button type="button" onClick={props.onDone} className="h-11 w-full rounded-xl border border-outline/20 text-[14px] font-semibold">Listo</button>
    </div>
  );
}

/** `streetId`: the street it opens on; null lets the GPS pick it. `initial`: already filled (#253). */
type Props = { map: WorkMap; streetId: string | null; send: MapEditSend; uploadPhoto?: ManualPhotoUpload<File>; initial?: ManualProgressDraft; /** The layer it opens on (ma01 «Registrar avance de <capa>»). */ workId?: string | null; onDone: () => void };

/** «Registrar avance» (design ma04, José 28/11): a full screen over the map; it waits for an admin's approval. */
export function ManualProgress(props: Props) {
  // From a layer (ma01) the GPS and «¿En qué calle?» look only at that layer's streets.
  const layerMap = useMemo(() => layerRecordMap(props.map, props.workId ?? null), [props.map, props.workId]);
  const located = useLocatedStreet(layerMap);
  const [picked, setPicked] = useState<string | null>(props.streetId);
  const [choosing, setChoosing] = useState(false);
  const [sent, setSent] = useState<string | null>(null);
  const stage = recordStageOf({ picked, located, choosing, sent });
  const body = stage.kind === 'sent' ? <Sent message={stage.message} onDone={props.onDone} />
    : stage.kind === 'record' ? <RecordScreen key={stage.streetId} map={props.map} streetId={stage.streetId} send={props.send} uploadPhoto={props.uploadPhoto} initial={stage.streetId === props.streetId ? props.initial : undefined} located={stage.located} workId={props.workId ?? null} onChangeStreet={() => setChoosing(true)} onClose={props.onDone} onAnswer={(answer) => setSent(answer.message)} />
      : <StreetChooser map={layerMap} problem={stage.problem} locating={stage.locating} onPick={(id) => { setPicked(id); setChoosing(false); }} onClose={props.onDone} />;
  // On the body: a transformed ancestor (the sheet's slide) would trap a fixed layer inside it.
  return createPortal(<div role="dialog" aria-modal="true" aria-label="Registrar avance" className="fixed inset-0 z-[60] flex flex-col bg-background">{body}</div>, document.body);
}
