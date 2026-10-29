import type { AppChannel, AppLink } from '@lilachat/shared';
import type { ActivityItem, ActivityType, ClientChannel, ClientWorkspace, ClientWorkspaceMember, JoinPolicy, MediaLibraryItem, MediaLibraryType, SpaceApp, AvailableApp, SpaceAppDirectory, TopicRoute, AppItemRow, AppItemSetting, AppSchedules, ScheduleRow, WorkspaceMemberStatus, WorkspacePreview, WorkspaceRole } from '@lilachat/shared';
import { api } from '../api';
import type { ChatSummary } from '../chat/types';
import { shrinkPhotoBlob } from '../chat/shrinkPhoto';

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
  const response = await api<{ chats: ChatSummary[]; activity?: { mentions: number; threads: number } }>(`/chats?workspace=${spaceId}`, { jwt });
  return response.ok ? { ...response, data: { chats: response.data.chats.map((chat) => ({ ...chat, workspaceId: spaceId })), activity: response.data.activity } } : response;
}

/** The people of a space (designs `e1-08`, `e1-10`, `e1-11`): active for everyone; pending and deactivated for admins. */
export const spaceMembers = (jwt: string, spaceId: string, status: 'active' | 'pending' | 'invited' | 'deactivated' | 'all' = 'active') => api<{ members: ClientWorkspaceMember[] }>(path(`/${spaceId}/members?status=${status}`), { jwt });
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
export function mediaLibrary(jwt: string, params: { type: MediaLibraryType; spaceId?: string | null; before?: string; q?: string | null }) {
  const query = new URLSearchParams({ type: params.type, ...(params.spaceId ? { workspace: params.spaceId } : {}), ...(params.before ? { before: params.before } : {}), ...(params.q ? { q: params.q } : {}) });
  return api<{ items: MediaLibraryItem[]; hasMore: boolean }>(`/media/library?${query}`, { jwt });
}

/** The space's logo (design e1-12): the file goes as multipart, the common `api` sends JSON. */
export async function uploadSpaceLogo(jwt: string, spaceId: string, file: File): Promise<{ ok: true; workspace: ClientWorkspace } | { ok: false; message: string }> {
  // Portal's standard (28/10): a logo with transparency stays PNG.
  const logo = await shrinkPhotoBlob(file, file.name);
  const form = new FormData();
  form.append('file', logo.blob, logo.name);
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
export const availableApps = (jwt: string, spaceId: string) => api<{ apps: AvailableApp[] }>(`/workspaces/${spaceId}/available-apps`, { jwt });
/** The «Apps» section (23/10): installed for everyone, to add for admins; and the 1:1 with an app's bot. */
export const appDirectory = (jwt: string, spaceId: string) => api<SpaceAppDirectory>(`/workspaces/${spaceId}/app-directory`, { jwt });
export const openAppChat = (jwt: string, spaceId: string, appId: string) => api<{ chatId: string; botUserId: string }>(`/workspaces/${spaceId}/apps/${appId}/chat`, { jwt, method: 'POST', body: {} });
export const uninstallApp = (jwt: string, spaceId: string, installationId: string) => api<Record<string, never>>(`/workspaces/${spaceId}/apps/${installationId}`, { jwt, method: 'DELETE' });

/** «¿Dónde llega cada aviso?» (R160): the app's topics with their channel, and the space's channels to pick from. */
export type AppTopics = { topics: TopicRoute[]; channels: { id: string; name: string; private: boolean }[]; canEdit: boolean };
export const appTopics = (jwt: string, spaceId: string, appId: string) => api<AppTopics>(`/workspaces/${spaceId}/apps/${appId}/topics`, { jwt });
export const saveAppTopics = (jwt: string, spaceId: string, appId: string, channels: Record<string, string | null>) => api<AppTopics>(`/workspaces/${spaceId}/apps/${appId}/topics`, { jwt, method: 'PUT', body: { channels } });
export const testAppTopics = (jwt: string, spaceId: string, appId: string) => api<{ channels: number }>(`/workspaces/${spaceId}/apps/${appId}/topics/test`, { jwt, method: 'POST', body: {} });

/** «Conectado como … / Desconectar» (pending 59): MY account in this app, asked to the app each time. */
export const appLink = (jwt: string, spaceId: string, appId: string) => api<AppLink>(`/workspaces/${spaceId}/apps/${appId}/link`, { jwt });
export const unlinkApp = (jwt: string, spaceId: string, appId: string) => api<Record<string, never>>(`/workspaces/${spaceId}/apps/${appId}/link`, { jwt, method: 'DELETE' });

/** «En qué canales está» (pending 99): the switch rides the chat's members routes, so the channel says who took the app out. */
export type AppChannels = { channels: AppChannel[]; botUserId: string; canEdit: boolean };
export const appChannels = (jwt: string, spaceId: string, appId: string) => api<AppChannels>(`/workspaces/${spaceId}/apps/${appId}/channels`, { jwt });
export const setAppInChannel = (jwt: string, chatId: string, botUserId: string, inChannel: boolean) =>
  inChannel ? api<{ ok: true }>(`/chats/${chatId}/members`, { jwt, body: { userId: botUserId } }) : api<{ ok: true }>(`/chats/${chatId}/members/${botUserId}`, { jwt, method: 'DELETE' });

/** «Comandos y acciones» (R160): where each command and action of the app works. */
export type AppItems = { items: AppItemRow[]; channels: { id: string; name: string; private: boolean }[]; canEdit: boolean };
export const appItems = (jwt: string, spaceId: string, appId: string) => api<AppItems>(`/workspaces/${spaceId}/apps/${appId}/items`, { jwt });
export const saveAppItems = (jwt: string, spaceId: string, appId: string, items: Record<string, AppItemSetting>) => api<AppItems>(`/workspaces/${spaceId}/apps/${appId}/items`, { jwt, method: 'PUT', body: { items } });

/** «Horarios» (designs d-02, d-03): every member reads them; an admin programs, pauses or deletes. */
const schedulesPath = (spaceId: string, appId: string) => `/workspaces/${spaceId}/apps/${appId}/schedules`;
export const appSchedules = (jwt: string, spaceId: string, appId: string) => api<AppSchedules>(schedulesPath(spaceId, appId), { jwt });
export const createAppSchedule = (jwt: string, spaceId: string, appId: string, body: Record<string, unknown>) => api<{ schedule: ScheduleRow }>(schedulesPath(spaceId, appId), { jwt, body });
export const setAppScheduleActive = (jwt: string, spaceId: string, appId: string, scheduleId: string, active: boolean) => api<{ ok: true }>(`${schedulesPath(spaceId, appId)}/${scheduleId}`, { jwt, method: 'PATCH', body: { active } });
export const deleteAppSchedule = (jwt: string, spaceId: string, appId: string, scheduleId: string) => api<{ ok: true }>(`${schedulesPath(spaceId, appId)}/${scheduleId}`, { jwt, method: 'DELETE' });
