import { describe, expect, it } from 'vitest';
import { channelTabsFor, checklistHoldsPending, PENDING_PREVIEW_MAX, pendingPreview, SERVICE_SEGMENTS, serviceHeadLine, serviceSegmentsOf, serviceSlimLine, serviceTakesScreen, SHELL_WIDE_MIN_PX } from './serviceShell.js';
import type { WorkStage } from './workStages.js';

const stage = (stageNumber: number, items: Array<{ id: string; text: string; doneBy?: string; assignee?: string }>): WorkStage => ({ _id: `s${stageNumber}`, title: `Etapa ${stageNumber}`, stage: stageNumber, items: items.map((item) => ({ id: item.id, text: item.text, doneBy: item.doneBy ?? null, doneAt: null, assignee: item.assignee ?? null })) });

describe('serviceTakesScreen', () => {
  it('takes the screen on a phone and keeps the channel tabs from a tablet up', () => {
    expect(serviceTakesScreen(390)).toBe(true);
    expect(serviceTakesScreen(SHELL_WIDE_MIN_PX - 1)).toBe(true);
    expect(serviceTakesScreen(SHELL_WIDE_MIN_PX)).toBe(false);
    expect(serviceTakesScreen(1440)).toBe(false);
  });
  it('a phone turned sideways is wide but short: the service still takes the screen', () => {
    expect(serviceTakesScreen(844, 390)).toBe(true);
    expect(serviceTakesScreen(1194, 834)).toBe(false);
  });
});

describe('channelTabsFor', () => {
  const admin = { money: true, admin: true };
  it('keeps every tab of channelTabs on a wide screen', () => {
    expect(channelTabsFor(admin, true, false)).toEqual(['chat', 'account', 'services', 'checklist', 'pending']);
  });
  it('folds «Pendientes» into «Checklist» on a phone for whoever has the checklist', () => {
    expect(channelTabsFor(admin, true, true)).toEqual(['chat', 'account', 'services', 'checklist']);
    expect(checklistHoldsPending(admin, true, true)).toBe(true);
  });
  it('a member without the checklist keeps its own «Pendientes» tab on a phone (no permission changes)', () => {
    expect(channelTabsFor({ money: false }, true, true)).toEqual(['chat', 'services', 'pending']);
    expect(checklistHoldsPending({ money: false }, true, true)).toBe(false);
  });
  it('without stages nothing is folded', () => {
    expect(channelTabsFor(admin, false, true)).toEqual(['chat', 'account', 'services', 'checklist']);
    expect(checklistHoldsPending(admin, false, true)).toBe(false);
  });
});

describe('serviceHeadLine', () => {
  it('says the progress, the stage and the start, what exists only', () => {
    expect(serviceHeadLine({ status: 'pending', stage_label: 'Pendiente', progress: 0, started_at: '2026-11-12' })).toBe('Avance 0 % · Inicio 12 nov');
    expect(serviceHeadLine({ status: 'in_progress', stage_label: 'Imprimación', progress: 64, started_at: '2026-10-28' })).toBe('Avance 64 % · Etapa: Imprimación · Inicio 28 oct');
    expect(serviceHeadLine({ status: 'pending', stage_label: '' })).toBe('');
  });

  it('adds the stages when Portal sends them (design cc-02: «Avance 0 % · 6 etapas · Inicio 12 nov»)', () => {
    expect(serviceHeadLine({ status: 'pending', stage_label: 'Pendiente', progress: 0, started_at: '2026-11-12', stagesTotal: 6 })).toBe('Avance 0 % · 6 etapas · Inicio 12 nov');
    expect(serviceHeadLine({ status: 'pending', stage_label: '', stagesTotal: 0 })).toBe('');
  });
});

describe('serviceSlimLine', () => {
  it('the map\'s one-row head (José 20/11): the client and the progress, what exists only', () => {
    // Arrange
    const service = { progress: 40 };
    // Act / Assert
    expect(serviceSlimLine(service, 'CONSORCIO EL ALMIRANTE')).toBe('CONSORCIO EL ALMIRANTE · 40 %');
    expect(serviceSlimLine(service)).toBe('40 %');
    expect(serviceSlimLine({}, 'CONSORCIO')).toBe('CONSORCIO');
    expect(serviceSlimLine({}, '  ')).toBe('');
  });
});

describe('serviceSegmentsOf', () => {
  it('reads «Abiertos · Completados · Todos» with their counts, and «Rechazados» only when there is one', () => {
    expect(serviceSegmentsOf({ all: 3, open: 2, completed: 1, rejected: 0 })).toEqual([
      { key: 'open', label: 'Abiertos', count: 2 },
      { key: 'completed', label: 'Completados', count: 1 },
      { key: 'all', label: 'Todos', count: 3 },
    ]);
    expect(serviceSegmentsOf({ all: 4, open: 2, completed: 1, rejected: 1 }).map((one) => one.key)).toEqual(['open', 'completed', 'rejected', 'all']);
    expect(SERVICE_SEGMENTS).toContain('open');
  });
});

describe('pendingPreview', () => {
  const now = new Date('2026-11-19T12:00:00Z');
  it('shows the first open tasks and the total', () => {
    const stages = [stage(1, [{ id: 'a', text: 'Firmar acta de inicio' }, { id: 'b', text: 'Hecha', doneBy: 'u1' }]), stage(2, [{ id: 'c', text: 'Enviar plano' }])];
    const preview = pendingPreview(stages, now);
    expect(preview.total).toBe(2);
    expect(preview.tasks.map((task) => task.item.text)).toEqual(['Firmar acta de inicio', 'Enviar plano']);
  });
  it('caps the preview and keeps the total', () => {
    const many = stage(1, Array.from({ length: PENDING_PREVIEW_MAX + 2 }, (_, index) => ({ id: `t${index}`, text: `Tarea ${index}` })));
    const preview = pendingPreview([many], now);
    expect(preview.tasks).toHaveLength(PENDING_PREVIEW_MAX);
    expect(preview.total).toBe(PENDING_PREVIEW_MAX + 2);
  });
  it('is empty without stages', () => {
    expect(pendingPreview([], now)).toEqual({ tasks: [], total: 0 });
  });
});
