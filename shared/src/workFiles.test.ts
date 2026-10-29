import { describe, expect, it } from 'vitest';
import { linkEvidence, pendingTasks, stageFiles, taskActivity, EVIDENCE_LIMIT } from './workFiles.js';
import type { TaskEvidence } from './checklists.js';
import type { WorkStage } from './workStages.js';

/** Pending 21 (designs e2-17 and e2-18): the «Pendientes» and «Archivos» tabs and a task's evidence. */
const now = new Date('2026-10-28T15:00:00Z');
const evidence = (seq: number, at: string, kind: TaskEvidence['kind'] = 'image'): TaskEvidence => ({ seq, kind, url: `/media/${seq}.jpg`, name: `foto-${seq}.jpg`, sizeBytes: 1000, by: 'u2', at });
const task = (id: string, extra: Partial<WorkStage['items'][number]> = {}): WorkStage['items'][number] => ({ id, text: id, doneBy: null, doneAt: null, ...extra });
const stage = (n: number, title: string, items: WorkStage['items']): WorkStage => ({ _id: `s${n}`, title, stage: n, items });

describe('pendingTasks', () => {
  it('lists the open tasks of every stage: overdue first, then by date, the ones without a date last', () => {
    const plan = [
      stage(3, 'Ejecución', [task('sin-fecha'), task('manana', { dueAt: '2026-10-29T15:00:00Z' }), task('hecha', { doneBy: 'u1', doneAt: '2026-10-27T00:00:00Z' })]),
      stage(1, 'Cotización', [task('vencida', { dueAt: '2026-10-23T00:00:00Z' }), task('hoy', { dueAt: '2026-10-28T20:00:00Z' })]),
    ];

    const pending = pendingTasks(plan, now);

    expect(pending.map((one) => one.item.id)).toEqual(['vencida', 'hoy', 'manana', 'sin-fecha']);
    expect(pending[0]).toMatchObject({ stageId: 's1', stageTitle: 'Cotización', stage: 1, overdue: true });
    expect(pending[1]!.overdue).toBe(false);
  });

  it('nothing open, nothing listed', () => {
    expect(pendingTasks([stage(1, 'Cotización', [task('a', { doneBy: 'u1', doneAt: '2026-10-27T00:00:00Z' })])], now)).toEqual([]);
  });
});

describe('stageFiles', () => {
  it('groups the evidence by stage in the plan order, the newest first, and skips stages without files', () => {
    const plan = [
      stage(3, 'Ejecución', [task('a', { evidence: [evidence(10, '2026-10-23T10:14:00Z')] }), task('b', { evidence: [evidence(12, '2026-10-23T10:18:00Z', 'file')] })]),
      stage(2, 'Orden', [task('c')]),
      stage(1, 'Cotización', [task('d', { evidence: [evidence(4, '2026-10-20T09:00:00Z')] })]),
    ];

    const files = stageFiles(plan);

    expect(files.groups.map((group) => group.title)).toEqual(['Cotización', 'Ejecución']);
    expect(files.groups[1]!.files.map((file) => [file.seq, file.taskText])).toEqual([[12, 'b'], [10, 'a']]);
    expect(files.total).toBe(3);
  });

  it('a plan without evidence has no groups', () => {
    expect(stageFiles([stage(1, 'Cotización', [task('a')])])).toEqual({ groups: [], total: 0 });
  });
});

describe('linkEvidence', () => {
  it('adds a file to the task', () => {
    const linked = linkEvidence([], evidence(10, '2026-10-23T10:14:00Z'));

    expect(linked).toEqual({ ok: true, evidence: [evidence(10, '2026-10-23T10:14:00Z')], added: true });
  });

  it('the same message twice is linked once (a retried upload)', () => {
    const linked = linkEvidence([evidence(10, '2026-10-23T10:14:00Z')], evidence(10, '2026-10-23T10:20:00Z'));

    expect(linked).toMatchObject({ ok: true, added: false });
    expect(linked.ok && linked.evidence).toHaveLength(1);
  });

  it('refuses past the limit of files of a task', () => {
    const full = Array.from({ length: EVIDENCE_LIMIT }, (_, index) => evidence(index + 1, '2026-10-23T10:00:00Z'));

    expect(linkEvidence(full, evidence(99, '2026-10-23T11:00:00Z'))).toEqual({ ok: false, message: `Una tarea lleva hasta ${EVIDENCE_LIMIT} archivos.` });
  });
});

describe('taskActivity', () => {
  const names = new Map([['u1', 'Beto Ramos'], ['u2', 'Ana Torres']]);
  const nameOf = (id: string) => names.get(id) ?? 'Alguien';

  it('who made it, each file uploaded and who ticked it, in order', () => {
    const activity = taskActivity(task('a', { addedBy: 'u1', doneBy: 'u2', doneAt: '2026-10-24T08:00:00Z', evidence: [evidence(12, '2026-10-23T10:18:00Z', 'file'), evidence(10, '2026-10-23T10:14:00Z')] }), nameOf);

    expect(activity.map((one) => one.text)).toEqual(['Beto Ramos lo creó', 'Ana Torres subió una foto', 'Ana Torres subió un archivo', 'Ana Torres lo marcó hecho']);
    expect(activity[0]!.at).toBeNull();
    expect(activity[3]!.at).toBe('2026-10-24T08:00:00Z');
  });

  it('an old task without its author starts with the first thing known', () => {
    expect(taskActivity(task('a'), nameOf)).toEqual([]);
  });
});
