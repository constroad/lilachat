import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AREA_TYPE, areaPlaceValues, areaRemoveRequest, projectAreaReport, type AreaEditRequest, readAreaDraft, type AreaCreateRequest, type AreaDocument, type AreaDraftResult } from '@lilachat/shared';
import { askReportDraft } from '../reports/reportsApi';
import type { CapturedEvidence } from '../useDriveUpload';
import { enqueueFieldWrite, FIELD_WRITE_QUEUED, keepFieldReport, keptFieldReport } from '../fieldWriteJobs';
import { fieldQueueNow, onFieldJobDone, subscribeFieldQueue } from '../fieldQueueStore';
import type { ObservationTarget } from '../observations/useObservations';

/**
 * The additional-area report on the APK (José 15/11: the phone measures, the PWA does not):
 * Portal's `informe_area_adicional` answers it, asked again after each write.
 */
export function useAreaReport(to: ObservationTarget, reportId: string | null) {
  const [draft, setDraft] = useState<AreaDraftResult | null>(null);
  const [id, setId] = useState(reportId);
  const alive = useRef(true);
  const load = useCallback(async (nextId: string | null) => {
    const reply = await askReportDraft(to.target, to.serviceId, AREA_TYPE, nextId);
    // Without signal the report Portal last sent is shown (José 26/11).
    if (reply.ok) keepFieldReport(to, AREA_TYPE, reply.data);
    const kept = await keptFieldReport(to, AREA_TYPE, reply);
    if (alive.current) setDraft(readAreaDraft(reply.ok ? reply.data : kept ?? { message: reply.message }));
  }, [to.target, to.serviceId]);
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
  /** A first area creates the report: from then on its id is asked for. */
  const reload = useCallback((nextId?: string) => {
    if (nextId && nextId !== id) setId(nextId);
    else void load(id);
  }, [id, load]);
  // The queue's waiting edits and removals of this service drawn on top (26/11).
  const queue = useSyncExternalStore(subscribeFieldQueue, fieldQueueNow);
  const report: AreaDocument | null = useMemo(() => (draft?.ok ? projectAreaReport(draft.document, queue, to.serviceId) : null), [draft, queue, to.serviceId]);
  return { draft, report, reload };
}

/**
 * One area and its photo, by the field queue since 26/11 (José, a site without signal): saved on the
 * phone, it leaves by itself. Answers the report's id to reload (empty when the report is still new).
 */
export function useAreaWrite(to: ObservationTarget) {
  const [state, setState] = useState<{ busy: boolean; line: string | null }>({ busy: false, line: null });
  const save = useCallback(async (request: AreaCreateRequest, place: { place: string; note: string }, evidence: readonly CapturedEvidence[]): Promise<string | null> => {
    setState({ busy: true, line: null });
    await enqueueFieldWrite(to, 'area', request, areaPlaceValues(place), evidence);
    setState({ busy: false, line: FIELD_WRITE_QUEUED });
    return request.report_id ?? '';
  }, [to]);
  return { ...state, save };
}

const QUEUED = { ok: true as const, message: FIELD_WRITE_QUEUED };

/** «Quitar área» as the web does it (Portal's `quitar` with only the area), by the field queue since 26/11. */
export function useAreaRemove(to: ObservationTarget, onDone: () => void) {
  return useCallback(async (areaId: string) => {
    await enqueueFieldWrite(to, 'area', areaRemoveRequest(areaId), {}, []);
    onDone();
    return QUEUED;
  }, [to, onDone]);
}

/** «Guardar cambios» (la-06): Portal's `editar` with the zone's whole measure and the two texts (blank keeps Portal's); by the queue. */
export function useAreaEdit(to: ObservationTarget) {
  return useCallback(async (request: AreaEditRequest, texts: { place: string; note: string }) => {
    await enqueueFieldWrite(to, 'area', request, areaPlaceValues(texts), []);
    return QUEUED;
  }, [to]);
}
