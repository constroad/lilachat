import { describe, expect, it } from 'vitest';
import type { GroupCallEnd } from '@lilachat/shared';
import { createGroupCallHub, type GroupChatAccess } from './groupCalls.js';

/** Pending 56 (José, 29/10): group calls, a mesh of up to four, apart from the 1:1 call. */
function setup(chats: Record<string, GroupChatAccess> = { g1: { members: ['a', 'b', 'c', 'd', 'e'], isGroup: true, name: 'obra-km-12' }, d1: { members: ['a', 'b'], isGroup: false } }) {
  const toUser: { userId: string; event: string; frame: Record<string, unknown> }[] = [];
  const toSocket: { socketId: string; event: string; frame: Record<string, unknown> }[] = [];
  const ends: { chatId: string; end: GroupCallEnd }[] = [];
  let clock = 1_000;
  const hub = createGroupCallHub({
    access: async (chatId, userId) => (chats[chatId]?.members.includes(userId) ? chats[chatId]! : null),
    emitToUser: (userId, event, frame) => toUser.push({ userId, event, frame: frame as Record<string, unknown> }),
    emitToSocket: (socketId, event, frame) => toSocket.push({ socketId, event, frame: frame as Record<string, unknown> }),
    nameOf: async (userId) => `Nombre ${userId}`,
    writeEnd: async (chatId, end) => void ends.push({ chatId, end }),
    now: () => clock,
  });
  return { hub, toUser, toSocket, ends, tick: (ms: number) => (clock += ms) };
}

describe('joining a group call', () => {
  it('the first rings the others and everyone in the chat learns the room; the second gets the first to offer to', async () => {
    // Arrange
    const { hub, toUser } = setup();
    // Act
    const first = await hub.join({ socketId: 's-a', userId: 'a', chatId: 'g1', video: true });
    const second = await hub.join({ socketId: 's-b', userId: 'b', chatId: 'g1', video: true });
    // Assert
    expect(first).toMatchObject({ ok: true, peers: [] });
    expect(second).toMatchObject({ ok: true, peers: ['a'], room: { participants: ['a', 'b'] } });
    const rings = toUser.filter((one) => one.event === 'groupcall.ring');
    expect(rings.map((one) => one.userId)).toEqual(['b', 'c', 'd', 'e']);
    // The ring names the channel: a phone only knows the names of its personal chats.
    expect(rings[0]!.frame).toMatchObject({ chatId: 'g1', chatName: 'obra-km-12', from: 'a', fromName: 'Nombre a', video: true });
    expect(toUser.filter((one) => one.event === 'groupcall.state')).toHaveLength(10);
    // The tiles show who is in the call: the room travels with their names.
    expect(toUser.filter((one) => one.event === 'groupcall.state').at(-1)!.frame).toMatchObject({ names: { a: 'Nombre a', b: 'Nombre b' } });
    expect(second).toMatchObject({ names: { a: 'Nombre a', b: 'Nombre b' } });
  });

  it('refuses a stranger, a 1:1 chat and a fifth person', async () => {
    const { hub } = setup();
    for (const userId of ['a', 'b', 'c', 'd']) await hub.join({ socketId: `s-${userId}`, userId, chatId: 'g1', video: false });
    expect(await hub.join({ socketId: 's-z', userId: 'z', chatId: 'g1', video: false })).toEqual({ ok: false, motivo: 'No eres parte de este chat.' });
    expect(await hub.join({ socketId: 's-a', userId: 'a', chatId: 'd1', video: false })).toMatchObject({ ok: false });
    expect(await hub.join({ socketId: 's-e', userId: 'e', chatId: 'g1', video: false })).toEqual({ ok: false, motivo: 'La llamada está llena (4 personas).' });
  });
});

