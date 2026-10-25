import { describe, expect, it } from 'vitest';
import { directChatSummary } from './directChatSummary';

describe('directChatSummary', () => {
  it('a person: a 1:1 of the space with their name and phone', () => {
    expect(directChatSummary({ chatId: 'c1', name: 'Ana', phone: '987000111', memberIds: ['me', 'ana'], spaceId: 'w1' })).toMatchObject({ id: 'c1', kind: 'direct', name: 'Ana', phone: '987000111', memberIds: ['me', 'ana'], workspaceId: 'w1', lastSeq: 0, unread: 0, lastMessage: null });
  });

  it('an app: carries its id for the app head, and no phone', () => {
    const summary = directChatSummary({ chatId: 'c2', name: 'Portal', memberIds: ['me', 'bot'], spaceId: 'w1', appId: 'app-portal' });
    expect(summary).toMatchObject({ workspaceId: 'w1', appId: 'app-portal' });
    expect(summary.phone).toBeUndefined();
  });
});
