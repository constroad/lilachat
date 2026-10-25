import { listChats } from '../api/client';
import { spaceChats } from '../spaces/spacesApi';

/**
 * The list that holds a chat. One of a space is not in the personal list: its pinned messages
 * and everything the list carries come from its space's (José 25/10, pinned in Slack mode).
 */
export const chatListFor = (jwt: string, workspaceId?: string) => (workspaceId ? spaceChats(jwt, workspaceId) : listChats(jwt));
