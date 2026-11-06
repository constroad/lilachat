import { describe, expect, it } from 'vitest';
import { replyRowOf } from './threadReply';

const sent = (seq: number) => ({ seq });
const pending = { seq: 7, pending: true };

describe('replyRowOf', () => {
  it('finds the reply in the rows as they are now', () => {
    expect(replyRowOf([sent(1), sent(2), sent(3)], 3)).toBe(2);
  });

  it('a reply that left the list has no row: the late scroll asks for nothing (index 6 of 0 to 5, 06/11)', () => {
    // Arrange: seven rows when the thread opened, six when the second pass runs.
    const rows = [1, 2, 3, 4, 5, 6].map(sent);
    // Act and assert
    expect(replyRowOf(rows, 7)).toBe(-1);
  });

  it('a reply still sending is not the one a notice points to', () => {
    expect(replyRowOf([sent(1), pending], 7)).toBe(-1);
  });

  it('with no reply asked there is nothing to find', () => {
    expect(replyRowOf([sent(1)], undefined)).toBe(-1);
  });
});
