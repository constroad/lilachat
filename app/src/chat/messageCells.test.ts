import { describe, expect, it } from 'vitest';
import { buildMessageCells, cellKey, cellType, keepCells, type CellContext, type MessageCell } from './messageCells';
import type { Row } from './rowKinds';
import type { ChatMessage, PendingMessage } from './useChat';

const ME = '6a0f1c2d3e4f5a6b7c8d9e01';
const OTHER = '6a0f1c2d3e4f5a6b7c8d9e02';

const message = (seq: number, changes: Partial<ChatMessage> = {}): ChatMessage =>
  ({ _id: `m${seq}`, chatId: '6adbb02ec9d066b069307eb6', seq, senderId: OTHER, clientKey: `ck-${seq}`, kind: 'text', body: `m${seq}`, at: '2026-11-03T07:50:00.000Z', ...changes }) as ChatMessage;

const pending = (clientKey: string): PendingMessage => ({ clientKey, body: 'F4', queuedAt: '2026-11-03T07:51:00.000Z', pending: true });

const context = (changes: Partial<CellContext> = {}): CellContext => ({
  myUserId: ME,
  flat: false,
  dividerSeq: null,
  unreadAtOpen: 0,
  otherReadSeq: 0,
  otherDeliveredSeq: 0,
  quotes: new Map(),
  threadHasNew: () => false,
  ...changes,
});

const build = (rows: Row[], changes: Partial<CellContext> = {}) => buildMessageCells(rows, context(changes)).cells;

/**
 * F4, 03/11: a send called the row drawer 147 times (≈50 cells on screen, three
 * times) to redraw 2 rows. Each cell now carries what changes its look, and an
 * equal cell keeps its object: FlashList redraws only the cells that changed.
 */
describe('keepCells', () => {
  it('a send keeps every earlier cell but the one above it, whose next changed', () => {
    // Arrange
    const history = [message(1), message(2), message(3, { senderId: ME })];
    const before = build(history);
    // Act
    const after = keepCells(before, build([...history, pending('nuevo')]));
    // Assert
    expect(after[0]).toBe(before[0]);
    expect(after[1]).toBe(before[1]);
    expect(after[2]).not.toBe(before[2]);
    expect(after[2].next).toEqual(pending('nuevo'));
    expect(after).toHaveLength(4);
  });

  it('nothing changed: the same array, so the list does not even re-lay out', () => {
    // Arrange
    const rows = [message(1), message(2)];
    const before = build(rows);
    // Act
    const after = keepCells(before, build([...rows]));
    // Assert
    expect(after).toBe(before);
  });

  it('the echo of the server replaces only the pending cell (same key, new row)', () => {
    // Arrange
    const history = [message(1)];
    const before = build([...history, pending('ck-2')]);
    // Act
    const after = keepCells(before, build([...history, message(2, { senderId: ME, clientKey: 'ck-2' })]));
    // Assert
    expect(after[0]).not.toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].delivery).toBe('sent');
  });

  it('a new read mark redraws only my cells whose state changed', () => {
    // Arrange
    const rows = [message(1, { senderId: ME }), message(2, { senderId: ME }), message(3)];
    const before = build(rows, { otherReadSeq: 1, otherDeliveredSeq: 1 });
    // Act
    const after = keepCells(before, build(rows, { otherReadSeq: 2, otherDeliveredSeq: 2 }));
    // Assert
    expect(after[0]).toBe(before[0]);
    expect(after[1]).not.toBe(before[1]);
    expect(after[1].delivery).toBe('read');
    expect(after[2]).toBe(before[2]);
  });

  it('a first render has nothing to keep', () => {
    // Arrange
    const cells = build([message(1)]);
    // Act
    const kept = keepCells(undefined, cells);
    // Assert
    expect(kept).toBe(cells);
  });

  it('a removed row (deleted, or the window moved) changes the array', () => {
    // Arrange
    const before = build([message(1), message(2)]);
    // Act
    const after = keepCells(before, build([message(2)]));
    // Assert
    expect(after).not.toBe(before);
    expect(after).toHaveLength(1);
  });
});

