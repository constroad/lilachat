/**
 * The «Pendientes» and «Archivos» tabs of a job's channel and the evidence of
 * a task (pending 21, designs e2-17 and e2-18). A file of evidence is a
 * message of the channel linked to the task by its seq: it stays in the chat
 * history and the task only points at it. PURE: server, app and web.
 */
import { taskDueState, type ChecklistItem, type TaskEvidence } from './checklists.js';
import type { WorkStage } from './workStages.js';

export const EVIDENCE_LIMIT = 12;

export type PendingTask = { stageId: string; stageTitle: string; stage: number; item: ChecklistItem; overdue: boolean };
export type StageFile = TaskEvidence & { taskId: string; taskText: string };
export type StageFileGroup = { stageId: string; title: string; stage: number; files: StageFile[] };
export type ActivityLine = { text: string; at: string | null; tone: 'created' | 'file' | 'done' };

const byStage = (stages: readonly WorkStage[]) => [...stages].sort((a, b) => a.stage - b.stage);
const dueTime = (item: ChecklistItem) => (item.dueAt ? new Date(item.dueAt).getTime() : Number.POSITIVE_INFINITY);

/** The open tasks of the whole plan: overdue first, then the soonest date, the ones without a date last. */
export function pendingTasks(stages: readonly WorkStage[], now: Date): PendingTask[] {
  const open = byStage(stages).flatMap((one) =>
    one.items.filter((item) => !item.doneBy).map((item): PendingTask => ({ stageId: one._id, stageTitle: one.title, stage: one.stage, item, overdue: taskDueState(item, now) === 'overdue' }))
  );
  return open.sort((a, b) => Number(b.overdue) - Number(a.overdue) || dueTime(a.item) - dueTime(b.item) || a.stage - b.stage);
}

/** The evidence of every task, by stage in the plan's order and the newest first; stages without files are left out. */
export function stageFiles(stages: readonly WorkStage[]): { groups: StageFileGroup[]; total: number } {
  const groups = byStage(stages)
    .map((one): StageFileGroup => ({
      stageId: one._id,
      title: one.title,
      stage: one.stage,
      files: one.items
        .flatMap((item) => (item.evidence ?? []).map((file): StageFile => ({ ...file, taskId: item.id, taskText: item.text })))
        .sort((a, b) => b.at.localeCompare(a.at)),
    }))
    .filter((group) => group.files.length > 0);
  return { groups, total: groups.reduce((sum, group) => sum + group.files.length, 0) };
}

/** Links one more file to a task; the same message twice stays once (an upload retried). */
export function linkEvidence(existing: readonly TaskEvidence[], file: TaskEvidence): { ok: true; evidence: TaskEvidence[]; added: boolean } | { ok: false; message: string } {
  if (existing.some((one) => one.seq === file.seq)) return { ok: true, evidence: [...existing], added: false };
  if (existing.length >= EVIDENCE_LIMIT) return { ok: false, message: `Una tarea lleva hasta ${EVIDENCE_LIMIT} archivos.` };
  return { ok: true, evidence: [...existing, file], added: true };
}

const FILE_WORD: Record<TaskEvidence['kind'], string> = { image: 'una foto', video: 'un video', file: 'un archivo' };

/** «Beto Ramos lo creó», «Ana Torres subió una foto», «… lo marcó hecho»: what the data says, oldest first. */
export function taskActivity(item: ChecklistItem, nameOf: (userId: string) => string): ActivityLine[] {
  const files = [...(item.evidence ?? [])].sort((a, b) => a.at.localeCompare(b.at)).map((file): ActivityLine => ({ text: `${nameOf(file.by)} subió ${FILE_WORD[file.kind]}`, at: file.at, tone: 'file' }));
  return [
    ...(item.addedBy ? [{ text: `${nameOf(item.addedBy)} lo creó`, at: null, tone: 'created' as const }] : []),
    ...files,
    ...(item.doneBy ? [{ text: `${nameOf(item.doneBy)} lo marcó hecho`, at: item.doneAt, tone: 'done' as const }] : []),
  ];
}
