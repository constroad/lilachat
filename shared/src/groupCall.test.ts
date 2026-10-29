import { describe, expect, it } from 'vitest';
import { GROUP_CALL_MAX, gridOf, groupCallBanner, joinGroupCall, leaveGroupCall, type GroupCallRoom } from './groupCall.js';

/** Pending 56 (José, 29/10): calls in a group, a mesh of up to four. */
describe('joinGroupCall', () => {
  it('the first one opens the room; the next ones get who is already there, to offer to each', () => {
    // Act
    const first = joinGroupCall(null, { chatId: 'c1', userId: 'a', video: true, now: 1000 });
    const second = first.ok ? joinGroupCall(first.room, { chatId: 'c1', userId: 'b', video: false, now: 2000 }) : first;
    // Assert
    expect(first).toMatchObject({ ok: true, created: true, peers: [], room: { participants: ['a'], video: true, startedAt: 1000, startedBy: 'a' } });
    expect(second).toMatchObject({ ok: true, created: false, peers: ['a'], room: { participants: ['a', 'b'], video: true } });
  });

  it('joining again does not duplicate; a fifth person is refused', () => {
    let room: GroupCallRoom | null = null;
    for (const userId of ['a', 'b', 'c', 'd']) {
      const result = joinGroupCall(room, { chatId: 'c1', userId, video: true, now: 1 });
      if (result.ok) room = result.room;
    }
    const again = joinGroupCall(room, { chatId: 'c1', userId: 'b', video: true, now: 2 });
    const fifth = joinGroupCall(room, { chatId: 'c1', userId: 'e', video: true, now: 2 });
    expect(room?.participants).toHaveLength(GROUP_CALL_MAX);
    expect(again).toMatchObject({ ok: true, peers: ['a', 'c', 'd'], room: { participants: ['a', 'b', 'c', 'd'] } });
    expect(fifth).toEqual({ ok: false, reason: 'full' });
  });
});

describe('leaveGroupCall', () => {
  it('the room goes on while someone is in it, and ends with its length and how many joined', () => {
    // Arrange
    const room: GroupCallRoom = { chatId: 'c1', video: false, startedAt: 0, startedBy: 'a', participants: ['a', 'b'], joinedEver: ['a', 'b', 'c'] };
    // Act
    const one = leaveGroupCall(room, 'a', 30_000);
    const last = one.room ? leaveGroupCall(one.room, 'b', 95_500) : one;
    const stranger = leaveGroupCall(room, 'z', 1);
    // Assert
    expect(one).toEqual({ room: { ...room, participants: ['b'] }, ended: null });
    expect(last).toEqual({ room: null, ended: { seconds: 95, people: 3, video: false, startedBy: 'a' } });
    expect(stranger).toEqual({ room, ended: null });
  });
});

describe('gridOf and groupCallBanner', () => {
  it('one or two tiles go stacked, three and four in two columns', () => {
    expect([1, 2, 3, 4].map(gridOf)).toEqual([{ columns: 1, rows: 1 }, { columns: 1, rows: 2 }, { columns: 2, rows: 2 }, { columns: 2, rows: 2 }]);
  });

  it('says how many are in it and whether I can still join', () => {
    const room: GroupCallRoom = { chatId: 'c1', video: true, startedAt: 0, startedBy: 'a', participants: ['a', 'b'], joinedEver: ['a', 'b'] };
    expect(groupCallBanner(room, 'c')).toEqual({ text: 'Videollamada en curso · 2 personas', canJoin: true });
    expect(groupCallBanner(room, 'a')).toEqual({ text: 'Videollamada en curso · 2 personas', canJoin: false });
    expect(groupCallBanner({ ...room, video: false, participants: ['a', 'b', 'c', 'd'] }, 'e')).toEqual({ text: 'Llamada en curso · 4 personas (llena)', canJoin: false });
    expect(groupCallBanner(null, 'a')).toBeNull();
  });
});
