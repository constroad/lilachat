import { describe, expect, it } from 'vitest';
import { canDeleteSpace, confirmsSpaceName, countdownLabel, invitedByLine, owesItsName, accountOwesItsName, spacesToOpen, canChangeRole, canDeactivate, canManageMembers, joinCodePrefix, makeJoinCode, normalizeChannelName, normalizeJoinCode, statusAfterJoin, workspacesOf } from './workspaces.js';

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

describe('workspacesOf (01/11: «Algo se rompió en esta pantalla» on José\'s phone)', () => {
  it('reads the list the server sends', () => {
    // Arrange
    const body = { workspaces: [{ id: 'w1', name: 'Constroad' }] };
    // Act / Assert
    expect(workspacesOf(body)).toEqual(body.workspaces);
  });

  it('a 2xx that is not the list (an HTML page, an empty body) is no answer, not «undefined spaces»', () => {
    expect(workspacesOf({})).toBeNull();
    expect(workspacesOf(null)).toBeNull();
    expect(workspacesOf({ workspaces: 'x' })).toBeNull();
  });
});

describe('sign-in by workspace (spec INGRESO-POR-ESPACIO)', () => {
  it('offers to open only the active spaces', () => {
    const spaces = [{ id: 'a', status: 'active' as const }, { id: 'b', status: 'pending' as const }, { id: 'c', status: 'deactivated' as const }];
    expect(spacesToOpen(spaces).map((space) => space.id)).toEqual(['a']);
  });

  it('only an email account without a name owes it', () => {
    expect(owesItsName({ phone: 'mail:abc', name: null })).toBe(true);
    expect(owesItsName({ phone: 'mail:abc', name: '  ' })).toBe(true);
    expect(owesItsName({ phone: 'mail:abc', name: 'Ana' })).toBe(false);
    expect(owesItsName({ phone: '902049935', name: null })).toBe(false);
  });

  it('writes the wait as minutes and two digits of seconds', () => {
    expect(countdownLabel(60)).toBe('1:00');
    expect(countdownLabel(42)).toBe('0:42');
    expect(countdownLabel(5)).toBe('0:05');
  });

  it('says who invited, and still reads well when that account is gone', () => {
    expect(invitedByLine({ invitedBy: 'Darío Paredes' })).toBe('Te invitó Darío Paredes');
    expect(invitedByLine({ invitedBy: null })).toBe('Te invitaron a este espacio');
  });
});

/** Medaly 09/11: «cada vez que abro el enlace» asked her name again; the phone kept the credential of her first email sign-in. */
describe('accountOwesItsName, asked to the account and not to the stored credential', () => {
  const emailCredential = { phone: 'mail:abc', name: null };
  it('skips the name when the account already has one', () => {
    expect(accountOwesItsName(emailCredential, { missing: ['birthday'] })).toBe(false);
  });
  it('asks it when the account still lacks it, or when the account could not be read', () => {
    expect(accountOwesItsName(emailCredential, { missing: ['name', 'birthday'] })).toBe(true);
    expect(accountOwesItsName(emailCredential, null)).toBe(true);
  });
  it('never asks a credential that already has its name', () => {
    expect(accountOwesItsName({ phone: 'mail:abc', name: 'Ana' }, null)).toBe(false);
  });
});

/** José 10/11: deleting a space asks for its name, like GitHub; only the owner sees the button. */
describe('deleting a space', () => {
  it('only the owner deletes it', () => {
    expect(canDeleteSpace('owner')).toBe(true);
    expect(canDeleteSpace('admin')).toBe(false);
    expect(canDeleteSpace('member')).toBe(false);
  });

  it('the typed name confirms without minding case, accents or extra spaces', () => {
    expect(confirmsSpaceName('  obras  ñandu ', 'Obras Ñandú')).toBe(true);
    expect(confirmsSpaceName('Obras', 'Obras Ñandú')).toBe(false);
    expect(confirmsSpaceName('', '')).toBe(false);
    expect(confirmsSpaceName(undefined, 'Obras')).toBe(false);
    expect(confirmsSpaceName(42, '42')).toBe(false);
  });
});
