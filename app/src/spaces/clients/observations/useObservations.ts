import { useCallback, useEffect, useRef, useState } from 'react';
import { BackHandler } from 'react-native';
import { OBSERVATION_GPS_MISSING, readObservationDraft, writeObservation, writeOutcome, type ObservationDraftResult, type ObservationLiftRequest, type ObservationRegisterRequest, type WorkMapPoint } from '@lilachat/shared';
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

type PlaceState = { state: 'reading' } | { state: 'ready'; point: WorkMapPoint & { precision?: number } } | { state: 'missing' };

/** The phone's place, read when the screen opens (design `ob-02`: «GPS activo»); the person can ask again. */
export function useFieldPlace() {
  const [place, setPlace] = useState<PlaceState>({ state: 'reading' });
  const read = useCallback(async () => {
    setPlace({ state: 'reading' });
    const point = await freshPoint();
    setPlace(point ? { state: 'ready', point } : { state: 'missing' });
  }, []);
  useEffect(() => {
    void read();
  }, [read]);
  return { place, retry: read };
}

/** The photos and videos taken for one write, before they leave the phone. */
export function useEvidence() {
  const [items, setItems] = useState<CapturedEvidence[]>([]);
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

/** One write and what it said: the same request again sends only the files Portal does not have yet. */
export function useObservationWrite(to: ObservationTarget, onDone: (reportId: string) => void) {
  const [busy, setBusy] = useState(false);
  const [line, setLine] = useState<string | null>(null);
  const run = useCallback(async (request: ObservationRegisterRequest | ObservationLiftRequest | null, note: string, evidence: readonly CapturedEvidence[], done: string) => {
    if (!request) return setLine(OBSERVATION_GPS_MISSING);
    setBusy(true);
    setLine(null);
    const progress = (sent: number, total: number) => setLine(`Subiendo ${sent} de ${total}…`);
    const result = await writeObservation(observationWriteDeps(to, request, progress), note, evidence.map((one) => one.file));
    const outcome = writeOutcome(result, done);
    setBusy(false);
    setLine(outcome.line);
    if (outcome.done && result.ok) onDone(result.answer.reportId);
  }, [to, onDone]);
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