describe('buildMessageCells', () => {
  it('the unread divider cuts the block: the first unread has no previous, the one above no next', () => {
    // Arrange
    const rows = [message(1), message(2), message(3)];
    // Act
    const cells = build(rows, { dividerSeq: 2, unreadAtOpen: 2 });
    // Assert
    expect(cells[0].next).toBeUndefined();
    expect(cells[1].previous).toBeUndefined();
    expect(cells[1].unreadCount).toBe(2);
    expect(cells[2].unreadCount).toBeUndefined();
  });

  it('an album: its first cell draws all the photos, the others are hidden', () => {
    // Arrange
    const media = { mediaId: 'x', mime: 'image/jpeg', album: 'al1abcdef' };
    const rows = [message(1, { kind: 'image', media }), message(2, { kind: 'image', media })];
    // Act
    const cells = build(rows);
    // Assert
    expect(cells[0].album?.map((one) => one.seq)).toEqual([1, 2]);
    expect(cells[1].hidden).toBe(true);
  });

  it('the flat (Slack) rows keep each photo apart', () => {
    // Arrange
    const media = { mediaId: 'x', mime: 'image/jpeg', album: 'al1abcdef' };
    const rows = [message(1, { kind: 'image', media }), message(2, { kind: 'image', media })];
    // Act
    const cells = build(rows, { flat: true });
    // Assert
    expect(cells.map((cell) => [cell.album, cell.hidden])).toEqual([[undefined, false], [undefined, false]]);
  });

  it('two of my stickers in a row: one cell draws the pair with both ticks', () => {
    // Arrange
    const sticker = (seq: number) => message(seq, { senderId: ME, kind: 'sticker', media: { mediaId: `s${seq}`, mime: 'image/webp', url: `https://x/s${seq}.webp` } });
    // Act
    const cells = build([sticker(1), sticker(2)], { otherReadSeq: 1, otherDeliveredSeq: 2 });
    // Assert
    expect(cells[0].pair?.map((one) => one.seq)).toEqual([1, 2]);
    expect(cells[0].pairDelivery).toEqual(['read', 'delivered']);
    expect(cells[1].hidden).toBe(true);
  });

  it('a day chip on the first row of a new day only', () => {
    // Arrange
    const rows = [message(1, { at: '2026-11-02T15:00:00.000Z' }), message(2, { at: '2026-11-03T15:00:00.000Z' }), message(3, { at: '2026-11-03T15:01:00.000Z' })];
    // Act
    const cells = build(rows);
    // Assert
    expect(cells[0].dayLabel).toBeDefined();
    expect(cells[1].dayLabel).toBeDefined();
    expect(cells[2].dayLabel).toBeUndefined();
  });

  it('a notice deleted for everyone is hidden; a pending row is mine and pending', () => {
    // Arrange
    const notice = message(1, { kind: 'system', deletedAt: '2026-11-03T07:00:00.000Z' });
    // Act
    const cells = build([notice, pending('k')]);
    // Assert
    expect(cells[0].hidden).toBe(true);
    expect(cells[1]).toMatchObject({ mine: true, delivery: 'pending', quoted: null });
  });

  it('the quote, the greeting and a thread with news come with their cell', () => {
    // Arrange
    const joined = message(1, { kind: 'system', system: { evento: 'se-unio' } as ChatMessage['system'] });
    const root = message(2, { hilo: { respuestas: 3 } as ChatMessage['hilo'] });
    const quote = { autor: 'Ana', texto: 'hola' };
    // Act
    const cells = build([joined, root, message(3, { replyToSeq: 2 })], { quotes: new Map([[3, quote]]), threadHasNew: (seq) => seq === 2 });
    // Assert
    expect(cells[0].greets).toBe(true);
    expect(cells[1].threadHasNew).toBe(true);
    expect(cells[2].quoted).toBe(quote);
  });

  it('an empty conversation has no cells', () => {
    // Arrange / Act
    const { cells, bySeq } = buildMessageCells([], context());
    // Assert
    expect(cells).toEqual([]);
    expect(bySeq.size).toBe(0);
  });
});

describe('MessageCell', () => {
  it('is built from the row alone: no index, so a prepended page does not redraw what is on screen', () => {
    // Arrange
    const before = build([message(5), message(6)]);
    // Act
    const after = keepCells(before, build([message(3), message(4), message(5), message(6)]));
    // Assert
    const unchanged: MessageCell = after[3];
    expect(unchanged).toBe(before[1]);
    expect(after[2]).not.toBe(before[0]);
  });
});

describe('cellKey / cellType', () => {
  it('a cell keeps its row\'s key and type: pending and confirmed share the cell', () => {
    // Arrange
    const [waiting] = build([pending('ck-9')]);
    const [confirmed] = build([message(9, { senderId: ME, clientKey: 'ck-9', kind: 'image', media: { mediaId: 'p', mime: 'image/jpeg' } })]);
    // Act / Assert
    expect(cellKey(waiting)).toBe(cellKey(confirmed));
    expect(cellType(confirmed)).toBe('media');
  });
});
