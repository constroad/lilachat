import { useCallback, useEffect, useState, type ReactNode } from 'react';
import { directMessageAction, installedAppsByBot, type CardPerson } from '@lilachat/shared';
import { createChat } from '../../contacts/contactsApi';
import { appDirectory, createSpaceChat, openAppChat } from '../../spaces/spacesApi';
import { requestOpenChat } from '../../ui/openChatRequest';
import { directChatSummary } from './directChatSummary';
import { PersonSheet } from './PersonSheet';

const OPEN_FAILED = 'No se pudo abrir el chat.';

/**
 * A person's card for a chat or a member list (José, 25/10/2026): `show(person)` draws it,
 * and «Enviar mensaje» opens the 1:1 with them, in the space the chat belongs to, or
 * creates it. An app is offered its 1:1 only while it is installed in that space.
 */
export function usePersonCard(params: { jwt: string; myUserId: string; spaceId?: string }): { show: (person: CardPerson) => void; element: ReactNode } {
  const { jwt, myUserId, spaceId } = params;
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
    if (action.kind === 'none' || busy) return;
    setBusy(true);
    setError(null);
    const opened =
      action.kind === 'app'
        ? await openAppChat(jwt, action.spaceId, action.appId)
        : action.spaceId
          ? await createSpaceChat(jwt, action.spaceId, { kind: 'direct', memberIds: [action.userId] })
          : await createChat(jwt, { kind: 'direct', memberIds: [action.userId] });
    setBusy(false);
    if (!opened.ok) return setError(opened.message ?? OPEN_FAILED);
    // In a space the 1:1 is not in the personal list the lookup reads: it goes with its summary.
    requestOpenChat(
      opened.data.chatId,
      action.spaceId && person ? directChatSummary({ chatId: opened.data.chatId, name: person.name, phone: person.phone, memberIds: [myUserId, person.userId], spaceId: action.spaceId, appId: action.kind === 'app' ? action.appId : undefined }) : undefined
    );
    close();
  }, [action, busy, jwt, close, person, myUserId]);

  const element = person ? (
    <PersonSheet person={person} canWrite={action.kind !== 'none'} checking={asksForApps && installed === undefined} busy={busy} error={error} onWrite={() => void write()} onClose={close} />
  ) : null;
  return { show, element };
}
