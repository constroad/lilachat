import { describe, expect, it } from 'vitest';
import { DEFAULT_MEMBER_PERMISSIONS, memberMay, memberPermissionDenied, memberPermissionsOf, memberPermissionsPatch } from './groupPermissions.js';

/** Pending 8 (design permisos-admin): what the members of a group may do. */
describe('group permissions', () => {
  it('without the field the group works as before: anyone edits, writes and adds; only admins pin', () => {
    expect(memberPermissionsOf(undefined)).toEqual(DEFAULT_MEMBER_PERMISSIONS);
    expect(memberPermissionsOf({ sendMessages: 'no', pinMessages: true })).toEqual({ ...DEFAULT_MEMBER_PERMISSIONS, pinMessages: true });
  });

  it('an admin always may; a member only where the switch is on', () => {
    expect(memberMay({ permission: 'sendMessages', role: 'admin', permissions: { sendMessages: false } })).toBe(true);
    expect(memberMay({ permission: 'sendMessages', role: 'member', permissions: { sendMessages: false } })).toBe(false);
    expect(memberMay({ permission: 'pinMessages', role: 'member', permissions: undefined })).toBe(false);
    expect(memberMay({ permission: 'addMembers', role: undefined, permissions: {} })).toBe(true);
  });

  it('a change keeps only the four switches and only booleans', () => {
    expect(memberPermissionsPatch({ sendMessages: false, hack: true, editInfo: 'x' })).toEqual({ sendMessages: false });
    expect(memberPermissionsPatch({ nada: 1 })).toBeNull();
    expect(memberPermissionsPatch(null)).toBeNull();
  });

  it('a refusal says who may', () => {
    expect(memberPermissionDenied('sendMessages')).toBe('Solo los admins pueden enviar mensajes en este grupo.');
  });
});
