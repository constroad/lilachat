import { describe, expect, it } from 'vitest';
import { accessSummary, canSeeTab, channelTabs, memberAccessIn, memberAccessOf, stageScopeOf, toggleInAccess, visibleStagesFor, type MyClientAccess } from './clientAccess.js';

/** José 30/10 night: topographers and engineers join a client's channel seeing only what an admin picks; money only for admins. */
const STAGE_A = 'a'.repeat(24);
const STAGE_B = 'b'.repeat(24);
const ME = 'u1';
const stages = [
  { _id: STAGE_A, title: 'Permisos', items: [{ id: 't1', assignee: null }, { id: 't2', assignee: ME }] },
  { _id: STAGE_B, title: 'Topografía', items: [{ id: 't3', assignee: 'u2' }, { id: 't4', assignee: ME }, { id: 't5' }] },
];

describe('channelTabs', () => {
  it('an admin: Chat · Cuenta · Servicios · Archivos · Checklist · Pendientes, in the order José asked', () => {
    // Arrange
    const access: MyClientAccess = { money: true };
    // Act
    const tabs = channelTabs(access, true);
    // Assert
    expect(tabs).toEqual(['chat', 'account', 'services', 'files', 'checklist', 'pending']);
  });

  it('a member without money does not get Cuenta; without stages there is no Pendientes', () => {
    expect(channelTabs({ money: false }, false)).toEqual(['chat', 'services', 'files', 'checklist']);
  });

  it('a restricted member only gets the chat and the tabs the admin picked', () => {
    const access: MyClientAccess = { money: false, restricted: { tabs: ['checklist'], stages: [STAGE_A] } };
    expect(channelTabs(access, true)).toEqual(['chat', 'checklist', 'pending']);
    expect(canSeeTab(access, 'services')).toBe(false);
    expect(canSeeTab(access, 'checklist')).toBe(true);
  });

  it('a list from an older server (no access) shows everything but Cuenta', () => {
    expect(channelTabs(undefined, true)).toEqual(['chat', 'services', 'files', 'checklist', 'pending']);
    expect(canSeeTab(undefined, 'files')).toBe(true);
  });
});

describe('stageScopeOf and visibleStagesFor', () => {
  it('without restriction every stage is whole', () => {
    expect(stageScopeOf(null, STAGE_B, false)).toBe('full');
    expect(visibleStagesFor(stages, null, ME)).toEqual(stages);
  });

  it('a picked stage is whole; any other only shows the tasks assigned to me; with none it is hidden', () => {
    // Arrange
    const restricted = { tabs: ['checklist' as const], stages: [STAGE_A] };
    // Act
    const visible = visibleStagesFor(stages, restricted, ME);
    // Assert
    expect(stageScopeOf(restricted, STAGE_A, false)).toBe('full');
    expect(stageScopeOf(restricted, STAGE_B, true)).toBe('own');
    expect(stageScopeOf(restricted, STAGE_B, false)).toBe('none');
    expect(visible.map((stage) => [stage.title, stage.items.map((item) => item.id)])).toEqual([['Permisos', ['t1', 't2']], ['Topografía', ['t4']]]);
  });

  it('without the Checklist tab only the tasks assigned to me remain (for «Mis tareas»)', () => {
    const restricted = { tabs: ['services' as const], stages: [STAGE_A] };
    expect(stageScopeOf(restricted, STAGE_A, false)).toBe('none');
    expect(stageScopeOf(restricted, STAGE_A, true)).toBe('own');
    expect(visibleStagesFor(stages, restricted, 'nobody')).toEqual([]);
  });
});

describe('memberAccessOf', () => {
  it('keeps the known tabs once and valid stage ids', () => {
    expect(memberAccessOf({ tabs: ['checklist', 'files', 'checklist'], stages: [STAGE_A, STAGE_A] })).toEqual({ ok: true, access: { tabs: ['files', 'checklist'], stages: [STAGE_A] } });
  });

  it('only the chat is a valid choice', () => {
    expect(memberAccessOf({ tabs: [], stages: [] })).toEqual({ ok: true, access: { tabs: [], stages: [] } });
  });

  it('refuses an unknown tab (Cuenta is money, never a restricted tab), a bad id or a missing list', () => {
    expect(memberAccessOf({ tabs: ['account'], stages: [] })).toEqual({ ok: false, message: 'Pestaña desconocida: account.' });
    expect(memberAccessOf({ tabs: [], stages: ['x'] })).toEqual({ ok: false, message: 'Etapa inválida.' });
    expect(memberAccessOf({ stages: [] })).toEqual({ ok: false, message: 'Faltan las pestañas (tabs).' });
    expect(memberAccessOf('todo')).toEqual({ ok: false, message: 'Faltan las pestañas (tabs).' });
  });
});

describe('accessSummary', () => {
  const titles = new Map([[STAGE_A, 'Permisos'], [STAGE_B, 'Topografía']]);
  it('says in one line what the member sees', () => {
    expect(accessSummary({ money: true }, titles)).toBe('Todo el canal · ve montos');
    expect(accessSummary({ money: false }, titles)).toBe('Todo el canal, sin montos');
    expect(accessSummary({ money: false, restricted: { tabs: [], stages: [] } }, titles)).toBe('Solo el chat');
    expect(accessSummary({ money: false, restricted: { tabs: ['services', 'checklist'], stages: [STAGE_A] } }, titles)).toBe('Chat, Servicios y Checklist (Permisos)');
    expect(accessSummary({ money: false, restricted: { tabs: ['checklist'], stages: [STAGE_A, STAGE_B] } }, titles)).toBe('Chat y Checklist (2 etapas)');
    expect(accessSummary({ money: false, restricted: { tabs: ['checklist'], stages: [] } }, titles)).toBe('Chat y Checklist (solo sus tareas)');
  });
});

describe('memberAccessIn and toggleInAccess (the editor)', () => {
  const list = { viewers: ['u3'], restricted: [{ user_id: 'u2', tabs: ['checklist' as const], stages: [STAGE_A] }], admins: ['u1'] };
  it('an admin of the space sees all; a restricted one has her tabs; a marked one sees money', () => {
    expect(memberAccessIn(list, 'u1')).toEqual({ admin: true, money: true });
    expect(memberAccessIn(list, 'u2')).toEqual({ admin: false, money: false, restricted: { tabs: ['checklist'], stages: [STAGE_A] } });
    expect(memberAccessIn(list, 'u3')).toEqual({ admin: false, money: true });
  });

  it('flips a tab keeping the tab order, and a stage', () => {
    // Arrange
    const access = { tabs: ['checklist' as const], stages: [STAGE_A] };
    // Act
    const withServices = toggleInAccess(access, { tab: 'services' });
    const withoutStage = toggleInAccess(withServices, { stage: STAGE_A });
    // Assert
    expect(withServices.tabs).toEqual(['services', 'checklist']);
    expect(toggleInAccess(withServices, { tab: 'checklist' }).tabs).toEqual(['services']);
    expect(withoutStage.stages).toEqual([]);
    expect(toggleInAccess(withoutStage, { stage: STAGE_B }).stages).toEqual([STAGE_B]);
  });
});
