import { describe, expect, it } from 'vitest';
import { mergeContactGroups } from './mergeContacts';

describe('mergeContactGroups (pending 20)', () => {
  it('the phone\'s contacts on Lilachat join the chats I already have, once each, with the agenda\'s name', () => {
    // Arrange
    const mine = [{ letter: 'W', contacts: [{ id: 'u1', name: 'Wil', phone: '987654321', directChatId: 'c1' }] }];
    const fromPhone = [{ id: 'u1', name: 'Wilson Zeña', phone: '987654321' }, { id: 'u2', name: 'Ana', phone: '912345678' }];
    // Act
    const merged = mergeContactGroups(mine, fromPhone);
    // Assert
    expect(merged.map((group) => group.letter)).toEqual(['A', 'W']);
    expect(merged.flatMap((group) => group.contacts)).toEqual([
      { id: 'u2', name: 'Ana', phone: '912345678' },
      { id: 'u1', name: 'Wilson Zeña', phone: '987654321', directChatId: 'c1' },
    ]);
  });

  it('nothing from the phone leaves the same groups', () => {
    const mine = [{ letter: 'W', contacts: [{ id: 'u1', name: 'Wil', phone: '987654321' }] }];
    expect(mergeContactGroups(mine, [])).toBe(mine);
  });
});
