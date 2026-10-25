import type { ChatSummary } from '../../api/client';

/**
 * The 1:1 just opened from a person's card, as the conversation draws it until the
 * lists bring it: in its space (the Slack format) and, for an app, with its head.
 */
export function directChatSummary(params: { chatId: string; name: string; phone?: string | null; memberIds: string[]; spaceId: string; appId?: string }): ChatSummary {
  return {
    id: params.chatId,
    kind: 'direct',
    name: params.name,
    ...(params.phone ? { phone: params.phone } : {}),
    memberIds: params.memberIds,
    lastSeq: 0,
    unread: 0,
    othersReadSeq: 0,
    othersDeliveredSeq: 0,
    lastMessage: null,
    workspaceId: params.spaceId,
    ...(params.appId ? { appId: params.appId } : {}),
  };
}
