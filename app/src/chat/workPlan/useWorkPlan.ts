import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { projectStages, suscribirTarjeta, workPlanSummary, type WorkPlanSummary, type WorkStage } from '@lilachat/shared';
import { agendaGet, agendaPost } from '../../agenda/agendaApi';
import { fieldQueueNow, onFieldJobDone, subscribeFieldQueue } from '../../spaces/clients/fieldQueueStore';
import { spaceDiskKey } from '../../spaces/spaceCache';

/** The plan last read, on the phone (José 26/11, a site without signal); under the space cache's prefix, so logout drops it. */
const savedKeyOf = (chatId: string) => spaceDiskKey(`chat:${chatId}:stages`);
async function readSavedStages(chatId: string): Promise<WorkStage[] | null> {
  const raw = await AsyncStorage.getItem(savedKeyOf(chatId)).catch(() => null);
  try {
    const parsed: unknown = raw ? JSON.parse(raw) : null;
    return Array.isArray(parsed) ? (parsed as WorkStage[]) : null;
  } catch {
    return null;
  }
}

export type WorkPlan = {
  stages: WorkStage[] | null;
  summary: WorkPlanSummary | null;
  failed: boolean;
  starting: boolean;
  start: () => Promise<string | null>;
  reload: () => Promise<void>;
};

/** A channel's checklist by stages (pending 21): read once, and again when any stage changes live. */
export function useWorkPlan(jwt: string, chatId: string, enabled: boolean, me = ''): WorkPlan {
  const [stages, setStages] = useState<WorkStage[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [starting, setStarting] = useState(false);
  const reload = useCallback(async () => {
    const response = await agendaGet<{ stages: WorkStage[] }>(`/checklists/stages?chatId=${chatId}`, jwt);
    if (response.ok) {
      setFailed(false);
      setStages(response.data.stages);
      AsyncStorage.setItem(savedKeyOf(chatId), JSON.stringify(response.data.stages)).catch(() => undefined);
      return;
    }
    // Without signal the saved plan is shown; only with nothing saved it fails.
    const saved = await readSavedStages(chatId);
    if (saved) setStages((current) => current ?? saved);
    setFailed(!saved);
  }, [jwt, chatId]);
  // A tick or an evidence of this chat landed: the plan is read again.
  useEffect(() => {
    const stop = onFieldJobDone((job) => {
      if (job.scope.chatId === chatId && (job.kind === 'task_toggle' || job.kind === 'task_evidence')) void reload();
    });
    return () => void stop();
  }, [chatId, reload]);
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
  // The ticks still on the phone are drawn on the plan (José 26/11); the summary counts them too.
  const jobs = useSyncExternalStore(subscribeFieldQueue, fieldQueueNow);
  const shown = useMemo(() => (stages ? projectStages(stages, jobs, me, new Date()) : null), [stages, jobs, me]);
  // Recomputed on every change of the stages; «today» moves with them.
  const summary = useMemo(() => (shown ? workPlanSummary(shown, new Date()) : null), [shown]);
  return { stages: shown, summary, failed, starting, start, reload };
}
