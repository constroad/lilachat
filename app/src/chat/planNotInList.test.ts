import { describe, expect, it } from 'vitest';
import { planNotInList } from './planNotInList';

/**
 * B4 E2E (25/10): opening a channel from a notice placed the list twice (onLoad, then
 * once it settled). The first call asked the server for the window around the message;
 * the second found that request in flight and printed «Ese mensaje está más arriba»,
 * which nothing clears, although the message was found a moment later.
 */
describe('planNotInList', () => {
  it('fetches the window around the message when nothing is in flight', () => {
    expect(planNotInList({ encrypted: false, busy: false, fetchingSeq: null, seq: 28 })).toBe('fetch');
  });

  it('ignores the repeat for the message whose window is already being fetched', () => {
    expect(planNotInList({ encrypted: false, busy: true, fetchingSeq: 28, seq: 28 })).toBe('ignore');
  });

  it('reports when the window in flight is for another message', () => {
    expect(planNotInList({ encrypted: false, busy: true, fetchingSeq: 12, seq: 28 })).toBe('report');
  });

  it('reports when a page of the open window is loading (no window to ask for yet)', () => {
    expect(planNotInList({ encrypted: false, busy: true, fetchingSeq: null, seq: 28 })).toBe('report');
  });

  it('reports in an encrypted chat, which has no server window to ask for', () => {
    expect(planNotInList({ encrypted: true, busy: false, fetchingSeq: null, seq: 28 })).toBe('report');
    expect(planNotInList({ encrypted: true, busy: true, fetchingSeq: 28, seq: 28 })).toBe('report');
  });

  it('treats seq 0 as a real target, not as «nothing in flight»', () => {
    expect(planNotInList({ encrypted: false, busy: true, fetchingSeq: 0, seq: 0 })).toBe('ignore');
    expect(planNotInList({ encrypted: false, busy: true, fetchingSeq: 0, seq: 5 })).toBe('report');
  });
});
