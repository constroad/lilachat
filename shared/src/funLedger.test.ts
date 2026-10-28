import { describe, expect, it } from 'vitest';
import { FUN_LEDGER_MAX, funPlayedFloor, funToPlayInRow, parseFunLedger, recordFunPlayed, serializeFunLedger, type FunLedger } from './funLedger.js';

const NOW = Date.parse('2026-10-28T15:00:00.000Z');
const secondsAgo = (seconds: number) => new Date(NOW - seconds * 1000).toISOString();

describe('the fun ledger: what this device already played (pending 107, José 28/10)', () => {
  it('the floor is the higher of what I read and what already played here', () => {
    // Arrange
    const ledger: FunLedger = { lokillos: { seq: 40, at: NOW } };
    // Act
    const behindCursor = funPlayedFloor(ledger, 'lokillos', 35);
    const aheadCursor = funPlayedFloor(ledger, 'lokillos', 52);
    const unknownChat = funPlayedFloor(ledger, 'otro', 7);
    // Assert
    expect([behindCursor, aheadCursor, unknownChat]).toEqual([40, 52, 7]);
  });

  it('records only forward, and returns the same ledger when nothing changes', () => {
    // Arrange
    const ledger = recordFunPlayed({}, 'lokillos', 40, NOW);
    // Act
    const same = recordFunPlayed(ledger, 'lokillos', 38, NOW + 1);
    const ahead = recordFunPlayed(ledger, 'lokillos', 41, NOW + 2);
    // Assert
    expect(same).toBe(ledger);
    expect(ahead.lokillos).toEqual({ seq: 41, at: NOW + 2 });
  });

  it('keeps at most FUN_LEDGER_MAX chats, dropping the ones played longest ago', () => {
    // Arrange
    let ledger: FunLedger = {};
    for (let index = 0; index < FUN_LEDGER_MAX; index += 1) ledger = recordFunPlayed(ledger, `chat${index}`, 1, NOW + index);
    // Act
    ledger = recordFunPlayed(ledger, 'nuevo', 1, NOW + FUN_LEDGER_MAX);
    // Assert
    expect(Object.keys(ledger)).toHaveLength(FUN_LEDGER_MAX);
    expect(ledger.chat0).toBeUndefined();
    expect(ledger.nuevo).toEqual({ seq: 1, at: NOW + FUN_LEDGER_MAX });
  });

  it('survives what storage gives back: empty, broken or with junk entries', () => {
    // Arrange
    const stored = serializeFunLedger({ lokillos: { seq: 40, at: NOW } });
    // Act
    const read = parseFunLedger(stored);
    const broken = [parseFunLedger(null), parseFunLedger('{nope'), parseFunLedger('[1,2]'), parseFunLedger('{"a":{"seq":"x"},"b":{"seq":3,"at":5}}')];
    // Assert
    expect(read).toEqual({ lokillos: { seq: 40, at: NOW } });
    expect(broken).toEqual([{}, {}, {}, { b: { seq: 3, at: 5 } }]);
  });
});

describe('a row of the chat list plays a nudge or wink only when it is live (pending 107)', () => {
  const nudge = { seq: 8, kind: 'zumbido', senderId: 'lila', at: secondsAgo(3) };

  it('a nudge or wink someone just sent', () => {
    expect(funToPlayInRow({ last: nudge, me: 'jose', playedSeq: 7, now: NOW })).toBe('zumbido');
    expect(funToPlayInRow({ last: { ...nudge, kind: 'guino' }, me: 'jose', playedSeq: 0, now: NOW })).toBe('guino');
  });

  it('not an old one: coming back to the app or reopening it does not replay it', () => {
    // Lila's nudge to «Lokillos», read and left: the list reloads it a minute later.
    expect(funToPlayInRow({ last: { ...nudge, at: secondsAgo(60) }, me: 'jose', playedSeq: 0, now: NOW })).toBeNull();
  });

  it('not one already played here, not mine, not a text, not deleted', () => {
    expect(funToPlayInRow({ last: nudge, me: 'jose', playedSeq: 8, now: NOW })).toBeNull();
    expect(funToPlayInRow({ last: { ...nudge, senderId: 'jose' }, me: 'jose', playedSeq: 0, now: NOW })).toBeNull();
    expect(funToPlayInRow({ last: { ...nudge, kind: 'text' }, me: 'jose', playedSeq: 0, now: NOW })).toBeNull();
    expect(funToPlayInRow({ last: { ...nudge, deletedAt: secondsAgo(1) }, me: 'jose', playedSeq: 0, now: NOW })).toBeNull();
    expect(funToPlayInRow({ last: null, me: 'jose', playedSeq: 0, now: NOW })).toBeNull();
  });

  it('a phone clock a little ahead of the server still counts as live', () => {
    expect(funToPlayInRow({ last: { ...nudge, at: new Date(NOW + 5000).toISOString() }, me: 'jose', playedSeq: 0, now: NOW })).toBe('zumbido');
  });
});
