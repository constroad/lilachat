import { describe, expect, it } from 'vitest';
import { accessSummary, canSeeDrive, canSeeTab, isFieldReport, isMoneyRecord, channelTabs, memberAccessIn, memberAccessOf, serviceAccessOf, taskActionsFor, toggleInAccess, type MyClientAccess } from './clientAccess.js';

/** José 30/10 night: topographers and engineers join a client's channel seeing only what an admin picks; money only for admins. */
const STAGE_A = 'a'.repeat(24);
const STAGE_B = 'b'.repeat(24);
const ME = 'u1';
const stages = [
  { _id: STAGE_A, title: 'Permisos', items: [{ id: 't1', assignee: null }, { id: 't2', assignee: ME }] },
  { _id: STAGE_B, title: 'Topografía', items: [{ id: 't3', assignee: 'u2' }, { id: 't4', assignee: ME }, { id: 't5' }] },
];

describe('channelTabs', () => {
  it('an admin: Chat · Cuenta · Servicios · Checklist · Pendientes; «Archivos» is gone (José 06/11)', () => {
    // Arrange
    const access: MyClientAccess = { money: true, admin: true };
    // Act
    const tabs = channelTabs(access, true);
    // Assert
    expect(tabs).toEqual(['chat', 'account', 'services', 'checklist', 'pending']);
  });

  it('the Checklist is only for admins and Pendientes for everyone (José 06/11); without money there is no Cuenta', () => {
    expect(channelTabs({ money: false }, true)).toEqual(['chat', 'services', 'pending']);
    expect(channelTabs({ money: true }, true)).toEqual(['chat', 'account', 'services', 'pending']);
    expect(channelTabs({ money: true, admin: true }, false)).toEqual(['chat', 'account', 'services', 'checklist']);
  });

  it('a restricted member only gets the chat and the tabs the admin picked', () => {
    const access: MyClientAccess = { money: false, restricted: { tabs: ['services'], stages: [] } };
    expect(channelTabs(access, true)).toEqual(['chat', 'services', 'pending']);
    expect(canSeeTab(access, 'files')).toBe(false);
    expect(canSeeTab(access, 'services')).toBe(true);
  });

  it('a member an admin gave only the Drive still reaches it: it lives inside each service now', () => {
    // Arrange
    const access: MyClientAccess = { money: false, restricted: { tabs: ['files'], stages: [] } };
    // Act
    const tabs = channelTabs(access, false);
    // Assert
    expect(tabs).toEqual(['chat', 'services']);
    expect(serviceAccessOf(access)).toEqual({ detail: false, drive: true });
  });

  it('opening a service shows what each one may see: orders and reports, the Drive, or both', () => {
    expect(serviceAccessOf({ money: true })).toEqual({ detail: true, drive: true });
    expect(serviceAccessOf({ money: false })).toEqual({ detail: true, drive: false });
    expect(serviceAccessOf({ money: false, restricted: { tabs: ['services', 'files'], stages: [] } })).toEqual({ detail: true, drive: true });
  });

  it('a list from an older server (no access) shows neither Cuenta nor the checklist, only Pendientes', () => {
    expect(channelTabs(undefined, true)).toEqual(['chat', 'services', 'pending']);
    expect(canSeeTab(undefined, 'files')).toBe(true);
  });
});

