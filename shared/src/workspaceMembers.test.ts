import { describe, expect, it } from 'vitest';
import { changeForAction, directoryAreas, filterMembers, joinedLabel, memberActions, newlyAddedSpaces, requestedAgo, roleLabel, SPACE_AREAS } from './workspaceMembers.js';

/** The enterprise screens (designs `e1-08`…`e1-14`). PURE. */
describe('roleLabel', () => {
  it('the role as the pill says it', () => {
    expect(['owner', 'admin', 'member', 'guest'].map((role) => roleLabel(role as never))).toEqual(['Dueño', 'Admin', 'Miembro', 'Invitado']);
  });
});

describe('memberActions (the ⋮ of «Miembros y roles», e1-10)', () => {
  it('an owner over a member: make admin, make guest, deactivate', () => {
    expect(memberActions({ actor: 'owner', target: { role: 'member', status: 'active' } })).toEqual(['make-admin', 'make-guest', 'deactivate']);
  });
  it('an owner over an admin: back to member, deactivate', () => {
    expect(memberActions({ actor: 'owner', target: { role: 'admin', status: 'active' } })).toEqual(['make-member', 'deactivate']);
  });
  it('an admin cannot touch another admin nor the owner; over a guest, make member', () => {
    expect(memberActions({ actor: 'admin', target: { role: 'admin', status: 'active' } })).toEqual([]);
    expect(memberActions({ actor: 'admin', target: { role: 'owner', status: 'active' } })).toEqual([]);
    expect(memberActions({ actor: 'admin', target: { role: 'guest', status: 'active' } })).toContain('make-member');
  });
  it('a deactivated one can only be reactivated; a member sees no actions; nobody acts on themselves', () => {
    expect(memberActions({ actor: 'owner', target: { role: 'member', status: 'deactivated' } })).toEqual(['reactivate']);
    expect(memberActions({ actor: 'member', target: { role: 'member', status: 'active' } })).toEqual([]);
    expect(memberActions({ actor: 'owner', target: { role: 'owner', status: 'active' } })).toEqual([]);
  });
});

describe('the directory (e1-08)', () => {
  const people = [
    { name: 'Ana Torres', title: 'Residente de obra', area: 'Obra', phone: '987654321' },
    { name: 'Beto Ramos', title: 'Operador de planta', area: 'Planta', phone: '976543210' },
    { name: 'Carla Díaz', title: 'Administración', area: 'Flota', phone: '965432109' },
    { name: 'Luis Huamán', title: 'Chofer', area: 'Flota', phone: '954321098' },
    { name: undefined, title: undefined, area: undefined, phone: '911222333' },
  ];
  it('chips by area with their counts, the biggest first, and «Todas» with everyone', () => {
    expect(directoryAreas(people)).toEqual([{ area: null, label: 'Todas', count: 5 }, { area: 'Flota', label: 'Flota', count: 2 }, { area: 'Obra', label: 'Obra', count: 1 }, { area: 'Planta', label: 'Planta', count: 1 }]);
  });
  it('search by name, title, area or phone, accents and spaces ignored; then the area chip', () => {
    expect(filterMembers(people, { query: 'diaz', area: null }).map((one) => one.phone)).toEqual(['965432109']);
    expect(filterMembers(people, { query: 'chofer', area: null }).map((one) => one.phone)).toEqual(['954321098']);
    expect(filterMembers(people, { query: '976 543', area: null }).map((one) => one.phone)).toEqual(['976543210']);
    expect(filterMembers(people, { query: '', area: 'Flota' }).map((one) => one.phone)).toEqual(['965432109', '954321098']);
  });
  it('the areas offered when approving start with the usual ones of a construction company', () => {
    expect(SPACE_AREAS).toEqual(['Obra', 'Planta', 'Flota', 'Admin.']);
  });
});

describe('dates of a member', () => {
  const now = new Date('2026-10-21T15:00:00-05:00');
  it('«Entró con el código hace 5 min», ayer, or the date', () => {
    expect(requestedAgo('2026-10-21T14:55:00-05:00', now)).toBe('hace 5 min');
    expect(requestedAgo('2026-10-21T14:59:50-05:00', now)).toBe('hace un momento');
    expect(requestedAgo('2026-10-21T12:00:00-05:00', now)).toBe('hace 3 h');
    expect(requestedAgo('2026-10-20T18:00:00-05:00', now)).toBe('ayer');
    expect(requestedAgo('2026-10-12T09:00:00-05:00', now)).toBe('el 12 de octubre');
  });
  it('«Se unió»: day and month, with the year when it is another one', () => {
    expect(joinedLabel('2026-08-03T10:00:00-05:00', now)).toBe('3 de agosto');
    expect(joinedLabel('2025-12-24T10:00:00-05:00', now)).toBe('24 de diciembre de 2025');
  });
});

describe('newlyAddedSpaces («te agregaron», e1-13)', () => {
  const space = (id: string, extra: Record<string, unknown> = {}) => ({ id, status: 'active', addedBy: { name: 'José Zamora', phone: '902049935' }, ...extra });
  it('a space someone else added me to and I have not seen yet', () => {
    expect(newlyAddedSpaces([space('a'), space('b')], ['b']).map((one) => one.id)).toEqual(['a']);
  });
  it('not one I joined myself, nor one waiting or without access', () => {
    expect(newlyAddedSpaces([space('a', { addedBy: undefined }), space('b', { status: 'pending' }), space('c', { status: 'deactivated' })], [])).toEqual([]);
  });
});

describe('changeForAction', () => {
  it('each action as the change the server applies', () => {
    expect(changeForAction('make-admin')).toEqual({ role: 'admin' });
    expect(changeForAction('make-member')).toEqual({ role: 'member' });
    expect(changeForAction('make-guest')).toEqual({ role: 'guest' });
    expect(changeForAction('deactivate')).toEqual({ status: 'deactivated' });
    expect(changeForAction('reactivate')).toEqual({ status: 'active' });
  });
});
