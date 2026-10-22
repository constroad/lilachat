import { useEffect, useRef } from 'react';

/**
 * Opens the selected chat (its newest page from the server and the read
 * receipt) once there is a session token to ask with (22/10). Reloading on
 * `/c/<chat>` mounts the shell while the token is still being renewed: the
 * open used to run then, ask nothing, and never run again, so a chat this
 * browser had not cached stayed «Todavía no hay mensajes». Each chat opens
 * once per selection; a renewed token does not open it again.
 */
export function useOpenChatWhenReady(params: { chatId: string | null; ready: boolean; open: (chatId: string) => void }): void {
  const { chatId, ready } = params;
  const openRef = useRef(params.open);
  openRef.current = params.open;
  const opened = useRef<string | null>(null);
  useEffect(() => {
    if (!chatId) {
      opened.current = null;
      return;
    }
    if (!ready || opened.current === chatId) return;
    opened.current = chatId;
    openRef.current(chatId);
  }, [chatId, ready]);
}
