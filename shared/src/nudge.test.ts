import { describe, expect, it } from 'vitest';
import { nudgeToShake } from './nudge.js';

/** The MSN nudge (backlog 3): it shakes the open chat when the OTHER person sends it. */
describe('nudgeToShake', () => {
  const messages = [
    { seq: 10, kind: 'text', senderId: 'ana' },
    { seq: 11, kind: 'zumbido', senderId: 'ana' },
    { seq: 12, kind: 'zumbido', senderId: 'yo' },
  ];

  it('a new nudge from the other person shakes once', () => {
    expect(nudgeToShake(messages, 'yo', 10)).toBe(11);
    expect(nudgeToShake(messages, 'yo', 11)).toBeNull();
  });

  it('my own nudge and the old ones (already there on opening) do not shake', () => {
    expect(nudgeToShake([{ seq: 12, kind: 'zumbido', senderId: 'yo' }], 'yo', 11)).toBeNull();
    expect(nudgeToShake(messages, 'yo', 12)).toBeNull();
  });
});
