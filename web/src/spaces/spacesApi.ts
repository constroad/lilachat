import type { ClientChannel, ClientWorkspace, JoinPolicy, WorkspaceMemberStatus, WorkspacePreview } from '@lilachat/shared';
import { api } from '../api';
import type { ChatSummary } from '../chat/types';

/** The company spaces (E1) and their channels (E2), the same `/api/workspaces` the phone uses (§72). */
const path = (rest: string) => `/workspaces${rest}`;

export const mySpaces = (jwt: string) => api<{ workspaces: ClientWorkspace[] }>(path(''), { jwt });
export const previewSpace = (jwt: string, code: string) => api<WorkspacePreview>(path(`/preview/${encodeURIComponent(code)}`), { jwt });
export const joinSpace = (jwt: string, code: string) => api<{ workspaceId: string; status: WorkspaceMemberStatus }>(path('/join'), { jwt, body: { code } });
export const createSpace = (jwt: string, input: { name: string; rubro?: string; joinPolicy: JoinPolicy }) => api<{ workspace: ClientWorkspace }>(path(''), { jwt, body: input });
export const addToSpace = (jwt: string, spaceId: string, phone: string) => api<{ member: { id: string; status: WorkspaceMemberStatus } }>(path(`/${spaceId}/members`), { jwt, body: { phone } });
/** Leave a space, or withdraw a request still waiting (design `e1-03`). */
export const leaveSpace = (jwt: string, spaceId: string) => api<Record<string, never>>(path(`/${spaceId}/leave`), { jwt, method: 'POST' });

export const spaceChannels = (jwt: string, spaceId: string) => api<{ channels: ClientChannel[] }>(path(`/${spaceId}/channels`), { jwt });
export const createChannel = (jwt: string, spaceId: string, input: { name: string; descripcion?: string; visibility: 'public' | 'private' }) => api<{ channel: ClientChannel }>(path(`/${spaceId}/channels`), { jwt, body: input });
export const joinChannel = (jwt: string, spaceId: string, chatId: string) => api<{ channel: ClientChannel }>(path(`/${spaceId}/channels/${chatId}/join`), { jwt, method: 'POST' });

/** The chats of a space; each one carries its space, so it opens in the Slack format. */
export async function spaceChats(jwt: string, spaceId: string) {
  const response = await api<{ chats: ChatSummary[] }>(`/chats?workspace=${spaceId}`, { jwt });
  return response.ok ? { ...response, data: { chats: response.data.chats.map((chat) => ({ ...chat, workspaceId: spaceId })) } } : response;
}

/** A channel just joined or created, as the conversation opens it until the list reloads. */
export const chatOfChannel = (channel: ClientChannel, spaceId: string): ChatSummary => ({
  id: channel.id,
  kind: 'group',
  name: channel.name,
  memberIds: [],
  lastSeq: 0,
  unread: 0,
  othersReadSeq: 0,
  othersDeliveredSeq: 0,
  lastMessage: null,
  workspaceId: spaceId,
  channel: { visibility: channel.visibility },
});
