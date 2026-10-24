import type { AppLink } from '@lilachat/shared';
import type { ActivityItem, ActivityType, ClientChannel, ClientWorkspace, ClientWorkspaceMember, JoinPolicy, MediaLibraryItem, MediaLibraryType, SpaceApp, AvailableApp, SpaceAppDirectory, TopicRoute, AppItemRow, ItemChannels, WorkspaceMemberStatus, WorkspacePreview, WorkspaceRole } from '@lilachat/shared';
import { BASE_URL, type ChatSummary } from '../api/client';
import { jsonCall } from '../api/jsonCall';
import { subirFotoRedonda } from '../chat/fotoDeGrupo';

/** The company spaces (E1) and their channels (E2), over `/api/workspaces` (§72). */
const url = (path: string) => `${BASE_URL}/api/workspaces${path}`;
const post = (body: Record<string, unknown>) => ({ method: 'POST', body: JSON.stringify(body) });

export const mySpaces = (jwt: string) => jsonCall<{ workspaces: ClientWorkspace[] }>(url(''), jwt);
export const previewSpace = (jwt: string, code: string) => jsonCall<WorkspacePreview>(url(`/preview/${encodeURIComponent(code)}`), jwt);
export const joinSpace = (jwt: string, code: string) => jsonCall<{ workspaceId: string; status: WorkspaceMemberStatus }>(url('/join'), jwt, post({ code }));
export const createSpace = (jwt: string, input: { name: string; rubro?: string; joinPolicy: JoinPolicy }) => jsonCall<{ workspace: ClientWorkspace }>(url(''), jwt, post(input));
export const addToSpace = (jwt: string, spaceId: string, phone: string) => jsonCall<{ member: { id: string; status: WorkspaceMemberStatus } }>(url(`/${spaceId}/members`), jwt, post({ phone }));
/** A company invites by email (22/10): `active` if a verified account owns it, otherwise `invited` until that email is verified. */
export const inviteToSpaceByEmail = (jwt: string, spaceId: string, email: string) => jsonCall<{ id: string; email: string; status: 'active' | 'invited' }>(url(`/${spaceId}/invites`), jwt, post({ email }));

export const spaceChannels = (jwt: string, spaceId: string) => jsonCall<{ channels: ClientChannel[] }>(url(`/${spaceId}/channels`), jwt);
export const createChannel = (jwt: string, spaceId: string, input: { name: string; descripcion?: string; visibility: 'public' | 'private' }) => jsonCall<{ channel: ClientChannel }>(url(`/${spaceId}/channels`), jwt, post(input));
export const joinChannel = (jwt: string, spaceId: string, chatId: string) => jsonCall<{ channel: ClientChannel }>(url(`/${spaceId}/channels/${chatId}/join`), jwt, post({}));

