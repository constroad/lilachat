import { describe, expect, it } from 'vitest';
import { canChangeRole, canDeactivate, canManageMembers, joinCodePrefix, makeJoinCode, normalizeChannelName, normalizeJoinCode, statusAfterJoin } from './workspaces.js';

/** E1 (José, 20/10): personal account plus company spaces; join with a code or be added by phone. */
describe('join code', () => {
  it('starts with four letters of the name, without accents or spaces', () => {
    expect(joinCodePrefix('CONSTROAD')).toBe('CONS');
    expect(joinCodePrefix('Ingeniería Ñañez')).toBe('INGE');
    expect(joinCodePrefix('M & S')).toBe('MSXX');
  });

  it('has a readable random part without ambiguous characters', () => {
    const code = makeJoinCode('CONSTROAD', () => 0.5);
    expect(code).toMatch(/^CONS-[A-HJ-NP-Z2-9]{4}$/);
    expect(makeJoinCode('CONSTROAD', () => 0)).not.toBe(makeJoinCode('CONSTROAD', () => 0.99));
  });

  it('is typed loosely: lower case, spaces, missing dash, or a full link', () => {
    expect(normalizeJoinCode(' cons 7k3p ')).toBe('CONS-7K3P');
    expect(normalizeJoinCode('CONS7K3P')).toBe('CONS-7K3P');
    expect(normalizeJoinCode('https://lilachat.constroad.com/e/cons-7k3p')).toBe('CONS-7K3P');
    expect(normalizeJoinCode('hola')).toBeNull();
  });
});

describe('roles', () => {
  it('owners and admins manage people; members and guests do not', () => {
    expect(canManageMembers('owner')).toBe(true);
    expect(canManageMembers('admin')).toBe(true);
    expect(canManageMembers('member')).toBe(false);
    expect(canManageMembers('guest')).toBe(false);
  });

  it('only the owner names admins; nobody changes the owner', () => {
    expect(canChangeRole({ actor: 'owner', target: 'member', to: 'admin' })).toBe(true);
    expect(canChangeRole({ actor: 'admin', target: 'member', to: 'admin' })).toBe(false);
    expect(canChangeRole({ actor: 'admin', target: 'member', to: 'guest' })).toBe(true);
    expect(canChangeRole({ actor: 'admin', target: 'admin', to: 'member' })).toBe(false);
    expect(canChangeRole({ actor: 'owner', target: 'owner', to: 'member' })).toBe(false);
    expect(canChangeRole({ actor: 'owner', target: 'member', to: 'owner' })).toBe(false);
  });

  it('the owner is never deactivated; an admin deactivates members and guests, not admins', () => {
    expect(canDeactivate({ actor: 'owner', target: 'admin' })).toBe(true);
    expect(canDeactivate({ actor: 'admin', target: 'member' })).toBe(true);
    expect(canDeactivate({ actor: 'admin', target: 'admin' })).toBe(false);
    expect(canDeactivate({ actor: 'owner', target: 'owner' })).toBe(false);
    expect(canDeactivate({ actor: 'member', target: 'guest' })).toBe(false);
  });

  it('joining with the code waits for approval unless the space is open', () => {
    expect(statusAfterJoin('approval')).toBe('pending');
    expect(statusAfterJoin('open')).toBe('active');
  });
});

describe('channel name', () => {
  it('is lower case with dashes, without accents or symbols', () => {
    expect(normalizeChannelName('Obra Surco')).toBe('obra-surco');
    expect(normalizeChannelName('#Planta  Asfalto!')).toBe('planta-asfalto');
    expect(normalizeChannelName('Administración')).toBe('administracion');
    expect(normalizeChannelName('  --obra--  ')).toBe('obra');
  });

  it('too short or empty is not a name', () => {
    expect(normalizeChannelName('a')).toBeNull();
    expect(normalizeChannelName('***')).toBeNull();
  });

  it('is cut at 40 characters', () => {
    expect(normalizeChannelName('a'.repeat(60))).toHaveLength(40);
  });
});
