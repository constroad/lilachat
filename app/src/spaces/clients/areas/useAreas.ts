import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { AREA_REMOVE_FAILED, AREA_REMOVED, AREA_TYPE, areaRemoveRequest, areaWriteStore, readAreaDraft, sendMapTool, type AreaCreateRequest, type AreaDocument, type AreaDraftResult } from '@lilachat/shared';
import { askReportDraft } from '../reports/reportsApi';
import { observationWriteDeps, type CapturedEvidence } from '../useDriveUpload';
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
    if (alive.current) setDraft(readAreaDraft(reply.ok ? reply.data : { message: reply.message }));
  }, [to.target, to.serviceId]);
  useEffect(() => {
    alive.current = true;
    void load(id);
    return () => { alive.current = false; };
  }, [load, id]);
  /** A first area creates the report: from then on its id is asked for. */
  const reload = useCallback((nextId?: string) => {
    if (nextId && nextId !== id) setId(nextId);
    else void load(id);
  }, [id, load]);
  const report: AreaDocument | null = draft?.ok ? draft.document : null;
  return { draft, report, reload };
}

/** One area and its photo; the same request again sends only what Portal does not have yet. */
export function useAreaWrite(to: ObservationTarget) {
  const store = useMemo(() => areaWriteStore(), []);
  const { busy, line } = useSyncExternalStore(store.subscribe, store.get);
  const save = useCallback((request: AreaCreateRequest, place: { place: string; note: string }, evidence: readonly CapturedEvidence[]) =>
    store.run(observationWriteDeps(to, request), place, evidence.map((one) => one.file), 'guardada'), [store, to]);
  return { busy, line, save };
}

/** «Quitar área» as the web does it: Portal's `quitar` with only the area. */
export function useAreaRemove(to: ObservationTarget, onDone: () => void) {
  return useCallback(async (areaId: string) => {
    const result = await sendMapTool(observationWriteDeps(to, areaRemoveRequest(areaId)), {}, { sent: AREA_REMOVED, failed: AREA_REMOVE_FAILED });
    if (result.ok) onDone();
    return result;
  }, [to, onDone]);
}