/** The chats of a space; each one carries its space, so it opens in the Slack format. */
export async function spaceChats(jwt: string, spaceId: string) {
  const result = await jsonCall<{ chats: ChatSummary[]; activity?: { mentions: number; threads: number } }>(`${BASE_URL}/api/chats?workspace=${spaceId}`, jwt);
  return result.ok ? { ...result, data: { chats: result.data.chats.map((chat) => ({ ...chat, workspaceId: spaceId })), activity: result.data.activity } } : result;
}
/** Leave a space, or withdraw a request still waiting («Cancelar solicitud», design `e1-03`). */
export const leaveSpace = (jwt: string, spaceId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/leave`), jwt, post({}));

/** The people of a space (designs `e1-08`, `e1-10`, `e1-11`): active for everyone; pending and deactivated for admins. */
export const spaceMembers = (jwt: string, spaceId: string, status: 'active' | 'pending' | 'invited' | 'deactivated' | 'all' = 'active') =>
  jsonCall<{ members: ClientWorkspaceMember[] }>(url(`/${spaceId}/members?status=${status}`), jwt);
/** Approve (with area and title), change the role, deactivate or reactivate. */
export const changeMember = (jwt: string, spaceId: string, memberId: string, change: { status?: 'active' | 'deactivated'; role?: WorkspaceRole; title?: string; area?: string }) =>
  jsonCall<{ member: ClientWorkspaceMember }>(url(`/${spaceId}/members/${memberId}`), jwt, { method: 'PATCH', body: JSON.stringify(change) });
/** «Rechazar» a request: it goes away (design `e1-11`). */
export const rejectRequest = (jwt: string, spaceId: string, memberId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/members/${memberId}`), jwt, { method: 'DELETE' });
/** Withdraws an email invitation (22/10). */
export const revokeSpaceInvite = (jwt: string, spaceId: string, inviteId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/invites/${inviteId}`), jwt, { method: 'DELETE' });
/** «Ajustes del espacio» (design `e1-12`): name, trade, approval, and a new code. */
export const updateSpace = (jwt: string, spaceId: string, change: { name?: string; rubro?: string; joinPolicy?: JoinPolicy; newCode?: boolean }) =>
  jsonCall<{ workspace: ClientWorkspace }>(url(`/${spaceId}`), jwt, { method: 'PATCH', body: JSON.stringify(change) });
/** A 1:1 or a group INSIDE the space, among its active members (the server checks it). */
export const createSpaceChat = (jwt: string, spaceId: string, body: { kind: 'direct' | 'group'; memberIds: string[]; name?: string }) =>
  jsonCall<{ chatId: string }>(`${BASE_URL}/api/chats`, jwt, post({ ...body, workspaceId: spaceId }));

/** «Medios» (pending 38): photos, videos, documents or links of the personal chats, or of a space. */
export function mediaLibrary(jwt: string, params: { type: MediaLibraryType; spaceId?: string | null; before?: string }) {
  const query = new URLSearchParams({ type: params.type, ...(params.spaceId ? { workspace: params.spaceId } : {}), ...(params.before ? { before: params.before } : {}) });
  return jsonCall<{ items: MediaLibraryItem[]; hasMore: boolean }>(`${BASE_URL}/api/media/library?${query}`, jwt);
}

/** A chat of the space by its id, to open it from outside its list (a link in «Medios»). */
export async function findSpaceChat(jwt: string, spaceId: string, chatId: string): Promise<ChatSummary | null> {
  const response = await spaceChats(jwt, spaceId);
  return response.ok ? (response.data.chats.find((chat) => chat.id === chatId) ?? null) : null;
}

/** «Menciones y actividad» (design e-19): one tab of a space, or only the counts for the list's chips. */
export function spaceActivity(jwt: string, spaceId: string, params: { type?: ActivityType; countsOnly?: boolean } = {}) {
  const query = new URLSearchParams({ workspace: spaceId, ...(params.type ? { type: params.type } : {}), ...(params.countsOnly ? { counts: '1' } : {}) });
  return jsonCall<{ items: ActivityItem[]; unread: { mentions: number; threads: number } }>(`${BASE_URL}/api/activity?${query}`, jwt);
}

/** The space's logo (design e1-12): uploaded like a group photo; taking it away brings the initials back. */
/** A photo picked on the phone, as the round-photo upload takes it. */
type PickedPhoto = Parameters<typeof subirFotoRedonda>[0]['foto'];

export async function uploadSpaceLogo(jwt: string, spaceId: string, photo: PickedPhoto): Promise<{ ok: true; workspace: ClientWorkspace } | { ok: false; message: string }> {
  const sent = await subirFotoRedonda({ url: url(`/${spaceId}/logo`), jwt, foto: photo });
  if (!sent.ok) return { ok: false, message: sent.motivo };
  return { ok: true, workspace: sent.payload.workspace as ClientWorkspace };
}
export const removeSpaceLogo = (jwt: string, spaceId: string) => jsonCall<{ workspace: ClientWorkspace }>(url(`/${spaceId}/logo`), jwt, { method: 'DELETE' });
/** Integraciones (`specs/BOTS-API.spec.md`): the space's installed apps, and uninstalling one. */
export const spaceApps = (jwt: string, spaceId: string) => jsonCall<{ apps: SpaceApp[] }>(url(`/${spaceId}/apps`), jwt);
export const availableApps = (jwt: string, spaceId: string) => jsonCall<{ apps: AvailableApp[] }>(url(`/${spaceId}/available-apps`), jwt);
/** The «Apps» section (23/10): installed for everyone, to add for admins; and the 1:1 with an app's bot. */
export const appDirectory = (jwt: string, spaceId: string) => jsonCall<SpaceAppDirectory>(url(`/${spaceId}/app-directory`), jwt);
export const openAppChat = (jwt: string, spaceId: string, appId: string) => jsonCall<{ chatId: string; botUserId: string }>(url(`/${spaceId}/apps/${appId}/chat`), jwt, post({}));
export const uninstallApp = (jwt: string, spaceId: string, installationId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/apps/${installationId}`), jwt, { method: 'DELETE' });

/** «¿Dónde llega cada aviso?» (R160): the app's topics with their channel, and the space's channels to pick from. */
export type AppTopics = { topics: TopicRoute[]; channels: { id: string; name: string; private: boolean }[]; canEdit: boolean };
export const appTopics = (jwt: string, spaceId: string, appId: string) => jsonCall<AppTopics>(url(`/${spaceId}/apps/${appId}/topics`), jwt);
export const saveAppTopics = (jwt: string, spaceId: string, appId: string, channels: Record<string, string | null>) => jsonCall<AppTopics>(url(`/${spaceId}/apps/${appId}/topics`), jwt, { method: 'PUT', body: JSON.stringify({ channels }) });
export const testAppTopics = (jwt: string, spaceId: string, appId: string) => jsonCall<{ channels: number }>(url(`/${spaceId}/apps/${appId}/topics/test`), jwt, post({}));

/** «Conectado como … / Desconectar» (pending 59): MY account in this app, asked to the app each time. */
export const appLink = (jwt: string, spaceId: string, appId: string) => jsonCall<AppLink>(url(`/${spaceId}/apps/${appId}/link`), jwt);
export const unlinkApp = (jwt: string, spaceId: string, appId: string) => jsonCall<Record<string, never>>(url(`/${spaceId}/apps/${appId}/link`), jwt, { method: 'DELETE' });

/** «Comandos y acciones» (R160): where each command and action of the app works. */
export type AppItems = { items: AppItemRow[]; channels: { id: string; name: string; private: boolean }[]; canEdit: boolean };
export const appItems = (jwt: string, spaceId: string, appId: string) => jsonCall<AppItems>(url(`/${spaceId}/apps/${appId}/items`), jwt);
export const saveAppItems = (jwt: string, spaceId: string, appId: string, items: Record<string, { global: boolean; channels: ItemChannels }>) => jsonCall<AppItems>(url(`/${spaceId}/apps/${appId}/items`), jwt, { method: 'PUT', body: JSON.stringify({ items }) });
