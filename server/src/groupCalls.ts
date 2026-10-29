import { GROUP_CALL_MAX, joinGroupCall, leaveGroupCall, type GroupCallEnd, type GroupCallRoom } from '@lilachat/shared';

/**
 * The rooms of the group calls (pending 56, José 29/10), apart from the 1:1
 * call so that one keeps working as it is. In memory, like the ringing offers:
 * a call lives while its sockets do, and a restart ends it anyway.
 *
 * Each participant is ONE socket: the signals of a pair go to the phone that
 * joined, not to every device of that person (two of them would answer).
 */
export type GroupChatAccess = { members: string[]; isGroup: boolean; name?: string };

export type GroupCallDeps = {
  /** The chat's members when `userId` is one of them, else `null`. */
  access: (chatId: string, userId: string) => Promise<GroupChatAccess | null>;
  emitToUser: (userId: string, event: string, frame: object) => void;
  emitToSocket: (socketId: string, event: string, frame: object) => void;
  nameOf: (userId: string) => Promise<string | null>;
  /** The line in the chat when the call ends. */
  writeEnd: (chatId: string, end: GroupCallEnd, members: string[]) => Promise<void>;
  now?: () => number;
};

/** userId → name, for the tiles of the people in the room. */
export type GroupCallNames = Record<string, string>;
export type JoinAnswer = { ok: true; room: GroupCallRoom; peers: string[]; names: GroupCallNames } | { ok: false; motivo: string };
type SignalKind = 'offer' | 'answer' | 'ice';
const SIGNAL_KINDS: readonly SignalKind[] = ['offer', 'answer', 'ice'];

export function createGroupCallHub(deps: GroupCallDeps) {
  const rooms = new Map<string, GroupCallRoom>();
  /** chatId → userId → the socket that joined. */
  const sockets = new Map<string, Map<string, string>>();
  const now = () => deps.now?.() ?? Date.now();
  const knownNames = new Map<string, string>();

  async function namesOf(room: GroupCallRoom | null): Promise<GroupCallNames> {
    const names: GroupCallNames = {};
    for (const userId of room?.participants ?? []) {
      if (!knownNames.has(userId)) knownNames.set(userId, (await deps.nameOf(userId)) ?? '');
      names[userId] = knownNames.get(userId)!;
    }
    return names;
  }

  const announce = async (chatId: string, members: string[]) => {
    const room = rooms.get(chatId) ?? null;
    const names = await namesOf(room);
    for (const member of members) deps.emitToUser(member, 'groupcall.state', { chatId, room, names });
  };

  async function join(input: { socketId: string; userId: string; chatId: string; video: boolean }): Promise<JoinAnswer> {
    const access = await deps.access(input.chatId, input.userId);
    if (!access) return { ok: false, motivo: 'No eres parte de este chat.' };
    if (!access.isGroup) return { ok: false, motivo: 'Las llamadas grupales son para grupos y canales.' };
    const joined = joinGroupCall(rooms.get(input.chatId) ?? null, { chatId: input.chatId, userId: input.userId, video: input.video, now: now() });
    if (!joined.ok) return { ok: false, motivo: `La llamada está llena (${GROUP_CALL_MAX} personas).` };
    rooms.set(input.chatId, joined.room);
    const bySocket = sockets.get(input.chatId) ?? new Map<string, string>();
    bySocket.set(input.userId, input.socketId);
    sockets.set(input.chatId, bySocket);
    await announce(input.chatId, access.members);
    if (joined.created) {
      const fromName = (await namesOf(joined.room))[input.userId] || null;
      for (const member of access.members) if (member !== input.userId) deps.emitToUser(member, 'groupcall.ring', { chatId: input.chatId, chatName: access.name ?? null, from: input.userId, fromName, video: input.video });
    }
    return { ok: true, room: joined.room, peers: joined.peers, names: await namesOf(joined.room) };
  }

  async function leave(input: { socketId: string; userId: string; chatId: string }): Promise<void> {
    const room = rooms.get(input.chatId);
    // Only the socket that joined leaves: another device of the same person closing changes nothing.
    if (!room || sockets.get(input.chatId)?.get(input.userId) !== input.socketId) return;
    const left = leaveGroupCall(room, input.userId, now());
    sockets.get(input.chatId)?.delete(input.userId);
    if (left.room) rooms.set(input.chatId, left.room);
    else {
      rooms.delete(input.chatId);
      sockets.delete(input.chatId);
    }
    const access = await deps.access(input.chatId, input.userId);
    const members = access?.members ?? room.joinedEver;
    for (const peer of left.room?.participants ?? []) {
      const socketId = sockets.get(input.chatId)?.get(peer);
      if (socketId) deps.emitToSocket(socketId, 'groupcall.left', { chatId: input.chatId, userId: input.userId });
    }
    await announce(input.chatId, members);
    if (left.ended) await deps.writeEnd(input.chatId, left.ended, members);
  }

  /** An offer, answer or candidate between two people in the same room; anything else is dropped. */
  function signal(input: { userId: string; frame: unknown }): boolean {
    const frame = (input.frame ?? {}) as { chatId?: unknown; to?: unknown; kind?: unknown; data?: unknown };
    if (typeof frame.chatId !== 'string' || typeof frame.to !== 'string' || !SIGNAL_KINDS.includes(frame.kind as SignalKind)) return false;
    const room = rooms.get(frame.chatId);
    if (!room?.participants.includes(input.userId) || !room.participants.includes(frame.to)) return false;
    const socketId = sockets.get(frame.chatId)?.get(frame.to);
    if (!socketId) return false;
    deps.emitToSocket(socketId, 'groupcall.signal', { chatId: frame.chatId, from: input.userId, kind: frame.kind, data: frame.data });
    return true;
  }

  /** The room of a chat I am in (the strip «Unirse» when the chat opens). */
  async function roomOf(chatId: string, userId: string): Promise<GroupCallRoom | null> {
    return (await deps.access(chatId, userId)) ? (rooms.get(chatId) ?? null) : null;
  }

  /** The socket went away: it leaves every room it was in. */
  async function dropSocket(socketId: string, userId: string): Promise<void> {
    const chatIds = [...sockets.entries()].filter(([, bySocket]) => bySocket.get(userId) === socketId).map(([chatId]) => chatId);
    for (const chatId of chatIds) await leave({ socketId, userId, chatId });
  }

  return { join, leave, signal, roomOf, dropSocket };
}

export type GroupCallHub = ReturnType<typeof createGroupCallHub>;
