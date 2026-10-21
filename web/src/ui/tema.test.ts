import { describe, expect, it } from 'vitest';
import { isDark, readThemeChoice, THEME_KEY } from './tema';

describe('the theme', () => {
  it('«Sistema» follows the operating system; the others are fixed', () => {
    expect(isDark('system', true)).toBe(true);
    expect(isDark('system', false)).toBe(false);
    expect(isDark('dark', false)).toBe(true);
    expect(isDark('light', true)).toBe(false);
  });

  it('reads the saved choice, «Sistema» when there is none or it is unknown or the storage fails', () => {
    expect(readThemeChoice({ getItem: (key) => (key === THEME_KEY ? 'dark' : null) })).toBe('dark');
    expect(readThemeChoice({ getItem: () => null })).toBe('system');
    expect(readThemeChoice({ getItem: () => 'purple' })).toBe('system');
    expect(readThemeChoice({ getItem: () => { throw new Error('blocked'); } })).toBe('system');
  });
});
