import { describe, expect, it } from 'vitest';
import { windowOnScreen } from './windowOnScreen';

const message = (seq: number, extra: Record<string, unknown> = {}) => ({ chatId: 'c1', seq, senderId: 'ana', clientKey: `k${seq}`, kind: 'text', body: `m${seq}`, at: '2026-10-22T12:00:00.000Z', ...extra });

/** Pending 44: what the conversation shows with a window open. */
describe('windowOnScreen', () => {
  it('the window alone while there is more below, without thread-only replies', () => {
    const shown = windowOnScreen({ messages: [message(10), message(11, { hiloDe: 10 }), message(12)], target: 10, hasOlder: true, hasNewer: true }, [message(90)]);
    expect(shown.map((one) => one.seq)).toEqual([10, 12]);
  });

  it('once it reached the end, the live list continues below it', () => {
    const shown = windowOnScreen({ messages: [message(88), message(89)], target: 88, hasOlder: true, hasNewer: false }, [message(89), message(90)]);
    expect(shown.map((one) => one.seq)).toEqual([88, 89, 90]);
  });
});
