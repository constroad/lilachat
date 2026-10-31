import { useCallback, useMemo, useState } from 'react';
import { cambiarAjustesDeChat } from '../api/client';
import { chatMenuOptions, type ChatMenuId, type ChatMenuKind } from './chatHeaderMenu';
import type { MuteFor } from '@lilachat/shared';
import { askMuteDuration } from './askMuteDuration';

const BASE_URL = process.env.EXPO_PUBLIC_API_URL ?? 'https://lilachat.constroad.com';

/** Where the detail opens from the menu: at its shared media, or adding people. */
export type DetailSection = 'media' | 'add-members';
export type ChatHeaderMenu = { options: ReturnType<typeof chatMenuOptions>; select: (id: ChatMenuId) => void; refresh: () => void };

/**
 * The ⋮ of the chat (José, 21/10, like WhatsApp). Whether it is muted is
 * asked when the menu opens (the detail says it), not on every chat opened:
 * muting is «nada» and turning it back on is «todo», the detail's levels.
 */
export function useChatHeaderMenu(params: { chatId: string; jwt: string; kind: ChatMenuKind; onDetail: (section?: DetailSection) => void; onSearch: () => void; onError: (text: string) => void }): ChatHeaderMenu {
  const { chatId, jwt, kind, onDetail, onSearch, onError } = params;
  const [muted, setMuted] = useState(false);
  const refresh = useCallback(() => {
    void fetch(`${BASE_URL}/api/chats/${chatId}/detail`, { headers: { Authorization: `Bearer ${jwt}` } })
      .then((response) => (response.ok ? (response.json() as Promise<{ avisos?: string; muted?: boolean }>) : null))
      .then((detail) => detail && setMuted((detail.avisos ?? (detail.muted ? 'menciones' : 'todo')) !== 'todo'))
      .catch(() => undefined);
  }, [chatId, jwt]);
  const setNotices = useCallback((silence: boolean, muteFor?: MuteFor) => {
    setMuted(silence);
    void cambiarAjustesDeChat(chatId, jwt, { avisos: silence ? 'nada' : 'todo', muteFor }).then((ok) => {
      if (ok) return;
      setMuted(!silence);
      onError('No se pudo cambiar los avisos. Revisa tu conexión.');
    });
  }, [chatId, jwt, onError]);
  const select = useCallback((id: ChatMenuId) => {
    if (id === 'search') onSearch();
    // R31/10: muting asks for how long, like WhatsApp.
    else if (id === 'mute') askMuteDuration((muteFor) => setNotices(true, muteFor));
    else if (id === 'unmute') setNotices(false);
    else onDetail(id === 'info' ? undefined : id);
  }, [onDetail, onSearch, setNotices]);
  const options = useMemo(() => chatMenuOptions({ kind, muted }), [kind, muted]);
  return { options, select, refresh };
}
