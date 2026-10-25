import { useEffect, useState } from 'react';
import { spaceMembersAsContacts, type ContactGroup } from '@lilachat/shared';
import { useContactos } from '../../agenda/CreatePanels';
import { spaceMembers } from '../../spaces/spacesApi';

/** The active members of a space as pickable contacts; null while they load. */
function useSpaceMembersAsContacts(jwt: string, workspaceId: string | undefined): ContactGroup[] | null {
  const [groups, setGroups] = useState<ContactGroup[] | null>(null);

  useEffect(() => {
    if (!workspaceId) return;
    let current = true;
    void (async () => {
      const result = await spaceMembers(jwt, workspaceId);
      if (current) setGroups(result.ok ? spaceMembersAsContacts(result.data.members) : []);
    })();
    return () => {
      current = false;
    };
  }, [jwt, workspaceId]);

  return groups;
}

/**
 * Who can be added to a chat. Inside a space the candidates are its members, not the
 * contacts (José, 25/10/2026: Max was in «Constroad» and the channel did not list him).
 */
export function useAddCandidates(jwt: string, workspaceId: string | undefined): ContactGroup[] | null {
  const contacts = useContactos(jwt, !workspaceId);
  const members = useSpaceMembersAsContacts(jwt, workspaceId);
  return workspaceId ? members : contacts;
}
