import { describe, expect, it } from 'vitest';
import { windowRows } from './messageWindowRows';

const message = (seq: number, extra: Record<string, unknown> = {}) => ({ chatId: 'c1', seq, senderId: 'ana', clientKey: `k${seq}`, kind: 'text', body: `m${seq}`, at: '2026-10-22T12:00:00.000Z', ...extra }) as never;
const pending = { clientKey: 'p1', body: 'hola', queuedAt: '2026-10-22T12:00:00.000Z', pending: true } as never;

/** Pending 44 (José, 22/10): the rows on screen while a window is open. */
describe('windowRows', () => {
  it('the window alone while there is more below, without thread-only replies', () => {
    const rows = windowRows({ messages: [message(10), message(11, { hiloDe: 10 }), message(12)], target: 10, hasOlder: true, hasNewer: true }, [message(90), pending]);
    expect(rows.map((row) => ('seq' in row ? row.seq : row.clientKey))).toEqual([10, 12]);
  });

  it('once it reached the end, the live rows after it continue below, pending ones included', () => {
    const rows = windowRows({ messages: [message(88), message(89)], target: 88, hasOlder: true, hasNewer: false }, [message(89), message(90), pending]);
    expect(rows.map((row) => ('seq' in row ? row.seq : row.clientKey))).toEqual([88, 89, 90, 'p1']);
  });
});
