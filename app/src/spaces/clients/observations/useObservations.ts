import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { BackHandler } from 'react-native';
import { observationWriteStore, readObservationDraft, type ObservationDraftResult, type ObservationLiftRequest, type ObservationRegisterRequest, type WorkMapPoint } from '@lilachat/shared';
import { freshPoint } from '../../../chat/location/freshPoint';
import { askReportDraft } from '../reports/reportsApi';
import { captureEvidence, observationWriteDeps, type CapturedEvidence } from '../useDriveUpload';
import type { ServiceAskTarget } from '../useServiceAsk';

/** Where the screens write: the client's channel and its service. */
export type ObservationTarget = { target: ServiceAskTarget; chatId: string; serviceId: string };

/**
 * The observation report as Portal answers it (agentes sends REG-OBS and LEV-OBS to
 * `informe_de_observaciones`). Asked again after each write: Portal rebuilds it from the work map.
 */
export function useObservationReport(to: ObservationTarget, type: string, reportId: string | null) {
  const [draft, setDraft] = useState<ObservationDraftResult | null>(null);
  const [id, setId] = useState(reportId);
  const alive = useRef(true);
  const load = useCallback(async (nextId: string | null) => {
    const reply = await askReportDraft(to.target, to.serviceId, type, nextId);
    if (alive.current) setDraft(readObservationDraft(reply.ok ? reply.data : { message: reply.message }));
  }, [to.target, to.serviceId, type]);
  useEffect(() => {
    alive.current = true;
    void load(id);
    return () => { alive.current = false; };
  }, [load, id]);
  /** A first write creates the report: from then on its id is asked for. */
  const reload = useCallback((nextId?: string) => {
    if (nextId && nextId !== id) setId(nextId);
    else void load(id);
  }, [id, load]);
  return { draft, reload };
}

type FieldPoint = WorkMapPoint & { precision?: number };
type PlaceState = { state: 'reading' } | { state: 'ready'; point: FieldPoint } | { state: 'missing' };

/**
 * The phone's place (design `ob-02`: «GPS activo»). `first` is the reading
 * started when the camera opened (§5-ter rule 2: read by itself at the shot);
 * the person can ask again.
 */
export function useFieldPlace(first?: Promise<FieldPoint | null>) {
  const [place, setPlace] = useState<PlaceState>({ state: 'reading' });
  const settle = useCallback(async (reading: Promise<FieldPoint | null>) => {
    setPlace({ state: 'reading' });
    const point = await reading;
    setPlace(point ? { state: 'ready', point } : { state: 'missing' });
  }, []);
  useEffect(() => {
    void settle(first ?? freshPoint());
  }, [settle, first]);
  return { place, retry: () => void settle(freshPoint()) };
}

/** «Nueva observación» opens the camera at once (§5-ter rule 2), with the GPS reading at the same time. */
export async function startObservation(): Promise<{ shot: CapturedEvidence; reading: Promise<FieldPoint | null> } | { message: string } | null> {
  const reading = freshPoint();
  const shot = await captureEvidence('photo');
  return shot && 'file' in shot ? { shot, reading } : shot;
}

/** The photos and videos taken for one write, before they leave the phone. */
export function useEvidence(first: readonly CapturedEvidence[] = []) {
  const [items, setItems] = useState<CapturedEvidence[]>([...first]);
  const [message, setMessage] = useState<string | null>(null);
  const take = useCallback(async (kind: 'photo' | 'video') => {
    setMessage(null);
    const shot = await captureEvidence(kind);
    if (shot && 'message' in shot) setMessage(shot.message);
    else if (shot) setItems((current) => [...current, shot]);
  }, []);
  const remove = useCallback((key: string) => setItems((current) => current.filter((one) => one.file.key !== key)), []);
  return { items, message, take, remove };
}

/** One write and what it said (`observationWriteStore`): the same request again sends only the files Portal does not have yet. */
export function useObservationWrite(to: ObservationTarget, onDone: (reportId: string) => void) {
  const store = useMemo(() => observationWriteStore(), []);
  const { busy, line } = useSyncExternalStore(store.subscribe, store.get);
  const run = useCallback(async (request: ObservationRegisterRequest | ObservationLiftRequest | null, note: string, evidence: readonly CapturedEvidence[], done: string) => {
    const reportId = await store.run(request ? observationWriteDeps(to, request) : null, note, evidence.map((one) => one.file), done);
    if (reportId) onDone(reportId);
  }, [store, to, onDone]);
  return { busy, line, run };
}

/** Android's back closes the screen on top, as its arrow does. */
export function useBackTo(back: () => void) {
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back]);
}
