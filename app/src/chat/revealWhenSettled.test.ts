import { describe, expect, it } from 'vitest';
import { MAX_HIDDEN_MS, RevealWhenSettled, SETTLE_MS } from './revealWhenSettled';

/**
 * José, 21/10: «otra vez estoy viendo el salto al abrir los chats». The list was
 * shown after its first layout while FlashList was still measuring the rows
 * above (content 1761 → 3157 px), and the position correction showed on screen.
 */
describe('RevealWhenSettled', () => {
  it('waits for the first layout, then for the height to stay still', () => {
    const reveal = new RevealWhenSettled(0);
    expect(reveal.check(100)).toBe('wait');
    reveal.load(200);
    reveal.size(1761, 210);
    expect(reveal.check(210 + SETTLE_MS - 1)).toBe('wait');
    reveal.size(3157, 300);
    expect(reveal.check(300 + SETTLE_MS - 1)).toBe('wait');
    expect(reveal.check(300 + SETTLE_MS)).toBe('reveal');
  });

  it('the same height again does not restart the wait', () => {
    const reveal = new RevealWhenSettled(0);
    reveal.load(100);
    reveal.size(3157, 110);
    reveal.size(3157, 200);
    expect(reveal.check(110 + SETTLE_MS)).toBe('reveal');
  });

  it('never stays hidden longer than the cap, even without a layout', () => {
    const reveal = new RevealWhenSettled(0);
    expect(reveal.check(MAX_HIDDEN_MS)).toBe('reveal');
    const growing = new RevealWhenSettled(0);
    growing.load(10);
    for (let t = 20; t < MAX_HIDDEN_MS; t += 50) growing.size(t, t);
    expect(growing.check(MAX_HIDDEN_MS)).toBe('reveal');
  });
});
