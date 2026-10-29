/**
 * A channel as a job's file (pending 21, designs e2-17/e2-18): the checklist
 * by stages. Each stage is one of the channel's checklists with its `stage`
 * number; this reads them as one plan. PURE: the server, the app and the web.
 */
import { checklistOverdue, type ChecklistItem } from './checklists.js';

/** The stages a job goes through (José, 20/10): the plan starts with these and each is edited like any checklist. */
export const DEFAULT_WORK_STAGES = ['Cotización', 'Orden de compra y servicio', 'Ejecución', 'Valorizaciones', 'Pagos', 'Informes', 'Levantamiento de observaciones'] as const;

export type StageStatus = 'done' | 'in_progress' | 'pending';
export type WorkStage = { _id: string; title: string; stage: number; items: ChecklistItem[] };
export type StageSummary = { id: string; title: string; stage: number; done: number; total: number; status: StageStatus; overdue: number };
export type WorkPlanSummary = { current: StageSummary | null; done: number; total: number; percent: number; pending: number; overdue: number; stages: StageSummary[] };

function stageStatus(done: number, total: number): StageStatus {
  if (total > 0 && done === total) return 'done';
  return done > 0 ? 'in_progress' : 'pending';
}

/** The plan at a glance: the current stage is the first one not finished; an empty stage counts as not finished. */
export function workPlanSummary(stages: readonly WorkStage[], now: Date): WorkPlanSummary {
  const ordered = [...stages].sort((a, b) => a.stage - b.stage);
  const summaries = ordered.map((one): StageSummary => {
    const done = one.items.filter((item) => item.doneBy).length;
    return { id: one._id, title: one.title, stage: one.stage, done, total: one.items.length, status: stageStatus(done, one.items.length), overdue: checklistOverdue(one.items, now) };
  });
  const done = summaries.reduce((sum, one) => sum + one.done, 0);
  const total = summaries.reduce((sum, one) => sum + one.total, 0);
  return {
    current: summaries.find((one) => one.status !== 'done') ?? null,
    done,
    total,
    percent: total === 0 ? 0 : Math.round((done / total) * 100),
    pending: total - done,
    overdue: summaries.reduce((sum, one) => sum + one.overdue, 0),
    stages: summaries,
  };
}
