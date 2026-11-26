import { useCallback, useEffect, useRef, useState } from 'react';
import { AREA_EDIT_FAILED, AREA_EDITED, AREA_REMOVE_FAILED, AREA_REMOVED, AREA_TYPE, areaPlaceValues, areaRemoveRequest, type AreaEditRequest, readAreaDraft, sendMapTool, type AreaCreateRequest, type AreaDocument, type AreaDraftResult } from '@lilachat/shared';
import { askReportDraft } from '../reports/reportsApi';
import { observationWriteDeps, type CapturedEvidence } from '../useDriveUpload';
import { enqueueFieldWrite, FIELD_WRITE_QUEUED, keepFieldReport, keptFieldReport } from '../fieldWriteJobs';
import { onFieldJobDone } from '../fieldQueueStore';
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
  const report: AreaDocument | null = draft?.ok ? draft.document : null;
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

/** «Quitar área» as the web does it: Portal's `quitar` with only the area. */
export function useAreaRemove(to: ObservationTarget, onDone: () => void) {
  return useCallback(async (areaId: string) => {
    const result = await sendMapTool(observationWriteDeps(to, areaRemoveRequest(areaId)), {}, { sent: AREA_REMOVED, failed: AREA_REMOVE_FAILED });
    if (result.ok) onDone();
    return result;
  }, [to, onDone]);
}

/** «Guardar cambios» (la-06): Portal's `editar` with the zone's whole measure and the two texts (blank keeps Portal's). */
export function useAreaEdit(to: ObservationTarget) {
  return useCallback((request: AreaEditRequest, texts: { place: string; note: string }) =>
    sendMapTool(observationWriteDeps(to, request), areaPlaceValues(texts), { sent: AREA_EDITED, failed: AREA_EDIT_FAILED }), [to]);
}
