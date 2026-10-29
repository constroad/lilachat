/**
 * Calls in a group (pending 56, José 29/10): a mesh, every phone talks to every
 * other, so it stays small — four at most. One room per group chat; who joins
 * gets the ones already there and sends an offer to each, so two phones never
 * offer to each other at once. PURE: the server keeps the rooms, the apps draw them.
 */
export const GROUP_CALL_MAX = 4;

export type GroupCallRoom = {
  chatId: string;
  video: boolean;
  startedAt: number;
  startedBy: string;
  participants: string[];
  /** Everyone who was in it at some point: the line at the end says how many. */
  joinedEver: string[];
};

export type GroupCallJoin =
  | { ok: true; room: GroupCallRoom; created: boolean; peers: string[] }
  | { ok: false; reason: 'full' };

export function joinGroupCall(room: GroupCallRoom | null, input: { chatId: string; userId: string; video: boolean; now: number }): GroupCallJoin {
  if (!room) {
    const created = { chatId: input.chatId, video: input.video, startedAt: input.now, startedBy: input.userId, participants: [input.userId], joinedEver: [input.userId] };
    return { ok: true, room: created, created: true, peers: [] };
  }
  const peers = room.participants.filter((userId) => userId !== input.userId);
  if (room.participants.includes(input.userId)) return { ok: true, room, created: false, peers };
  if (room.participants.length >= GROUP_CALL_MAX) return { ok: false, reason: 'full' };
  const joinedEver = room.joinedEver.includes(input.userId) ? room.joinedEver : [...room.joinedEver, input.userId];
  return { ok: true, room: { ...room, participants: [...room.participants, input.userId], joinedEver }, created: false, peers };
}

export type GroupCallEnd = { seconds: number; people: number; video: boolean; startedBy: string };

/** Someone left: the room goes on, or it ends when nobody is left. */
export function leaveGroupCall(room: GroupCallRoom, userId: string, now: number): { room: GroupCallRoom | null; ended: GroupCallEnd | null } {
  if (!room.participants.includes(userId)) return { room, ended: null };
  const participants = room.participants.filter((one) => one !== userId);
  if (participants.length > 0) return { room: { ...room, participants }, ended: null };
  return { room: null, ended: { seconds: Math.max(0, Math.floor((now - room.startedAt) / 1000)), people: room.joinedEver.length, video: room.video, startedBy: room.startedBy } };
}

/** The tiles of the call screen: one or two stacked, three or four in a 2×2 grid. */
export function gridOf(tiles: number): { columns: number; rows: number } {
  if (tiles <= 1) return { columns: 1, rows: 1 };
  if (tiles === 2) return { columns: 1, rows: 2 };
  return { columns: 2, rows: 2 };
}

/** The strip over a group chat while its call goes on. */
export function groupCallBanner(room: GroupCallRoom | null, me: string): { text: string; canJoin: boolean } | null {
  if (!room || room.participants.length === 0) return null;
  const full = room.participants.length >= GROUP_CALL_MAX;
  const count = room.participants.length;
  const text = `${room.video ? 'Videollamada' : 'Llamada'} en curso · ${count} ${count === 1 ? 'persona' : 'personas'}${full ? ' (llena)' : ''}`;
  return { text, canJoin: !full && !room.participants.includes(me) };
}
