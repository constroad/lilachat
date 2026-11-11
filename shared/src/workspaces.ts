/**
 * Company spaces (E1, spec §66): one personal account per person, plus the
 * spaces of the companies they belong to. Pure rules shared by the server and
 * the clients.
 */
import { isRealPhone } from './phone.js';

export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'guest';
export type WorkspaceMemberStatus = 'active' | 'pending' | 'invited' | 'deactivated';
export type JoinPolicy = 'open' | 'approval';

/** No 0/O, 1/I/L: the code is read aloud and typed from a WhatsApp message. */
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_PATTERN = /^([A-Z]{4})-?([A-Z0-9]{4})$/;
const PREFIX_LENGTH = 4;
const RANDOM_LENGTH = 4;

export function joinCodePrefix(name: string): string {
  const letters = name.normalize('NFD').replace(/\p{M}/gu, '').toUpperCase().replace(/[^A-Z]/g, '');
  return letters.slice(0, PREFIX_LENGTH).padEnd(PREFIX_LENGTH, 'X');
}

export function makeJoinCode(name: string, random: () => number = Math.random): string {
  let tail = '';
  for (let index = 0; index < RANDOM_LENGTH; index += 1) tail += CODE_ALPHABET[Math.floor(random() * CODE_ALPHABET.length) % CODE_ALPHABET.length];
  return `${joinCodePrefix(name)}-${tail}`;
}

/** What the person typed or pasted (with spaces, lower case, or the whole link) as `CONS-7K3P`, or `null`. */
export function normalizeJoinCode(input: string): string | null {
  const lastPart = input.trim().split('/').pop() ?? '';
  const compact = lastPart.toUpperCase().replace(/\s+/g, '');
  const match = CODE_PATTERN.exec(compact);
  return match ? `${match[1]}-${match[2]}` : null;
}

export const canManageMembers = (role: WorkspaceRole): boolean => role === 'owner' || role === 'admin';

/** Only the owner deletes a space (José 10/11), like Slack's primary owner. */
export const canDeleteSpace = (role: WorkspaceRole): boolean => role === 'owner';

const foldName = (text: string) => text.normalize('NFD').replace(/\p{M}/gu, '').trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');

/** The typed name confirms the deletion: the same letters, not minding case, accents or extra spaces. */
export function confirmsSpaceName(typed: unknown, name: string): boolean {
  if (typeof typed !== 'string') return false;
  const folded = foldName(typed);
  return folded !== '' && folded === foldName(name);
}

/** Only the owner names admins; the owner's role never changes here (transferring it is its own action). */
export function canChangeRole(params: { actor: WorkspaceRole; target: WorkspaceRole; to: WorkspaceRole }): boolean {
  const { actor, target, to } = params;
  if (target === 'owner' || to === 'owner' || !canManageMembers(actor)) return false;
  if (actor === 'admin') return target !== 'admin' && to !== 'admin';
  return true;
}

export function canDeactivate(params: { actor: WorkspaceRole; target: WorkspaceRole }): boolean {
  if (params.target === 'owner' || !canManageMembers(params.actor)) return false;
  return params.actor === 'owner' || params.target === 'member' || params.target === 'guest';
}

export const statusAfterJoin = (policy: JoinPolicy): WorkspaceMemberStatus => (policy === 'open' ? 'active' : 'pending');

/** E2: channel visibility in a space. Public = anyone in the space finds it and joins. */
export type ChannelVisibility = 'public' | 'private';
const CHANNEL_NAME_MAX = 40;
const CHANNEL_NAME_MIN = 2;

/** «Obra Surco» → `obra-surco`, like Slack: lower case, dashes, no accents. `null` if nothing usable is left. */
export function normalizeChannelName(input: string): string | null {
  const slug = input
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, CHANNEL_NAME_MAX)
    .replace(/-+$/g, '');
  return slug.length >= CHANNEL_NAME_MIN ? slug : null;
}

/** A space as my spaces list returns it (`GET /api/workspaces`): the switcher reads members and unread chats (design `e1-06`). */
export type ClientWorkspace = {
  id: string;
  name: string;
  rubro?: string;
  logoUrl?: string;
  joinPolicy: JoinPolicy;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  /** Only for those who can invite. */
  joinCode?: string;
  /** Pushes to whoever gets a task and two hours before it is due (José 06/11); born off. */
  taskNotices?: boolean;
  members: number;
  unreadChats: number;
  /** For those who approve: requests waiting (design `e1-11`). */
  pendingRequests?: number;
  /** Someone else added me (design `e1-13`, «José Zamora te agregó a CONSTROAD»). */
  addedBy?: { name?: string; phone: string };
  /** Without access: who to talk to (design `e1-14`). */
  admins?: { userId: string; name?: string; phone: string }[];
};

/**
 * The list out of a `GET /api/workspaces` answer, or `null` when the body is not it.
 * A 2xx that is not JSON (an HTML page on the way) parses to `{}`: trusting it left
 * the spaces `undefined` and the whole app on «Algo se rompió» (01/11, 8 reports).
 */
export function workspacesOf(body: unknown): ClientWorkspace[] | null {
  const list = (body as { workspaces?: unknown } | null)?.workspaces;
  return Array.isArray(list) ? (list as ClientWorkspace[]) : null;
}

/** A person of a space as `GET /api/workspaces/:id/members` returns it. */
export type ClientWorkspaceMember = {
  id: string;
  userId?: string;
  name?: string;
  avatarUrl?: string;
  /** Missing on an email invitation (22/10): that one carries `email` until the person verifies it. */
  phone?: string;
  email?: string;
  role: WorkspaceRole;
  status: WorkspaceMemberStatus;
  title?: string;
  area?: string;
  joinedAt?: string;
  requestedAt?: string;
};

/** What a code shows before joining (`GET /api/workspaces/preview/:code`). */
/** What «Tus espacios» offers to open (design i-03): a request still waiting or a removed access do not open. */
export const spacesToOpen = <Space extends Pick<ClientWorkspace, 'status'>>(spaces: Space[]): Space[] => spaces.filter((space) => space.status === 'active');

/** Only an account born from an email writes its name in «Crea tu usuario» (design i-04); a phone account has its own form. */
export const owesItsName = (account: { name?: string | null; phone: string }): boolean => !isRealPhone(account.phone) && !account.name?.trim();

/** The stored credential can be older than the account (Medaly 09/11): only the account's own `missing` decides. `null`: it could not be read, so ask. */
export const accountOwesItsName = (credential: { name?: string | null; phone: string }, account: { missing: readonly string[] } | null): boolean =>
  owesItsName(credential) && (account === null || account.missing.includes('name'));

export const invitedByLine = (invitation: Pick<SpaceInvitation, 'invitedBy'>): string => (invitation.invitedBy ? `Te invitó ${invitation.invitedBy}` : 'Te invitaron a este espacio');

/** «0:42», as design `i-02` writes the wait to ask for the code again. */
export const countdownLabel = (seconds: number): string => `${Math.floor(seconds / 60)}:${String(seconds % 60).padStart(2, '0')}`;

/** An email invitation waiting for «Unirme» (design i-03). */
export type SpaceInvitation = { id: string; workspace: { id: string; name: string; logoUrl?: string }; invitedBy: string | null };

export type WorkspacePreview = { id: string; name: string; rubro?: string; logoUrl?: string; members: number; joinPolicy: JoinPolicy };

/** A channel of a space as exploring lists it (design `e2-15-explorar-canales`). */
export type ClientChannel = { id: string; name: string; descripcion?: string; visibility: ChannelVisibility; members: number; joined: boolean };
