import { useMemo } from 'react';
import { mentionCandidates } from '@lilachat/shared';
import { fetchMembers, membersCache, useCached } from '../spaces/spaceCache';
import type { Mencionable } from './SugerenciasDeMencion';
import type { DetalleDelChat } from './useDetalleDelChat';

/**
 * Who `@` lists in a chat (José 25/10): the people of the chat and, in a space, the rest of the
 * space too — the ones outside are marked so a mention offers to add them. Only groups mention;
 * never myself. The space directory is the one already cached by entering the space.
 */
export function useMentionCandidatesWeb(params: { jwt: string; workspaceId?: string; isGroup: boolean; detail: DetalleDelChat | null | undefined; myUserId: string }): Mencionable[] | undefined {
  const { jwt, workspaceId, isGroup, detail, myUserId } = params;
  const directory = useCached(membersCache, workspaceId && isGroup ? `${workspaceId}:members` : null, fetchMembers(jwt, workspaceId ?? ''));
  return useMemo(() => {
    if (!isGroup || !detail) return undefined;
    const inChat = [...detail.miembros.values()].filter((one) => !one.esYo).map(({ id, nombre, foto }) => ({ id, nombre, foto }));
    return mentionCandidates({ chatMembers: inChat, spaceMembers: workspaceId ? directory.value : undefined, myUserId });
  }, [isGroup, detail, workspaceId, directory.value, myUserId]);
}
