import { describe, expect, it } from 'vitest';
import { drawsAsCard, drawsAsFunLine, type Row } from './rowKinds';

const row = (extra: Record<string, unknown>): Row => ({ chatId: 'c1', seq: 5, senderId: 'ana', clientKey: 'k5', kind: 'text', at: '2026-10-22T19:00:00.000Z', ...extra }) as Row;

describe('deleted winks, nudges and cards (22/10)', () => {
  it('a wink or a nudge is its own line while it exists', () => {
    expect(drawsAsFunLine(row({ kind: 'guino', wink: 'panda' }))).toBe(true);
    expect(drawsAsFunLine(row({ kind: 'zumbido' }))).toBe(true);
  });

  it('deleted for everyone, it is a deleted message, not the card', () => {
    // Arrange
    const deletedAt = '2026-10-22T19:12:00.000Z';
    // Act / Assert
    expect(drawsAsFunLine(row({ kind: 'guino', wink: 'panda', deletedAt }))).toBe(false);
    expect(drawsAsCard(row({ kind: 'event', ref: { tipo: 'evento', id: 'e1' }, deletedAt }))).toBe(false);
  });

  it('a poll or event card shows while its message exists', () => {
    expect(drawsAsCard(row({ kind: 'event', ref: { tipo: 'evento', id: 'e1' } }))).toBe(true);
    expect(drawsAsCard(row({ kind: 'text' }))).toBe(false);
  });
});
