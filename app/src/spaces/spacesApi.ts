import type { ClientChannel, ClientWorkspace, JoinPolicy, WorkspaceMemberStatus, WorkspacePreview } from '@lilachat/shared';
import { BASE_URL, type ChatSummary } from '../api/client';
import { jsonCall } from '../api/jsonCall';

/** The company spaces (E1) and their channels (E2), over `/api/workspaces` (§72). */
const url = (path: string) => `${BASE_URL}/api/workspaces${path}`;
const post = (body: Record<string, unknown>) => ({ method: 'POST', body: JSON.stringify(body) });

export const mySpaces = (jwt: string) => jsonCall<{ workspaces: ClientWorkspace[] }>(url(''), jwt);
export const previewSpace = (jwt: string, code: string) => jsonCall<WorkspacePreview>(url(`/preview/${encodeURIComponent(code)}`), jwt);
export const joinSpace = (jwt: string, code: string) => jsonCall<{ workspaceId: string; status: WorkspaceMemberStatus }>(url('/join'), jwt, post({ code }));
export const createSpace = (jwt: string, input: { name: string; rubro?: string; joinPolicy: JoinPolicy }) => jsonCall<{ workspace: ClientWorkspace }>(url(''), jwt, post(input));
export const addToSpace = (jwt: string, spaceId: string, phone: string) => jsonCall<{ member: { id: string; status: WorkspaceMemberStatus } }>(url(`/${spaceId}/members`), jwt, post({ phone }));

export const spaceChannels = (jwt: string, spaceId: string) => jsonCall<{ channels: ClientChannel[] }>(url(`/${spaceId}/channels`), jwt);
export const createChannel = (jwt: string, spaceId: string, input: { name: string; descripcion?: string; visibility: 'public' | 'private' }) => jsonCall<{ channel: ClientChannel }>(url(`/${spaceId}/channels`), jwt, post(input));
export const joinChannel = (jwt: string, spaceId: string, chatId: string) => jsonCall<{ channel: ClientChannel }>(url(`/${spaceId}/channels/${chatId}/join`), jwt, post({}));

/** The chats of a space; each one carries its space, so it opens in the Slack format. */
export async function spaceChats(jwt: string, spaceId: string) {
  const result = await jsonCall<{ chats: ChatSummary[] }>(`${BASE_URL}/api/chats?workspace=${spaceId}`, jwt);
  return result.ok ? { ...result, data: { chats: result.data.chats.map((chat) => ({ ...chat, workspaceId: spaceId })) } } : result;
}
/** Leave a space, or withdraw a request still waiting («Cancelar solicitud», design `e1-03`). */
export const leaveSpace = (jwt: string, spaceId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/leave`), jwt, post({}));
