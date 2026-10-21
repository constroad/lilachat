import { describe, expect, it } from 'vitest';
import { lastPanelTab } from './panelTab.js';

/** José, 21/10: «que recuerde si lo último que abrí es stickers, la siguiente vez que lo abra sea stickers; y así guiños o emojis». */
describe('lastPanelTab', () => {
  const all = ['emoji', 'stickers', 'winks'] as const;
  it('opens on the tab used last, if this chat offers it', () => {
    expect(lastPanelTab('stickers', all)).toBe('stickers');
    expect(lastPanelTab('winks', all)).toBe('winks');
  });
  it('falls back to emoji: nothing stored, something unknown, or a tab this chat does not have (a secret chat has no stickers)', () => {
    expect(lastPanelTab(null, all)).toBe('emoji');
    expect(lastPanelTab('gifs', all)).toBe('emoji');
    expect(lastPanelTab('stickers', ['emoji'])).toBe('emoji');
  });
});
