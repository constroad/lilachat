let openChat: string | null = null;

/** The chat being seen right now, for whoever cannot wait for a render: a list held under that chat is not redrawn. */
export const openChatNow = (): string | null => openChat;

export function reportOpenChat(chatId: string | null): void {
  openChat = chatId;
}
