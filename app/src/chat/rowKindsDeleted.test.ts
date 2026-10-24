import { describe, expect, it } from 'vitest';
import { drawsAsCard, drawsAsFunLine, hasBotCard, type Row } from './rowKinds';

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

describe('a bot card is a block of its own (24/10)', () => {
  const card = { title: 'Asistencia · Hoy' };

  it('a row with a card is a bot card; plain text and a pending row are not', () => {
    expect(hasBotCard(row({ card }))).toBe(true);
    expect(hasBotCard(row({ kind: 'text' }))).toBe(false);
    expect(hasBotCard({ pending: true, clientKey: 'k1', queuedAt: '2026-10-24T09:00:00.000Z' } as Row)).toBe(false);
  });

  it('deleted for everyone, it reads as a deleted message and groups like one', () => {
    expect(hasBotCard(row({ card, deletedAt: '2026-10-24T09:12:00.000Z' }))).toBe(false);
  });
});