describe('signals and leaving', () => {
  it('a signal goes only to the socket of someone in the room; not to strangers or other devices', async () => {
    // Arrange
    const { hub, toSocket } = setup();
    await hub.join({ socketId: 's-a', userId: 'a', chatId: 'g1', video: true });
    await hub.join({ socketId: 's-b', userId: 'b', chatId: 'g1', video: true });
    // Act
    const sent = hub.signal({ userId: 'b', frame: { chatId: 'g1', to: 'a', kind: 'offer', data: { sdp: 'x' } } });
    const toOutsider = hub.signal({ userId: 'b', frame: { chatId: 'g1', to: 'c', kind: 'offer', data: {} } });
    const fromOutsider = hub.signal({ userId: 'c', frame: { chatId: 'g1', to: 'a', kind: 'ice', data: {} } });
    const badKind = hub.signal({ userId: 'b', frame: { chatId: 'g1', to: 'a', kind: 'hack', data: {} } });
    // Assert
    expect([sent, toOutsider, fromOutsider, badKind]).toEqual([true, false, false, false]);
    expect(toSocket).toEqual([{ socketId: 's-a', event: 'groupcall.signal', frame: { chatId: 'g1', from: 'b', kind: 'offer', data: { sdp: 'x' } } }]);
  });

  it('leaving tells the ones left; the last one out ends it with its length and the line', async () => {
    // Arrange
    const { hub, toSocket, ends, tick } = setup();
    for (const userId of ['a', 'b', 'c']) await hub.join({ socketId: `s-${userId}`, userId, chatId: 'g1', video: false });
    // Act
    tick(65_000);
    await hub.leave({ socketId: 's-a', userId: 'a', chatId: 'g1' });
    await hub.dropSocket('s-b', 'b');
    const roomBefore = await hub.roomOf('g1', 'c');
    await hub.leave({ socketId: 's-c', userId: 'c', chatId: 'g1' });
    // Assert
    expect(toSocket.filter((one) => one.event === 'groupcall.left').map((one) => one.socketId)).toEqual(['s-b', 's-c', 's-c']);
    expect(roomBefore?.participants).toEqual(['c']);
    expect(ends).toEqual([{ chatId: 'g1', end: { seconds: 65, people: 3, video: false, startedBy: 'a' } }]);
    expect(await hub.roomOf('g1', 'c')).toBeNull();
  });

  it('another device of the same person leaving does not take them out', async () => {
    const { hub } = setup();
    await hub.join({ socketId: 's-a', userId: 'a', chatId: 'g1', video: false });
    await hub.leave({ socketId: 's-a-tablet', userId: 'a', chatId: 'g1' });
    await hub.dropSocket('s-a-tablet', 'a');
    expect((await hub.roomOf('g1', 'a'))?.participants).toEqual(['a']);
  });
});

describe('winks and stickers in a group call (pending 4)', () => {
  it('go to the sockets of the others in the room, never to the chat members outside it nor back to the sender', async () => {
    // Arrange
    const { hub, toSocket } = setup();
    await hub.join({ socketId: 's-a', userId: 'a', chatId: 'g1', video: true });
    await hub.join({ socketId: 's-b', userId: 'b', chatId: 'g1', video: true });
    await hub.join({ socketId: 's-c', userId: 'c', chatId: 'g1', video: true });
    toSocket.length = 0;
    // Act
    const relayed = hub.relay({ userId: 'b', chatId: 'g1', event: 'groupcall.reaction', frame: { reaction: { kind: 'emoji', id: '😂' }, key: 'k-1' } });
    // Assert
    expect(relayed).toBe(true);
    expect(toSocket.map((one) => one.socketId)).toEqual(['s-a', 's-c']);
    expect(toSocket[0]).toMatchObject({ event: 'groupcall.reaction', frame: { chatId: 'g1', from: 'b', reaction: { kind: 'emoji', id: '😂' }, key: 'k-1' } });
  });

  it('someone outside the room, or a chat without a call, relays nothing', async () => {
    const { hub, toSocket } = setup();
    await hub.join({ socketId: 's-a', userId: 'a', chatId: 'g1', video: false });
    toSocket.length = 0;
    expect(hub.relay({ userId: 'd', chatId: 'g1', event: 'groupcall.reaction', frame: {} })).toBe(false);
    expect(hub.relay({ userId: 'a', chatId: 'd1', event: 'groupcall.reaction', frame: {} })).toBe(false);
    expect(toSocket).toEqual([]);
  });
});

