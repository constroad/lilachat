import { useMemo } from 'react';
import { mentionCandidates } from '@lilachat/shared';
import { fetchMembers, membersCache, useCached } from '../spaces/spaceCache';
import type { MentionableMember } from './useMenciones';

/**
 * Who `@` lists in a chat (José 25/10): the people of the chat and, in a space, the rest of the
 * space too — the ones outside are marked so a mention offers to add them. Outside a space it is
 * just the chat. The space's directory is the one already cached by entering the space.
 */
export function useMentionCandidates(params: { jwt: string; workspaceId?: string; inChat: ((myUserId: string) => MentionableMember[]) | undefined; myUserId: string }): MentionableMember[] | undefined {
  const { jwt, workspaceId, inChat, myUserId } = params;
  const directory = useCached(membersCache, workspaceId ? `${workspaceId}:members` : null, fetchMembers(jwt, workspaceId ?? ''), Boolean(workspaceId && inChat));
  // Memo: a new array on every render would redraw the composer (FL12).
  return useMemo(
    () => (inChat ? mentionCandidates({ chatMembers: inChat(myUserId), spaceMembers: workspaceId ? directory.value : undefined, myUserId }) : undefined),
    [inChat, workspaceId, directory.value, myUserId]
  );
}
