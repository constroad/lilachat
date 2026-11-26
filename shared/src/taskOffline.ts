import { newFieldJob, type FieldJob, type FieldJobFile } from './fieldQueue.js';
import type { WorkStage } from './workStages.js';

/**
 * A channel's tasks without signal (José 26/11): ticking a task and adding its
 * evidence are jobs of the field queue. A tick says the state it wants
 * (`done`), so a resend after a lost answer never flips it back (the server
 * answers the same since 26/11). The screen draws the plan it last read with the
 * queued ticks on top. PURE.
 */
export type TaskJobPayload =
  | { kind: 'task_toggle'; checklistId: string; itemId: string; done: boolean }
  | { kind: 'task_evidence'; checklistId: string; itemId: string; taskText: string };

const isTaskJob = (job: FieldJob): boolean => job.kind === 'task_toggle' || job.kind === 'task_evidence';
const payloadOf = (job: FieldJob): TaskJobPayload => job.payload as unknown as TaskJobPayload;

/** Task jobs hang from their chat as their «service»: the plan's strip finds them by it. */
export const chatScopeId = (chatId: string): string => `chat:${chatId}`;

export function taskJobOf(input: { key: string; chatId: string; payload: TaskJobPayload; files: FieldJobFile[]; now: number }): FieldJob {
  const { payload } = input;
  const label = payload.kind === 'task_evidence' ? `Evidencia · ${payload.taskText}` : payload.done ? 'Tarea marcada' : 'Tarea reabierta';
  return newFieldJob({ key: input.key, kind: payload.kind, scope: { spaceId: '', clientId: '', serviceId: chatScopeId(input.chatId), chatId: input.chatId }, label, payload: payload as unknown as Record<string, unknown>, files: input.files, now: input.now });
}

/** A new tick replaces an older one of the same task still waiting: only the last state the person chose goes. */
export function supersededTicks(queue: readonly FieldJob[], job: FieldJob): string[] {
  const payload = payloadOf(job);
  if (payload.kind !== 'task_toggle') return [];
  return queue
    .filter((one) => one.key !== job.key && one.kind === 'task_toggle' && !one.refusal)
    .filter((one) => {
      const other = payloadOf(one);
      return other.checklistId === payload.checklistId && other.itemId === payload.itemId;
    })
    .map((one) => one.key);
}

/** The plan as it will be once its ticks land: each waiting tick of a stage drawn on its task. */
export function projectStages(stages: readonly WorkStage[], queue: readonly FieldJob[], me: string, now: Date): WorkStage[] {
  const ticks = queue.filter((job) => job.kind === 'task_toggle' && !job.refusal).map(payloadOf);
  if (!ticks.length) return [...stages];
  return stages.map((stage) => ({
    ...stage,
    items: stage.items.map((item) => {
      const tick = ticks.filter((one) => one.checklistId === stage._id && one.itemId === item.id).at(-1);
      if (!tick || tick.kind !== 'task_toggle') return item;
      return tick.done ? { ...item, doneBy: item.doneBy ?? me, doneAt: item.doneAt ?? now.toISOString() } : { ...item, doneBy: null, doneAt: null };
    }),
  }));
}

export const hasTaskJobs = (queue: readonly FieldJob[], chatId: string): boolean => queue.some((job) => isTaskJob(job) && job.scope.chatId === chatId);
