import type { ProspectView } from '@lilachat/shared';
import type { ChatSummary } from '../../chat/types';
import type { ProspectList } from './prospectsApi';

/** Shared fixtures for the Dali web tests: one Tuesday afternoon in Lima. */
export const NOW = new Date('2026-11-17T20:00:00.000Z');
export const ME = 'u-me';
const MINUTE_MS = 60_000;
export const minutesAgo = (minutes: number): string => new Date(NOW.getTime() - minutes * MINUTE_MS).toISOString();

export const prospectOf = (overrides: Partial<ProspectView> = {}): ProspectView => ({
  id: 'dali:p1',
  chatId: 'chat-1',
  phone: '51949123824',
  lastActivityAt: minutesAgo(5),
  attendedBy: 'dali',
  version: 1,
  createdAt: minutesAgo(60),
  ...overrides,
});

export const listOf = (prospects: ProspectView[], admin = true): ProspectList => ({ prospects, admin, enabled: true, me: ME });

export const chatOf = (overrides: Partial<ChatSummary> = {}): ChatSummary => ({
  id: 'chat-general',
  kind: 'group',
  name: 'general',
  memberIds: [ME, 'u-rosa'],
  lastSeq: 0,
  unread: 0,
  lastMessage: null,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  ...overrides,
});
