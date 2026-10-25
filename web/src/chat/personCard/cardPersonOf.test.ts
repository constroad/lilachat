import { describe, expect, it } from 'vitest';
import { aDetalle } from '../useDetalleDelChat';
import { cardPersonOf } from './cardPersonOf';

/** José, 25/10/2026: the card of whoever was tapped in a chat or in the member list. */
const detail = aDetalle({
  members: [
    { id: 'u-me', name: 'Juan Carlos', phone: '900000001', role: 'admin', esYo: true },
    { id: 'u-max', name: 'Max', phone: '987000111', role: 'member', spaceRole: 'member', title: 'Capataz' },
    { id: 'u-bot', name: 'Portal', phone: null, role: 'member', app: true },
  ],
});

describe('cardPersonOf', () => {
  it('a member: the name the chat draws, the phone, the photo and the pill of the space', () => {
    // Act
    const person = cardPersonOf({ userId: 'u-max', detail, names: new Map([['u-max', 'Max (obra)']]), myUserId: 'u-me' });
    // Assert
    expect(person).toEqual({ userId: 'u-max', name: 'Max (obra)', phone: '987000111', avatarUrl: null, isApp: false, badge: 'Capataz' });
  });

  it('an installed app: no phone, marked as an app', () => {
    const person = cardPersonOf({ userId: 'u-bot', detail, names: new Map(), myUserId: 'u-me' });
    expect(person).toMatchObject({ userId: 'u-bot', name: 'Portal', phone: null, isApp: true, badge: 'App' });
  });

  it('someone who already left the group: the name of the message, no phone', () => {
    const person = cardPersonOf({ userId: 'u-gone', detail, names: new Map([['u-gone', 'Pedro']]), myUserId: 'u-me' });
    expect(person).toMatchObject({ userId: 'u-gone', name: 'Pedro', phone: null, isApp: false });
  });

  it('before the detail arrives: still a card, named «Alguien» at worst', () => {
    expect(cardPersonOf({ userId: 'u-x', detail: null, names: new Map(), myUserId: 'u-me' })).toMatchObject({ userId: 'u-x', name: 'Alguien' });
  });

  it('myself: no card', () => {
    expect(cardPersonOf({ userId: 'u-me', detail, names: new Map(), myUserId: 'u-me' })).toBeNull();
  });
});
