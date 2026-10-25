import { describe, expect, it, vi } from 'vitest';
import type { ChatSummary } from '../api/client';
import { requestOpenChat, subscribeOpenChatRequests } from './openChatRequest';

/** «Enviar mensaje» from a person's card opens the 1:1 in the space it was asked in (José, 25/10/2026). */
describe('openChatRequest', () => {
  const known: ChatSummary = { id: 'c1', kind: 'direct', name: 'Ana', memberIds: ['me', 'ana'], lastSeq: 0, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null, workspaceId: 'w1' };

  it('hands the listeners the chat, and the chat itself when the caller already has it', () => {
    const listener = vi.fn();
    const stop = subscribeOpenChatRequests(listener);
    requestOpenChat('c1', known);
    requestOpenChat('c2');
    stop();
    requestOpenChat('c3');
    expect(listener.mock.calls).toEqual([['c1', known], ['c2', undefined]]);
  });
});
