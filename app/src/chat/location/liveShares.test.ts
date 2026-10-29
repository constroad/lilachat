import { describe, expect, it } from 'vitest';
import { activeShares, withShare, withoutShare, type LiveShare } from './liveShares';

const NOW = new Date('2026-10-28T20:00:00.000Z');
const share = (seq: number, liveUntil: string, chatId = '6720f0a1b2c3d4e5f6a7b8c9'): LiveShare => ({ chatId, seq, liveUntil });

describe('live shares of this phone', () => {
  it('keeps only the shares that still last', () => {
    const shares = [share(1, '2026-10-28T20:15:00.000Z'), share(2, '2026-10-28T19:59:59.000Z'), share(3, 'not a date')];
    expect(activeShares(shares, NOW).map((one) => one.seq)).toEqual([1]);
  });

  it('adds a share once, replacing the same message', () => {
    const first = withShare([], share(4, '2026-10-28T20:15:00.000Z'));
    const again = withShare(first, share(4, '2026-10-28T21:00:00.000Z'));
    expect(again).toEqual([share(4, '2026-10-28T21:00:00.000Z')]);
  });

  it('tells apart the same seq in another chat', () => {
    const shares = withShare([share(4, '2026-10-28T20:15:00.000Z')], share(4, '2026-10-28T20:15:00.000Z', '6720f0a1b2c3d4e5f6a7b8d0'));
    expect(shares).toHaveLength(2);
    expect(withoutShare(shares, '6720f0a1b2c3d4e5f6a7b8c9', 4)).toEqual([share(4, '2026-10-28T20:15:00.000Z', '6720f0a1b2c3d4e5f6a7b8d0')]);
  });

  it('reads anything but a list as no shares', () => {
    expect(activeShares(null, NOW)).toEqual([]);
    expect(activeShares([{ chatId: 3 }] as unknown, NOW)).toEqual([]);
  });
});
