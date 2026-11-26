import { describe, expect, it } from 'vitest';
import { chatScopeId, hasTaskJobs, projectStages, supersededTicks, taskJobOf } from './taskOffline.js';
import type { WorkStage } from './workStages.js';

const NOW = new Date(Date.UTC(2026, 10, 24, 15, 30));
const CHAT = '6651aa00bb11cc22dd33ee44';
const STAGE = '6652bb11cc22dd33ee44ff55';
const ME = '6650aa11bb22cc33dd44ee55';
const OTHER = '6650aa11bb22cc33dd44ee66';
const stages: WorkStage[] = [{ _id: STAGE, title: 'Ejecución', stage: 4, items: [
  { id: 'it-1', text: 'Imprimar Jr. Conchucos', doneBy: null, doneAt: null },
  { id: 'it-2', text: 'Sellar juntas', doneBy: OTHER, doneAt: '2026-11-23T10:00:00.000Z' },
] }];
let counter = 0;
const keyOf = () => `00000000-0000-4000-8000-${String(++counter).padStart(12, '0')}`;
const tick = (itemId: string, done: boolean) => taskJobOf({ key: keyOf(), chatId: CHAT, payload: { kind: 'task_toggle', checklistId: STAGE, itemId, done }, files: [], now: NOW.getTime() });

describe('taskJobOf', () => {
  it('lives under its chat and says what it is', () => {
    const job = taskJobOf({ key: keyOf(), chatId: CHAT, payload: { kind: 'task_evidence', checklistId: STAGE, itemId: 'it-1', taskText: 'Imprimar Jr. Conchucos' }, files: [], now: NOW.getTime() });
    expect(job.scope.serviceId).toBe(chatScopeId(CHAT));
    expect(job.label).toBe('Evidencia · Imprimar Jr. Conchucos');
    expect(tick('it-1', true).label).toBe('Tarea marcada');
    expect(tick('it-1', false).label).toBe('Tarea reabierta');
  });
});

describe('projectStages', () => {
  it('a waiting tick shows the task done by me', () => {
    const [stage] = projectStages(stages, [tick('it-1', true)], ME, NOW);
    expect(stage!.items[0]).toMatchObject({ doneBy: ME, doneAt: NOW.toISOString() });
  });

  it('reopening a task done by someone else clears it; ticking it again keeps who did it', () => {
    expect(projectStages(stages, [tick('it-2', false)], ME, NOW)[0]!.items[1]).toMatchObject({ doneBy: null, doneAt: null });
    expect(projectStages(stages, [tick('it-2', true)], ME, NOW)[0]!.items[1]).toMatchObject({ doneBy: OTHER });
  });

  it('the last tick wins; a refused one draws nothing', () => {
    expect(projectStages(stages, [tick('it-1', true), tick('it-1', false)], ME, NOW)[0]!.items[0]!.doneBy).toBeNull();
    expect(projectStages(stages, [{ ...tick('it-1', true), refusal: 'No' }], ME, NOW)[0]!.items[0]!.doneBy).toBeNull();
  });
});

describe('supersededTicks', () => {
  it('a new tick of the same task replaces the waiting one; other tasks and evidence stay', () => {
    const first = tick('it-1', true);
    const other = tick('it-2', false);
    const evidence = taskJobOf({ key: keyOf(), chatId: CHAT, payload: { kind: 'task_evidence', checklistId: STAGE, itemId: 'it-1', taskText: 'x' }, files: [], now: NOW.getTime() });
    const second = tick('it-1', false);
    expect(supersededTicks([first, other, evidence], second)).toEqual([first.key]);
    expect(supersededTicks([first], evidence)).toEqual([]);
  });
});

describe('hasTaskJobs', () => {
  it('only this chat', () => {
    expect(hasTaskJobs([tick('it-1', true)], CHAT)).toBe(true);
    expect(hasTaskJobs([tick('it-1', true)], '6651aa00bb11cc22dd33ee99')).toBe(false);
  });
});
