import type { ActivityItem, ActivityType, ClientChannel, ClientWorkspace, ClientWorkspaceMember, JoinPolicy, MediaLibraryItem, MediaLibraryType, SpaceApp, WorkspaceMemberStatus, WorkspacePreview, WorkspaceRole } from '@lilachat/shared';
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

/** The people of a space (designs `e1-08`, `e1-10`, `e1-11`): active for everyone; pending and deactivated for admins. */
export const spaceMembers = (jwt: string, spaceId: string, status: 'active' | 'pending' | 'invited' | 'deactivated' = 'active') => api<{ members: ClientWorkspaceMember[] }>(path(`/${spaceId}/members?status=${status}`), { jwt });
export const changeMember = (jwt: string, spaceId: string, memberId: string, change: { status?: 'active' | 'deactivated'; role?: WorkspaceRole; title?: string; area?: string }) =>
  api<{ member: ClientWorkspaceMember }>(path(`/${spaceId}/members/${memberId}`), { jwt, method: 'PATCH', body: change });
export const rejectRequest = (jwt: string, spaceId: string, memberId: string) => api<Record<string, never>>(path(`/${spaceId}/members/${memberId}`), { jwt, method: 'DELETE' });
/** A company invites by email (22/10): `active` if a verified account owns it, otherwise `invited` until that email is verified. */
export const inviteToSpaceByEmail = (jwt: string, spaceId: string, email: string) => api<{ id: string; email: string; status: 'active' | 'invited' }>(path(`/${spaceId}/invites`), { jwt, body: { email } });
/** Withdraws an email invitation (22/10). */
export const revokeSpaceInvite = (jwt: string, spaceId: string, inviteId: string) => api<Record<string, never>>(path(`/${spaceId}/invites/${inviteId}`), { jwt, method: 'DELETE' });
export const updateSpace = (jwt: string, spaceId: string, change: { name?: string; rubro?: string; joinPolicy?: JoinPolicy; newCode?: boolean }) => api<{ workspace: ClientWorkspace }>(path(`/${spaceId}`), { jwt, method: 'PATCH', body: change });
/** A 1:1 or a group INSIDE the space, among its active members (the server checks it). */
export const createSpaceChat = (jwt: string, spaceId: string, body: { kind: 'direct' | 'group'; memberIds: string[]; name?: string }) => api<{ chatId: string }>('/chats', { jwt, body: { ...body, workspaceId: spaceId } });

/** «Medios» (pending 38): photos, videos, documents or links of the personal chats, or of a space. */
export function mediaLibrary(jwt: string, params: { type: MediaLibraryType; spaceId?: string | null; before?: string }) {
  const query = new URLSearchParams({ type: params.type, ...(params.spaceId ? { workspace: params.spaceId } : {}), ...(params.before ? { before: params.before } : {}) });
  return api<{ items: MediaLibraryItem[]; hasMore: boolean }>(`/media/library?${query}`, { jwt });
}

/** The space's logo (design e1-12): the file goes as multipart, the common `api` sends JSON. */
export async function uploadSpaceLogo(jwt: string, spaceId: string, file: File): Promise<{ ok: true; workspace: ClientWorkspace } | { ok: false; message: string }> {
  const form = new FormData();
  form.append('file', file);
  try {
    const response = await fetch(`/api${path(`/${spaceId}/logo`)}`, { method: 'POST', headers: { Authorization: `Bearer ${jwt}` }, body: form });
    const payload = (await response.json().catch(() => ({}))) as { workspace?: ClientWorkspace; message?: string };
    return response.ok && payload.workspace ? { ok: true, workspace: payload.workspace } : { ok: false, message: payload.message ?? 'No se pudo cambiar el logo.' };
  } catch {
    return { ok: false, message: 'Sin conexión. Revisa tu internet.' };
  }
}
export const removeSpaceLogo = (jwt: string, spaceId: string) => api<{ workspace: ClientWorkspace }>(path(`/${spaceId}/logo`), { jwt, method: 'DELETE' });

/** «Menciones y actividad» (design e-19): one tab of a space, or only the counts for the list's chips. */
export function spaceActivity(jwt: string, spaceId: string, params: { type?: ActivityType; countsOnly?: boolean } = {}) {
  const query = new URLSearchParams({ workspace: spaceId, ...(params.type ? { type: params.type } : {}), ...(params.countsOnly ? { counts: '1' } : {}) });
  return api<{ items: ActivityItem[]; unread: { mentions: number; threads: number } }>(`/activity?${query}`, { jwt });
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
/** Integraciones (`specs/BOTS-API.spec.md`): the space's installed apps, and uninstalling one. */
export const spaceApps = (jwt: string, spaceId: string) => api<{ apps: SpaceApp[] }>(`/workspaces/${spaceId}/apps`, { jwt });
export const uninstallApp = (jwt: string, spaceId: string, installationId: string) => api<Record<string, never>>(`/workspaces/${spaceId}/apps/${installationId}`, { jwt, method: 'DELETE' });
