import { describe, expect, it } from 'vitest';
import { downButtonCount, followsMyNewRow, unreadBelow } from './followMine';

describe('followsMyNewRow (José, 22/10)', () => {
  it('a new last row of mine takes the list down', () => {
    expect(followsMyNewRow(null, 'k2')).toBe(true);
    expect(followsMyNewRow('k1', 'k2')).toBe(true);
  });

  it('opening the chat, the same row, someone else\'s or an empty chat does not', () => {
    expect(followsMyNewRow(undefined, 'k1')).toBe(false);
    expect(followsMyNewRow('k2', 'k2')).toBe(false);
    expect(followsMyNewRow('k2', null)).toBe(false);
    expect(followsMyNewRow('k2', undefined)).toBe(false);
  });
});

/** José, 22/10: entering a chat, the «bajar» button did not say how many unread messages wait below. */
describe('unreadBelow', () => {
  const messages = [
    { seq: 4, senderId: 'ana' },
    { seq: 5, senderId: 'yo' },
    { seq: 6, senderId: 'ana' },
    { seq: 7, senderId: 'ana', kind: 'system' },
    { seq: 8, senderId: 'beto' },
  ];
  it('the messages of others after what I had read, without notices', () => {
    expect(unreadBelow(messages, 'yo', 4)).toBe(2);
  });
  it('nothing after it, or only mine, is zero', () => {
    expect(unreadBelow(messages, 'yo', 8)).toBe(0);
    expect(unreadBelow([{ seq: 9, senderId: 'yo' }], 'yo', 0)).toBe(0);
  });
});

describe('downButtonCount (22/10)', () => {
  it('at the end there is no button and no number', () => {
    expect(downButtonCount({ away: false, reachedEnd: false, unreadSinceOpen: 9, arrivedWhileAway: 2 })).toBe(0);
  });
  it('opened at the first unread: the unread since entering, until the end is reached once', () => {
    expect(downButtonCount({ away: true, reachedEnd: false, unreadSinceOpen: 25, arrivedWhileAway: 3 })).toBe(25);
  });
  it('after reaching the end: what arrived while reading further up', () => {
    expect(downButtonCount({ away: true, reachedEnd: true, unreadSinceOpen: 25, arrivedWhileAway: 3 })).toBe(3);
  });
});
