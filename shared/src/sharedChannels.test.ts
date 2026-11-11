import { describe, expect, it, vi } from 'vitest';
import { channelPeopleAsContacts, memberSpacePill, shareCardFor, shareInvitesStore, shareRefusal, shareStatusFor, spacesWithAccess, type ShareInvite } from './sharedChannels.js';
import { spaceSections } from './spaceSections.js';

/** José 11/11 (via Portal): a channel of one space shared with others, like Slack Connect. */
describe('shareRefusal', () => {
  const ok = { role: 'admin' as const, isChannel: true, isGeneral: false, isClientChannel: false, sameSpace: false, memberOfTarget: true };

  it('an admin of the owner space shares a channel with another space of theirs', () => {
    expect(shareRefusal(ok)).toBeNull();
    expect(shareRefusal({ ...ok, role: 'owner' })).toBeNull();
  });

  it('refuses a member, #general, a client channel, a non-channel, the same space and a space I am not in', () => {
    expect(shareRefusal({ ...ok, role: 'member' })).toMatch(/admin/);
    expect(shareRefusal({ ...ok, isGeneral: true })).toMatch(/#general/);
    expect(shareRefusal({ ...ok, isClientChannel: true })).toMatch(/cliente/);
    expect(shareRefusal({ ...ok, isChannel: false })).toMatch(/canales/);
    expect(shareRefusal({ ...ok, sameSpace: true })).toMatch(/otro espacio/);
    expect(shareRefusal({ ...ok, memberOfTarget: false })).toMatch(/miembro/);
  });
});

describe('shareStatusFor', () => {
  it('is active at once when the one sharing also runs the receiving space; otherwise it waits for its admins', () => {
    expect(shareStatusFor('owner')).toBe('active');
    expect(shareStatusFor('admin')).toBe('active');
    expect(shareStatusFor('member')).toBe('pending');
    expect(shareStatusFor('guest')).toBe('pending');
  });
});

describe('spacesWithAccess', () => {
  it('is the owner space plus every space the channel is actively shared with, once each', () => {
    expect(spacesWithAccess('a', [{ workspaceId: 'b', status: 'active' }, { workspaceId: 'c', status: 'pending' }, { workspaceId: 'b', status: 'active' }, { workspaceId: 'd', status: 'removed' }])).toEqual(['a', 'b']);
  });
});

describe('memberSpacePill', () => {
  it('names the space of someone from another space, never of the one being looked from', () => {
    expect(memberSpacePill({ spaceId: 'im', spaceName: 'Inframaq' }, 'cr')).toBe('Inframaq');
    expect(memberSpacePill({ spaceId: 'cr', spaceName: 'Constroad' }, 'cr')).toBeNull();
    expect(memberSpacePill({}, 'cr')).toBeNull();
  });
});

describe('spaceSections with shared channels', () => {
  const chats = [
    { kind: 'group' as const, name: 'general', channel: { visibility: 'public' } },
    { kind: 'group' as const, name: 'taller', channel: { visibility: 'private' }, sharedFrom: { workspaceId: 'im', name: 'Inframaq' } },
    { kind: 'group' as const, name: 'administracion', channel: { visibility: 'private' }, sharedFrom: { workspaceId: 'im', name: 'Inframaq' } },
    { kind: 'group' as const, name: 'ventas', channel: { visibility: 'public' }, sharedFrom: { workspaceId: 'gl', name: 'Globofast', logoUrl: 'https://x/gl.png' } },
    { kind: 'direct' as const, name: 'Ana' },
  ];

  it('channels of another space go under a section named after it, by name, after the own channels', () => {
    const sections = spaceSections(chats);

    expect(sections.map((section) => section.title)).toEqual(['Canales', 'Globofast', 'Inframaq', 'Mensajes directos', 'Apps']);
    expect(sections[0]!.chats.map((chat) => chat.name)).toEqual(['general']);
    expect(sections[2]).toMatchObject({ key: 'shared:im', space: { id: 'im', name: 'Inframaq' } });
    expect(sections[2]!.chats.map((chat) => chat.name)).toEqual(['administracion', 'taller']);
    expect(sections[1]!.space).toEqual({ id: 'gl', name: 'Globofast', logoUrl: 'https://x/gl.png' });
  });

  it('without shared channels the sections are the same as before', () => {
    expect(spaceSections(chats.filter((chat) => !('sharedFrom' in chat))).map((section) => section.key)).toEqual(['channels', 'directs', 'apps']);
  });
});

describe('channelPeopleAsContacts', () => {
  it('offers everyone of the spaces with access; those of another space carry its name', () => {
    const groups = channelPeopleAsContacts([
      { userId: 'a', name: 'Ana Quispe', phone: '987333444', space: { id: 'cr', name: 'Constroad' }, inChannel: false },
      { userId: 'l', name: 'Luis Paredes', phone: '987555666', space: { id: 'im', name: 'Inframaq' }, inChannel: false },
    ], 'cr');

    const contacts = groups.flatMap((group) => group.contacts);
    expect(contacts.find((contact) => contact.id === 'a')?.space).toBeUndefined();
    expect(contacts.find((contact) => contact.id === 'l')?.space).toBe('Inframaq');
  });
});

describe('shareInvitesStore', () => {
  const invite: ShareInvite = { chatId: 'c1', channelName: 'administracion', from: { workspaceId: 'im', name: 'Inframaq' }, invitedBy: 'José Zamora' };

  it('an admin loads the invitations; a plain member never asks', async () => {
    const list = vi.fn(async () => ({ ok: true as const, data: { invites: [invite] } }));
    const admin = shareInvitesStore({ role: 'admin', list, answer: vi.fn() });
    const member = shareInvitesStore({ role: 'member', list, answer: vi.fn() });

    await admin.load();
    await member.load();

    expect(admin.get().invites).toEqual([invite]);
    expect(member.get().invites).toEqual([]);
    expect(list).toHaveBeenCalledTimes(1);
  });

  it('answering marks it busy, sends the answer, and reloads what is left', async () => {
    let left = [invite];
    const answer = vi.fn(async () => { left = []; });
    const store = shareInvitesStore({ role: 'owner', list: async () => ({ ok: true as const, data: { invites: left } }), answer });
    await store.load();
    const seen: (string | null)[] = [];
    store.subscribe(() => seen.push(store.get().busy));

    await store.answer('c1', true);

    expect(answer).toHaveBeenCalledWith('c1', true);
    expect(seen[0]).toBe('c1');
    expect(store.get()).toEqual({ invites: [], busy: null });
  });

  it('a failed list leaves no invitations', async () => {
    const store = shareInvitesStore({ role: 'admin', list: async () => ({ ok: false as const }), answer: vi.fn() });
    await store.load();
    expect(store.get().invites).toEqual([]);
  });
});

describe('shareCardFor', () => {
  const spaces = [{ id: 'im', role: 'owner' as const }, { id: 'cr', role: 'admin' as const }, { id: 'gl', role: 'member' as const }];

  it('from its own space, an admin shares it; never #general, never a plain member', () => {
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: 'im', spaces, isGeneral: false })).toBe('share');
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: 'im', spaces, isGeneral: true })).toBeNull();
    expect(shareCardFor({ ownerSpaceId: 'gl', viewingSpaceId: 'gl', spaces, isGeneral: false })).toBeNull();
  });

  it('from the space that receives it, its admin stops receiving it; a plain member sees nothing', () => {
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: 'cr', spaces, isGeneral: false })).toBe('leave');
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: 'gl', spaces, isGeneral: false })).toBeNull();
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: null, spaces, isGeneral: false })).toBeNull();
  });

  it('nothing while the spaces load or without an owner space', () => {
    expect(shareCardFor({ ownerSpaceId: 'im', viewingSpaceId: 'im', spaces: null, isGeneral: false })).toBeNull();
    expect(shareCardFor({ ownerSpaceId: undefined, viewingSpaceId: 'im', spaces, isGeneral: false })).toBeNull();
  });
});

