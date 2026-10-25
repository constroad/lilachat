import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { directMessageAction, installedAppsByBot, type CardPerson } from '@lilachat/shared';
import { api } from '../../api';
import { openedChat } from '../../spaces/openedChat';
import { appDirectory, createSpaceChat, openAppChat } from '../../spaces/spacesApi';
import type { ChatSummary } from '../types';
import { openChatFromAnywhere } from '../rutaDelChat';
import { PersonCardDialog } from './PersonCardDialog';

const OPEN_FAILED = 'No se pudo abrir el chat.';

/**
 * A person's card for a chat or a member list (José, 25/10/2026): `show(person)` draws it,
 * and «Enviar mensaje» opens the 1:1 with them, in the space the chat belongs to, or
 * creates it. An app is offered its 1:1 only while it is installed in that space.
 *
 * `onOpenChat` gets the summary of a space's 1:1: it is not in the lists yet, and the
 * server's answer says neither its space nor its app.
 */
export function usePersonCardWeb(params: { jwt: string; myUserId: string; spaceId?: string; onOpenChat?: (chatId: string, known?: ChatSummary) => void }): { show: (person: CardPerson) => void; element: ReactNode } {
  const { jwt, myUserId, spaceId, onOpenChat } = params;
  const [person, setPerson] = useState<CardPerson | null>(null);
  const [installed, setInstalled] = useState<ReadonlyMap<string, string> | undefined>(undefined);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const asksForApps = Boolean(person?.isApp && spaceId);
  useEffect(() => {
    if (!asksForApps || !spaceId) return;
    let current = true;
    void appDirectory(jwt, spaceId).then((result) => {
      if (current) setInstalled(result.ok ? installedAppsByBot(result.data.apps) : new Map());
    });
    return () => {
      current = false;
    };
  }, [asksForApps, jwt, spaceId]);

  const show = useCallback((next: CardPerson) => {
    setError(null);
    setBusy(false);
    setPerson(next);
  }, []);
  const close = useCallback(() => {
    setPerson(null);
    setInstalled(undefined);
  }, []);

  const action = person ? directMessageAction({ person, myUserId, spaceId, installedApps: installed }) : { kind: 'none' as const };
  const write = useCallback(async () => {
    if (action.kind === 'none' || !person || busy) return;
    setBusy(true);
    setError(null);
    const opened =
      action.kind === 'app'
        ? await openAppChat(jwt, action.spaceId, action.appId)
        : action.spaceId
          ? await createSpaceChat(jwt, action.spaceId, { kind: 'direct', memberIds: [action.userId] })
          : await api<{ chatId: string }>('/chats', { jwt, body: { kind: 'direct', memberIds: [action.userId] } });
    setBusy(false);
    if (!opened.ok) return setError(opened.message || OPEN_FAILED);
    const known = action.spaceId
      ? openedChat({ id: opened.data.chatId, kind: 'direct', name: person.name, phone: person.phone ?? undefined, memberIds: [myUserId, person.userId], ...(action.kind === 'app' ? { appId: action.appId } : {}) }, action.spaceId)
      : undefined;
    if (onOpenChat) onOpenChat(opened.data.chatId, known);
    else openChatFromAnywhere(opened.data.chatId);
    close();
  }, [action, busy, jwt, close, person, myUserId, onOpenChat]);

  const element = person ? (
    <PersonCardDialog person={person} canWrite={action.kind !== 'none'} checking={asksForApps && installed === undefined} busy={busy} error={error} onWrite={() => void write()} onClose={close} />
  ) : null;
  return { show, element };
}
