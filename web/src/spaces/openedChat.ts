import type { ChatSummary } from '../chat/types';

/** A chat of the space as the conversation opens it until the list brings it. */
export const openedChat = (chat: Pick<ChatSummary, 'id' | 'kind' | 'name' | 'phone' | 'memberIds' | 'appId'>, spaceId: string): ChatSummary => ({ lastSeq: 0, unread: 0, othersReadSeq: 0, othersDeliveredSeq: 0, lastMessage: null, workspaceId: spaceId, ...chat });
