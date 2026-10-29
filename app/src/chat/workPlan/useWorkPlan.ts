import { useCallback, useEffect, useMemo, useState } from 'react';
import { suscribirTarjeta, workPlanSummary, type WorkPlanSummary, type WorkStage } from '@lilachat/shared';
import { agendaGet, agendaPost } from '../../agenda/agendaApi';

export type WorkPlan = {
  stages: WorkStage[] | null;
  summary: WorkPlanSummary | null;
  failed: boolean;
  starting: boolean;
  start: () => Promise<string | null>;
  reload: () => Promise<void>;
};

/** A channel's checklist by stages (pending 21): read once, and again when any stage changes live. */
export function useWorkPlan(jwt: string, chatId: string, enabled: boolean): WorkPlan {
  const [stages, setStages] = useState<WorkStage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const reload = useCallback(async () => {
    const response = await agendaGet<{ stages: WorkStage[] }>(`/checklists/stages?chatId=${chatId}`, jwt);
    setFailed(!response.ok);
    if (response.ok) setStages(response.data.stages);
  }, [jwt, chatId]);
  useEffect(() => {
    if (enabled) void reload();
  }, [enabled, reload]);
  const stageIds = stages?.map((one) => one._id).join(',') ?? '';
  useEffect(() => {
    if (!stageIds) return;
    const unsubscribes = stageIds.split(',').map((id) => suscribirTarjeta('checklist', id, () => void reload()));
    return () => unsubscribes.forEach((unsubscribe) => unsubscribe());
  }, [stageIds, reload]);
  const start = useCallback(async () => {
    setStarting(true);
    const response = await agendaPost<{ stages: number }>('/checklists/stages', jwt, { chatId });
    setStarting(false);
    if (!response.ok && response.status !== 409) return response.message ?? 'No se pudo armar el checklist.';
    await reload();
    return null;
  }, [jwt, chatId, reload]);
  // Recomputed on every change of the stages; «today» moves with them.
  const summary = useMemo(() => (stages ? workPlanSummary(stages, new Date()) : null), [stages]);
  return { stages, summary, failed, starting, start, reload };
}
