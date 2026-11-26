import { useCallback, useEffect, useRef, useState } from 'react';
import { useOverlayLevel } from '../../../ui/Modal';
import { coveredAbove } from '../../../ui/overlays';
import { BackHandler } from 'react-native';
import { noteValues, OBSERVATION_GPS_MISSING, readObservationDraft, type ObservationDocument, type ObservationDraftResult, type ObservationLiftRequest, type ObservationRegisterRequest, type WorkMapPoint } from '@lilachat/shared';
import { freshPoint } from '../../../chat/location/freshPoint';
import { askReportDraft } from '../reports/reportsApi';
import { captureEvidence, type CapturedEvidence } from '../useDriveUpload';
import { enqueueFieldWrite, FIELD_WRITE_QUEUED, keepFieldReport, keptFieldReport } from '../fieldWriteJobs';
import { onFieldJobDone } from '../fieldQueueStore';
import type { ServiceAskTarget } from '../useServiceAsk';

/** Where the screens write: the client's channel and its service. */
export type ObservationTarget = { target: ServiceAskTarget; chatId: string; serviceId: string };

/**
 * The observation report as Portal answers it (agentes sends REG-OBS and LEV-OBS to
 * `informe_de_observaciones`). Asked again after each write: Portal rebuilds it from the work map.
 */
export function useObservationReport(to: ObservationTarget, type: string, reportId: string | null) {
  const [draft, setDraft] = useState<ObservationDraftResult | null>(null);
  // The last report Portal gave: a failed second ask does not close the screen being filled.
  const [lastReport, setLastReport] = useState<ObservationDocument | null>(null);
  const [id, setId] = useState(reportId);
  const alive = useRef(true);
  const load = useCallback(async (nextId: string | null) => {
    const reply = await askReportDraft(to.target, to.serviceId, type, nextId);
    // Without signal the report Portal last sent is shown (José 26/11).
    if (reply.ok) keepFieldReport(to, type, reply.data);
    const kept = await keptFieldReport(to, type, reply);
    if (!alive.current) return;
    const next = readObservationDraft(reply.ok ? reply.data : kept ?? { message: reply.message });
    setDraft(next);
    if (next.ok) setLastReport(next.document);
  }, [to.target, to.serviceId, type]);
  useEffect(() => {
    alive.current = true;
    void load(id);
    return () => { alive.current = false; };
  }, [load, id]);
  // A write of this service landed: Portal's report has it now.
  useEffect(() => {
    const stop = onFieldJobDone((job) => {
      if (job.kind === 'observation' && job.scope.serviceId === to.serviceId) void load(id);
    });
    return () => void stop();
  }, [to.serviceId, load, id]);
  /** A first write creates the report: from then on its id is asked for. */
  const reload = useCallback((nextId?: string) => {
    if (nextId && nextId !== id) setId(nextId);
    else void load(id);
  }, [id, load]);
  return { draft, lastReport, reload };
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

/**
 * One write, by the field queue since 26/11 (José, a site without signal): saved on the phone with its
 * photos and videos, it leaves by itself; Portal finds a resend by its `entry_id`. No request (no GPS): it says so.
 */
export function useObservationWrite(to: ObservationTarget, onDone: (reportId: string) => void) {
  const [state, setState] = useState<{ busy: boolean; line: string | null }>({ busy: false, line: null });
  const run = useCallback(async (request: ObservationRegisterRequest | ObservationLiftRequest | null, note: string, evidence: readonly CapturedEvidence[], _done: string) => {
    if (!request) return setState({ busy: false, line: OBSERVATION_GPS_MISSING });
    setState({ busy: true, line: null });
    await enqueueFieldWrite(to, 'observation', request, noteValues(note), evidence);
    setState({ busy: false, line: FIELD_WRITE_QUEUED });
    onDone(request.report_id ?? '');
  }, [to, onDone]);
  return { ...state, run };
}

/** Android's back closes the screen on top, as its arrow does. */
export function useBackTo(back: () => void) {
  const level = useOverlayLevel();
  useEffect(() => {
    const subscription = BackHandler.addEventListener('hardwareBackPress', () => {
      // A viewer or preview open above this screen closes first (audit 15/11: re-subscribing put this one on top).
      if (coveredAbove(level)) return false;
      back();
      return true;
    });
    return () => subscription.remove();
  }, [back, level]);
}
