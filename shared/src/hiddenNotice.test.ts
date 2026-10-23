import { describe, expect, it } from 'vitest';
import { isHiddenNotice } from './hiddenNotice.js';

describe('isHiddenNotice', () => {
  it('hides a notice deleted for everyone', () => {
    // Act / Assert
    expect(isHiddenNotice({ kind: 'system', deletedAt: '2026-10-22T19:40:00Z' })).toBe(true);
  });

  it('keeps a live notice and any message a person wrote, deleted or not', () => {
    // Act / Assert
    expect(isHiddenNotice({ kind: 'system' })).toBe(false);
    expect(isHiddenNotice({ kind: 'system', deletedAt: null })).toBe(false);
    expect(isHiddenNotice({ kind: 'text', deletedAt: '2026-10-22T19:40:00Z' })).toBe(false);
    expect(isHiddenNotice({})).toBe(false);
  });
});