describe('taskActionsFor', () => {
  it('an admin marks and reassigns any task', () => {
    expect(taskActionsFor({ admin: true, me: ME, assignee: 'other' })).toEqual({ canMark: true, canReassign: true });
  });

  it('anyone else marks only what was assigned to them and never reassigns', () => {
    expect(taskActionsFor({ admin: false, me: ME, assignee: ME })).toEqual({ canMark: true, canReassign: false });
    expect(taskActionsFor({ admin: false, me: ME, assignee: 'other' })).toEqual({ canMark: false, canReassign: false });
    expect(taskActionsFor({ admin: false, me: ME })).toEqual({ canMark: false, canReassign: false });
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
  it('says in one line what the member sees', () => {
    expect(accessSummary({ money: true })).toBe('Todo el canal · ve montos');
    expect(accessSummary({ money: false })).toBe('Todo el canal, sin montos ni Drive');
    expect(accessSummary({ money: false, restricted: { tabs: [], stages: [] } })).toBe('Solo el chat');
    expect(accessSummary({ money: false, restricted: { tabs: ['services'], stages: [] } })).toBe('Chat y Servicios');
  });

  it('ignores the checklist mark an older editor left', () => {
    expect(accessSummary({ money: false, restricted: { tabs: ['checklist'], stages: [STAGE_A] } })).toBe('Solo el chat');
    expect(accessSummary({ money: true, restricted: { tabs: ['services', 'checklist'], stages: [] } })).toBe('Chat y Servicios · ve montos');
  });
});

describe('memberAccessIn and toggleInAccess (the editor)', () => {
  const list = { viewers: ['u3'], restricted: [{ user_id: 'u2', tabs: ['checklist' as const], stages: [STAGE_A] }], admins: ['u1'] };
  it('an admin of the space sees all; a restricted one has her tabs; a marked one sees money', () => {
    expect(memberAccessIn(list, 'u1')).toEqual({ admin: true, money: true });
    expect(memberAccessIn(list, 'u2')).toEqual({ admin: false, money: false, restricted: { tabs: ['checklist'], stages: [STAGE_A] } });
    expect(memberAccessIn(list, 'u3')).toEqual({ admin: false, money: true });
  });

  it('flips a tab keeping the tab order', () => {
    // Arrange
    const access = { tabs: ['files' as const], stages: [] };
    // Act
    const withServices = toggleInAccess(access, 'services');
    // Assert
    expect(withServices.tabs).toEqual(['services', 'files']);
    expect(toggleInAccess(withServices, 'files').tabs).toEqual(['services']);
  });
});

/** José 05/11: the engineers joining a client's channel see no money anywhere, not only in «Cuenta». */
describe('what carries money beyond the tabs', () => {
  it('Portal\'s Drive holds liquidations: it takes the money mark or an admin ticking «Drive»', () => {
    expect(canSeeDrive({ money: false })).toBe(false);
    expect(canSeeDrive(undefined)).toBe(false);
    expect(canSeeDrive({ money: true })).toBe(true);
    expect(canSeeDrive({ money: false, restricted: { tabs: ['files'], stages: [] } })).toBe(true);
    expect(canSeeDrive({ money: false, restricted: { tabs: ['services'], stages: [] } })).toBe(false);
  });

  it('a payment or a quote on a service\'s card is money; a report or an observation is not', () => {
    expect(isMoneyRecord({ kicker: 'Pago', title: 'Adelanto S/ 5,000' })).toBe(true);
    expect(isMoneyRecord({ title: 'Cotización COT-12' })).toBe(true);
    expect(isMoneyRecord({ kicker: 'Valorización', title: 'Octubre' })).toBe(true);
    expect(isMoneyRecord({ kicker: 'Informe', title: 'Control de pista · 29 de octubre' })).toBe(false);
    expect(isMoneyRecord({ title: 'Observación de obra' })).toBe(false);
  });
});

describe('isFieldReport: the reports of a member without money', () => {
  const PUBLIC_PAGE = ['Control de pista', 'Conformación de capa', 'Control de imprimación', 'Área adicional', 'Recepción de campo', 'Levantamiento de observaciones', 'Fresado de pavimento', 'Solicitud de imprimación'];
  const HIDDEN = ['Valorización de servicios', 'Liquidación final del servicio', 'Contrato de servicio', 'Aprobación de adicional', 'Acta de conformidad', 'Cuadro Resumen de Metrado', 'Informe Tecnico Reclamo Excedente', 'Dossier de obra', 'Producción de planta', 'Panel fotográfico de obra', 'Informe de obra'];

  it.each(PUBLIC_PAGE)('shows «%s», as Portal\'s public services page does', (typeLabel) => {
    expect(isFieldReport({ typeLabel })).toBe(true);
  });

  it.each(HIDDEN)('hides «%s»', (typeLabel) => {
    expect(isFieldReport({ typeLabel })).toBe(false);
  });

  it('hides a report that says no type: a list of what is allowed fails closed', () => {
    expect(isFieldReport({})).toBe(false);
  });

  it('does not depend on accents or capitals', () => {
    expect(isFieldReport({ typeLabel: 'CONTROL DE IMPRIMACION' })).toBe(true);
  });
});
