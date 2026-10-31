/**
 * «Leer todo» (R31/10-B9), like WhatsApp: every chat of this list (a space's or
 * the personal one) read to its end. The rows update by the server's notice,
 * as when a chat is read on another device. False when it could not be saved.
 */
export async function readAllChats(jwt: string, workspaceId: string | null): Promise<boolean> {
  try {
    const response = await fetch('/api/chats/read-all', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${jwt}` },
      body: JSON.stringify(workspaceId ? { workspaceId } : {}),
    });
    return response.ok;
  } catch {
    return false;
  }
}

/** The list's scope: the space of its chats, or none for the personal list. */
export const scopeOf = (chats: readonly { workspaceId?: string }[]): string | null => chats.find((chat) => chat.workspaceId)?.workspaceId ?? null;
