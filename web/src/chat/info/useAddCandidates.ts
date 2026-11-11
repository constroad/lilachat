import { useEffect, useState } from 'react';
import { channelPeopleAsContacts, spaceMembersAsContacts, type ContactGroup } from '@lilachat/shared';
import { useContactos } from '../../agenda/CreatePanels';
import { channelPeople, spaceMembers } from '../../spaces/spacesApi';

/** The active members of a space as pickable contacts; null while they load. */
function useSpaceMembersAsContacts(jwt: string, workspaceId: string | undefined, sharedChatId?: string): ContactGroup[] | null {
  const [groups, setGroups] = useState<ContactGroup[] | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let current = true;
    void (async () => {
      // José 11/11: a shared channel offers the people of every space it reaches, each with their space.
      if (sharedChatId) {
        const result = await channelPeople(jwt, workspaceId, sharedChatId);
        if (current) setGroups(result.ok ? channelPeopleAsContacts(result.data.people, workspaceId) : []);
        return;
      }
      const result = await spaceMembers(jwt, workspaceId);
      if (current) setGroups(result.ok ? spaceMembersAsContacts(result.data.members) : []);
    })();
    return () => {
      current = false;
    };
  }, [jwt, workspaceId, sharedChatId]);

  return groups;
}

/**
 * Who can be added to a chat. Inside a space the candidates are its members, not the
 * contacts (José, 25/10/2026: Max was in «Constroad» and the channel did not list him).
 */
export function useAddCandidates(jwt: string, workspaceId: string | undefined, sharedChatId?: string): ContactGroup[] | null {
  const contacts = useContactos(jwt, !workspaceId);
  const members = useSpaceMembersAsContacts(jwt, workspaceId, sharedChatId);
  return workspaceId ? members : contacts;
}
