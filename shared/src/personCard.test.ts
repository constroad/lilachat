import { describe, expect, it } from 'vitest';
import type { DirectoryApp } from './bots.js';
import { directMessageAction, installedAppsByBot, personOfMember } from './personCard.js';

/**
 * José, 25/10/2026: from a person's name or photo, in a chat, a group or the member list,
 * a card with «Enviar mensaje» that opens the 1:1 (or creates it, in the same space) in
 * every mode. A bot that does not take direct messages is never offered.
 */
const ME = 'u-me';
const SPACE = '6adbb02ec9d066b069307eb4';
const person = (userId: string, isApp = false) => ({ userId, isApp });

describe('directMessageAction', () => {
  it('a person in a personal chat: the plain 1:1, no space', () => {
    expect(directMessageAction({ person: person('u-ana'), myUserId: ME })).toEqual({ kind: 'person', userId: 'u-ana' });
  });

  it('a person in a space chat: the 1:1 of that same space', () => {
    expect(directMessageAction({ person: person('u-ana'), myUserId: ME, spaceId: SPACE })).toEqual({ kind: 'person', userId: 'u-ana', spaceId: SPACE });
  });

  it('myself: nothing to write to', () => {
    expect(directMessageAction({ person: person(ME), myUserId: ME, spaceId: SPACE })).toEqual({ kind: 'none' });
  });

  it('nobody to write to: an empty id', () => {
    expect(directMessageAction({ person: person(''), myUserId: ME })).toEqual({ kind: 'none' });
  });

  it('an installed app of the space goes through its own 1:1', () => {
    const installedApps = new Map([['u-bot', 'app-portal']]);
    expect(directMessageAction({ person: person('u-bot', true), myUserId: ME, spaceId: SPACE, installedApps })).toEqual({ kind: 'app', appId: 'app-portal', spaceId: SPACE });
  });

  it('a bot with no installation in this space is not offered', () => {
    expect(directMessageAction({ person: person('u-bot', true), myUserId: ME, spaceId: SPACE, installedApps: new Map() })).toEqual({ kind: 'none' });
    expect(directMessageAction({ person: person('u-bot', true), myUserId: ME, spaceId: SPACE })).toEqual({ kind: 'none' });
  });

  it('a bot outside any space is not offered either: its 1:1 lives in the space', () => {
    expect(directMessageAction({ person: person('u-bot', true), myUserId: ME, installedApps: new Map([['u-bot', 'app-portal']]) })).toEqual({ kind: 'none' });
  });
});

describe('installedAppsByBot', () => {
  const app = (appId: string, botUserId?: string): DirectoryApp => ({
    appId,
    clientId: `client-${appId}`,
    name: appId,
    features: [],
    commands: [],
    ...(botUserId ? { installation: { installationId: `i-${appId}`, botUserId, installedBy: null, installedAt: '2026-10-20T00:00:00.000Z', channels: 0, directs: 0 } } : {}),
  });

  it('maps each installed app by its bot user and skips the ones not installed', () => {
    const map = installedAppsByBot([app('app-portal', 'u-bot-1'), app('app-lab'), app('app-faro', 'u-bot-3')]);
    expect([...map.entries()]).toEqual([['u-bot-1', 'app-portal'], ['u-bot-3', 'app-faro']]);
  });
});

describe('personOfMember', () => {
  it('takes the name the chat shows (the agenda wins), the photo, the phone and the badge', () => {
    const card = personOfMember({ member: { id: 'u-ana', name: 'Ana P.', phone: '987000111', avatarUrl: 'https://x/a.jpg' }, displayName: 'Ana (obra)', pill: { role: 'member', title: 'Residente de obra' }, isMe: false });
    expect(card).toEqual({ userId: 'u-ana', name: 'Ana (obra)', phone: '987000111', avatarUrl: 'https://x/a.jpg', isApp: false, badge: 'Residente de obra' });
  });

  it('falls back to the server name, then the phone, then «Alguien»', () => {
    expect(personOfMember({ member: { id: 'u1', name: 'Luis', phone: '9' }, isMe: false }).name).toBe('Luis');
    expect(personOfMember({ member: { id: 'u2', name: null, phone: '987000222' }, isMe: false }).name).toBe('987000222');
    expect(personOfMember({ member: { id: 'u3', name: null, phone: null }, isMe: false }).name).toBe('Alguien');
  });

  it('an app has no phone to show and says «App»', () => {
    const card = personOfMember({ member: { id: 'u-bot', name: 'Portal', phone: 'bot:portal', app: true }, pill: { role: 'app' }, isMe: false });
    expect(card).toMatchObject({ userId: 'u-bot', name: 'Portal', isApp: true, badge: 'App' });
    expect(card.phone).toBeNull();
  });

  it('mine carries no phone either (it is mine) and the badge says Tú', () => {
    const card = personOfMember({ member: { id: 'u-me', name: 'José', phone: '902049935' }, pill: { role: 'admin' }, isMe: true });
    expect(card.phone).toBeNull();
    expect(card.badge).toContain('Tú');
  });
});
