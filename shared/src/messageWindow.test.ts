import { describe, expect, it } from 'vitest';
import { extendWindow, joinsLive, mergeIntoLive, newSinceWindow, nextWindowPage, targetStatus, windowFromPage, type MessageWindow } from './messageWindow.js';

type Row = { seq: number; senderId: string; body?: string; hiloDe?: number; enElChat?: boolean; deletedAt?: string };
const row = (seq: number, extra: Partial<Row> = {}): Row => ({ seq, senderId: seq % 2 ? 'yo' : 'ana', body: `m${seq}`, ...extra });
const rows = (from: number, to: number) => Array.from({ length: to - from + 1 }, (_, index) => row(from + index));
const window = (from: number, to: number, flags: Partial<MessageWindow<Row>> = {}): MessageWindow<Row> => ({ messages: rows(from, to), target: from, hasOlder: true, hasNewer: true, ...flags });

/** Pending 44 (José, 22/10): opening an old message with its context, like WhatsApp Web and Telegram. */
describe('windowFromPage', () => {
  it('a window from the server’s answer, ordered, with its flags', () => {
    const made = windowFromPage({ messages: [row(12), row(10), row(11)], hasOlder: false, hasNewer: true }, 11);
    expect(made).toEqual({ messages: [row(10), row(11), row(12)], target: 11, hasOlder: false, hasNewer: true });
  });

  it('an empty answer is no window', () => {
    expect(windowFromPage({ messages: [], hasOlder: false, hasNewer: false }, 5)).toBeNull();
  });
});

describe('targetStatus', () => {
  it('shown, a thread reply not sent to the chat, or missing', () => {
    expect(targetStatus(window(1, 5), 3)).toBe('shown');
    expect(targetStatus({ ...window(1, 5), messages: [row(1), row(2), row(3, { hiloDe: 1 })] }, 3)).toBe('thread');
    expect(targetStatus({ ...window(1, 5), messages: [row(3, { hiloDe: 1, enElChat: true })] }, 3)).toBe('shown');
    expect(targetStatus({ ...window(1, 5), messages: [row(3, { deletedAt: '2026-10-22' })] }, 3)).toBe('shown');
    expect(targetStatus(window(1, 5), 9)).toBe('missing');
  });
});

describe('nextWindowPage', () => {
  it('up from the first, down from the last, nothing when that side is over', () => {
    expect(nextWindowPage(window(10, 20), 'older')).toEqual({ beforeSeq: 10 });
    expect(nextWindowPage(window(10, 20), 'newer')).toEqual({ afterSeq: 20 });
    expect(nextWindowPage(window(10, 20, { hasOlder: false }), 'older')).toBeNull();
    expect(nextWindowPage({ ...window(10, 20), messages: [] }, 'newer')).toBeNull();
  });
});

describe('extendWindow', () => {
  it('a page up goes before, a page down after, and each says whether there is more', () => {
    const up = extendWindow(window(10, 20), 'older', { messages: rows(5, 9), more: false });
    expect(up.messages.map((one) => one.seq)).toEqual(rows(5, 20).map((one) => one.seq));
    expect(up.hasOlder).toBe(false);
    const down = extendWindow(window(10, 20), 'newer', { messages: rows(21, 25), more: true });
    expect(down.messages.at(-1)?.seq).toBe(25);
    expect(down.hasNewer).toBe(true);
  });

  it('an empty page closes that side and keeps the same messages', () => {
    const before = window(10, 20);
    const after = extendWindow(before, 'newer', { messages: [], more: false });
    expect(after.messages).toBe(before.messages);
    expect(after.hasNewer).toBe(false);
  });
});

describe('joinsLive', () => {
  it('the window touches or overlaps the live end, or the server says nothing is newer', () => {
    expect(joinsLive(window(10, 20), 21)).toBe(true);
    expect(joinsLive(window(10, 20), 15)).toBe(true);
    expect(joinsLive(window(10, 20), 22)).toBe(false);
    expect(joinsLive(window(10, 20, { hasNewer: false }), 40)).toBe(true);
    expect(joinsLive(window(10, 20), null)).toBe(false);
  });
});

describe('mergeIntoLive', () => {
  it('the live list starts where the window started, without repeating seqs', () => {
    const merged = mergeIntoLive(rows(18, 30), window(10, 20));
    expect(merged.map((one) => one.seq)).toEqual(rows(10, 30).map((one) => one.seq));
  });
});

describe('newSinceWindow', () => {
  it('only others’ messages after the window opened count', () => {
    const live = [row(30), row(31), row(32), row(33), { seq: Number.MAX_SAFE_INTEGER, senderId: 'ana' }];
    expect(newSinceWindow(live, 30, 'yo')).toBe(1);
  });
});
